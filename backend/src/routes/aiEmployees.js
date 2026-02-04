// backend/src/routes/aiEmployees.js
// Routes for AI Employees V2 and templates

const express = require('express');
const router = express.Router();
const aiEmployeesController = require('../controllers/aiEmployeesController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// ===========================================
// TEMPLATE ROUTES
// ===========================================

// Get all templates (official + public + own)
router.get('/templates', aiEmployeesController.getTemplates);

// Get a single template
router.get('/templates/:id', aiEmployeesController.getTemplate);

// Create a new template
router.post('/templates', aiEmployeesController.createTemplate);

// Update a template
router.put('/templates/:id', aiEmployeesController.updateTemplate);

// Delete a template
router.delete('/templates/:id', aiEmployeesController.deleteTemplate);

// Clone a template
router.post('/templates/:id/clone', aiEmployeesController.cloneTemplate);

// Rate a template
router.post('/templates/:id/rate', aiEmployeesController.rateTemplate);

// ===========================================
// INTERVIEW & GENERATION ROUTES
// ===========================================

// Get available niches
router.get('/niches', aiEmployeesController.getNiches);

// Smart Interview - Get next question
router.post('/interview', aiEmployeesController.getInterviewQuestion);

// Generate agent from interview answers
router.post('/generate', aiEmployeesController.generateAgent);

// ===========================================
// ADMIN ROUTES
// ===========================================

// Get templates pending approval (admin only)
router.get('/admin/pending', aiEmployeesController.getPendingTemplates);

// Approve or reject a template (admin only)
router.post('/admin/moderate/:id', aiEmployeesController.moderateTemplate);

// ===========================================
// TEST SESSION ROUTES
// ===========================================

// Get active test sessions
router.get('/test/sessions', aiEmployeesController.getActiveSessions);

// Start a test session for an agent
router.post('/:agentId/test/start', aiEmployeesController.startTestSession);

// Get test session state
router.get('/test/:sessionId', aiEmployeesController.getTestSession);

// Send a test message
router.post('/test/:sessionId/message', aiEmployeesController.sendTestMessage);

// Get test session logs
router.get('/test/:sessionId/logs', aiEmployeesController.getTestLogs);

// End a test session
router.post('/test/:sessionId/end', aiEmployeesController.endTestSession);

// Reset a test session
router.post('/test/:sessionId/reset', aiEmployeesController.resetTestSession);

// Update lead simulation
router.put('/test/:sessionId/lead', aiEmployeesController.updateTestLead);

// ===========================================
// TRANSFER RULES ROUTES
// ===========================================

// Get preset trigger definitions (static, must be before :agentId routes)
router.get('/transfer-presets', aiEmployeesController.getPresetTriggerDefinitions);

// Get all transfer rules for an agent
router.get('/:agentId/transfer-rules', aiEmployeesController.getTransferRules);

// Reorder transfer rules (must be before :ruleId route)
router.put('/:agentId/transfer-rules/reorder', aiEmployeesController.reorderTransferRules);

// Create a new transfer rule
router.post('/:agentId/transfer-rules', aiEmployeesController.createTransferRule);

// Update a transfer rule
router.put('/:agentId/transfer-rules/:ruleId', aiEmployeesController.updateTransferRule);

// Delete a transfer rule
router.delete('/:agentId/transfer-rules/:ruleId', aiEmployeesController.deleteTransferRule);

// Default transfer config
router.get('/:agentId/default-transfer-config', aiEmployeesController.getDefaultTransferConfig);
router.put('/:agentId/default-transfer-config', aiEmployeesController.updateDefaultTransferConfig);

module.exports = router;
