// backend/src/routes/roadmaps.js
const express = require('express');
const router = express.Router();
const roadmapController = require('../controllers/roadmapController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// ============================================
// ROADMAPS CRUD
// ============================================

// GET /api/roadmaps - List all roadmaps (own + global)
router.get('/', roadmapController.getRoadmaps);

// GET /api/roadmaps/search - Search roadmaps (for chat "/" trigger)
router.get('/search', roadmapController.searchRoadmaps);

// GET /api/roadmaps/analytics - Get analytics for all roadmaps
router.get('/analytics', roadmapController.getAnalytics);

// GET /api/roadmaps/:id - Get single roadmap with tasks
router.get('/:id', roadmapController.getRoadmap);

// GET /api/roadmaps/:id/analytics - Get analytics for specific roadmap
router.get('/:id/analytics', roadmapController.getRoadmapAnalytics);

// POST /api/roadmaps - Create new roadmap
router.post('/', roadmapController.createRoadmap);

// PUT /api/roadmaps/:id - Update roadmap
router.put('/:id', roadmapController.updateRoadmap);

// DELETE /api/roadmaps/:id - Delete roadmap
router.delete('/:id', roadmapController.deleteRoadmap);

// ============================================
// ROADMAP TASKS
// ============================================

// GET /api/roadmaps/:id/tasks - Get tasks for a roadmap
router.get('/:id/tasks', roadmapController.getRoadmapTasks);

// POST /api/roadmaps/:id/tasks - Add task to roadmap
router.post('/:id/tasks', roadmapController.addRoadmapTask);

// PUT /api/roadmaps/:id/tasks/:taskId - Update task
router.put('/:id/tasks/:taskId', roadmapController.updateRoadmapTask);

// DELETE /api/roadmaps/:id/tasks/:taskId - Delete task
router.delete('/:id/tasks/:taskId', roadmapController.deleteRoadmapTask);

// PATCH /api/roadmaps/:id/tasks/reorder - Reorder tasks
router.patch('/:id/tasks/reorder', roadmapController.reorderRoadmapTasks);

// ============================================
// EXECUTION
// ============================================

// POST /api/roadmaps/:id/execute - Execute roadmap
router.post('/:id/execute', roadmapController.executeRoadmap);

module.exports = router;
