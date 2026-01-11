// backend/src/routes/notifications.js

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// All routes require authentication
router.use(authenticateToken);
router.use(apiLimiter);

// Get notifications for the authenticated user
// GET /api/notifications?limit=50&offset=0&unread_only=false&type=handoff
router.get('/', notificationController.getNotifications);

// Get unread notification count
// GET /api/notifications/count
router.get('/count', notificationController.getUnreadCount);

// Mark all notifications as read
// POST /api/notifications/read-all
router.post('/read-all', notificationController.markAllAsRead);

// Mark a single notification as read
// POST /api/notifications/:id/read
router.post('/:id/read', notificationController.markAsRead);

// Handle invitation action (accept/reject) from notification dropdown
// POST /api/notifications/:id/invitation-action
// Body: { action: 'accept' | 'reject' }
router.post('/:id/invitation-action', notificationController.handleInvitationAction);

// Delete a notification
// DELETE /api/notifications/:id
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
