/**
 * Checklist Item Routes
 */

const express = require('express');
const router = express.Router();
const checklistController = require('../controllers/checklistController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Item operations
router.put('/:id', checklistController.updateChecklistItem);
router.delete('/:id', checklistController.deleteChecklistItem);
router.patch('/:id/toggle', checklistController.toggleChecklistItem);

module.exports = router;
