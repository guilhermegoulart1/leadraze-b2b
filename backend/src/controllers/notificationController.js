// backend/src/controllers/notificationController.js

const notificationService = require('../services/notificationService');
const { sendSuccess, sendError } = require('../utils/responses');

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

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification
};
