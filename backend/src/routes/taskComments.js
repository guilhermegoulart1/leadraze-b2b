// backend/src/routes/taskComments.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const taskCommentController = require('../controllers/taskCommentController');

// All routes require authentication
router.use(authenticate);

// Get comments for a task
router.get('/:taskId/comments', taskCommentController.getComments);

// Create a comment on a task
router.post('/:taskId/comments', taskCommentController.createComment);

// Delete a comment
router.delete('/:taskId/comments/:commentId', taskCommentController.deleteComment);

module.exports = router;
