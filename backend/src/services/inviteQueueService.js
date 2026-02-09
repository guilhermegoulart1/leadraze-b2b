// backend/src/services/inviteQueueService.js
const db = require('../config/database');
const { DateTime } = require('luxon');
const { linkedinInviteQueue } = require('../queues');
const inviteService = require('./inviteService');

// ====================================
// 🔧 LOGGING HELPER
// ====================================
const LOG_PREFIX = '📬 [INVITE-QUEUE]';

const log = {
  info: (msg, data) => console.log(`${LOG_PREFIX} ${msg}`, data || ''),
  success: (msg, data) => console.log(`${LOG_PREFIX} ✅ ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`${LOG_PREFIX} ⚠️ ${msg}`, data || ''),
  error: (msg, data) => console.error(`${LOG_PREFIX} ❌ ${msg}`, data || ''),
  step: (step, msg, data) => console.log(`${LOG_PREFIX} [${step}] ${msg}`, data || ''),
};

/**
 * Extract send hours from agent workingHours config
 * Falls back to campaign config or defaults
 * @param {object} agentConfig - Agent config JSONB (parsed)
 * @param {object} campaignConfig - Campaign review config (fallback)
 * @returns {object} { send_start_hour, send_end_hour, timezone, days }
 */
const getScheduleFromAgent = (agentConfig, campaignConfig = {}) => {
  const wh = agentConfig?.workingHours;

  if (wh?.enabled) {
    const [startH] = (wh.startTime || '09:00').split(':').map(Number);
    const [endH] = (wh.endTime || '18:00').split(':').map(Number);
    return {
      send_start_hour: startH,
      send_end_hour: endH,
      timezone: wh.timezone || 'America/Sao_Paulo',
      days: wh.days || ['mon', 'tue', 'wed', 'thu', 'fri']
    };
  }

  // Fallback to campaign config (backwards compatibility)
  return {
    send_start_hour: campaignConfig.send_start_hour || 9,
    send_end_hour: campaignConfig.send_end_hour || 18,
    timezone: campaignConfig.timezone || 'America/Sao_Paulo',
    days: null // no day filtering when using campaign config fallback
  };
};

/**
 * Luxon weekday to day code mapping (Luxon: 1=Monday, 7=Sunday)
 */
const LUXON_DAY_MAP = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat', 7: 'sun' };

/**
 * Find the next active business day from a given date
 * @param {DateTime} fromDate - Luxon DateTime to start searching from
 * @param {string[]} days - Active day codes e.g. ['mon','tue','wed','thu','fri']
 * @returns {DateTime} The next active day (startOf('day'))
 */
const findNextActiveDay = (fromDate, days) => {
  for (let offset = 0; offset < 7; offset++) {
    const candidate = fromDate.plus({ days: offset });
    const dayCode = LUXON_DAY_MAP[candidate.weekday];
    if (days.includes(dayCode)) {
      return candidate.startOf('day');
    }
  }
  // Should never happen if days has at least 1 entry, fallback to fromDate
  return fromDate.startOf('day');
};

/**
 * Calculate random send times for invites throughout the day
 * @param {number} count - Number of invites to schedule
 * @param {object} config - Configuration with send hours, timezone, and active days
 * @returns {Date[]} Array of scheduled times
 */
const calculateRandomSendTimes = (count, config = {}) => {
  const {
    send_start_hour = 9,
    send_end_hour = 18,
    timezone = 'America/Sao_Paulo',
    days = null
  } = config;

  const schedule = [];
  const totalMinutes = (send_end_hour - send_start_hour) * 60;

  // Get current time in the specified timezone
  const now = DateTime.now().setZone(timezone);

  // Determine the target day: today if active and still has time, otherwise next active day
  let targetDay;
  if (days && days.length > 0) {
    targetDay = findNextActiveDay(now, days);
  } else {
    targetDay = now.startOf('day');
  }

  for (let i = 0; i < count; i++) {
    // Random minute within business hours
    const randomMinute = Math.floor(Math.random() * totalMinutes);
    const hour = send_start_hour + Math.floor(randomMinute / 60);
    const minute = randomMinute % 60;

    // Add jitter of ±5 minutes for more natural distribution
    const jitter = Math.floor(Math.random() * 10) - 5;
    const finalMinute = Math.max(0, Math.min(59, minute + jitter));

    // Create the scheduled time on the target day
    let scheduledTime = targetDay.set({ hour, minute: finalMinute, second: 0, millisecond: 0 });

    // If time is in the past, advance to the next active day
    if (scheduledTime < now) {
      const nextDay = days && days.length > 0
        ? findNextActiveDay(now.plus({ days: 1 }), days)
        : now.plus({ days: 1 }).startOf('day');
      scheduledTime = nextDay.set({ hour, minute: finalMinute, second: 0, millisecond: 0 });
    }

    schedule.push(scheduledTime.toJSDate());
  }

  // Sort chronologically
  return schedule.sort((a, b) => a - b);
};

/**
 * Create invite queue for a campaign
 * @param {string} campaignId - Campaign ID
 * @param {string} accountId - Account ID
 * @param {object} options - Options for queue creation
 * @returns {object} Queue creation result
 */
const createInviteQueue = async (campaignId, accountId, options = {}) => {
  log.info('═══════════════════════════════════════════════════════════');
  log.info('🚀 INICIANDO CRIAÇÃO DE FILA DE CONVITES');
  log.info(`   Campaign ID: ${campaignId}`);
  log.info(`   Account ID: ${accountId}`);
  log.info('═══════════════════════════════════════════════════════════');

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');
    log.step('1/6', 'Transação iniciada');

    // Get campaign with review config and agent config
    const campaignResult = await client.query(
      `SELECT c.*, crc.*, la.id as linkedin_account_id, la.unipile_account_id, la.daily_limit,
              la.weekly_limit, aa.config as agent_config
       FROM campaigns c
       LEFT JOIN campaign_review_config crc ON crc.campaign_id = c.id
       LEFT JOIN campaign_linkedin_accounts cla ON cla.campaign_id = c.id AND cla.is_active = true
       LEFT JOIN linkedin_accounts la ON la.id = cla.linkedin_account_id
       LEFT JOIN ai_agents aa ON c.ai_agent_id = aa.id
       WHERE c.id = $1 AND c.account_id = $2`,
      [campaignId, accountId]
    );

    if (campaignResult.rows.length === 0) {
      log.error('Campanha não encontrada!');
      throw new Error('Campaign not found');
    }

    const campaign = campaignResult.rows[0];

    // Parse agent config to get working hours (source of truth)
    const agentConfig = typeof campaign.agent_config === 'string'
      ? JSON.parse(campaign.agent_config || '{}')
      : (campaign.agent_config || {});
    const schedule = getScheduleFromAgent(agentConfig, campaign);

    log.step('2/6', 'Campanha encontrada:', {
      name: campaign.name,
      linkedin_account_id: campaign.linkedin_account_id,
      is_reviewed: campaign.is_reviewed,
      invite_expiry_days: campaign.invite_expiry_days,
      send_start_hour: schedule.send_start_hour,
      send_end_hour: schedule.send_end_hour,
      timezone: schedule.timezone,
      days: schedule.days,
      source: agentConfig?.workingHours?.enabled ? 'agent' : 'campaign_fallback'
    });

    if (!campaign.is_reviewed) {
      log.error('Campanha não foi revisada!');
      throw new Error('Campaign must be reviewed before starting');
    }

    // Get approved campaign_contacts (pending invite)
    const contactsResult = await client.query(
      `SELECT cc.id as campaign_contact_id, cc.linkedin_profile_id, cc.contact_id,
              c.name as contact_name, c.title, c.company
       FROM campaign_contacts cc
       JOIN contacts c ON cc.contact_id = c.id
       WHERE cc.campaign_id = $1 AND cc.status = 'approved'
       ORDER BY cc.created_at ASC`,
      [campaignId]
    );

    const campaignContacts = contactsResult.rows;
    log.step('3/6', `Contatos aprovados encontrados: ${campaignContacts.length}`);
    campaignContacts.forEach((cc, i) => log.info(`   [${i+1}] ${cc.contact_name} (${cc.linkedin_profile_id})`));

    if (campaignContacts.length === 0) {
      log.warn('Nenhum contato aprovado para enfileirar');
      throw new Error('No approved contacts to queue');
    }

    // Get daily + weekly limits and pending count
    const dailyLimit = campaign.daily_limit || 20;
    const weeklyLimit = campaign.weekly_limit || 100;
    const maxPending = campaign.max_pending_invites || 100;

    // Get current pending invites count for this LinkedIn account
    const pendingResult = await client.query(
      `SELECT COUNT(*) as count
       FROM campaign_invite_queue
       WHERE linkedin_account_id = $1 AND status IN ('sent', 'scheduled')`,
      [campaign.linkedin_account_id]
    );

    const currentPending = parseInt(pendingResult.rows[0].count) || 0;
    const availableSlots = Math.max(0, maxPending - currentPending);

    // Check weekly remaining (LinkedIn usa limites semanais)
    const sentThisWeek = await inviteService.getInvitesSentThisWeek(campaign.linkedin_account_id);
    const weeklyRemaining = Math.max(0, weeklyLimit - sentThisWeek);

    log.step('4/6', 'Limites calculados:', {
      dailyLimit,
      weeklyLimit,
      weeklyRemaining,
      sentThisWeek,
      maxPending,
      currentPending,
      availableSlots
    });

    // Calculate how many invites we can queue today (respecting daily + weekly + pending)
    const invitesToday = Math.min(campaignContacts.length, dailyLimit, availableSlots, weeklyRemaining);
    log.info(`   Convites para hoje: ${invitesToday}`);

    // Calculate random send times for today's invites (using agent hours + days)
    const sendTimes = calculateRandomSendTimes(invitesToday, {
      send_start_hour: schedule.send_start_hour,
      send_end_hour: schedule.send_end_hour,
      timezone: schedule.timezone,
      days: schedule.days
    });

    log.step('5/6', 'Horários de envio calculados:');
    sendTimes.forEach((t, i) => {
      const dt = DateTime.fromJSDate(t);
      log.info(`   [${i+1}] ${dt.toFormat('HH:mm:ss')} (${dt.zoneName})`);
    });

    // Calculate expiration date
    const expiryDays = campaign.invite_expiry_days || 7;
    log.info(`   Dias para expirar: ${expiryDays}`);

    // Create queue entries
    let queuedCount = 0;
    log.step('6/6', 'Criando entradas na fila...');

    for (let i = 0; i < campaignContacts.length; i++) {
      const cc = campaignContacts[i];
      const scheduledFor = i < sendTimes.length ? sendTimes[i] : null;
      const queueStatus = scheduledFor ? 'scheduled' : 'pending';

      // Calculate expiration (from when it will be sent)
      const expiresAt = scheduledFor
        ? DateTime.fromJSDate(scheduledFor).plus({ days: expiryDays }).toJSDate()
        : null;

      const insertResult = await client.query(
        `INSERT INTO campaign_invite_queue
         (account_id, campaign_id, campaign_contact_id, linkedin_account_id, status, scheduled_for, expires_at, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [accountId, campaignId, cc.campaign_contact_id, campaign.linkedin_account_id, queueStatus, scheduledFor, expiresAt, i]
      );
      const queueRowId = insertResult.rows[0].id;

      // Create Bull delayed job if scheduled for today
      if (scheduledFor) {
        const delayMs = Math.max(0, scheduledFor.getTime() - Date.now());
        const job = await linkedinInviteQueue.add('send-invite', {
          queueId: queueRowId,
          campaignId,
          campaignContactId: cc.campaign_contact_id,
          linkedinAccountId: campaign.linkedin_account_id,
          unipileAccountId: campaign.unipile_account_id
        }, {
          delay: delayMs,
          attempts: 3,
          backoff: { type: 'exponential', delay: 10000 },
          jobId: `invite-${queueRowId}`
        });

        await client.query(
          'UPDATE campaign_invite_queue SET bull_job_id = $1 WHERE id = $2',
          [job.id.toString(), queueRowId]
        );
      }

      // Update campaign_contact status to indicate queued
      await client.query(
        `UPDATE campaign_contacts SET status = 'invite_queued', updated_at = NOW() WHERE id = $1`,
        [cc.campaign_contact_id]
      );

      const scheduleInfo = scheduledFor
        ? `agendado para ${DateTime.fromJSDate(scheduledFor).toFormat('HH:mm')} (Bull job)`
        : 'pendente (próximo dia)';
      log.info(`   ✓ ${cc.contact_name} - ${queueStatus} (${scheduleInfo})`);

      queuedCount++;
    }

    // Update campaign pending count
    await client.query(
      `UPDATE campaigns SET pending_invites_count = pending_invites_count + $1 WHERE id = $2`,
      [queuedCount, campaignId]
    );

    await client.query('COMMIT');

    const result = {
      success: true,
      totalQueued: queuedCount,
      scheduledToday: sendTimes.length,
      pendingForLater: queuedCount - sendTimes.length,
      nextScheduledAt: sendTimes.length > 0 ? sendTimes[0] : null
    };

    log.success('═══════════════════════════════════════════════════════════');
    log.success('FILA DE CONVITES CRIADA COM SUCESSO!');
    log.success(`   Total na fila: ${result.totalQueued}`);
    log.success(`   Agendados para hoje: ${result.scheduledToday}`);
    log.success(`   Pendentes para depois: ${result.pendingForLater}`);
    if (result.nextScheduledAt) {
      log.success(`   Próximo envio: ${DateTime.fromJSDate(result.nextScheduledAt).toFormat('HH:mm:ss')}`);
    }
    log.success('═══════════════════════════════════════════════════════════');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    log.error('Erro ao criar fila de convites:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get invite expiry days from campaign config
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<number>} Expiry days
 */
const getInviteExpiryDays = async (campaignId) => {
  const result = await db.query(
    'SELECT invite_expiry_days FROM campaign_review_config WHERE campaign_id = $1',
    [campaignId]
  );
  return result.rows[0]?.invite_expiry_days || 7;
};

/**
 * Mark invite as sent
 * @param {string} queueId - Queue entry ID
 * @param {string} campaignContactId - Campaign Contact ID
 * @param {number} expiryDays - Days until expiration
 */
const markInviteAsSent = async (queueId, campaignContactId, expiryDays = 7) => {
  const expiresAt = DateTime.now().plus({ days: expiryDays }).toJSDate();

  log.info('───────────────────────────────────────────────────────────');
  log.info('📤 MARCANDO CONVITE COMO ENVIADO');
  log.info(`   Queue ID: ${queueId}`);
  log.info(`   Campaign Contact ID: ${campaignContactId}`);
  log.info(`   Expira em: ${expiryDays} dias (${DateTime.fromJSDate(expiresAt).toFormat('dd/MM/yyyy HH:mm')})`);

  await db.query(
    `UPDATE campaign_invite_queue
     SET status = 'sent', sent_at = NOW(), expires_at = $1
     WHERE id = $2`,
    [expiresAt, queueId]
  );

  await db.query(
    `UPDATE campaign_contacts
     SET status = 'invite_sent', invite_sent_at = NOW(), invite_expires_at = $1, updated_at = NOW()
     WHERE id = $2`,
    [expiresAt, campaignContactId]
  );

  log.success('Convite marcado como ENVIADO');
  log.info('───────────────────────────────────────────────────────────');
};

/**
 * Mark invite as accepted
 * @param {string} campaignContactId - Campaign Contact ID
 */
const markInviteAsAccepted = async (campaignContactId) => {
  log.info('───────────────────────────────────────────────────────────');
  log.info('🎉 MARCANDO CONVITE COMO ACEITO');
  log.info(`   Campaign Contact ID: ${campaignContactId}`);

  // Update queue entry
  const queueResult = await db.query(
    `UPDATE campaign_invite_queue
     SET status = 'accepted', updated_at = NOW()
     WHERE campaign_contact_id = $1 AND status = 'sent'
     RETURNING id, campaign_id`,
    [campaignContactId]
  );

  if (queueResult.rows.length > 0) {
    log.info(`   Queue entry atualizada: ${queueResult.rows[0].id}`);
  } else {
    log.warn('   Nenhuma entrada encontrada na fila com status "sent"');
  }

  // Update campaign_contact
  await db.query(
    `UPDATE campaign_contacts
     SET status = 'invite_accepted', invite_accepted_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [campaignContactId]
  );

  // Decrement pending count
  await db.query(
    `UPDATE campaigns c
     SET pending_invites_count = GREATEST(0, pending_invites_count - 1)
     FROM campaign_contacts cc
     WHERE cc.id = $1 AND c.id = cc.campaign_id`,
    [campaignContactId]
  );

  log.success('Convite marcado como ACEITO! 🎊');
  log.info('───────────────────────────────────────────────────────────');
};

/**
 * Get expired invites for processing
 * @returns {object[]} Expired invites
 */
const getExpiredInvites = async () => {
  const result = await db.query(
    `SELECT ciq.*, cc.linkedin_profile_id, ct.name as contact_name,
            camp.id as campaign_id, camp.name as campaign_name, camp.account_id,
            crc.withdraw_expired_invites, crc.sector_id, crc.round_robin_users,
            la.unipile_account_id
     FROM campaign_invite_queue ciq
     JOIN campaign_contacts cc ON cc.id = ciq.campaign_contact_id
     JOIN contacts ct ON ct.id = cc.contact_id
     JOIN campaigns camp ON camp.id = ciq.campaign_id
     LEFT JOIN campaign_review_config crc ON crc.campaign_id = camp.id
     JOIN linkedin_accounts la ON la.id = ciq.linkedin_account_id
     WHERE ciq.status = 'sent'
       AND ciq.expires_at <= NOW()
     ORDER BY ciq.expires_at ASC`
  );

  return result.rows;
};

/**
 * Mark invite as expired
 * @param {string} queueId - Queue entry ID
 * @param {string} campaignContactId - Campaign Contact ID
 */
const markInviteAsExpired = async (queueId, campaignContactId) => {
  log.info('───────────────────────────────────────────────────────────');
  log.info('⏰ MARCANDO CONVITE COMO EXPIRADO');
  log.info(`   Queue ID: ${queueId}`);
  log.info(`   Campaign Contact ID: ${campaignContactId}`);

  await db.query(
    `UPDATE campaign_invite_queue
     SET status = 'expired', expired_at = NOW()
     WHERE id = $1`,
    [queueId]
  );

  await db.query(
    `UPDATE campaign_contacts
     SET status = 'invite_expired', updated_at = NOW()
     WHERE id = $1`,
    [campaignContactId]
  );

  // Decrement pending count
  await db.query(
    `UPDATE campaigns c
     SET pending_invites_count = GREATEST(0, pending_invites_count - 1)
     FROM campaign_contacts cc
     WHERE cc.id = $1 AND c.id = cc.campaign_id`,
    [campaignContactId]
  );

  log.success('Convite marcado como EXPIRADO');
  log.info('───────────────────────────────────────────────────────────');
};

/**
 * Mark invite as withdrawn
 * @param {string} queueId - Queue entry ID
 */
const markInviteAsWithdrawn = async (queueId) => {
  await db.query(
    `UPDATE campaign_invite_queue
     SET status = 'withdrawn', withdrawn_at = NOW()
     WHERE id = $1`,
    [queueId]
  );
};

/**
 * Get pending invites count for a LinkedIn account
 * @param {string} linkedinAccountId - LinkedIn account ID
 * @returns {number} Count of pending invites
 */
const getPendingInvitesCount = async (linkedinAccountId) => {
  const result = await db.query(
    `SELECT COUNT(*) as count
     FROM campaign_invite_queue
     WHERE linkedin_account_id = $1 AND status IN ('sent', 'scheduled')`,
    [linkedinAccountId]
  );

  return parseInt(result.rows[0].count) || 0;
};

/**
 * Check if more invites can be queued for a LinkedIn account
 * @param {string} linkedinAccountId - LinkedIn account ID
 * @param {string} campaignId - Campaign ID
 * @returns {object} Availability info
 */
const canQueueMoreInvites = async (linkedinAccountId, campaignId) => {
  // Get config
  const configResult = await db.query(
    `SELECT max_pending_invites FROM campaign_review_config WHERE campaign_id = $1`,
    [campaignId]
  );

  const maxPending = configResult.rows[0]?.max_pending_invites || 100;
  const currentPending = await getPendingInvitesCount(linkedinAccountId);

  return {
    canQueue: currentPending < maxPending,
    currentPending,
    maxPending,
    available: Math.max(0, maxPending - currentPending)
  };
};

/**
 * Get daily invites sent count
 * @param {string} linkedinAccountId - LinkedIn account ID
 * @returns {number} Count of invites sent today
 */
const getDailyInvitesSent = async (linkedinAccountId) => {
  const result = await db.query(
    `SELECT COUNT(*) as count
     FROM campaign_invite_queue
     WHERE linkedin_account_id = $1
       AND status = 'sent'
       AND sent_at >= CURRENT_DATE`,
    [linkedinAccountId]
  );

  return parseInt(result.rows[0].count) || 0;
};

/**
 * Get queue status for a campaign
 * @param {string} campaignId - Campaign ID
 * @returns {object} Queue status
 */
const getQueueStatus = async (campaignId) => {
  const result = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'pending') as pending,
       COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
       COUNT(*) FILTER (WHERE status = 'sent') as sent,
       COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
       COUNT(*) FILTER (WHERE status = 'expired') as expired,
       COUNT(*) FILTER (WHERE status = 'withdrawn') as withdrawn,
       COUNT(*) FILTER (WHERE status = 'failed') as failed,
       MIN(scheduled_for) FILTER (WHERE status = 'scheduled') as next_scheduled_at
     FROM campaign_invite_queue
     WHERE campaign_id = $1`,
    [campaignId]
  );

  const stats = result.rows[0];

  return {
    pending: parseInt(stats.pending) || 0,
    scheduled: parseInt(stats.scheduled) || 0,
    sent: parseInt(stats.sent) || 0,
    accepted: parseInt(stats.accepted) || 0,
    expired: parseInt(stats.expired) || 0,
    withdrawn: parseInt(stats.withdrawn) || 0,
    failed: parseInt(stats.failed) || 0,
    nextScheduledAt: stats.next_scheduled_at
  };
};

/**
 * Schedule more invites for today
 * @param {string} campaignId - Campaign ID
 * @param {string} accountId - Account ID
 * @returns {object} Scheduling result
 */
const scheduleInvitesForToday = async (campaignId, accountId) => {
  // Get pending invites that haven't been scheduled
  const pendingResult = await db.query(
    `SELECT ciq.id, ciq.campaign_contact_id
     FROM campaign_invite_queue ciq
     JOIN campaigns c ON c.id = ciq.campaign_id
     WHERE ciq.campaign_id = $1
       AND ciq.status = 'pending'
       AND c.status = 'active'
       AND c.automation_active = true
     ORDER BY ciq.priority ASC`,
    [campaignId]
  );

  if (pendingResult.rows.length === 0) {
    return { scheduled: 0, message: 'No pending invites to schedule' };
  }

  // Get config with agent working hours
  const configResult = await db.query(
    `SELECT crc.*, la.id as linkedin_account_id, la.daily_limit, la.weekly_limit,
            aa.config as agent_config
     FROM campaign_review_config crc
     JOIN campaigns c ON c.id = crc.campaign_id
     LEFT JOIN ai_agents aa ON c.ai_agent_id = aa.id
     JOIN campaign_linkedin_accounts cla ON cla.campaign_id = c.id AND cla.is_active = true
     JOIN linkedin_accounts la ON la.id = cla.linkedin_account_id
     WHERE crc.campaign_id = $1`,
    [campaignId]
  );

  if (configResult.rows.length === 0) {
    return { scheduled: 0, message: 'Campaign config not found' };
  }

  const config = configResult.rows[0];

  // Get schedule from agent (source of truth) with campaign fallback
  const agentCfg = typeof config.agent_config === 'string'
    ? JSON.parse(config.agent_config || '{}')
    : (config.agent_config || {});
  const schedule = getScheduleFromAgent(agentCfg, config);

  // Check how many we can still send today (daily inner cap)
  const sentToday = await getDailyInvitesSent(config.linkedin_account_id);
  const dailyLimit = config.daily_limit || 20;
  const availableToday = Math.max(0, dailyLimit - sentToday);

  if (availableToday === 0) {
    return { scheduled: 0, message: 'Daily limit reached' };
  }

  // Check weekly remaining (LinkedIn usa limites semanais)
  const sentThisWeek = await inviteService.getInvitesSentThisWeek(config.linkedin_account_id);
  const weeklyLimit = config.weekly_limit || 100;
  const weeklyRemaining = Math.max(0, weeklyLimit - sentThisWeek);

  if (weeklyRemaining === 0) {
    return { scheduled: 0, message: 'Weekly limit reached' };
  }

  // Check pending limit
  const { available: pendingAvailable } = await canQueueMoreInvites(config.linkedin_account_id, campaignId);

  const toSchedule = Math.min(pendingResult.rows.length, availableToday, pendingAvailable, weeklyRemaining);

  if (toSchedule === 0) {
    return { scheduled: 0, message: 'No slots available' };
  }

  // Calculate send times (using agent hours + days)
  const sendTimes = calculateRandomSendTimes(toSchedule, {
    send_start_hour: schedule.send_start_hour,
    send_end_hour: schedule.send_end_hour,
    timezone: schedule.timezone,
    days: schedule.days
  });

  // Update queue entries and create Bull delayed jobs
  for (let i = 0; i < toSchedule; i++) {
    const entry = pendingResult.rows[i];
    const scheduledFor = sendTimes[i];
    const expiresAt = DateTime.fromJSDate(scheduledFor).plus({ days: config.invite_expiry_days || 7 }).toJSDate();

    await db.query(
      `UPDATE campaign_invite_queue
       SET status = 'scheduled', scheduled_for = $1, expires_at = $2
       WHERE id = $3`,
      [scheduledFor, expiresAt, entry.id]
    );

    // Create Bull delayed job
    const delayMs = Math.max(0, scheduledFor.getTime() - Date.now());
    const job = await linkedinInviteQueue.add('send-invite', {
      queueId: entry.id,
      campaignId,
      campaignContactId: entry.campaign_contact_id,
      linkedinAccountId: config.linkedin_account_id,
      unipileAccountId: config.unipile_account_id
    }, {
      delay: delayMs,
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000 },
      jobId: `invite-${entry.id}`
    });

    await db.query(
      'UPDATE campaign_invite_queue SET bull_job_id = $1 WHERE id = $2',
      [job.id.toString(), entry.id]
    );

    log.info(`   Reagendado: ${entry.id} → delay ${Math.round(delayMs / 60000)} min (Bull job ${job.id})`);
  }

  return {
    scheduled: toSchedule,
    remaining: pendingResult.rows.length - toSchedule,
    nextScheduledAt: sendTimes[0]
  };
};

/**
 * Cancel all pending/scheduled invites for a campaign
 * @param {string} campaignId - Campaign ID
 * @returns {number} Number of cancelled invites
 */
const cancelCampaignInvites = async (campaignId) => {
  // Cancel Bull jobs (delayed + waiting)
  try {
    const [waitingJobs, delayedJobs] = await Promise.all([
      linkedinInviteQueue.getWaiting(),
      linkedinInviteQueue.getDelayed()
    ]);

    let bullCanceled = 0;
    for (const job of [...waitingJobs, ...delayedJobs]) {
      if (job.data.campaignId === campaignId) {
        await job.remove();
        bullCanceled++;
      }
    }
    log.info(`Bull jobs cancelados: ${bullCanceled}`);
  } catch (bullError) {
    log.error('Erro ao cancelar Bull jobs:', bullError.message);
  }

  // Update DB
  const result = await db.query(
    `UPDATE campaign_invite_queue
     SET status = 'withdrawn', withdrawn_at = NOW()
     WHERE campaign_id = $1 AND status IN ('pending', 'scheduled')
     RETURNING id, campaign_contact_id`,
    [campaignId]
  );

  // Update campaign_contacts - reset to approved status
  if (result.rows.length > 0) {
    const campaignContactIds = result.rows.map(r => r.campaign_contact_id).filter(Boolean);
    if (campaignContactIds.length > 0) {
      await db.query(
        `UPDATE campaign_contacts
         SET status = 'approved', updated_at = NOW()
         WHERE id = ANY($1)`,
        [campaignContactIds]
      );
    }
  }

  return result.rowCount;
};

/**
 * Get campaign report data
 * @param {string} campaignId - Campaign ID
 * @param {object} filters - Filters for the report
 * @returns {object} Report data
 */
const getCampaignReport = async (campaignId, filters = {}) => {
  const { status, page = 1, limit = 50 } = filters;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE cc.campaign_id = $1';
  const params = [campaignId];
  let paramIndex = 2;

  if (status) {
    whereClause += ` AND cc.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  // Get campaign_contacts with contact info and queue info
  const contactsResult = await db.query(
    `SELECT cc.id, cc.campaign_id, cc.contact_id, cc.status,
            cc.invite_sent_at, cc.invite_accepted_at, cc.invite_expires_at,
            ct.name, ct.company, ct.title, ct.profile_picture, ct.profile_url,
            ciq.status as invite_status, ciq.scheduled_for, ciq.sent_at as queue_sent_at,
            ciq.expires_at, ciq.expired_at, ciq.withdrawn_at,
            EXTRACT(DAY FROM NOW() - cc.invite_sent_at) as days_waiting
     FROM campaign_contacts cc
     JOIN contacts ct ON ct.id = cc.contact_id
     LEFT JOIN LATERAL (
       SELECT * FROM campaign_invite_queue q
       WHERE q.campaign_contact_id = cc.id
       ORDER BY q.created_at DESC
       LIMIT 1
     ) ciq ON true
     ${whereClause}
     ORDER BY
       CASE cc.status
         WHEN 'invite_accepted' THEN 1
         WHEN 'conversation_started' THEN 2
         WHEN 'conversation_ended' THEN 3
         WHEN 'invite_sent' THEN 4
         WHEN 'invite_expired' THEN 5
         WHEN 'invite_queued' THEN 6
         WHEN 'approved' THEN 7
         WHEN 'collected' THEN 8
         WHEN 'rejected' THEN 9
         ELSE 10
       END,
       cc.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  // Get total count
  const countResult = await db.query(
    `SELECT COUNT(*) FROM campaign_contacts cc
     ${whereClause}`,
    params
  );

  // Get summary stats based on campaign_contacts status
  const statsResult = await db.query(
    `SELECT
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'collected') as collected,
       COUNT(*) FILTER (WHERE status = 'approved') as approved,
       COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
       COUNT(*) FILTER (WHERE status = 'invite_queued') as queued,
       COUNT(*) FILTER (WHERE status = 'invite_sent') as sent,
       COUNT(*) FILTER (WHERE status = 'invite_accepted') as accepted,
       COUNT(*) FILTER (WHERE status = 'invite_expired') as expired,
       COUNT(*) FILTER (WHERE status = 'conversation_started') as conversation_started,
       COUNT(*) FILTER (WHERE status = 'conversation_ended') as conversation_ended
     FROM campaign_contacts
     WHERE campaign_id = $1`,
    [campaignId]
  );

  return {
    leads: contactsResult.rows,
    summary: statsResult.rows[0],
    pagination: {
      page,
      limit,
      total: parseInt(countResult.rows[0].count),
      totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
    }
  };
};

module.exports = {
  getScheduleFromAgent,
  findNextActiveDay,
  LUXON_DAY_MAP,
  calculateRandomSendTimes,
  createInviteQueue,
  getInviteExpiryDays,
  markInviteAsSent,
  markInviteAsAccepted,
  getExpiredInvites,
  markInviteAsExpired,
  markInviteAsWithdrawn,
  getPendingInvitesCount,
  canQueueMoreInvites,
  getDailyInvitesSent,
  getQueueStatus,
  scheduleInvitesForToday,
  cancelCampaignInvites,
  getCampaignReport
};
