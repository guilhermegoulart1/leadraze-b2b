// backend/src/workers/inviteExpirationWorker.js

const db = require('../config/database');
const unipileClient = require('../config/unipile');
const inviteQueueService = require('../services/inviteQueueService');
const notificationService = require('../services/notificationService');

/**
 * Invite Expiration Worker
 *
 * Processa convites expirados:
 * - Retira convite via Unipile (se configurado)
 * - Aplica tag "Convite não aceito"
 * - Distribui via round robin
 * - Notifica usuário responsável
 */

const PROCESSING_INTERVAL = 60 * 60 * 1000; // 1 hora
let isProcessing = false;

// Logging helper
const LOG_PREFIX = '⏰ [EXPIRATION]';
const log = {
  info: (msg, data) => console.log(`${LOG_PREFIX} ${msg}`, data || ''),
  success: (msg, data) => console.log(`${LOG_PREFIX} ✅ ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`${LOG_PREFIX} ⚠️ ${msg}`, data || ''),
  error: (msg, data) => console.error(`${LOG_PREFIX} ❌ ${msg}`, data || ''),
  step: (step, msg, data) => console.log(`${LOG_PREFIX} [${step}] ${msg}`, data || ''),
  divider: () => console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`),
};

/**
 * Get the "Convite não aceito" tag ID
 * @param {string} accountId - Account ID (not used for global tags)
 * @returns {Promise<string|null>} Tag ID
 */
async function getExpiredInviteTagId() {
  const result = await db.query(
    `SELECT id FROM tags WHERE name = 'Convite não aceito' LIMIT 1`
  );

  return result.rows[0]?.id || null;
}

/**
 * Apply tag to lead
 * @param {string} leadId - Lead ID
 * @param {string} tagId - Tag ID
 */
async function applyTagToLead(leadId, tagId) {
  if (!tagId) return;

  // First get contact_id from lead if exists
  const leadResult = await db.query(
    `SELECT l.id, c.id as contact_id
     FROM leads l
     LEFT JOIN contacts c ON c.linkedin_profile_id = l.linkedin_profile_id
     WHERE l.id = $1`,
    [leadId]
  );

  const contactId = leadResult.rows[0]?.contact_id;

  if (contactId) {
    await db.query(
      `INSERT INTO contact_tags (contact_id, tag_id)
       VALUES ($1, $2)
       ON CONFLICT (contact_id, tag_id) DO NOTHING`,
      [contactId, tagId]
    );
    console.log(`🏷️ Tag aplicada ao contato ${contactId}`);
  }
}

/**
 * Get next user for round robin distribution
 * @param {string} sectorId - Sector ID
 * @param {string[]} userIds - User IDs in rotation
 * @param {string} accountId - Account ID
 * @returns {Promise<object|null>} Next user
 */
async function getNextUserForDistribution(sectorId, userIds, accountId) {
  if (!userIds || userIds.length === 0) {
    return null;
  }

  // Get current rotation state from sector or campaign
  const sectorResult = await db.query(
    `SELECT last_assigned_user_id FROM sectors WHERE id = $1 AND account_id = $2`,
    [sectorId, accountId]
  );

  const lastAssignedUserId = sectorResult.rows[0]?.last_assigned_user_id;

  // Find next user in rotation
  let nextIndex = 0;
  if (lastAssignedUserId) {
    const lastIndex = userIds.indexOf(lastAssignedUserId);
    if (lastIndex !== -1) {
      nextIndex = (lastIndex + 1) % userIds.length;
    }
  }

  const nextUserId = userIds[nextIndex];

  // Get user details
  const userResult = await db.query(
    `SELECT id, name, email, avatar_url FROM users WHERE id = $1`,
    [nextUserId]
  );

  if (userResult.rows.length === 0) {
    return null;
  }

  // Update sector's last assigned user
  if (sectorId) {
    await db.query(
      `UPDATE sectors SET last_assigned_user_id = $1 WHERE id = $2`,
      [nextUserId, sectorId]
    );
  }

  return userResult.rows[0];
}

/**
 * Withdraw invite via Unipile API
 * @param {string} unipileAccountId - Unipile account ID
 * @param {string} linkedinProfileId - LinkedIn profile ID
 * @returns {Promise<boolean>} Success status
 */
async function withdrawInvite(unipileAccountId, linkedinProfileId) {
  try {
    log.info(`Retirando convite via API Unipile...`);
    log.info(`   Profile ID: ${linkedinProfileId}`);
    log.info(`   Account ID: ${unipileAccountId}`);

    const axios = require('axios');
    const dsn = process.env.UNIPILE_DSN;
    const token = process.env.UNIPILE_API_KEY || process.env.UNIPILE_ACCESS_TOKEN;

    // DELETE /users/{user_id}/invitation?account_id={account_id}
    const response = await axios.delete(
      `https://${dsn}/api/v1/users/${linkedinProfileId}/invitation`,
      {
        headers: {
          'X-API-KEY': token,
          'Accept': 'application/json'
        },
        params: {
          account_id: unipileAccountId
        },
        timeout: 30000
      }
    );

    log.success(`Convite retirado com sucesso para ${linkedinProfileId}`);
    return true;
  } catch (error) {
    // Log but don't fail - invite might not exist or API might not support
    log.warn(`Não foi possível retirar convite para ${linkedinProfileId}: ${error.message}`);
    return false;
  }
}

/**
 * Process a single expired invite
 * @param {object} invite - Expired invite data
 * @param {string} tagId - Tag ID for "Convite não aceito"
 */
async function processExpiredInvite(invite, tagId) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    log.divider();
    log.info(`PROCESSANDO CONVITE EXPIRADO`);
    log.info(`   Lead: ${invite.lead_name}`);
    log.info(`   Lead ID: ${invite.lead_id}`);
    log.info(`   Queue ID: ${invite.id}`);
    log.info(`   Campanha: ${invite.campaign_id}`);

    // 1. Withdraw invite if configured
    log.step('1', 'Verificando retirada de convite...');
    if (invite.withdraw_expired_invites) {
      log.info(`   withdraw_expired_invites = TRUE, retirando convite...`);
      await withdrawInvite(invite.unipile_account_id, invite.linkedin_profile_id);
      await inviteQueueService.markInviteAsWithdrawn(invite.id);
    } else {
      log.info(`   withdraw_expired_invites = FALSE, mantendo convite no LinkedIn`);
    }

    // 2. Mark as expired
    log.step('2', 'Marcando convite como expirado...');
    await inviteQueueService.markInviteAsExpired(invite.id, invite.lead_id);
    log.success('Convite marcado como expirado');

    // 3. Apply tag
    log.step('3', 'Aplicando tag "Convite não aceito"...');
    if (tagId) {
      await applyTagToLead(invite.lead_id, tagId);
      log.success('Tag aplicada');
    } else {
      log.warn('Tag não encontrada no sistema');
    }

    // 4. Distribute via round robin
    log.step('4', 'Verificando distribuição Round Robin...');
    let assignedUser = null;
    if (invite.sector_id && invite.round_robin_users && invite.round_robin_users.length > 0) {
      log.info(`   Round Robin ATIVO - Setor: ${invite.sector_id}, Usuários: ${invite.round_robin_users.length}`);
      assignedUser = await getNextUserForDistribution(
        invite.sector_id,
        invite.round_robin_users,
        invite.account_id
      );

      if (assignedUser) {
        await client.query(
          `UPDATE leads
           SET responsible_user_id = $1, round_robin_distributed_at = NOW()
           WHERE id = $2`,
          [assignedUser.id, invite.lead_id]
        );
        log.success(`Lead distribuído para: ${assignedUser.name}`);
      } else {
        log.warn('Não foi possível encontrar próximo usuário para distribuição');
      }
    } else {
      log.info(`   Round Robin NÃO configurado`);
    }

    // 5. Move to "Prospecção" (status already set to 'invite_expired' which is valid)
    // The lead is now available in the CRM for follow-up

    await client.query('COMMIT');

    log.success(`Convite expirado processado: ${invite.lead_name}`);
    log.divider();

    return { success: true, assignedUser };
  } catch (error) {
    await client.query('ROLLBACK');
    log.error(`Erro ao processar convite expirado ${invite.id}: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

/**
 * Process all expired invites
 */
async function processExpiredInvites() {
  if (isProcessing) {
    log.warn('Já está processando convites expirados, pulando...');
    return;
  }

  isProcessing = true;

  try {
    console.log('\n');
    log.divider();
    log.info('VERIFICAÇÃO DE CONVITES EXPIRADOS INICIADA');
    log.info(`Timestamp: ${new Date().toISOString()}`);
    log.divider();

    // Get expired invites
    log.step('1', 'Buscando convites expirados no banco...');
    const expiredInvites = await inviteQueueService.getExpiredInvites();

    if (expiredInvites.length === 0) {
      log.success('Nenhum convite expirado encontrado');
      log.divider();
      return;
    }

    log.info(`Encontrados ${expiredInvites.length} convites expirados:`);
    expiredInvites.forEach((inv, i) => {
      log.info(`   ${i + 1}. ${inv.lead_name} (expires_at: ${inv.expires_at})`);
    });

    // Get tag ID
    log.step('2', 'Buscando ID da tag "Convite não aceito"...');
    const tagId = await getExpiredInviteTagId();
    if (tagId) {
      log.success(`Tag encontrada: ${tagId}`);
    } else {
      log.warn('Tag "Convite não aceito" não encontrada no sistema');
    }

    // Process each expired invite
    log.step('3', 'Processando convites expirados...');
    let processed = 0;
    let errors = 0;

    for (const invite of expiredInvites) {
      const result = await processExpiredInvite(invite, tagId);

      if (result.success) {
        processed++;
      } else {
        errors++;
      }

      // Small delay between processing
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n');
    log.divider();
    log.success('PROCESSAMENTO DE EXPIRAÇÃO CONCLUÍDO');
    log.info(`   Processados com sucesso: ${processed}`);
    log.info(`   Erros: ${errors}`);
    log.info(`   Total: ${expiredInvites.length}`);
    log.divider();

  } catch (error) {
    log.error(`Erro no processador de convites expirados: ${error.message}`);
    console.error(error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Start the expiration processor
 */
function startProcessor() {
  log.divider();
  log.info('PROCESSADOR DE EXPIRAÇÃO INICIADO');
  log.info(`Intervalo: ${PROCESSING_INTERVAL / 1000 / 60} minutos`);
  log.divider();

  // Process immediately on start
  processExpiredInvites();

  // Then process at interval
  setInterval(() => {
    processExpiredInvites();
  }, PROCESSING_INTERVAL);
}

/**
 * Manual trigger for testing
 */
async function runOnce() {
  log.info('Executando verificação manual de convites expirados...');
  await processExpiredInvites();
}

module.exports = {
  startProcessor,
  processExpiredInvites,
  runOnce,
  processExpiredInvite,
  withdrawInvite
};
