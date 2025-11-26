// backend/src/routes/leadComments.js
const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams to access :leadId from parent router
const leadCommentController = require('../controllers/leadCommentController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// All routes require authentication
router.use(authenticateToken);
router.use(apiLimiter);

// Search users for mentions (before :commentId routes to avoid conflicts)
router.get('/search-users', leadCommentController.searchUsersForMentions);

// Comment CRUD
router.get('/', leadCommentController.getComments);
router.post('/', leadCommentController.createComment);
router.put('/:commentId', leadCommentController.updateComment);
router.delete('/:commentId', leadCommentController.deleteComment);

module.exports = router;
