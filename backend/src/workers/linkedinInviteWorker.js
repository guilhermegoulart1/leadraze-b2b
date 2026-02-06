// backend/src/workers/linkedinInviteWorker.js

const { linkedinInviteQueue } = require('../queues');
const db = require('../config/database');
const unipileClient = require('../config/unipile');
const inviteQueueService = require('../services/inviteQueueService');
const inviteService = require('../services/inviteService');
const TemplateProcessor = require('../utils/templateProcessor');

/**
 * LinkedIn Invite Worker (Bull Queue)
 *
 * Processa envio de convites e verificacao de expiracoes via Bull:
 * - 'send-invite': Envia convite individual no horario agendado (delayed job)
 * - 'check-expirations': Verifica convites expirados (repeatable hourly)
 */

// Logging helpers
const LOG_PREFIX = '📤 [INVITE-SEND]';
const log = {
  info: (msg, data) => console.log(`${LOG_PREFIX} ${msg}`, data || ''),
  success: (msg, data) => console.log(`${LOG_PREFIX} ✅ ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`${LOG_PREFIX} ⚠️ ${msg}`, data || ''),
  error: (msg, data) => console.error(`${LOG_PREFIX} ❌ ${msg}`, data || ''),
  step: (step, msg, data) => console.log(`${LOG_PREFIX} [${step}] ${msg}`, data || ''),
  divider: () => console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`),
};

const EXP_PREFIX = '⏰ [EXPIRATION]';
const expLog = {
  info: (msg, data) => console.log(`${EXP_PREFIX} ${msg}`, data || ''),
  success: (msg, data) => console.log(`${EXP_PREFIX} ✅ ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`${EXP_PREFIX} ⚠️ ${msg}`, data || ''),
  error: (msg, data) => console.error(`${EXP_PREFIX} ❌ ${msg}`, data || ''),
  step: (step, msg, data) => console.log(`${EXP_PREFIX} [${step}] ${msg}`, data || ''),
  divider: () => console.log(`${EXP_PREFIX} ═══════════════════════════════════════════════════════════`),
};

// ====================================
// SEND INVITE PROCESSOR
// ====================================

/**
 * Process a single invite send job
 * @param {Object} job - Bull job with data: { queueId, campaignId, campaignContactId, linkedinAccountId, unipileAccountId }
 */
async function processInvite(job) {
  const { queueId, campaignId, campaignContactId, linkedinAccountId, unipileAccountId } = job.data;

  log.divider();
  log.info('PROCESSANDO ENVIO DE CONVITE');
  log.info(`   Job ID: ${job.id}`);
  log.info(`   Queue ID: ${queueId}`);
  log.info(`   Campaign ID: ${campaignId}`);
  log.info(`   Timestamp: ${new Date().toISOString()}`);

  try {
    // 1. Fetch contact data via campaign_contacts → contacts
    log.step('1', 'Buscando dados do contato...');
    const contactResult = await db.query(
      `SELECT cc.linkedin_profile_id, cc.contact_id,
              ct.name, ct.title, ct.company, ct.location,
              ct.industry, ct.headline, ct.about as summary
       FROM campaign_contacts cc
       JOIN contacts ct ON ct.id = cc.contact_id
       WHERE cc.id = $1`,
      [campaignContactId]
    );

    if (!contactResult.rows.length) {
      log.error(`Campaign contact ${campaignContactId} not found`);
      throw new Error(`Campaign contact ${campaignContactId} not found`);
    }
    const contact = contactResult.rows[0];
    log.success(`Contato: ${contact.name} (${contact.company || 'N/A'})`);

    // 2. Check if already sent (dedup)
    log.step('2', 'Verificando se já foi enviado...');
    const entry = await db.query(
      'SELECT status FROM campaign_invite_queue WHERE id = $1',
      [queueId]
    );
    if (entry.rows[0]?.status === 'sent') {
      log.warn('Convite já enviado, pulando');
      return { skipped: true, reason: 'already_sent' };
    }

    // 3. Check daily limit
    log.step('3', 'Verificando limite diário...');
    const limitCheck = await inviteService.canSendInvite(linkedinAccountId);
    log.info(`   Enviados hoje: ${limitCheck.sent}/${limitCheck.limit}`);

    if (!limitCheck.canSend) {
      log.warn(`Limite diário atingido: ${limitCheck.sent}/${limitCheck.limit}`);

      // Reschedule for next business day using agent working hours
      let rescheduleHour = 9; // default fallback
      try {
        const agentResult = await db.query(
          `SELECT aa.config as agent_config
           FROM campaigns c
           LEFT JOIN ai_agents aa ON c.ai_agent_id = aa.id
           WHERE c.id = $1`,
          [campaignId]
        );
        const agentCfg = agentResult.rows[0]?.agent_config;
        const parsedCfg = typeof agentCfg === 'string' ? JSON.parse(agentCfg || '{}') : (agentCfg || {});
        const wh = parsedCfg?.workingHours;
        if (wh?.enabled && wh.startTime) {
          rescheduleHour = parseInt(wh.startTime.split(':')[0]) || 9;
        }
      } catch (agentErr) {
        log.warn(`Erro ao buscar horário do agente, usando default 9h: ${agentErr.message}`);
      }

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(rescheduleHour, 0, 0, 0);

      log.info(`   Reagendando para amanhã ${String(rescheduleHour).padStart(2, '0')}:00: ${tomorrow.toISOString()}`);
      await linkedinInviteQueue.add('send-invite', job.data, {
        delay: tomorrow.getTime() - Date.now(),
        jobId: `invite-${queueId}-retry-${Date.now()}`
      });

      return { skipped: true, reason: 'daily_limit', rescheduled: true };
    }

    // 4. Get campaign AI agent message + process template
    log.step('4', 'Processando mensagem de convite...');
    const campaignResult = await db.query(
      `SELECT ai.initial_approach FROM campaigns c
       LEFT JOIN ai_agents ai ON c.ai_agent_id = ai.id
       WHERE c.id = $1`,
      [campaignId]
    );

    let inviteMessage = null;
    if (campaignResult.rows[0]?.initial_approach) {
      const templateData = TemplateProcessor.extractLeadData(contact);
      inviteMessage = TemplateProcessor.processTemplate(
        campaignResult.rows[0].initial_approach,
        templateData
      );
      if (inviteMessage && inviteMessage.length > 300) {
        log.warn(`Mensagem truncada: ${inviteMessage.length} -> 300 chars`);
        inviteMessage = inviteMessage.substring(0, 297) + '...';
      }
      log.success(`Mensagem processada (${inviteMessage?.length || 0} chars)`);
    } else {
      log.info('   Sem mensagem de convite (convite sem nota)');
    }

    // 5. Send invite via Unipile API
    log.step('5', 'Enviando convite via Unipile API...');
    const inviteParams = {
      account_id: unipileAccountId,
      user_id: contact.linkedin_profile_id
    };
    if (inviteMessage) inviteParams.message = inviteMessage;

    const result = await unipileClient.users.sendConnectionRequest(inviteParams);
    log.success('Convite enviado via API Unipile!');

    // 6. Update campaign_invite_queue + campaign_contacts via inviteQueueService
    log.step('6', 'Atualizando status no banco...');
    const expiryDays = await inviteQueueService.getInviteExpiryDays(campaignId);
    await inviteQueueService.markInviteAsSent(queueId, campaignContactId, expiryDays);

    // 7. Log in linkedin_invite_logs
    await inviteService.logInviteSent({
      linkedinAccountId,
      campaignId,
      status: 'sent'
    });

    log.divider();
    log.success('CONVITE ENVIADO COM SUCESSO!');
    log.info(`   Contato: ${contact.name}`);
    log.info(`   Empresa: ${contact.company || 'N/A'}`);
    log.info(`   Mensagem: ${inviteMessage ? inviteMessage.length + ' chars' : 'Sem nota'}`);
    log.divider();

    return { success: true, contactName: contact.name, messageLength: inviteMessage ? inviteMessage.length : 0 };

  } catch (error) {
    log.error(`Erro ao enviar convite: ${error.message}`);

    const errorMessage = error.response?.data?.detail || error.message;
    const errorType = error.response?.data?.type || 'unknown';
    log.error(`   Error type: ${errorType}`);
    log.error(`   Error detail: ${errorMessage}`);

    // Mark as failed in DB
    try {
      await db.query(
        `UPDATE campaign_invite_queue SET status = 'failed', last_error = $1, updated_at = NOW() WHERE id = $2`,
        [errorMessage, queueId]
      );

      // Log failure
      await inviteService.logInviteSent({
        linkedinAccountId,
        campaignId,
        status: 'failed'
      });
    } catch (dbError) {
      log.error(`Erro ao marcar convite como falha: ${dbError.message}`);
    }

    throw error; // Bull will retry based on attempts config
  }
}

// ====================================
// EXPIRATION PROCESSOR
// ====================================

/**
 * Get the "Convite não aceito" tag ID
 */
async function getExpiredInviteTagId() {
  const result = await db.query(
    `SELECT id FROM tags WHERE name = 'Convite não aceito' LIMIT 1`
  );
  return result.rows[0]?.id || null;
}

/**
 * Apply tag to contact via campaign_contact
 */
async function applyTagToContact(campaignContactId, tagId) {
  if (!tagId) return;

  const ccResult = await db.query(
    `SELECT contact_id FROM campaign_contacts WHERE id = $1`,
    [campaignContactId]
  );

  const contactId = ccResult.rows[0]?.contact_id;
  if (contactId) {
    await db.query(
      `INSERT INTO contact_tags (contact_id, tag_id)
       VALUES ($1, $2)
       ON CONFLICT (contact_id, tag_id) DO NOTHING`,
      [contactId, tagId]
    );
  }
}

/**
 * Get next user for round robin distribution
 */
async function getNextUserForDistribution(sectorId, userIds, accountId) {
  if (!userIds || userIds.length === 0) return null;

  const sectorResult = await db.query(
    `SELECT last_assigned_user_id FROM sectors WHERE id = $1 AND account_id = $2`,
    [sectorId, accountId]
  );

  const lastAssignedUserId = sectorResult.rows[0]?.last_assigned_user_id;

  let nextIndex = 0;
  if (lastAssignedUserId) {
    const lastIndex = userIds.indexOf(lastAssignedUserId);
    if (lastIndex !== -1) {
      nextIndex = (lastIndex + 1) % userIds.length;
    }
  }

  const nextUserId = userIds[nextIndex];
  const userResult = await db.query(
    `SELECT id, name, email, avatar_url FROM users WHERE id = $1`,
    [nextUserId]
  );

  if (userResult.rows.length === 0) return null;

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
 */
async function withdrawInvite(unipileAccountId, linkedinProfileId) {
  try {
    const axios = require('axios');
    const dsn = process.env.UNIPILE_DSN;
    const token = process.env.UNIPILE_API_KEY || process.env.UNIPILE_ACCESS_TOKEN;

    await axios.delete(
      `https://${dsn}/api/v1/users/${linkedinProfileId}/invitation`,
      {
        headers: { 'X-API-KEY': token, 'Accept': 'application/json' },
        params: { account_id: unipileAccountId },
        timeout: 30000
      }
    );

    expLog.success(`Convite retirado para ${linkedinProfileId}`);
    return true;
  } catch (error) {
    expLog.warn(`Não foi possível retirar convite para ${linkedinProfileId}: ${error.message}`);
    return false;
  }
}

/**
 * Process a single expired invite
 */
async function processExpiredInvite(invite, tagId) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    expLog.info(`Processando: ${invite.contact_name} (Queue ID: ${invite.id})`);

    // 1. Withdraw invite if configured
    if (invite.withdraw_expired_invites) {
      await withdrawInvite(invite.unipile_account_id, invite.linkedin_profile_id);
      await inviteQueueService.markInviteAsWithdrawn(invite.id);
    }

    // 2. Mark as expired
    await inviteQueueService.markInviteAsExpired(invite.id, invite.campaign_contact_id);

    // 3. Apply tag
    if (tagId) {
      await applyTagToContact(invite.campaign_contact_id, tagId);
    }

    // 4. Distribute via round robin
    if (invite.sector_id && invite.round_robin_users && invite.round_robin_users.length > 0) {
      const assignedUser = await getNextUserForDistribution(
        invite.sector_id,
        invite.round_robin_users,
        invite.account_id
      );

      if (assignedUser) {
        // Find opportunity linked to this campaign_contact and assign
        const oppResult = await client.query(
          `SELECT o.id FROM opportunities o
           JOIN campaign_contacts cc ON cc.contact_id = o.contact_id AND cc.campaign_id = o.campaign_id
           WHERE cc.id = $1 LIMIT 1`,
          [invite.campaign_contact_id]
        );

        if (oppResult.rows.length > 0) {
          await client.query(
            `UPDATE opportunities SET owner_user_id = $1, round_robin_distributed_at = NOW() WHERE id = $2`,
            [assignedUser.id, oppResult.rows[0].id]
          );
          expLog.success(`Distribuído para: ${assignedUser.name}`);
        }
      }
    }

    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    expLog.error(`Erro ao processar expiração ${invite.id}: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

/**
 * Process all expired invites (called by Bull repeatable job)
 */
async function processExpiredInvites() {
  expLog.divider();
  expLog.info('VERIFICAÇÃO DE CONVITES EXPIRADOS');
  expLog.info(`Timestamp: ${new Date().toISOString()}`);

  const expiredInvites = await inviteQueueService.getExpiredInvites();

  if (expiredInvites.length === 0) {
    expLog.success('Nenhum convite expirado');
    return { processed: 0 };
  }

  expLog.info(`Encontrados ${expiredInvites.length} convites expirados`);

  const tagId = await getExpiredInviteTagId();

  let processed = 0;
  let errors = 0;

  for (const invite of expiredInvites) {
    const result = await processExpiredInvite(invite, tagId);
    if (result.success) processed++;
    else errors++;

    // Small delay between processing
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  expLog.success(`Processamento concluído: ${processed} OK, ${errors} erros`);
  expLog.divider();

  return { processed, errors, total: expiredInvites.length };
}

// ====================================
// REGISTER BULL PROCESSORS
// ====================================

// Send invite processor (delayed jobs)
linkedinInviteQueue.process('send-invite', 1, async (job) => {
  return await processInvite(job);
});

// Expiration check processor (repeatable job)
linkedinInviteQueue.process('check-expirations', async (job) => {
  return await processExpiredInvites();
});

// ====================================
// EVENT HANDLERS
// ====================================

linkedinInviteQueue.on('completed', (job, result) => {
  if (job.name === 'send-invite') {
    if (result?.skipped) {
      log.warn(`Job ${job.id} pulado: ${result.reason}`);
    } else if (result?.success) {
      log.success(`Job ${job.id} concluído: ${result.contactName}`);
    }
  }
});

linkedinInviteQueue.on('failed', (job, err) => {
  if (job.name === 'send-invite') {
    log.error(`Job ${job.id} falhou (attempt ${job.attemptsMade}/${job.opts.attempts}): ${err.message}`);
  } else {
    expLog.error(`Job ${job.id} falhou: ${err.message}`);
  }
});

linkedinInviteQueue.on('stalled', (job) => {
  log.warn(`Job ${job.id} travou, será reprocessado`);
});

module.exports = {
  processInvite,
  processExpiredInvites,
  withdrawInvite
};
