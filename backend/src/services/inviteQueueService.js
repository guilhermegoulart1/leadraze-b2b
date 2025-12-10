// backend/src/services/inviteQueueService.js
const db = require('../config/database');
const { DateTime } = require('luxon');

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
 * Calculate random send times for invites throughout the day
 * @param {number} count - Number of invites to schedule
 * @param {object} config - Configuration with send hours and timezone
 * @returns {Date[]} Array of scheduled times
 */
const calculateRandomSendTimes = (count, config = {}) => {
  const {
    send_start_hour = 9,
    send_end_hour = 18,
    timezone = 'America/Sao_Paulo'
  } = config;

  const schedule = [];
  const totalMinutes = (send_end_hour - send_start_hour) * 60;

  // Get current time in the specified timezone
  const now = DateTime.now().setZone(timezone);
  const today = now.startOf('day');

  for (let i = 0; i < count; i++) {
    // Random minute within business hours
    const randomMinute = Math.floor(Math.random() * totalMinutes);
    const hour = send_start_hour + Math.floor(randomMinute / 60);
    const minute = randomMinute % 60;

    // Add jitter of ±5 minutes for more natural distribution
    const jitter = Math.floor(Math.random() * 10) - 5;
    const finalMinute = Math.max(0, Math.min(59, minute + jitter));

    // Create the scheduled time
    let scheduledTime = today.set({ hour, minute: finalMinute, second: 0, millisecond: 0 });

    // If time is in the past, schedule for tomorrow
    if (scheduledTime < now) {
      scheduledTime = scheduledTime.plus({ days: 1 });
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

    // Get campaign with review config
    const campaignResult = await client.query(
      `SELECT c.*, crc.*, la.id as linkedin_account_id, la.unipile_account_id, la.daily_limit
       FROM campaigns c
       LEFT JOIN campaign_review_config crc ON crc.campaign_id = c.id
       LEFT JOIN campaign_linkedin_accounts cla ON cla.campaign_id = c.id AND cla.is_active = true
       LEFT JOIN linkedin_accounts la ON la.id = cla.linkedin_account_id
       WHERE c.id = $1 AND c.account_id = $2`,
      [campaignId, accountId]
    );

    if (campaignResult.rows.length === 0) {
      log.error('Campanha não encontrada!');
      throw new Error('Campaign not found');
    }

    const campaign = campaignResult.rows[0];
    log.step('2/6', 'Campanha encontrada:', {
      name: campaign.name,
      linkedin_account_id: campaign.linkedin_account_id,
      is_reviewed: campaign.is_reviewed,
      invite_expiry_days: campaign.invite_expiry_days,
      send_start_hour: campaign.send_start_hour,
      send_end_hour: campaign.send_end_hour,
      timezone: campaign.timezone
    });

    if (!campaign.is_reviewed) {
      log.error('Campanha não foi revisada!');
      throw new Error('Campaign must be reviewed before starting');
    }

    // Get pending leads (status = 'leads' or 'lead')
    const leadsResult = await client.query(
      `SELECT id, linkedin_profile_id, name
       FROM leads
       WHERE campaign_id = $1 AND status IN ('leads', 'lead')
       ORDER BY created_at ASC`,
      [campaignId]
    );

    const leads = leadsResult.rows;
    log.step('3/6', `Leads pendentes encontrados: ${leads.length}`);
    leads.forEach((l, i) => log.info(`   [${i+1}] ${l.name} (${l.linkedin_profile_id})`));

    if (leads.length === 0) {
      log.warn('Nenhum lead pendente para enfileirar');
      throw new Error('No pending leads to queue');
    }

    // Get daily limit and pending count
    const dailyLimit = campaign.daily_limit || 50;
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

    log.step('4/6', 'Limites calculados:', {
      dailyLimit,
      maxPending,
      currentPending,
      availableSlots
    });

    // Calculate how many invites we can queue today
    const invitesToday = Math.min(leads.length, dailyLimit, availableSlots);
    log.info(`   Convites para hoje: ${invitesToday}`);

    // Calculate random send times for today's invites
    const sendTimes = calculateRandomSendTimes(invitesToday, {
      send_start_hour: campaign.send_start_hour,
      send_end_hour: campaign.send_end_hour,
      timezone: campaign.timezone
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

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      const scheduledFor = i < sendTimes.length ? sendTimes[i] : null;
      const status = scheduledFor ? 'scheduled' : 'pending';

      // Calculate expiration (from when it will be sent)
      const expiresAt = scheduledFor
        ? DateTime.fromJSDate(scheduledFor).plus({ days: expiryDays }).toJSDate()
        : null;

      await client.query(
        `INSERT INTO campaign_invite_queue
         (account_id, campaign_id, lead_id, linkedin_account_id, status, scheduled_for, expires_at, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [accountId, campaignId, lead.id, campaign.linkedin_account_id, status, scheduledFor, expiresAt, i]
      );

      // Update lead status
      await client.query(
        `UPDATE leads SET status = 'invite_queued', invite_queued_at = NOW() WHERE id = $1`,
        [lead.id]
      );

      const scheduleInfo = scheduledFor
        ? `agendado para ${DateTime.fromJSDate(scheduledFor).toFormat('HH:mm')}`
        : 'pendente (próximo dia)';
      log.info(`   ✓ ${lead.name} - ${status} (${scheduleInfo})`);

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
 * Get scheduled invites for processing
 * @param {number} limit - Maximum invites to get
 * @returns {object[]} Invites ready to be sent
 */
const getScheduledInvites = async (limit = 10) => {
  const result = await db.query(
    `SELECT ciq.*, l.linkedin_profile_id, l.name as lead_name, l.profile_url,
            c.name as campaign_name, la.unipile_account_id
     FROM campaign_invite_queue ciq
     JOIN leads l ON l.id = ciq.lead_id
     JOIN campaigns c ON c.id = ciq.campaign_id
     JOIN linkedin_accounts la ON la.id = ciq.linkedin_account_id
     WHERE ciq.status = 'scheduled'
       AND ciq.scheduled_for <= NOW()
       AND c.status = 'active'
       AND c.automation_active = true
     ORDER BY ciq.scheduled_for ASC, ciq.priority ASC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
};

/**
 * Mark invite as sent
 * @param {string} queueId - Queue entry ID
 * @param {string} leadId - Lead ID
 * @param {number} expiryDays - Days until expiration
 */
const markInviteAsSent = async (queueId, leadId, expiryDays = 7) => {
  const expiresAt = DateTime.now().plus({ days: expiryDays }).toJSDate();

  log.info('───────────────────────────────────────────────────────────');
  log.info('📤 MARCANDO CONVITE COMO ENVIADO');
  log.info(`   Queue ID: ${queueId}`);
  log.info(`   Lead ID: ${leadId}`);
  log.info(`   Expira em: ${expiryDays} dias (${DateTime.fromJSDate(expiresAt).toFormat('dd/MM/yyyy HH:mm')})`);

  await db.query(
    `UPDATE campaign_invite_queue
     SET status = 'sent', sent_at = NOW(), expires_at = $1
     WHERE id = $2`,
    [expiresAt, queueId]
  );

  await db.query(
    `UPDATE leads
     SET status = 'invite_sent', sent_at = NOW(), invite_expires_at = $1
     WHERE id = $2`,
    [expiresAt, leadId]
  );

  log.success('Convite marcado como ENVIADO');
  log.info('───────────────────────────────────────────────────────────');
};

/**
 * Mark invite as accepted
 * @param {string} leadId - Lead ID
 */
const markInviteAsAccepted = async (leadId) => {
  log.info('───────────────────────────────────────────────────────────');
  log.info('🎉 MARCANDO CONVITE COMO ACEITO');
  log.info(`   Lead ID: ${leadId}`);

  // Update queue entry
  const queueResult = await db.query(
    `UPDATE campaign_invite_queue
     SET status = 'accepted', updated_at = NOW()
     WHERE lead_id = $1 AND status = 'sent'
     RETURNING id, campaign_id`,
    [leadId]
  );

  if (queueResult.rows.length > 0) {
    log.info(`   Queue entry atualizada: ${queueResult.rows[0].id}`);
  } else {
    log.warn('   Nenhuma entrada encontrada na fila com status "sent"');
  }

  // Update lead
  await db.query(
    `UPDATE leads
     SET status = 'accepted', accepted_at = NOW()
     WHERE id = $1`,
    [leadId]
  );

  // Decrement pending count
  await db.query(
    `UPDATE campaigns c
     SET pending_invites_count = GREATEST(0, pending_invites_count - 1)
     FROM leads l
     WHERE l.id = $1 AND c.id = l.campaign_id`,
    [leadId]
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
    `SELECT ciq.*, l.linkedin_profile_id, l.name as lead_name,
            c.id as campaign_id, c.name as campaign_name, c.account_id,
            crc.withdraw_expired_invites, crc.sector_id, crc.round_robin_users,
            la.unipile_account_id
     FROM campaign_invite_queue ciq
     JOIN leads l ON l.id = ciq.lead_id
     JOIN campaigns c ON c.id = ciq.campaign_id
     LEFT JOIN campaign_review_config crc ON crc.campaign_id = c.id
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
 * @param {string} leadId - Lead ID
 */
const markInviteAsExpired = async (queueId, leadId) => {
  log.info('───────────────────────────────────────────────────────────');
  log.info('⏰ MARCANDO CONVITE COMO EXPIRADO');
  log.info(`   Queue ID: ${queueId}`);
  log.info(`   Lead ID: ${leadId}`);

  await db.query(
    `UPDATE campaign_invite_queue
     SET status = 'expired', expired_at = NOW()
     WHERE id = $1`,
    [queueId]
  );

  await db.query(
    `UPDATE leads
     SET status = 'invite_expired', invite_expired_at = NOW()
     WHERE id = $1`,
    [leadId]
  );

  // Decrement pending count
  await db.query(
    `UPDATE campaigns c
     SET pending_invites_count = GREATEST(0, pending_invites_count - 1)
     FROM leads l
     WHERE l.id = $1 AND c.id = l.campaign_id`,
    [leadId]
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
    `SELECT ciq.id, ciq.lead_id
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

  // Get config
  const configResult = await db.query(
    `SELECT crc.*, la.id as linkedin_account_id, la.daily_limit
     FROM campaign_review_config crc
     JOIN campaigns c ON c.id = crc.campaign_id
     JOIN campaign_linkedin_accounts cla ON cla.campaign_id = c.id AND cla.is_active = true
     JOIN linkedin_accounts la ON la.id = cla.linkedin_account_id
     WHERE crc.campaign_id = $1`,
    [campaignId]
  );

  if (configResult.rows.length === 0) {
    return { scheduled: 0, message: 'Campaign config not found' };
  }

  const config = configResult.rows[0];

  // Check how many we can still send today
  const sentToday = await getDailyInvitesSent(config.linkedin_account_id);
  const dailyLimit = config.daily_limit || 50;
  const availableToday = Math.max(0, dailyLimit - sentToday);

  if (availableToday === 0) {
    return { scheduled: 0, message: 'Daily limit reached' };
  }

  // Check pending limit
  const { available: pendingAvailable } = await canQueueMoreInvites(config.linkedin_account_id, campaignId);

  const toSchedule = Math.min(pendingResult.rows.length, availableToday, pendingAvailable);

  if (toSchedule === 0) {
    return { scheduled: 0, message: 'No slots available' };
  }

  // Calculate send times
  const sendTimes = calculateRandomSendTimes(toSchedule, {
    send_start_hour: config.send_start_hour,
    send_end_hour: config.send_end_hour,
    timezone: config.timezone
  });

  // Update queue entries
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
  const result = await db.query(
    `UPDATE campaign_invite_queue
     SET status = 'withdrawn', withdrawn_at = NOW()
     WHERE campaign_id = $1 AND status IN ('pending', 'scheduled')
     RETURNING id`,
    [campaignId]
  );

  // Update leads back to 'leads' status
  await db.query(
    `UPDATE leads l
     SET status = 'leads', invite_queued_at = NULL
     FROM campaign_invite_queue ciq
     WHERE ciq.lead_id = l.id
       AND ciq.campaign_id = $1
       AND ciq.status = 'withdrawn'`,
    [campaignId]
  );

  return result.rowCount;
};

/**
 * Get campaign report data
 * @param {string} campaignId - Campaign ID
 * @param {object} filters - Filters for the report
 * @returns {object} Report data
 */
const getCampaignReport = async (campaignId, filters = {}) => {
  const { status, assignedUserId, page = 1, limit = 50 } = filters;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE l.campaign_id = $1';
  const params = [campaignId];
  let paramIndex = 2;

  if (status) {
    // Filter by invite status (ciq.status) for invite-related filters
    const inviteStatuses = ['pending', 'scheduled', 'sent', 'accepted', 'expired', 'withdrawn', 'failed'];
    if (inviteStatuses.includes(status)) {
      whereClause += ` AND ciq.status = $${paramIndex}`;
    } else {
      whereClause += ` AND l.status = $${paramIndex}`;
    }
    params.push(status);
    paramIndex++;
  }

  if (assignedUserId) {
    whereClause += ` AND l.responsible_user_id = $${paramIndex}`;
    params.push(assignedUserId);
    paramIndex++;
  }

  // Get leads with queue info
  const leadsResult = await db.query(
    `SELECT l.*, ciq.status as invite_status, ciq.scheduled_for, ciq.sent_at as invite_sent_at,
            ciq.expires_at, ciq.expired_at, ciq.withdrawn_at,
            u.id as responsible_id, u.name as responsible_name, u.avatar_url as responsible_avatar,
            EXTRACT(DAY FROM NOW() - l.sent_at) as days_waiting
     FROM leads l
     LEFT JOIN campaign_invite_queue ciq ON ciq.lead_id = l.id
     LEFT JOIN users u ON u.id = l.responsible_user_id
     ${whereClause}
     ORDER BY l.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  // Get total count
  const countResult = await db.query(
    `SELECT COUNT(*) FROM leads l ${whereClause}`,
    params
  );

  // Get summary stats
  const statsResult = await db.query(
    `SELECT
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status IN ('leads', 'lead', 'invite_queued')) as pending,
       COUNT(*) FILTER (WHERE status = 'invite_sent') as sent,
       COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
       COUNT(*) FILTER (WHERE status = 'invite_expired') as expired,
       COUNT(*) FILTER (WHERE status = 'qualifying') as qualifying,
       COUNT(*) FILTER (WHERE status = 'qualified') as qualified,
       COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled_meetings,
       COUNT(*) FILTER (WHERE status = 'won') as won,
       COUNT(*) FILTER (WHERE status = 'lost' OR status = 'discarded') as lost
     FROM leads
     WHERE campaign_id = $1`,
    [campaignId]
  );

  return {
    leads: leadsResult.rows,
    summary: statsResult.rows[0],
    pagination: {
      page,
      limit,
      total: parseInt(countResult.rows[0].count),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
    }
  };
};

module.exports = {
  calculateRandomSendTimes,
  createInviteQueue,
  getScheduledInvites,
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
