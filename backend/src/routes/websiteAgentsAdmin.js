const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const controller = require('../controllers/websiteAgentsAdminController');
const leadsController = require('../controllers/websiteLeadsController');

// All routes require authentication
router.use(authenticateToken);

// TODO: Add admin role check middleware
// For now, any authenticated user can access (should be restricted to admin users)

/**
 * @route GET /api/website-agents
 * @desc Get all website agents
 * @access Private (Admin)
 */
router.get('/', controller.getAgents);

/**
 * @route GET /api/website-agents/:agentKey
 * @desc Get a specific website agent
 * @access Private (Admin)
 */
router.get('/:agentKey', controller.getAgent);

/**
 * @route PUT /api/website-agents/:agentKey
 * @desc Update a website agent
 * @access Private (Admin)
 */
router.put('/:agentKey', controller.updateAgent);

/**
 * @route GET /api/website-agents-knowledge
 * @desc Get knowledge base items
 * @access Private (Admin)
 */
router.get('/knowledge/list', controller.getKnowledge);

/**
 * @route POST /api/website-agents-knowledge
 * @desc Add knowledge item
 * @access Private (Admin)
 */
router.post('/knowledge', controller.addKnowledge);

/**
 * @route PUT /api/website-agents-knowledge/:id
 * @desc Update knowledge item
 * @access Private (Admin)
 */
router.put('/knowledge/:id', controller.updateKnowledge);

/**
 * @route DELETE /api/website-agents-knowledge/:id
 * @desc Delete knowledge item
 * @access Private (Admin)
 */
router.delete('/knowledge/:id', controller.deleteKnowledge);

/**
 * @route GET /api/website-agents-conversations
 * @desc Get chat conversations
 * @access Private (Admin)
 */
router.get('/conversations/list', controller.getConversations);

/**
 * @route GET /api/website-agents-conversations/:id
 * @desc Get a specific conversation
 * @access Private (Admin)
 */
router.get('/conversations/:id', controller.getConversation);

/**
 * @route GET /api/website-agents-stats
 * @desc Get statistics
 * @access Private (Admin)
 */
router.get('/stats/overview', controller.getStats);

// ================================
// WEBSITE LEADS ROUTES
// ================================

/**
 * @route GET /api/website-agents/leads/list
 * @desc Get all website leads
 * @access Private (Admin)
 */
router.get('/leads/list', leadsController.getLeads);

/**
 * @route GET /api/website-agents/leads/stats
 * @desc Get website leads statistics
 * @access Private (Admin)
 */
router.get('/leads/stats', leadsController.getLeadStats);

/**
 * @route GET /api/website-agents/leads/export
 * @desc Export leads as CSV
 * @access Private (Admin)
 */
router.get('/leads/export', leadsController.exportLeads);

module.exports = router;
