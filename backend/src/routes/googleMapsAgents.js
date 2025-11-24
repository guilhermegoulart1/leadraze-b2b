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

module.exports = router;
