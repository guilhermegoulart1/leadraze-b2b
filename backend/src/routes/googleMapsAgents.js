// backend/src/routes/googleMapsAgents.js
// Routes for Google Maps agents

const express = require('express');
const router = express.Router();
const googleMapsAgentController = require('../controllers/googleMapsAgentController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// Apply authentication to all routes
router.use(authenticateToken);

// Apply rate limiting
router.use(apiLimiter);

/**
 * @route   POST /api/google-maps-agents
 * @desc    Create a new Google Maps agent
 * @access  Private
 */
router.post('/', googleMapsAgentController.createAgent);

/**
 * @route   GET /api/google-maps-agents
 * @desc    Get all Google Maps agents for account
 * @access  Private
 */
router.get('/', googleMapsAgentController.getAgents);

/**
 * @route   GET /api/google-maps-agents/:id
 * @desc    Get a single Google Maps agent by ID
 * @access  Private
 */
router.get('/:id', googleMapsAgentController.getAgent);

/**
 * @route   PUT /api/google-maps-agents/:id
 * @desc    Update a Google Maps agent configuration
 * @access  Private
 */
router.put('/:id', googleMapsAgentController.updateAgent);

/**
 * @route   POST /api/google-maps-agents/:id/execute
 * @desc    Manually execute an agent (fetch next batch)
 * @access  Private
 */
router.post('/:id/execute', googleMapsAgentController.executeAgent);

/**
 * @route   PUT /api/google-maps-agents/:id/pause
 * @desc    Pause an agent
 * @access  Private
 */
router.put('/:id/pause', googleMapsAgentController.pauseAgent);

/**
 * @route   PUT /api/google-maps-agents/:id/resume
 * @desc    Resume a paused agent
 * @access  Private
 */
router.put('/:id/resume', googleMapsAgentController.resumeAgent);

/**
 * @route   DELETE /api/google-maps-agents/:id
 * @desc    Delete an agent
 * @access  Private
 */
router.delete('/:id', googleMapsAgentController.deleteAgent);

/**
 * @route   GET /api/google-maps-agents/:id/stats
 * @desc    Get agent statistics
 * @access  Private
 */
router.get('/:id/stats', googleMapsAgentController.getAgentStats);

/**
 * @route   GET /api/google-maps-agents/:id/assignees
 * @desc    Get rotation assignees for an agent
 * @access  Private
 */
router.get('/:id/assignees', googleMapsAgentController.getAssignees);

/**
 * @route   PUT /api/google-maps-agents/:id/assignees
 * @desc    Set rotation assignees for an agent
 * @access  Private
 */
router.put('/:id/assignees', googleMapsAgentController.setAssignees);

/**
 * @route   GET /api/google-maps-agents/:id/assignments
 * @desc    Get recent lead assignments for an agent
 * @access  Private
 */
router.get('/:id/assignments', googleMapsAgentController.getAssignments);

/**
 * @route   GET /api/google-maps-agents/:id/contacts
 * @desc    Get all contacts from an agent as JSON
 * @access  Private
 */
router.get('/:id/contacts', googleMapsAgentController.getAgentContacts);

/**
 * @route   GET /api/google-maps-agents/:id/export
 * @desc    Export all contacts from an agent as CSV
 * @access  Private
 */
router.get('/:id/export', googleMapsAgentController.exportAgentContacts);

/**
 * @route   GET /api/google-maps-agents/:id/logs
 * @desc    Get execution logs for an agent (SERPAPI raw responses)
 * @access  Private
 */
router.get('/:id/logs', googleMapsAgentController.getAgentLogs);

/**
 * @route   GET /api/google-maps-agents/:id/found-places
 * @desc    Get found places for an agent (when insert_in_crm is false)
 * @access  Private
 */
router.get('/:id/found-places', googleMapsAgentController.getFoundPlaces);

/**
 * @route   GET /api/google-maps-agents/:id/export-found-places
 * @desc    Export found places to CSV (when insert_in_crm is false)
 * @access  Private
 */
router.get('/:id/export-found-places', googleMapsAgentController.exportFoundPlaces);

/**
 * @route   GET /api/google-maps-agents/:id/duplicates
 * @desc    Get duplicates found by an agent
 * @access  Private
 */
router.get('/:id/duplicates', googleMapsAgentController.getAgentDuplicates);

/**
 * @route   GET /api/google-maps-agents/:id/duplicate-stats
 * @desc    Get duplicate statistics for an agent
 * @access  Private
 */
router.get('/:id/duplicate-stats', googleMapsAgentController.getAgentDuplicateStats);

module.exports = router;
