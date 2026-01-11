/**
 * Notification Service
 *
 * Manages in-app notifications for users.
 * Supports various notification types: handoff, new_message, escalation, assignment
 */

const db = require('../config/database');

/**
 * Create a new notification
 * @param {object} data - Notification data
 * @returns {Promise<object>}
 */
async function create(data) {
  try {
    const {
      account_id,
      user_id,
      type,
      title,
      message,
      conversation_id = null,
      opportunity_id = null,
      agent_id = null,
      metadata = {}
    } = data;

    const result = await db.query(`
      INSERT INTO notifications (
        account_id, user_id, type, title, message,
        conversation_id, opportunity_id, agent_id, metadata,
        is_read, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, NOW())
      RETURNING *
    `, [
      account_id,
      user_id,
      type,
      title,
      message,
      conversation_id,
      opportunity_id,
      agent_id,
      JSON.stringify(metadata)
    ]);

    console.log(`✅ [NotificationService] Created notification for user ${user_id}: ${title}`);

    return result.rows[0];
  } catch (error) {
    console.error('[NotificationService] Error creating notification:', error);
    throw error;
  }
}

/**
 * Get notifications for a user
 * @param {number} userId - The user ID
 * @param {object} options - Query options
 * @returns {Promise<Array>}
 */
async function getByUser(userId, options = {}) {
  try {
    const {
      limit = 50,
      offset = 0,
      unreadOnly = false,
      type = null
    } = options;

    let query = `
      SELECT n.*,
             o.title as opportunity_title,
             ct.name as contact_name,
             ct.company as contact_company,
             c.last_message_preview,
             a.name as agent_name
      FROM notifications n
      LEFT JOIN opportunities o ON n.opportunity_id = o.id
      LEFT JOIN contacts ct ON o.contact_id = ct.id
      LEFT JOIN conversations c ON n.conversation_id = c.id
      LEFT JOIN ai_agents a ON n.agent_id = a.id
      WHERE n.user_id = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    if (unreadOnly) {
      query += ` AND n.is_read = false`;
    }

    if (type) {
      query += ` AND n.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    query += ` ORDER BY n.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    return result.rows;
  } catch (error) {
    console.error('[NotificationService] Error getting notifications:', error);
    throw error;
  }
}

/**
 * Mark a notification as read
 * @param {number} notificationId - The notification ID
 * @param {number} userId - The user ID (for security)
 * @returns {Promise<object>}
 */
async function markAsRead(notificationId, userId) {
  try {
    const result = await db.query(`
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [notificationId, userId]);

    return result.rows[0];
  } catch (error) {
    console.error('[NotificationService] Error marking as read:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 * @param {number} userId - The user ID
 * @returns {Promise<number>} Number of notifications marked as read
 */
async function markAllAsRead(userId) {
  try {
    const result = await db.query(`
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE user_id = $1 AND is_read = false
    `, [userId]);

    console.log(`✅ [NotificationService] Marked ${result.rowCount} notifications as read for user ${userId}`);

    return result.rowCount;
  } catch (error) {
    console.error('[NotificationService] Error marking all as read:', error);
    throw error;
  }
}

/**
 * Count unread notifications for a user
 * @param {number} userId - The user ID
 * @returns {Promise<number>}
 */
async function countUnread(userId) {
  try {
    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = $1 AND is_read = false
    `, [userId]);

    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('[NotificationService] Error counting unread:', error);
    throw error;
  }
}

/**
 * Delete a notification
 * @param {number} notificationId - The notification ID
 * @param {number} userId - The user ID (for security)
 * @returns {Promise<boolean>}
 */
async function deleteNotification(notificationId, userId) {
  try {
    const result = await db.query(`
      DELETE FROM notifications
      WHERE id = $1 AND user_id = $2
    `, [notificationId, userId]);

    return result.rowCount > 0;
  } catch (error) {
    console.error('[NotificationService] Error deleting notification:', error);
    throw error;
  }
}

/**
 * Delete old notifications (cleanup)
 * @param {number} daysOld - Delete notifications older than this many days
 * @returns {Promise<number>} Number of deleted notifications
 */
async function deleteOldNotifications(daysOld = 30) {
  try {
    const result = await db.query(`
      DELETE FROM notifications
      WHERE created_at < NOW() - INTERVAL '${daysOld} days'
      AND is_read = true
    `);

    console.log(`✅ [NotificationService] Deleted ${result.rowCount} old notifications`);

    return result.rowCount;
  } catch (error) {
    console.error('[NotificationService] Error deleting old notifications:', error);
    throw error;
  }
}

/**
 * Create bulk notifications for multiple users
 * @param {Array<number>} userIds - Array of user IDs
 * @param {object} notificationData - Common notification data
 * @returns {Promise<number>} Number of notifications created
 */
async function createBulk(userIds, notificationData) {
  try {
    const {
      account_id,
      type,
      title,
      message,
      conversation_id = null,
      opportunity_id = null,
      agent_id = null,
      metadata = {}
    } = notificationData;

    let count = 0;

    for (const userId of userIds) {
      await db.query(`
        INSERT INTO notifications (
          account_id, user_id, type, title, message,
          conversation_id, opportunity_id, agent_id, metadata,
          is_read, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, NOW())
      `, [
        account_id,
        userId,
        type,
        title,
        message,
        conversation_id,
        opportunity_id,
        agent_id,
        JSON.stringify(metadata)
      ]);
      count++;
    }

    console.log(`✅ [NotificationService] Created ${count} bulk notifications`);

    return count;
  } catch (error) {
    console.error('[NotificationService] Error creating bulk notifications:', error);
    throw error;
  }
}

/**
 * Create notification for invite accepted
 * @param {object} data - Notification data
 * @returns {Promise<object>}
 */
async function notifyInviteAccepted({ accountId, userId, opportunityName, opportunityId, campaignId, campaignName }) {
  return create({
    account_id: accountId,
    user_id: userId,
    type: 'invite_accepted',
    title: 'Convite aceito',
    message: `${opportunityName} aceitou seu convite no LinkedIn`,
    opportunity_id: opportunityId,
    metadata: {
      campaign_id: campaignId,
      campaign_name: campaignName,
      contact_name: opportunityName,
      link: `/campaigns/${campaignId}/report`
    }
  });
}

/**
 * Create notification for invite expired
 * @param {object} data - Notification data
 * @returns {Promise<object>}
 */
async function notifyInviteExpired({ accountId, userId, opportunityName, opportunityId, campaignId, campaignName }) {
  return create({
    account_id: accountId,
    user_id: userId,
    type: 'invite_expired',
    title: 'Convite expirado',
    message: `O convite para ${opportunityName} expirou sem resposta`,
    opportunity_id: opportunityId,
    metadata: {
      campaign_id: campaignId,
      campaign_name: campaignName,
      contact_name: opportunityName,
      link: `/campaigns/${campaignId}/report`
    }
  });
}

/**
 * Create notification for channel disconnected
 * @param {object} data - Notification data
 * @returns {Promise<object>}
 */
async function notifyChannelDisconnected({ accountId, userId, channelName, channelId, providerType }) {
  return create({
    account_id: accountId,
    user_id: userId,
    type: 'channel_disconnected',
    title: 'Canal desconectado',
    message: `Seu canal ${channelName || providerType} foi desconectado. Reconecte para continuar recebendo mensagens.`,
    metadata: {
      channel_id: channelId,
      provider_type: providerType,
      channel_name: channelName,
      link: '/config?tab=channels'
    }
  });
}

module.exports = {
  create,
  getByUser,
  markAsRead,
  markAllAsRead,
  countUnread,
  deleteNotification,
  deleteOldNotifications,
  createBulk,
  notifyInviteAccepted,
  notifyInviteExpired,
  notifyChannelDisconnected
};
