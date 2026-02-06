// backend/src/services/inviteService.js
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Limites padrão por tipo de conta (alinhados com limites reais do LinkedIn)
// - daily: inner safety cap para evitar burst em um unico dia
// - weekly: limite real do LinkedIn (rolling 7 days)
// - monthly_messages: convites com nota personalizada por mes calendario
//   Free: 5-10/mes (usamos 10), Premium/SalesNav: ilimitado
// - note_char_limit: limite de caracteres da nota de convite
const DEFAULT_LIMITS = {
  free:            { daily: 20, weekly: 100, monthly_messages: 10,    note_char_limit: 200 },
  premium:         { daily: 35, weekly: 200, monthly_messages: 99999, note_char_limit: 300 },
  sales_navigator: { daily: 40, weekly: 250, monthly_messages: 99999, note_char_limit: 300 },
  recruiter:       { daily: 40, weekly: 250, monthly_messages: 99999, note_char_limit: 300 }
};

/**
 * Resolve os limites para uma conta, usando valores do DB com fallback para defaults
 */
function resolveLimits(account) {
  const type = account.account_type || 'free';
  const defaults = DEFAULT_LIMITS[type] || DEFAULT_LIMITS.free;

  return {
    daily: account.daily_limit || defaults.daily,
    weekly: account.weekly_limit || defaults.weekly,
    monthly_messages: account.monthly_message_limit ?? defaults.monthly_messages,
    note_char_limit: account.note_char_limit || defaults.note_char_limit
  };
}

/**
 * Verificar se uma conta pode enviar mais convites
 * Checa 3 niveis de limite: diario (inner cap), semanal, mensal de mensagens
 *
 * @param {string} linkedinAccountId - ID da conta LinkedIn
 * @param {Object} options - Opcoes
 * @param {boolean} options.withMessage - Se o convite tera mensagem personalizada
 * @returns {Promise<Object>} Status completo dos limites
 */
async function canSendInvite(linkedinAccountId, options = {}) {
  try {
    const account = await db.findOne('linkedin_accounts', { id: linkedinAccountId });

    if (!account) {
      throw new Error('LinkedIn account not found');
    }

    const limits = resolveLimits(account);

    // Contar em paralelo
    const [sentToday, sentThisWeek, messagesSentThisMonth] = await Promise.all([
      getInvitesSentToday(linkedinAccountId),
      getInvitesSentThisWeek(linkedinAccountId),
      options.withMessage ? getMessagesSentThisMonth(linkedinAccountId) : Promise.resolve(0)
    ]);

    const dailyRemaining = Math.max(0, limits.daily - sentToday);
    const weeklyRemaining = Math.max(0, limits.weekly - sentThisWeek);
    const monthlyMessagesRemaining = Math.max(0, limits.monthly_messages - messagesSentThisMonth);

    // Determinar se pode enviar (checa diario + semanal)
    const canSend = sentToday < limits.daily && sentThisWeek < limits.weekly;

    // Determinar se pode enviar COM mensagem (checa limite mensal de mensagens)
    const canSendWithMessage = canSend && messagesSentThisMonth < limits.monthly_messages;

    // Determinar o motivo do bloqueio
    let limitReason = null;
    if (!canSend) {
      if (sentThisWeek >= limits.weekly) limitReason = 'weekly';
      else if (sentToday >= limits.daily) limitReason = 'daily';
    } else if (options.withMessage && !canSendWithMessage) {
      limitReason = 'monthly_messages';
    }

    return {
      canSend,
      canSendWithMessage,
      daily: { sent: sentToday, limit: limits.daily, remaining: dailyRemaining },
      weekly: { sent: sentThisWeek, limit: limits.weekly, remaining: weeklyRemaining },
      monthly_messages: { sent: messagesSentThisMonth, limit: limits.monthly_messages, remaining: monthlyMessagesRemaining },
      note_char_limit: limits.note_char_limit,
      limitReason
    };
  } catch (error) {
    console.error('Error checking invite limit:', error);
    throw error;
  }
}

/**
 * Contar convites enviados nas ultimas 24 horas
 * @param {string} linkedinAccountId - ID da conta LinkedIn
 * @returns {Promise<number>}
 */
async function getInvitesSentToday(linkedinAccountId) {
  try {
    const result = await db.query(
      `SELECT COUNT(*) as count
       FROM linkedin_invite_logs
       WHERE linkedin_account_id = $1
         AND sent_at >= NOW() - INTERVAL '24 hours'
         AND status = 'sent'`,
      [linkedinAccountId]
    );

    return parseInt(result.rows[0]?.count || 0);
  } catch (error) {
    console.error('Error counting invites sent today:', error);
    throw error;
  }
}

/**
 * Contar convites enviados nos ultimos 7 dias (rolling week)
 * @param {string} linkedinAccountId - ID da conta LinkedIn
 * @returns {Promise<number>}
 */
async function getInvitesSentThisWeek(linkedinAccountId) {
  try {
    const result = await db.query(
      `SELECT COUNT(*) as count
       FROM linkedin_invite_logs
       WHERE linkedin_account_id = $1
         AND sent_at >= NOW() - INTERVAL '7 days'
         AND status = 'sent'`,
      [linkedinAccountId]
    );

    return parseInt(result.rows[0]?.count || 0);
  } catch (error) {
    console.error('Error counting invites sent this week:', error);
    throw error;
  }
}

/**
 * Contar convites COM mensagem personalizada enviados no mes calendario atual
 * @param {string} linkedinAccountId - ID da conta LinkedIn
 * @returns {Promise<number>}
 */
async function getMessagesSentThisMonth(linkedinAccountId) {
  try {
    const result = await db.query(
      `SELECT COUNT(*) as count
       FROM linkedin_invite_logs
       WHERE linkedin_account_id = $1
         AND sent_at >= DATE_TRUNC('month', CURRENT_DATE)
         AND status = 'sent'
         AND message_included = true`,
      [linkedinAccountId]
    );

    return parseInt(result.rows[0]?.count || 0);
  } catch (error) {
    console.error('Error counting messages sent this month:', error);
    throw error;
  }
}

/**
 * Registrar envio de convite
 * @param {Object} data - Dados do convite
 * @param {string} data.linkedinAccountId - ID da conta LinkedIn
 * @param {string} data.campaignId - ID da campanha
 * @param {string} data.opportunityId - ID da opportunity
 * @param {string} data.status - Status do envio ('sent', 'failed', 'pending')
 * @param {boolean} data.messageIncluded - Se o convite incluiu mensagem personalizada
 * @returns {Promise<Object>}
 */
async function logInviteSent(data) {
  try {
    const logData = {
      id: uuidv4(),
      linkedin_account_id: data.linkedinAccountId,
      campaign_id: data.campaignId || null,
      opportunity_id: data.opportunityId || null,
      status: data.status || 'sent',
      message_included: data.messageIncluded || false,
      sent_at: new Date()
    };

    const result = await db.insert('linkedin_invite_logs', logData);
    return result;
  } catch (error) {
    console.error('Error logging invite:', error);
    throw error;
  }
}

/**
 * Obter estatisticas de convites por conta (diario + semanal + mensal)
 * @param {string} linkedinAccountId - ID da conta LinkedIn
 * @returns {Promise<Object>}
 */
async function getInviteStats(linkedinAccountId) {
  try {
    const account = await db.findOne('linkedin_accounts', { id: linkedinAccountId });

    if (!account) {
      throw new Error('LinkedIn account not found');
    }

    const limits = resolveLimits(account);

    const [sentToday, sentThisWeek, messagesSentThisMonth] = await Promise.all([
      getInvitesSentToday(linkedinAccountId),
      getInvitesSentThisWeek(linkedinAccountId),
      getMessagesSentThisMonth(linkedinAccountId)
    ]);

    const dailyRemaining = Math.max(0, limits.daily - sentToday);
    const weeklyRemaining = Math.max(0, limits.weekly - sentThisWeek);
    const monthlyMessagesRemaining = Math.max(0, limits.monthly_messages - messagesSentThisMonth);

    // Buscar estatisticas por campanha
    const campaignStats = await db.query(
      `SELECT
         c.id,
         c.name,
         COUNT(l.id) as invites_sent
       FROM campaigns c
       LEFT JOIN linkedin_invite_logs l ON l.campaign_id = c.id
         AND l.linkedin_account_id = $1
         AND l.sent_at >= NOW() - INTERVAL '24 hours'
         AND l.status = 'sent'
       WHERE c.linkedin_account_id = $1
         AND c.status = 'active'
       GROUP BY c.id, c.name`,
      [linkedinAccountId]
    );

    return {
      account: {
        id: account.id,
        name: account.profile_name || account.linkedin_username,
        type: account.account_type || 'free'
      },
      // Limites diarios (inner safety cap)
      daily_limit: limits.daily,
      sent_today: sentToday,
      remaining: dailyRemaining,
      percentage: Math.round((sentToday / limits.daily) * 100),
      can_send: sentToday < limits.daily && sentThisWeek < limits.weekly,
      reset_at: getNextResetTime(),
      // Limites semanais (limite real do LinkedIn)
      weekly: {
        limit: limits.weekly,
        sent: sentThisWeek,
        remaining: weeklyRemaining,
        percentage: Math.round((sentThisWeek / limits.weekly) * 100)
      },
      // Limites mensais de mensagens personalizadas
      monthly_messages: {
        limit: limits.monthly_messages,
        sent: messagesSentThisMonth,
        remaining: monthlyMessagesRemaining,
        percentage: limits.monthly_messages < 99999
          ? Math.round((messagesSentThisMonth / limits.monthly_messages) * 100)
          : 0,
        is_limited: limits.monthly_messages < 99999
      },
      // Limite de caracteres
      note_char_limit: limits.note_char_limit,
      campaigns: campaignStats.rows || []
    };
  } catch (error) {
    console.error('Error getting invite stats:', error);
    throw error;
  }
}

/**
 * Calcular hora do proximo reset (meia-noite)
 * @returns {Date}
 */
function getNextResetTime() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

/**
 * Atualizar limite diario de uma conta
 * @param {string} linkedinAccountId - ID da conta LinkedIn
 * @param {number} newLimit - Novo limite diario
 * @returns {Promise<Object>}
 */
async function updateDailyLimit(linkedinAccountId, newLimit) {
  try {
    if (newLimit < 0 || newLimit > 200) {
      throw new Error('Daily limit must be between 0 and 200');
    }

    if (newLimit > 100) {
      console.warn(`⚠️ High daily limit set (${newLimit}). Risk of LinkedIn account restriction.`);
    }

    const updated = await db.update(
      'linkedin_accounts',
      { daily_limit: newLimit },
      { id: linkedinAccountId }
    );

    return updated;
  } catch (error) {
    console.error('Error updating daily limit:', error);
    throw error;
  }
}

/**
 * Atualizar limites de uma conta (diario + semanal)
 * @param {string} linkedinAccountId - ID da conta LinkedIn
 * @param {Object} limits - Novos limites
 * @param {number} limits.daily - Limite diario
 * @param {number} limits.weekly - Limite semanal
 * @returns {Promise<Object>}
 */
async function updateLimits(linkedinAccountId, limits) {
  try {
    const updateData = {};

    if (limits.daily !== undefined) {
      if (limits.daily < 0 || limits.daily > 200) {
        throw new Error('Daily limit must be between 0 and 200');
      }
      updateData.daily_limit = limits.daily;
    }

    if (limits.weekly !== undefined) {
      if (limits.weekly < 0 || limits.weekly > 500) {
        throw new Error('Weekly limit must be between 0 and 500');
      }
      updateData.weekly_limit = limits.weekly;
    }

    const updated = await db.update(
      'linkedin_accounts',
      updateData,
      { id: linkedinAccountId }
    );

    return updated;
  } catch (error) {
    console.error('Error updating limits:', error);
    throw error;
  }
}

/**
 * Obter historico de convites (ultimos N dias)
 * @param {string} linkedinAccountId - ID da conta LinkedIn
 * @param {number} days - Numero de dias de historico (padrao: 7)
 * @returns {Promise<Array>}
 */
async function getInviteHistory(linkedinAccountId, days = 7) {
  try {
    const result = await db.query(
      `SELECT
         DATE(sent_at) as date,
         COUNT(*) FILTER (WHERE status = 'sent') as sent,
         COUNT(*) FILTER (WHERE status = 'failed') as failed,
         COUNT(*) FILTER (WHERE status = 'sent' AND message_included = true) as with_message,
         COUNT(*) FILTER (WHERE status = 'sent' AND message_included = false) as without_message
       FROM linkedin_invite_logs
       WHERE linkedin_account_id = $1
         AND sent_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(sent_at)
       ORDER BY date DESC`,
      [linkedinAccountId]
    );

    return result.rows || [];
  } catch (error) {
    console.error('Error getting invite history:', error);
    throw error;
  }
}

module.exports = {
  canSendInvite,
  getInvitesSentToday,
  getInvitesSentThisWeek,
  getMessagesSentThisMonth,
  logInviteSent,
  getInviteStats,
  updateDailyLimit,
  updateLimits,
  getInviteHistory,
  DEFAULT_LIMITS
};
