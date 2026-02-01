// backend/src/routes/instagramAgents.js
// Routes for Instagram agents

const express = require('express');
const router = express.Router();
const instagramAgentController = require('../controllers/instagramAgentController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// Apply authentication and rate limiting to all routes
router.use(authenticateToken);
router.use(apiLimiter);

/**
 * @route   POST /api/instagram-agents
 * @desc    Create a new Instagram agent
 * @access  Private
 */
router.post('/', instagramAgentController.createAgent);

/**
 * @route   GET /api/instagram-agents
 * @desc    Get all Instagram agents for account
 * @access  Private
 */
router.get('/', instagramAgentController.getAgents);

/**
 * @route   GET /api/instagram-agents/:id
 * @desc    Get a single Instagram agent
 * @access  Private
 */
router.get('/:id', instagramAgentController.getAgent);

/**
 * @route   PUT /api/instagram-agents/:id
 * @desc    Update an Instagram agent
 * @access  Private
 */
router.put('/:id', instagramAgentController.updateAgent);

/**
 * @route   DELETE /api/instagram-agents/:id
 * @desc    Delete an Instagram agent
 * @access  Private
 */
router.delete('/:id', instagramAgentController.deleteAgent);

/**
 * @route   POST /api/instagram-agents/:id/execute
 * @desc    Execute agent (search Google for Instagram profiles)
 * @access  Private
 */
router.post('/:id/execute', instagramAgentController.executeAgent);

/**
 * @route   GET /api/instagram-agents/:id/profiles
 * @desc    Get found profiles (paginated)
 * @access  Private
 */
router.get('/:id/profiles', instagramAgentController.getFoundProfiles);

/**
 * @route   GET /api/instagram-agents/:id/export
 * @desc    Export profiles as CSV
 * @access  Private
 */
router.get('/:id/export', instagramAgentController.exportProfilesCSV);

/**
 * @route   PUT /api/instagram-agents/:id/pause
 * @desc    Pause an agent
 * @access  Private
 */
router.put('/:id/pause', instagramAgentController.pauseAgent);

/**
 * @route   PUT /api/instagram-agents/:id/resume
 * @desc    Resume a paused agent
 * @access  Private
 */
router.put('/:id/resume', instagramAgentController.resumeAgent);

module.exports = router;
