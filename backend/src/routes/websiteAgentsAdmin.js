const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const controller = require('../controllers/websiteAgentsAdminController');

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

module.exports = router;
