// backend/src/routes/roadmapExecutions.js
const express = require('express');
const router = express.Router();
const roadmapController = require('../controllers/roadmapController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET /api/roadmap-executions/:id - Get execution details
router.get('/:id', roadmapController.getExecution);

// POST /api/roadmap-executions/:id/cancel - Cancel execution
router.post('/:id/cancel', roadmapController.cancelExecution);

module.exports = router;
