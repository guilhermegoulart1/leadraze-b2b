// backend/src/controllers/googleMapsAgentController.js
// HTTP request handlers for Google Maps agents

const googleMapsAgentService = require('../services/googleMapsAgentService');
const googleMapsRotationService = require('../services/googleMapsRotationService');

/**
 * Create a new Google Maps agent
 * POST /api/google-maps-agents
 */
exports.createAgent = async (req, res) => {
  try {
    const {
      name,
      avatar_url,
      description,
      actionType,
      // Search filters
      searchCountry,
      searchLocation,
      searchQuery,
      searchRadius,
      radius,
      latitude,
      longitude,
      businessCategory,
      businessSpecification,
      minRating,
      minReviews,
      requirePhone,
      requireEmail,
      // Scheduling
      dailyLimit,
      executionTime
    } = req.body;

    // Get account and user from authenticated request
    const accountId = req.user.accountId;
    const userId = req.user.userId;
    const sectorId = req.body.sectorId || req.user.sectorId || null;

    const agent = await googleMapsAgentService.createAgent({
      accountId,
      sectorId,
      userId,
      name,
      avatar_url,
      description,
      actionType,
      searchCountry,
      searchLocation,
      searchQuery,
      searchRadius,
      radius,
      latitude,
      longitude,
      businessCategory,
      businessSpecification,
      minRating,
      minReviews,
      requirePhone,
      requireEmail,
      dailyLimit,
      executionTime
    });

    res.status(201).json({
      success: true,
      message: 'Google Maps agent created successfully',
      agent
    });

  } catch (error) {
    console.error('❌ Error creating agent:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating agent'
    });
  }
};

/**
 * Get all agents for the authenticated account
 * GET /api/google-maps-agents
 */
exports.getAgents = async (req, res) => {
  try {
    const accountId = req.user.accountId;
    const { sectorId, status, userId } = req.query;

    const agents = await googleMapsAgentService.getAgents(accountId, {
      sectorId,
      status,
      userId
    });

    res.json({
      success: true,
      agents,
      count: agents.length
    });

  } catch (error) {
    console.error('❌ Error fetching agents:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching agents'
    });
  }
};

/**
 * Get a single agent by ID
 * GET /api/google-maps-agents/:id
 */
exports.getAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;

    const agent = await googleMapsAgentService.getAgent(id, accountId);

    res.json({
      success: true,
      agent
    });

  } catch (error) {
    console.error('❌ Error fetching agent:', error);
    res.status(error.message === 'Agent not found' ? 404 : 500).json({
      success: false,
      message: error.message || 'Error fetching agent'
    });
  }
};

/**
 * Execute an agent manually (fetch next batch of leads)
 * POST /api/google-maps-agents/:id/execute
 */
exports.executeAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;

    // Verify agent belongs to account
    await googleMapsAgentService.getAgent(id, accountId);

    // Execute agent
    const results = await googleMapsAgentService.executeAgent(id);

    res.json({
      success: true,
      message: 'Agent executed successfully',
      results
    });

  } catch (error) {
    console.error('❌ Error executing agent:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error executing agent'
    });
  }
};

/**
 * Pause an agent
 * PUT /api/google-maps-agents/:id/pause
 */
exports.pauseAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;

    const result = await googleMapsAgentService.pauseAgent(id, accountId);

    res.json({
      success: true,
      message: 'Agent paused successfully',
      ...result
    });

  } catch (error) {
    console.error('❌ Error pausing agent:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error pausing agent'
    });
  }
};

/**
 * Resume an agent
 * PUT /api/google-maps-agents/:id/resume
 */
exports.resumeAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;

    const result = await googleMapsAgentService.resumeAgent(id, accountId);

    res.json({
      success: true,
      message: 'Agent resumed successfully',
      ...result
    });

  } catch (error) {
    console.error('❌ Error resuming agent:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error resuming agent'
    });
  }
};

/**
 * Delete an agent
 * DELETE /api/google-maps-agents/:id
 */
exports.deleteAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;

    await googleMapsAgentService.deleteAgent(id, accountId);

    res.json({
      success: true,
      message: 'Agent deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting agent:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting agent'
    });
  }
};

/**
 * Get agent statistics
 * GET /api/google-maps-agents/:id/stats
 */
exports.getAgentStats = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;

    const agent = await googleMapsAgentService.getAgent(id, accountId);

    // Calculate additional statistics
    const stats = {
      total_leads_found: agent.total_leads_found || 0,
      leads_inserted: agent.leads_inserted || 0,
      leads_skipped: agent.leads_skipped || 0,
      current_page: agent.current_page || 0,
      pages_fetched: (agent.last_page_fetched || -1) + 1,
      total_api_calls: agent.total_api_calls || 0,
      estimated_cost: agent.estimated_cost || 0,
      last_execution: agent.last_execution_at,
      next_execution: agent.next_execution_at,
      status: agent.status,
      success_rate: agent.total_leads_found > 0
        ? ((agent.leads_inserted / agent.total_leads_found) * 100).toFixed(2)
        : 0
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Error fetching agent stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching agent statistics'
    });
  }
};

/**
 * Get assignees for an agent
 * GET /api/google-maps-agents/:id/assignees
 */
exports.getAssignees = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;

    // Verify agent belongs to account
    await googleMapsAgentService.getAgent(id, accountId);

    const assignees = await googleMapsRotationService.getAssignees(id);
    const rotationState = await googleMapsRotationService.getRotationState(id);

    res.json({
      success: true,
      assignees,
      rotationState
    });

  } catch (error) {
    console.error('❌ Error fetching assignees:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching assignees'
    });
  }
};

/**
 * Set assignees for an agent (replace all)
 * PUT /api/google-maps-agents/:id/assignees
 */
exports.setAssignees = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;
    const accountId = req.user.accountId;

    // Verify agent belongs to account
    await googleMapsAgentService.getAgent(id, accountId);

    if (!Array.isArray(userIds)) {
      return res.status(400).json({
        success: false,
        message: 'userIds must be an array'
      });
    }

    const result = await googleMapsRotationService.setAssignees(id, userIds);

    res.json({
      success: true,
      message: `Set ${result.count} assignees for rotation`,
      ...result
    });

  } catch (error) {
    console.error('❌ Error setting assignees:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error setting assignees'
    });
  }
};

/**
 * Get recent assignments for an agent
 * GET /api/google-maps-agents/:id/assignments
 */
exports.getAssignments = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;
    const accountId = req.user.accountId;

    // Verify agent belongs to account
    await googleMapsAgentService.getAgent(id, accountId);

    const assignments = await googleMapsRotationService.getRecentAssignments(id, parseInt(limit));

    res.json({
      success: true,
      assignments,
      count: assignments.length
    });

  } catch (error) {
    console.error('❌ Error fetching assignments:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching assignments'
    });
  }
};
