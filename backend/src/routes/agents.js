// backend/src/routes/agents.js
const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// ==========================================
// UNIFIED AGENTS ROUTES
// ==========================================

/**
 * GET /api/agents
 * Get all agents (supports filtering by agent_type, is_active)
 * Query params:
 *   - agent_type (optional): linkedin|google_maps|email|whatsapp
 *   - is_active (optional): true|false
 *   - limit (optional): number of results (default 50)
 *   - offset (optional): pagination offset (default 0)
 */
router.get('/', agentController.getAgents);

/**
 * GET /api/agents/:id
 * Get single agent by ID
 */
router.get('/:id', agentController.getAgent);

/**
 * POST /api/agents
 * Create new agent
 * Body:
 *   - name (required): string
 *   - agent_type (required): linkedin|google_maps|email|whatsapp
 *   - description (optional): string
 *   - avatar_url (optional): string
 *   - response_length (optional): short|medium|long (default: medium)
 *   - config (required): object (structure varies by agent_type)
 *   - is_active (optional): boolean (default: true)
 *   - sector_id (optional): UUID
 *   - daily_limit (optional): number (default: 50)
 *   - execution_time (optional): time (default: 09:00:00)
 */
router.post('/', agentController.createAgent);

/**
 * PUT /api/agents/:id
 * Update agent
 * Body: any fields from create (agent_type cannot be changed)
 */
router.put('/:id', agentController.updateAgent);

/**
 * DELETE /api/agents/:id
 * Delete agent
 */
router.delete('/:id', agentController.deleteAgent);

/**
 * POST /api/agents/:id/test
 * Test agent functionality (simple test)
 * Body:
 *   - message: string
 *   - context: object (optional)
 */
router.post('/:id/test', agentController.testAgent);

/**
 * POST /api/agents/:id/test/initial-message
 * Test agent initial message with RAG
 * Body:
 *   - lead_data: object with lead information
 */
router.post('/:id/test/initial-message', agentController.testAgentInitialMessage);

/**
 * POST /api/agents/:id/test/response
 * Test agent response with RAG and intent detection
 * Body:
 *   - message: string (required)
 *   - conversation_history: array (optional)
 *   - lead_data: object (optional)
 */
router.post('/:id/test/response', agentController.testAgentResponse);

/**
 * GET /api/agents/:id/stats
 * Get agent statistics
 */
router.get('/:id/stats', agentController.getAgentStats);

// ==========================================
// ASSIGNEES / ROTATION ROUTES
// ==========================================

/**
 * GET /api/agents/:id/assignees
 * Get all assignees configured for rotation
 */
router.get('/:id/assignees', agentController.getAgentAssignees);

/**
 * POST /api/agents/:id/assignees
 * Set assignees for rotation (replaces existing)
 * Body: { user_ids: [1, 2, 3] } - array of user IDs in rotation order
 */
router.post('/:id/assignees', agentController.setAgentAssignees);

/**
 * POST /api/agents/:id/assignees/:userId
 * Add a single assignee to rotation
 */
router.post('/:id/assignees/:userId', agentController.addAgentAssignee);

/**
 * DELETE /api/agents/:id/assignees/:userId
 * Remove an assignee from rotation
 */
router.delete('/:id/assignees/:userId', agentController.removeAgentAssignee);

/**
 * GET /api/agents/:id/rotation-state
 * Get current rotation state (who's next, total assignments, etc)
 */
router.get('/:id/rotation-state', agentController.getAgentRotationState);

module.exports = router;
