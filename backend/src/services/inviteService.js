// backend/src/services/inviteService.js
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Limites padrão por tipo de conta
const DEFAULT_LIMITS = {
  free: 25,
  premium: 50,
  sales_navigator: 80
};

/**
 * Verificar se uma conta pode enviar mais convites hoje
 * @param {string} linkedinAccountId - ID da conta LinkedIn
 * @returns {Promise<{canSend: boolean, remaining: number, limit: number, sent: number}>}
 */
async function canSendInvite(linkedinAccountId) {
  try {
    // Buscar configuração da conta
    const account = await db.findOne('linkedin_accounts', { id: linkedinAccountId });

    if (!account) {
      throw new Error('LinkedIn account not found');
    }

    // Contar convites enviados hoje
    const sentToday = await getInvitesSentToday(linkedinAccountId);

    const limit = account.daily_limit || DEFAULT_LIMITS[account.account_type] || DEFAULT_LIMITS.free;
    const remaining = Math.max(0, limit - sentToday);

    return {
      canSend: sentToday < limit,
      remaining,
      limit,
      sent: sentToday
    };
  } catch (error) {
    console.error('Error checking invite limit:', error);
    throw error;
  }
}

/**
 * Contar convites enviados nas últimas 24 horas
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
 * Registrar envio de convite
 * @param {Object} data - Dados do convite
 * @param {string} data.linkedinAccountId - ID da conta LinkedIn
 * @param {string} data.campaignId - ID da campanha
 * @param {string} data.opportunityId - ID da opportunity
 * @param {string} data.status - Status do envio ('sent', 'failed', 'pending')
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
 * Obter estatísticas de convites por conta
 * @param {string} linkedinAccountId - ID da conta LinkedIn
 * @returns {Promise<Object>}
 */
async function getInviteStats(linkedinAccountId) {
  try {
    // Buscar configuração da conta
    const account = await db.findOne('linkedin_accounts', { id: linkedinAccountId });

    if (!account) {
      throw new Error('LinkedIn account not found');
    }

    const limit = account.daily_limit || DEFAULT_LIMITS[account.account_type] || DEFAULT_LIMITS.free;
    const sentToday = await getInvitesSentToday(linkedinAccountId);
    const remaining = Math.max(0, limit - sentToday);
    const percentage = Math.round((sentToday / limit) * 100);

    // Buscar estatísticas por campanha
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
      daily_limit: limit,
      sent_today: sentToday,
      remaining,
      percentage,
      can_send: sentToday < limit,
      reset_at: getNextResetTime(),
      campaigns: campaignStats.rows || []
    };
  } catch (error) {
    console.error('Error getting invite stats:', error);
    throw error;
  }
}

/**
 * Calcular hora do próximo reset (meia-noite)
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
 * Atualizar limite diário de uma conta
 * @param {string} linkedinAccountId - ID da conta LinkedIn
 * @param {number} newLimit - Novo limite diário
 * @returns {Promise<Object>}
 */
async function updateDailyLimit(linkedinAccountId, newLimit) {
  try {
    // Validar limite
    if (newLimit < 0 || newLimit > 200) {
      throw new Error('Daily limit must be between 0 and 200');
    }

    // Avisar se limite muito alto
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
 * Obter histórico de convites (últimos 7 dias)
 * @param {string} linkedinAccountId - ID da conta LinkedIn
 * @param {number} days - Número de dias de histórico (padrão: 7)
 * @returns {Promise<Array>}
 */
async function getInviteHistory(linkedinAccountId, days = 7) {
  try {
    const result = await db.query(
      `SELECT
         DATE(sent_at) as date,
         COUNT(*) FILTER (WHERE status = 'sent') as sent,
         COUNT(*) FILTER (WHERE status = 'failed') as failed
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
  logInviteSent,
  getInviteStats,
  updateDailyLimit,
  getInviteHistory,
  DEFAULT_LIMITS
};
