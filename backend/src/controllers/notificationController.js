// backend/src/controllers/notificationController.js

const notificationService = require('../services/notificationService');
const { sendSuccess, sendError } = require('../utils/responses');
const db = require('../config/database');
const unipileClient = require('../config/unipile');

/**
 * Get notifications for the authenticated user
 * GET /api/notifications
 */
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      limit = 50,
      offset = 0,
      unread_only = false,
      type = null
    } = req.query;

    const notifications = await notificationService.getByUser(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      unreadOnly: unread_only === 'true',
      type
    });

    sendSuccess(res, { notifications });
  } catch (error) {
    console.error('[NotificationController] Error getting notifications:', error);
    sendError(res, error);
  }
};

/**
 * Get unread notification count for the authenticated user
 * GET /api/notifications/count
 */
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await notificationService.countUnread(userId);

    sendSuccess(res, { count });
  } catch (error) {
    console.error('[NotificationController] Error getting unread count:', error);
    sendError(res, error);
  }
};

/**
 * Mark a single notification as read
 * POST /api/notifications/:id/read
 */
const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const notification = await notificationService.markAsRead(notificationId, userId);

    if (!notification) {
      return sendError(res, { message: 'Notification not found' }, 404);
    }

    sendSuccess(res, { notification });
  } catch (error) {
    console.error('[NotificationController] Error marking as read:', error);
    sendError(res, error);
  }
};

/**
 * Mark all notifications as read for the authenticated user
 * POST /api/notifications/read-all
 */
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await notificationService.markAllAsRead(userId);

    sendSuccess(res, {
      success: true,
      count,
      message: `${count} notifications marked as read`
    });
  } catch (error) {
    console.error('[NotificationController] Error marking all as read:', error);
    sendError(res, error);
  }
};

/**
 * Delete a notification
 * DELETE /api/notifications/:id
 */
const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const deleted = await notificationService.deleteNotification(notificationId, userId);

    if (!deleted) {
      return sendError(res, { message: 'Notification not found' }, 404);
    }

    sendSuccess(res, { success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('[NotificationController] Error deleting notification:', error);
    sendError(res, error);
  }
};

/**
 * Handle invitation action (accept/reject) from notification
 * POST /api/notifications/:id/invitation-action
 *
 * Body: { action: 'accept' | 'reject' }
 */
const handleInvitationAction = async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;
    const { action } = req.body;

    if (!action || !['accept', 'reject'].includes(action)) {
      return sendError(res, { message: 'Invalid action. Must be "accept" or "reject"' }, 400);
    }

    // Get the notification
    const notifResult = await db.query(
      `SELECT * FROM notifications WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    );

    if (notifResult.rows.length === 0) {
      return sendError(res, { message: 'Notification not found' }, 404);
    }

    const notification = notifResult.rows[0];

    // Verify it's an invitation_received notification
    if (notification.type !== 'invitation_received') {
      return sendError(res, { message: 'This notification is not an invitation' }, 400);
    }

    // Parse metadata
    const metadata = typeof notification.metadata === 'string'
      ? JSON.parse(notification.metadata)
      : notification.metadata;

    // Check if already handled
    if (metadata?.handled) {
      return sendError(res, { message: 'This invitation has already been handled' }, 400);
    }

    const { invitation_id: invitationId, linkedin_account_id: linkedinAccountId, shared_secret: sharedSecret } = metadata;

    if (!invitationId || !linkedinAccountId) {
      return sendError(res, { message: 'Missing invitation data' }, 400);
    }

    if (!sharedSecret) {
      console.error(`❌ [Invitation] Missing shared_secret for invitation ${invitationId}`);
      return sendError(res, { message: 'Dados do convite incompletos. Shared secret não encontrado.' }, 400);
    }

    // Get the LinkedIn account
    const accountResult = await db.query(
      `SELECT unipile_account_id FROM linkedin_accounts WHERE id = $1`,
      [linkedinAccountId]
    );

    if (accountResult.rows.length === 0) {
      return sendError(res, { message: 'LinkedIn account not found' }, 404);
    }

    const unipileAccountId = accountResult.rows[0].unipile_account_id;

    // Perform the action via Unipile API
    // API requires: provider, shared_secret, account_id, action (accept/decline)
    const unipileAction = action === 'accept' ? 'accept' : 'decline';

    console.log(`📬 [Invitation] Handling invitation action: ${unipileAction} for ${invitationId}`);
    console.log(`📬 [Invitation] unipile_account_id: ${unipileAccountId}`);
    console.log(`📬 [Invitation] shared_secret: ${sharedSecret ? 'present' : 'missing'}`);

    try {
      await unipileClient.users.handleReceivedInvitation({
        provider: 'LINKEDIN',
        account_id: unipileAccountId,
        shared_secret: sharedSecret,
        action: unipileAction
      });
      console.log(`✅ [Invitation] Invitation ${unipileAction}ed: ${invitationId}`);
    } catch (apiError) {
      console.error(`❌ [Invitation] API error:`, apiError.response?.data || apiError.message);

      // Check if invitation no longer exists (already processed or expired)
      const statusCode = apiError.response?.status || apiError.status;
      if (statusCode === 400 || statusCode === 404) {
        // Mark as handled to prevent future attempts
        const updatedMetadata = {
          ...metadata,
          handled: true,
          action_taken: 'expired',
          action_at: new Date().toISOString(),
          error: 'Convite não disponível'
        };
        await db.query(
          `UPDATE notifications SET metadata = $1, is_read = true, read_at = NOW() WHERE id = $2`,
          [JSON.stringify(updatedMetadata), notificationId]
        );

        // Clean up from snapshots
        await db.query(
          `DELETE FROM invitation_snapshots
           WHERE linkedin_account_id = $1
           AND invitation_id = $2
           AND invitation_type = 'received'`,
          [linkedinAccountId, invitationId]
        );

        return sendError(res, {
          message: 'Este convite não está mais disponível. Pode ter sido processado diretamente no LinkedIn ou expirado.'
        }, 400);
      }

      return sendError(res, { message: `Falha ao ${action === 'accept' ? 'aceitar' : 'recusar'} convite` }, 500);
    }

    // Update notification metadata to mark as handled
    const updatedMetadata = { ...metadata, handled: true, action_taken: action, action_at: new Date().toISOString() };
    await db.query(
      `UPDATE notifications SET metadata = $1, is_read = true, read_at = NOW() WHERE id = $2`,
      [JSON.stringify(updatedMetadata), notificationId]
    );

    // Remove from invitation_snapshots
    await db.query(
      `DELETE FROM invitation_snapshots
       WHERE linkedin_account_id = $1
       AND invitation_id = $2
       AND invitation_type = 'received'`,
      [linkedinAccountId, invitationId]
    );

    sendSuccess(res, {
      success: true,
      action,
      message: action === 'accept' ? 'Convite aceito com sucesso' : 'Convite recusado com sucesso'
    });
  } catch (error) {
    console.error('[NotificationController] Error handling invitation action:', error);
    sendError(res, error);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  handleInvitationAction
};
