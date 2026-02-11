// backend/src/workers/linkedinInviteWorker.js

const { linkedinInviteQueue } = require('../queues');
const db = require('../config/database');
const { DateTime } = require('luxon');
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

const SCHED_PREFIX = '📅 [DAILY-SCHEDULE]';
const schedLog = {
  info: (msg, data) => console.log(`${SCHED_PREFIX} ${msg}`, data || ''),
  success: (msg, data) => console.log(`${SCHED_PREFIX} ✅ ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`${SCHED_PREFIX} ⚠️ ${msg}`, data || ''),
  error: (msg, data) => console.error(`${SCHED_PREFIX} ❌ ${msg}`, data || ''),
  divider: () => console.log(`${SCHED_PREFIX} ═══════════════════════════════════════════════════════════`),
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

    // 3a. Determine if invite will have a message (BEFORE limit check)
    log.step('3a', 'Determinando estratégia de mensagem...');
    const campaignResult = await db.query(
      `SELECT c.account_id, ai.initial_approach, ai.connection_strategy
       FROM campaigns c
       LEFT JOIN ai_agents ai ON c.ai_agent_id = ai.id
       WHERE c.id = $1`,
      [campaignId]
    );

    const connectionStrategy = campaignResult.rows[0]?.connection_strategy || 'with-intro';
    const hasInitialApproach = !!campaignResult.rows[0]?.initial_approach;
    let willHaveMessage = connectionStrategy !== 'silent' && hasInitialApproach;
    let messageFallback = false;

    log.info(`   Estratégia: ${connectionStrategy}`);
    log.info(`   Tem mensagem configurada: ${hasInitialApproach}`);
    log.info(`   Vai incluir mensagem: ${willHaveMessage}`);

    // 3b. Check limits (daily + weekly + monthly messages)
    log.step('3b', 'Verificando limites (diário + semanal + mensal)...');
    const limitCheck = await inviteService.canSendInvite(linkedinAccountId, { withMessage: willHaveMessage });
    log.info(`   Diário: ${limitCheck.daily.sent}/${limitCheck.daily.limit}`);
    log.info(`   Semanal: ${limitCheck.weekly.sent}/${limitCheck.weekly.limit}`);
    if (willHaveMessage) {
      log.info(`   Mensagens no mês: ${limitCheck.monthly_messages.sent}/${limitCheck.monthly_messages.limit}`);
    }

    if (!limitCheck.canSend) {
      const reason = limitCheck.limitReason || 'daily';
      log.warn(`Limite atingido (${reason}): diário=${limitCheck.daily.sent}/${limitCheck.daily.limit}, semanal=${limitCheck.weekly.sent}/${limitCheck.weekly.limit}`);

      // Reschedule for next active business day using agent working hours
      let rescheduleTime;
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

        const startHour = (wh?.enabled && wh.startTime) ? parseInt(wh.startTime.split(':')[0]) || 9 : 9;
        const tz = wh?.timezone || 'America/Sao_Paulo';
        const days = (wh?.enabled && wh.days) ? wh.days : null;

        const tomorrow = DateTime.now().setZone(tz).plus({ days: 1 });
        const targetDay = days && days.length > 0
          ? inviteQueueService.findNextActiveDay(tomorrow, days)
          : tomorrow.startOf('day');

        rescheduleTime = targetDay.set({ hour: startHour, minute: 0, second: 0, millisecond: 0 }).toJSDate();
      } catch (agentErr) {
        log.warn(`Erro ao buscar horário do agente, usando default amanhã 9h: ${agentErr.message}`);
        rescheduleTime = new Date();
        rescheduleTime.setDate(rescheduleTime.getDate() + 1);
        rescheduleTime.setHours(9, 0, 0, 0);
      }

      log.info(`   Reagendando para: ${rescheduleTime.toISOString()}`);
      await linkedinInviteQueue.add('send-invite', job.data, {
        delay: Math.max(0, rescheduleTime.getTime() - Date.now()),
        jobId: `invite-${queueId}-retry-${Date.now()}`
      });

      return { skipped: true, reason: `limit_${reason}`, rescheduled: true };
    }

    // Smart Fallback: se ia ter mensagem mas limite mensal de mensagens atingido,
    // envia sem mensagem para maximizar conexoes (especialmente para contas free)
    if (willHaveMessage && !limitCheck.canSendWithMessage) {
      log.warn(`Limite mensal de mensagens atingido (${limitCheck.monthly_messages.sent}/${limitCheck.monthly_messages.limit}). Enviando convite SEM nota.`);
      willHaveMessage = false;
      messageFallback = true;
    }

    // 4. Process invite message (only if willHaveMessage is still true)
    log.step('4', 'Processando mensagem de convite...');
    let inviteMessage = null;

    if (willHaveMessage && campaignResult.rows[0]?.initial_approach) {
      const templateData = TemplateProcessor.extractLeadData(contact);
      inviteMessage = TemplateProcessor.processTemplate(
        campaignResult.rows[0].initial_approach,
        templateData
      );

      // Limite de caracteres dinamico por tipo de conta (Free=200, Premium=300)
      const charLimit = limitCheck.note_char_limit || 300;
      if (inviteMessage && inviteMessage.length > charLimit) {
        log.warn(`Mensagem truncada: ${inviteMessage.length} -> ${charLimit} chars`);
        inviteMessage = inviteMessage.substring(0, charLimit - 3) + '...';
      }
      log.success(`Mensagem processada (${inviteMessage?.length || 0} chars, limite: ${charLimit})`);
    } else if (messageFallback) {
      log.info('   Mensagem removida (fallback: limite mensal de notas atingido)');
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

    // 7. Log in linkedin_invite_logs (with message_included tracking)
    await inviteService.logInviteSent({
      linkedinAccountId,
      campaignId,
      status: 'sent',
      messageIncluded: !!inviteMessage
    });

    // 8. Save snapshot for acceptance detection (polling fallback + real-time via messages)
    try {
      const accountId = campaignResult.rows[0]?.account_id;
      await db.query(
        `INSERT INTO invitation_snapshots
         (account_id, linkedin_account_id, invitation_type, invitation_id, provider_id, user_name, invitation_message, detected_at)
         VALUES ($1, $2, 'sent', $3, $4, $5, $6, NOW())
         ON CONFLICT (linkedin_account_id, invitation_id) DO NOTHING`,
        [
          accountId,
          linkedinAccountId,
          result?.invitation_id || `sent_${contact.linkedin_profile_id}_${Date.now()}`,
          contact.linkedin_profile_id,
          contact.name,
          inviteMessage || null
        ]
      );
      log.info('   📸 Snapshot salvo para detecção de aceitação');
    } catch (snapshotError) {
      log.warn(`Erro ao salvar snapshot: ${snapshotError.message}`);
    }

    log.divider();
    log.success('CONVITE ENVIADO COM SUCESSO!');
    log.info(`   Contato: ${contact.name}`);
    log.info(`   Empresa: ${contact.company || 'N/A'}`);
    log.info(`   Mensagem: ${inviteMessage ? inviteMessage.length + ' chars' : 'Sem nota'}`);
    if (messageFallback) log.info(`   ⚠️ Fallback: mensagem removida (limite mensal de notas)`);
    log.info(`   Limites: D ${limitCheck.daily.sent + 1}/${limitCheck.daily.limit} | S ${limitCheck.weekly.sent + 1}/${limitCheck.weekly.limit}`);
    log.divider();

    return { success: true, contactName: contact.name, messageLength: inviteMessage ? inviteMessage.length : 0, messageFallback };

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
        status: 'failed',
        messageIncluded: false
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
// DAILY INVITE SCHEDULER
// ====================================

/**
 * Get all active campaigns that have pending invites in the queue
 */
async function getActiveCampaignsWithPendingInvites() {
  const result = await db.query(
    `SELECT DISTINCT
       c.id as campaign_id,
       c.account_id,
       c.name as campaign_name,
       COUNT(ciq.id) as pending_count
     FROM campaigns c
     JOIN campaign_invite_queue ciq ON ciq.campaign_id = c.id
     WHERE c.status = 'active'
       AND c.automation_active = true
       AND ciq.status = 'pending'
     GROUP BY c.id, c.account_id, c.name
     ORDER BY c.created_at ASC`
  );
  return result.rows;
}

/**
 * Schedule pending invites for all active campaigns (called by Bull repeatable job)
 */
async function processDailyScheduling() {
  schedLog.divider();
  schedLog.info('AGENDAMENTO AUTOMÁTICO DE CONVITES');
  schedLog.info(`Timestamp: ${new Date().toISOString()}`);

  const campaigns = await getActiveCampaignsWithPendingInvites();

  if (campaigns.length === 0) {
    schedLog.info('Nenhuma campanha precisa de agendamento');
    schedLog.divider();
    return { totalScheduled: 0, campaignsProcessed: 0 };
  }

  schedLog.info(`Encontradas ${campaigns.length} campanhas com convites pendentes`);

  let totalScheduled = 0;
  let errorCount = 0;

  for (const campaign of campaigns) {
    try {
      const result = await inviteQueueService.scheduleInvitesForToday(
        campaign.campaign_id,
        campaign.account_id
      );

      if (result.scheduled > 0) {
        schedLog.success(
          `"${campaign.campaign_name}": ${result.scheduled} agendados (${result.remaining || 0} restantes)`
        );
        totalScheduled += result.scheduled;
      } else {
        schedLog.info(`"${campaign.campaign_name}": ${result.message || 'Nenhum agendado'}`);
      }
    } catch (error) {
      errorCount++;
      schedLog.error(`"${campaign.campaign_name}" falhou: ${error.message}`);
    }

    // Small delay between campaigns
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  schedLog.success(
    `Concluído: ${totalScheduled} convites agendados, ${campaigns.length} campanhas processadas, ${errorCount} erros`
  );
  schedLog.divider();

  return { totalScheduled, campaignsProcessed: campaigns.length, errorCount };
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

// Daily invite scheduler processor (repeatable job - every 3 hours)
linkedinInviteQueue.process('schedule-daily-invites', async (job) => {
  return await processDailyScheduling();
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
  processDailyScheduling,
  withdrawInvite
};
