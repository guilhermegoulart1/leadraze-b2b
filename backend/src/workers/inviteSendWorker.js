// backend/src/workers/inviteSendWorker.js

const db = require('../config/database');
const unipileClient = require('../config/unipile');
const inviteQueueService = require('../services/inviteQueueService');
const TemplateProcessor = require('../utils/templateProcessor');

/**
 * Invite Send Worker
 *
 * Processa envio de convites do LinkedIn agendados na fila:
 * - Busca convites com scheduled_for <= NOW
 * - Envia via Unipile API
 * - Atualiza status para 'sent'
 */

const PROCESSING_INTERVAL = 2 * 60 * 1000; // 2 minutos
const BATCH_SIZE = 5; // Processar até 5 convites por vez
let isProcessing = false;

// Logging helper
const LOG_PREFIX = '📤 [INVITE-SEND]';
const log = {
  info: (msg, data) => console.log(`${LOG_PREFIX} ${msg}`, data || ''),
  success: (msg, data) => console.log(`${LOG_PREFIX} ✅ ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`${LOG_PREFIX} ⚠️ ${msg}`, data || ''),
  error: (msg, data) => console.error(`${LOG_PREFIX} ❌ ${msg}`, data || ''),
  step: (step, msg, data) => console.log(`${LOG_PREFIX} [${step}] ${msg}`, data || ''),
  divider: () => console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`),
};

/**
 * Get campaign AI agent's initial approach message
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<string|null>} Initial approach message
 */
async function getCampaignMessage(campaignId) {
  const result = await db.query(
    `SELECT ai.initial_approach
     FROM campaigns c
     LEFT JOIN ai_agents ai ON c.ai_agent_id = ai.id
     WHERE c.id = $1`,
    [campaignId]
  );

  return result.rows[0]?.initial_approach || null;
}

/**
 * Get opportunity data for template processing
 * @param {string} opportunityId - Opportunity ID
 * @returns {Promise<object|null>} Opportunity and contact data
 */
async function getOpportunityData(opportunityId) {
  const result = await db.query(
    `SELECT o.id, o.title as name, c.name as contact_name, c.title, c.company,
            c.city as location, c.industry, c.headline, c.about as summary
     FROM opportunities o
     LEFT JOIN contacts c ON o.contact_id = c.id
     WHERE o.id = $1`,
    [opportunityId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    name: row.contact_name || row.name,
    title: row.title,
    company: row.company,
    location: row.location,
    industry: row.industry,
    headline: row.headline,
    summary: row.summary
  };
}

/**
 * Get campaign invite expiry days
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<number>} Expiry days
 */
async function getInviteExpiryDays(campaignId) {
  const result = await db.query(
    `SELECT invite_expiry_days FROM campaign_review_config WHERE campaign_id = $1`,
    [campaignId]
  );

  return result.rows[0]?.invite_expiry_days || 7;
}

/**
 * Process a single invite
 * @param {object} invite - Invite data from queue
 * @returns {Promise<object>} Result
 */
async function processSingleInvite(invite) {
  log.info(`───────────────────────────────────────────────────────────`);
  log.info(`PROCESSANDO CONVITE`);
  log.info(`   Opportunity: ${invite.opportunity_name}`);
  log.info(`   Opportunity ID: ${invite.opportunity_id}`);
  log.info(`   Queue ID: ${invite.id}`);
  log.info(`   Campaign: ${invite.campaign_name}`);
  log.info(`   LinkedIn Profile ID: ${invite.linkedin_profile_id}`);
  log.info(`   Unipile Account ID: ${invite.unipile_account_id}`);

  try {
    // 1. Get campaign message
    log.step('1', 'Buscando mensagem de convite...');
    const initialApproach = await getCampaignMessage(invite.campaign_id);

    let inviteMessage = null;
    if (initialApproach) {
      // Get opportunity data for template processing
      const opportunityData = await getOpportunityData(invite.opportunity_id);
      if (opportunityData) {
        const templateData = TemplateProcessor.extractLeadData(opportunityData);
        inviteMessage = TemplateProcessor.processTemplate(initialApproach, templateData);

        // LinkedIn limits invite messages to 300 characters
        if (inviteMessage && inviteMessage.length > 300) {
          log.warn(`Mensagem truncada: ${inviteMessage.length} -> 300 chars`);
          inviteMessage = inviteMessage.substring(0, 297) + '...';
        }

        log.success(`Mensagem processada (${inviteMessage?.length || 0} chars)`);
        log.info(`   Preview: "${inviteMessage?.substring(0, 60)}..."`);
      }
    } else {
      log.info(`   Sem mensagem de convite (convite sem nota)`);
    }

    // 2. Send invite via Unipile API
    log.step('2', 'Enviando convite via Unipile API...');

    const inviteParams = {
      account_id: invite.unipile_account_id,
      user_id: invite.linkedin_profile_id
    };

    if (inviteMessage) {
      inviteParams.message = inviteMessage;
    }

    const result = await unipileClient.users.sendConnectionRequest(inviteParams);
    log.success('Convite enviado via API Unipile!');
    log.info(`   Response:`, JSON.stringify(result).substring(0, 100));

    // 3. Mark as sent
    log.step('3', 'Marcando convite como enviado...');
    const expiryDays = await getInviteExpiryDays(invite.campaign_id);
    await inviteQueueService.markInviteAsSent(invite.id, invite.opportunity_id, expiryDays);

    log.success(`CONVITE ENVIADO COM SUCESSO!`);
    log.info(`   Opportunity: ${invite.opportunity_name}`);
    log.info(`───────────────────────────────────────────────────────────`);

    return { success: true, opportunityId: invite.opportunity_id, opportunityName: invite.opportunity_name };

  } catch (error) {
    log.error(`Erro ao enviar convite: ${error.message}`);

    // Check for specific error types
    const errorMessage = error.response?.data?.detail || error.message;
    const errorType = error.response?.data?.type || 'unknown';

    log.error(`   Error type: ${errorType}`);
    log.error(`   Error detail: ${errorMessage}`);

    // Mark as failed in the queue
    try {
      await db.query(
        `UPDATE campaign_invite_queue
         SET status = 'failed', updated_at = NOW()
         WHERE id = $1`,
        [invite.id]
      );

      // Find the first stage (position 0) for this opportunity's pipeline to mark as failed
      await db.query(
        `UPDATE opportunities SET updated_at = NOW() WHERE id = $1`,
        [invite.opportunity_id]
      );

      log.warn(`Convite marcado como falha no banco`);
    } catch (dbError) {
      log.error(`Erro ao marcar convite como falha: ${dbError.message}`);
    }

    log.info(`───────────────────────────────────────────────────────────`);

    return { success: false, opportunityId: invite.opportunity_id, error: errorMessage };
  }
}

/**
 * Process all scheduled invites that are ready
 */
async function processScheduledInvites() {
  if (isProcessing) {
    log.warn('Já está processando convites, pulando...');
    return;
  }

  isProcessing = true;

  try {
    log.divider();
    log.info('VERIFICAÇÃO DE CONVITES AGENDADOS INICIADA');
    log.info(`Timestamp: ${new Date().toISOString()}`);
    log.divider();

    // Get scheduled invites ready to send
    log.step('1', 'Buscando convites agendados prontos para envio...');
    const scheduledInvites = await inviteQueueService.getScheduledInvites(BATCH_SIZE);

    if (scheduledInvites.length === 0) {
      log.success('Nenhum convite pronto para envio');
      log.divider();
      return;
    }

    log.info(`Encontrados ${scheduledInvites.length} convites prontos para envio:`);
    scheduledInvites.forEach((inv, i) => {
      log.info(`   ${i + 1}. ${inv.opportunity_name} (scheduled_for: ${inv.scheduled_for})`);
    });

    // Process each invite
    log.step('2', 'Processando convites...');
    let sent = 0;
    let failed = 0;

    for (const invite of scheduledInvites) {
      const result = await processSingleInvite(invite);

      if (result.success) {
        sent++;
      } else {
        failed++;
      }

      // Add delay between invites to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds
    }

    log.divider();
    log.success('PROCESSAMENTO DE CONVITES CONCLUÍDO');
    log.info(`   Enviados com sucesso: ${sent}`);
    log.info(`   Falhas: ${failed}`);
    log.info(`   Total processados: ${scheduledInvites.length}`);
    log.divider();

  } catch (error) {
    log.error(`Erro no processador de convites: ${error.message}`);
    console.error(error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Start the invite send processor
 */
function startProcessor() {
  log.divider();
  log.info('PROCESSADOR DE ENVIO DE CONVITES INICIADO');
  log.info(`Intervalo: ${PROCESSING_INTERVAL / 1000} segundos (${PROCESSING_INTERVAL / 1000 / 60} minutos)`);
  log.info(`Batch size: ${BATCH_SIZE} convites por ciclo`);
  log.divider();

  // Process immediately on start
  processScheduledInvites();

  // Then process at interval
  setInterval(() => {
    processScheduledInvites();
  }, PROCESSING_INTERVAL);
}

/**
 * Manual trigger for testing
 */
async function runOnce() {
  log.info('Executando processamento manual de convites agendados...');
  await processScheduledInvites();
}

module.exports = {
  startProcessor,
  processScheduledInvites,
  runOnce,
  processSingleInvite
};
