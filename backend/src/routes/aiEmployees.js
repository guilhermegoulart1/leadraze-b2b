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

module.exports = router;
