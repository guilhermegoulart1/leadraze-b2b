/**
 * Task Routes
 * Manage tasks linked to leads with board visualization
 */

const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const taskCommentController = require('../controllers/taskCommentController');
const { authenticateToken } = require('../middleware/auth');

// All task routes require authentication
router.use(authenticateToken);

// Get task statistics
router.get('/stats', taskController.getTaskStats);

// Get tasks grouped for board view
router.get('/board', taskController.getTasksBoard);

// Get tasks for calendar view
router.get('/calendar', taskController.getTasksCalendar);

// List all tasks with filters
router.get('/', taskController.getTasks);

// Create a new task
router.post('/', taskController.createTask);

// Get a single task
router.get('/:id', taskController.getTask);

// Update a task
router.put('/:id', taskController.updateTask);

// Delete a task
router.delete('/:id', taskController.deleteTask);

// Mark task as completed
router.patch('/:id/complete', taskController.completeTask);

// Update task status (for drag and drop)
router.patch('/:id/status', taskController.updateTaskStatus);

// ================================
// TASK COMMENTS
// ================================

// Get comments for a task
router.get('/:taskId/comments', taskCommentController.getComments);

// Create a comment on a task
router.post('/:taskId/comments', taskCommentController.createComment);

// Delete a comment
router.delete('/:taskId/comments/:commentId', taskCommentController.deleteComment);

module.exports = router;
