/**
 * Checklist Routes
 * Quick checklists within leads (ClickUp-style)
 */

const express = require('express');
const router = express.Router();
const checklistController = require('../controllers/checklistController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Checklist operations
router.put('/:id', checklistController.updateChecklist);
router.delete('/:id', checklistController.deleteChecklist);

// Checklist items
router.post('/:checklistId/items', checklistController.createChecklistItem);

module.exports = router;
