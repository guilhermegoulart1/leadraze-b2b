// backend/src/controllers/instagramAgentController.js
// HTTP request handlers for Instagram agents

const instagramAgentService = require('../services/instagramAgentService');

/**
 * Create a new Instagram agent
 * POST /api/instagram-agents
 */
exports.createAgent = async (req, res) => {
  try {
    const {
      name,
      description,
      searchNiche,
      searchLocation,
      searchCountry,
      profilesPerExecution,
      totalLimit,
      sectorId
    } = req.body;

    const accountId = req.user.accountId;
    const userId = req.user.userId;

    const agent = await instagramAgentService.createAgent({
      accountId,
      sectorId: sectorId || req.user.sectorId || null,
      userId,
      name,
      description,
      searchNiche,
      searchLocation,
      searchCountry,
      profilesPerExecution,
      totalLimit
    });

    res.status(201).json({ success: true, agent });
  } catch (error) {
    console.error('❌ Error creating Instagram agent:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Get all Instagram agents for account
 * GET /api/instagram-agents
 */
exports.getAgents = async (req, res) => {
  try {
    const accountId = req.user.accountId;
    const { page, limit, status, sectorId } = req.query;

    const result = await instagramAgentService.getAgents(accountId, {
      page, limit, status, sectorId
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Error fetching Instagram agents:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get a single Instagram agent
 * GET /api/instagram-agents/:id
 */
exports.getAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;

    const agent = await instagramAgentService.getAgent(id, accountId);

    res.json({ success: true, agent });
  } catch (error) {
    console.error('❌ Error fetching Instagram agent:', error);
    res.status(404).json({ success: false, message: error.message });
  }
};

/**
 * Update an Instagram agent
 * PUT /api/instagram-agents/:id
 */
exports.updateAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;
    const { name, description, profiles_per_execution, total_limit } = req.body;

    const agent = await instagramAgentService.updateAgent(id, accountId, {
      name, description, profiles_per_execution, total_limit
    });

    res.json({ success: true, agent });
  } catch (error) {
    console.error('❌ Error updating Instagram agent:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Delete an Instagram agent
 * DELETE /api/instagram-agents/:id
 */
exports.deleteAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;

    await instagramAgentService.deleteAgent(id, accountId);

    res.json({ success: true, message: 'Agente deletado com sucesso' });
  } catch (error) {
    console.error('❌ Error deleting Instagram agent:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Execute an agent (run Google search via Serper.dev)
 * POST /api/instagram-agents/:id/execute
 */
exports.executeAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;

    const result = await instagramAgentService.executeAgent(id, accountId);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Error executing Instagram agent:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Get found profiles for an agent (paginated)
 * GET /api/instagram-agents/:id/profiles
 */
exports.getFoundProfiles = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;
    const { page = 1, limit = 50 } = req.query;

    const result = await instagramAgentService.getFoundProfiles(id, accountId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Error fetching Instagram profiles:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Export profiles as CSV
 * GET /api/instagram-agents/:id/export
 */
exports.exportProfilesCSV = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;

    const csv = await instagramAgentService.exportProfilesCSV(id, accountId);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=instagram-profiles-${id}.csv`);
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8 compatibility
  } catch (error) {
    console.error('❌ Error exporting Instagram profiles:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Pause an agent
 * PUT /api/instagram-agents/:id/pause
 */
exports.pauseAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;

    const agent = await instagramAgentService.pauseAgent(id, accountId);

    res.json({ success: true, agent });
  } catch (error) {
    console.error('❌ Error pausing Instagram agent:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Resume a paused agent
 * PUT /api/instagram-agents/:id/resume
 */
exports.resumeAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;

    const agent = await instagramAgentService.resumeAgent(id, accountId);

    res.json({ success: true, agent });
  } catch (error) {
    console.error('❌ Error resuming Instagram agent:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};
