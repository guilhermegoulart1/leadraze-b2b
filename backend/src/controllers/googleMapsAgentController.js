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
      searchType,
      businessCategory,
      businessSpecification,
      minRating,
      minReviews,
      requirePhone,
      requireEmail,
      // Multiple locations support
      searchLocations,
      locationDistribution,
      // CRM insertion mode
      insertInCrm,
      // Activation channels
      activateEmail,
      emailAgentId,
      activateWhatsapp,
      whatsappAgentId,
      // Scheduling
      dailyLimit,
      executionTime,
      // Rotation assignees
      assignees
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
      searchType,
      businessCategory,
      businessSpecification,
      minRating,
      minReviews,
      requirePhone,
      requireEmail,
      // Multiple locations
      searchLocations,
      locationDistribution,
      // CRM mode
      insertInCrm,
      // Activation channels
      activateEmail,
      emailAgentId,
      activateWhatsapp,
      whatsappAgentId,
      // Scheduling
      dailyLimit,
      executionTime,
      // Rotation
      assignees
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
      message: result.message,
      leadsDeleted: result.leadsDeleted || 0,
      mode: result.mode
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
        message: 'Nenhum lead encontrado para este agente'
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
      'Telefone Principal',
      'Telefones Adicionais',
      'Email Principal',
      'Emails Adicionais',
      'Website',
      'Rating',
      'Reviews',
      'LinkedIn',
      'Instagram',
      'Facebook',
      'YouTube',
      'Twitter',
      'Descrição da Empresa',
      'Serviços',
      'Possíveis Dores',
      'Membros da Equipe',
      'CNPJ',
      'Razão Social',
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

    // Helper to format emails array (excluding the primary one)
    const formatAdditionalEmails = (emailsJson, primaryEmail) => {
      if (!emailsJson) return '';
      try {
        const emails = typeof emailsJson === 'string' ? JSON.parse(emailsJson) : emailsJson;
        if (Array.isArray(emails)) {
          return emails
            .filter(e => e.email && e.email !== primaryEmail)
            .map(e => e.email)
            .join('; ');
        }
        return '';
      } catch {
        return '';
      }
    };

    // Helper to format phones array (excluding the primary one)
    const formatAdditionalPhones = (phonesJson, primaryPhone) => {
      if (!phonesJson) return '';
      try {
        const phones = typeof phonesJson === 'string' ? JSON.parse(phonesJson) : phonesJson;
        if (Array.isArray(phones)) {
          return phones
            .filter(p => p.phone && p.phone !== primaryPhone)
            .map(p => p.phone)
            .join('; ');
        }
        return '';
      } catch {
        return '';
      }
    };

    // Helper to extract social link
    const getSocialLink = (socialLinks, network) => {
      if (!socialLinks) return '';
      try {
        const links = typeof socialLinks === 'string' ? JSON.parse(socialLinks) : socialLinks;
        return links[network] || '';
      } catch {
        return '';
      }
    };

    // Helper to format team members
    const formatTeamMembers = (teamJson) => {
      if (!teamJson) return '';
      try {
        const team = typeof teamJson === 'string' ? JSON.parse(teamJson) : teamJson;
        if (Array.isArray(team)) {
          return team
            .map(m => m.role ? `${m.name} (${m.role})` : m.name)
            .join('; ');
        }
        return '';
      } catch {
        return '';
      }
    };

    // Helper to get razao social from cnpj_data
    const getRazaoSocial = (cnpjData) => {
      if (!cnpjData) return '';
      try {
        const data = typeof cnpjData === 'string' ? JSON.parse(cnpjData) : cnpjData;
        return data.razaoSocial || data.razao_social || '';
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
      escapeCsvValue(formatAdditionalPhones(c.phones, c.phone)),
      escapeCsvValue(c.email),
      escapeCsvValue(formatAdditionalEmails(c.emails, c.email)),
      escapeCsvValue(c.website),
      c.rating || '',
      c.review_count || 0,
      escapeCsvValue(getSocialLink(c.social_links, 'linkedin')),
      escapeCsvValue(getSocialLink(c.social_links, 'instagram')),
      escapeCsvValue(getSocialLink(c.social_links, 'facebook')),
      escapeCsvValue(getSocialLink(c.social_links, 'youtube')),
      escapeCsvValue(getSocialLink(c.social_links, 'twitter')),
      escapeCsvValue(c.company_description),
      escapeCsvValue(formatJsonArray(c.company_services)),
      escapeCsvValue(formatJsonArray(c.pain_points)),
      escapeCsvValue(formatTeamMembers(c.team_members)),
      escapeCsvValue(c.cnpj),
      escapeCsvValue(getRazaoSocial(c.cnpj_data)),
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

/**
 * Get found places for an agent (when insert_in_crm is false)
 * GET /api/google-maps-agents/:id/found-places
 */
exports.getFoundPlaces = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;

    // Get agent to verify ownership and get found_places
    const agent = await googleMapsAgentService.getAgent(id, accountId);

    if (!agent.found_places) {
      return res.json({
        success: true,
        places: [],
        count: 0
      });
    }

    // Parse found_places (it's stored as JSONB)
    const places = typeof agent.found_places === 'string'
      ? JSON.parse(agent.found_places)
      : agent.found_places;

    res.json({
      success: true,
      places: places || [],
      count: places?.length || 0
    });

  } catch (error) {
    console.error('❌ Error fetching found places:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching found places'
    });
  }
};

/**
 * Get duplicates found by an agent
 * GET /api/google-maps-agents/:id/duplicates
 */
exports.getAgentDuplicates = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const accountId = req.user.accountId;

    const duplicates = await googleMapsAgentService.getAgentDuplicates(id, accountId, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      duplicates: duplicates || [],
      count: duplicates?.length || 0
    });

  } catch (error) {
    console.error('❌ Error fetching agent duplicates:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching duplicates'
    });
  }
};

/**
 * Get duplicate statistics for an agent
 * GET /api/google-maps-agents/:id/duplicate-stats
 */
exports.getAgentDuplicateStats = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;

    const stats = await googleMapsAgentService.getAgentDuplicateStats(id, accountId);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Error fetching duplicate stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching duplicate statistics'
    });
  }
};

/**
 * Export found places to CSV (when insert_in_crm is false)
 * GET /api/google-maps-agents/:id/export-found-places
 */
exports.exportFoundPlaces = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;

    console.log(`📥 CSV export request for found places of agent ${id}`);

    // Get agent info
    const agent = await googleMapsAgentService.getAgent(id, accountId);

    if (!agent.found_places) {
      return res.status(404).json({
        success: false,
        message: 'Nenhum lead encontrado para este agente'
      });
    }

    // Parse found_places
    const places = typeof agent.found_places === 'string'
      ? JSON.parse(agent.found_places)
      : agent.found_places;

    if (!places || places.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Nenhum lead encontrado para este agente'
      });
    }

    // Generate CSV (same structure as regular export)
    const headers = [
      'Nome',
      'Categoria',
      'Endereço',
      'Cidade',
      'Estado',
      'País',
      'Telefone Principal',
      'Telefones Adicionais',
      'Email Principal',
      'Emails Adicionais',
      'Website',
      'Rating',
      'Reviews',
      'LinkedIn',
      'Instagram',
      'Facebook',
      'YouTube',
      'Twitter',
      'Descrição da Empresa',
      'Serviços',
      'Possíveis Dores',
      'Membros da Equipe',
      'CNPJ',
      'Razão Social',
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

    const formatJsonArray = (jsonValue) => {
      if (!jsonValue) return '';
      try {
        const arr = Array.isArray(jsonValue) ? jsonValue : JSON.parse(jsonValue);
        if (Array.isArray(arr)) {
          return arr.join('; ');
        }
        return '';
      } catch {
        return '';
      }
    };

    const formatAdditionalEmails = (emails, primaryEmail) => {
      if (!emails || !Array.isArray(emails)) return '';
      return emails
        .filter(e => e.email && e.email !== primaryEmail)
        .map(e => e.email)
        .join('; ');
    };

    const formatAdditionalPhones = (phones, primaryPhone) => {
      if (!phones || !Array.isArray(phones)) return '';
      return phones
        .filter(p => p.phone && p.phone !== primaryPhone)
        .map(p => p.phone)
        .join('; ');
    };

    const getSocialLink = (socialLinks, network) => {
      if (!socialLinks) return '';
      return socialLinks[network] || '';
    };

    const formatTeamMembers = (team) => {
      if (!team || !Array.isArray(team)) return '';
      return team
        .map(m => m.role ? `${m.name} (${m.role})` : m.name)
        .join('; ');
    };

    const getRazaoSocial = (cnpjData) => {
      if (!cnpjData) return '';
      return cnpjData.razaoSocial || cnpjData.razao_social || '';
    };

    const rows = places.map(p => [
      escapeCsvValue(p.name),
      escapeCsvValue(p.business_category),
      escapeCsvValue(p.address || p.street_address),
      escapeCsvValue(p.city),
      escapeCsvValue(p.state),
      escapeCsvValue(p.country),
      escapeCsvValue(p.phone),
      escapeCsvValue(formatAdditionalPhones(p.phones, p.phone)),
      escapeCsvValue(p.email),
      escapeCsvValue(formatAdditionalEmails(p.emails, p.email)),
      escapeCsvValue(p.website),
      p.rating || '',
      p.review_count || 0,
      escapeCsvValue(getSocialLink(p.social_links, 'linkedin')),
      escapeCsvValue(getSocialLink(p.social_links, 'instagram')),
      escapeCsvValue(getSocialLink(p.social_links, 'facebook')),
      escapeCsvValue(getSocialLink(p.social_links, 'youtube')),
      escapeCsvValue(getSocialLink(p.social_links, 'twitter')),
      escapeCsvValue(p.company_description),
      escapeCsvValue(formatJsonArray(p.company_services)),
      escapeCsvValue(formatJsonArray(p.pain_points)),
      escapeCsvValue(formatTeamMembers(p.team_members)),
      escapeCsvValue(p.cnpj),
      escapeCsvValue(getRazaoSocial(p.cnpj_data)),
      escapeCsvValue(p.google_maps_url)
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    // Set headers for CSV download
    const filename = `google-maps-list-${agent.name.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Send CSV with BOM for Excel UTF-8 support
    res.send('\uFEFF' + csv);

    console.log(`✅ CSV exported successfully: ${places.length} leads`);

  } catch (error) {
    console.error('❌ Error exporting found places:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error exporting found places'
    });
  }
};
