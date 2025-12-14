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
 * Update an agent's configuration
 * PUT /api/google-maps-agents/:id
 */
exports.updateAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;
    const { dailyLimit } = req.body;

    // Validate dailyLimit is multiple of 20
    if (dailyLimit !== undefined && dailyLimit % 20 !== 0) {
      return res.status(400).json({
        success: false,
        message: 'dailyLimit deve ser múltiplo de 20'
      });
    }

    // Validate minimum value
    if (dailyLimit !== undefined && dailyLimit < 20) {
      return res.status(400).json({
        success: false,
        message: 'dailyLimit deve ser no mínimo 20'
      });
    }

    const agent = await googleMapsAgentService.updateAgent(id, accountId, { dailyLimit });

    res.json({
      success: true,
      message: 'Agent updated successfully',
      agent
    });

  } catch (error) {
    console.error('❌ Error updating agent:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message || 'Error updating agent'
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

    // Check for deleteLeads option in query string or body
    const deleteLeads = req.query.deleteLeads === 'true' || req.body?.deleteLeads === true;

    const result = await googleMapsAgentService.deleteAgent(id, accountId, { deleteLeads });

    res.json({
      success: true,
      message: deleteLeads
        ? `Campanha e ${result.leadsDeleted} leads deletados com sucesso`
        : 'Campanha deletada com sucesso',
      leadsDeleted: result.leadsDeleted || 0
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

/**
 * Get agent contacts as JSON
 * GET /api/google-maps-agents/:id/contacts
 */
exports.getAgentContacts = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;

    // Verify agent belongs to account
    await googleMapsAgentService.getAgent(id, accountId);

    // Get all contacts for this agent
    const contacts = await googleMapsAgentService.getAgentContacts(id, accountId);

    res.json({
      success: true,
      contacts: contacts || [],
      count: contacts?.length || 0
    });

  } catch (error) {
    console.error('❌ Error fetching agent contacts:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching contacts'
    });
  }
};

/**
 * Export agent contacts to CSV
 * GET /api/google-maps-agents/:id/export
 */
exports.exportAgentContacts = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;

    console.log(`📥 CSV export request for agent ${id}`);

    // Get agent info for filename
    const agent = await googleMapsAgentService.getAgent(id, accountId);

    // Get all contacts for this agent
    const contacts = await googleMapsAgentService.getAgentContacts(id, accountId);

    if (!contacts || contacts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Nenhum contato encontrado para este agente'
      });
    }

    // Generate CSV
    const headers = [
      'Nome',
      'Categoria',
      'Endereço',
      'Cidade',
      'Estado',
      'País',
      'Telefone',
      'Email',
      'Website',
      'Rating',
      'Reviews',
      'Descrição da Empresa',
      'Serviços',
      'Possíveis Dores',
      'Google Maps URL'
    ];

    const escapeCsvValue = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Helper to format JSON arrays as readable strings
    const formatJsonArray = (jsonValue) => {
      if (!jsonValue) return '';
      try {
        const arr = typeof jsonValue === 'string' ? JSON.parse(jsonValue) : jsonValue;
        if (Array.isArray(arr)) {
          return arr.join('; ');
        }
        return '';
      } catch {
        return '';
      }
    };

    const rows = contacts.map(c => [
      escapeCsvValue(c.name),
      escapeCsvValue(c.business_category),
      escapeCsvValue(c.address),
      escapeCsvValue(c.city),
      escapeCsvValue(c.state),
      escapeCsvValue(c.country),
      escapeCsvValue(c.phone),
      escapeCsvValue(c.email),
      escapeCsvValue(c.website),
      c.rating || '',
      c.review_count || 0,
      escapeCsvValue(c.company_description),
      escapeCsvValue(formatJsonArray(c.company_services)),
      escapeCsvValue(formatJsonArray(c.pain_points)),
      escapeCsvValue(c.google_maps_url)
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    // Set headers for CSV download
    const filename = `google-maps-${agent.name.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Send CSV with BOM for Excel UTF-8 support
    res.send('\uFEFF' + csv);

    console.log(`✅ CSV exported successfully: ${contacts.length} contacts`);

  } catch (error) {
    console.error('❌ Error exporting agent contacts:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error exporting contacts'
    });
  }
};

/**
 * Get execution logs for an agent
 * GET /api/google-maps-agents/:id/logs
 */
exports.getAgentLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;

    const logs = await googleMapsAgentService.getAgentLogs(id, accountId);

    res.json({
      success: true,
      logs: logs || [],
      count: logs?.length || 0
    });

  } catch (error) {
    console.error('❌ Error fetching agent logs:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching execution logs'
    });
  }
};
