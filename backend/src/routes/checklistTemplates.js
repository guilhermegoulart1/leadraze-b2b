/**
 * Checklist Template Routes
 * Manage checklist templates for automatic task creation on pipeline stage changes
 */

const express = require('express');
const router = express.Router();
const checklistTemplateController = require('../controllers/checklistTemplateController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Get template by pipeline stage
router.get('/by-stage/:stage', checklistTemplateController.getTemplateByStage);

// List all templates
router.get('/', checklistTemplateController.getTemplates);

// Create a new template
router.post('/', checklistTemplateController.createTemplate);

// Get a single template with items
router.get('/:id', checklistTemplateController.getTemplate);

// Update a template
router.put('/:id', checklistTemplateController.updateTemplate);

// Delete a template
router.delete('/:id', checklistTemplateController.deleteTemplate);

// Template items management
router.post('/:id/items', checklistTemplateController.addItem);
router.put('/:id/items/:itemId', checklistTemplateController.updateItem);
router.delete('/:id/items/:itemId', checklistTemplateController.deleteItem);
router.patch('/:id/items/reorder', checklistTemplateController.reorderItems);

module.exports = router;
