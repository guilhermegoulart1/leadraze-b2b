// backend/src/routes/roadmapExecutionTasks.js
const express = require('express');
const router = express.Router();
const roadmapController = require('../controllers/roadmapController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// PATCH /api/roadmap-execution-tasks/:id/toggle - Toggle task completion
router.patch('/:id/toggle', roadmapController.toggleExecutionTask);

module.exports = router;
