// backend/src/controllers/agentController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const {
  NotFoundError,
  ValidationError,
  ForbiddenError
} = require('../utils/errors');
const rotationService = require('../services/rotationService');
const assignmentLogService = require('../services/assignmentLogService');
const agentGeneratorService = require('../services/agentGeneratorService');
const agentTemplates = require('../data/agentTemplates');

// ==========================================
// HELPER: Check sector access
// ==========================================
const checkSectorAccess = (userSectors, agentSectorId, userRole) => {
  // Admins have access to all sectors
  if (userRole === 'admin') return true;
  // No sector restriction
  if (!agentSectorId) return true;
  // Check if user has access to this sector
  return userSectors.some(s => s.id === agentSectorId);
};

// ==========================================
// HELPER: Adapt unified agent to aiResponseService format
// ==========================================
const adaptAgentForAIService = (agent) => {
  // If agent already has the fields in root (legacy format), return as-is
  if (agent.initial_approach || agent.behavioral_profile) {
    return agent;
  }

  // Adapt new unified format to legacy format expected by aiResponseService
  return {
    ...agent,
    initial_approach: agent.config?.initial_approach || agent.config?.initial_message,
    behavioral_profile: agent.config?.behavioral_profile || 'consultivo',
    products_services: agent.config?.products_services || agent.description,
    intent_detection_enabled: true,
    auto_schedule: agent.config?.auto_schedule || false,
    scheduling_link: agent.config?.scheduling_link || null,
    response_style_instructions: agent.config?.response_style_instructions || null,
    // New fields for objective and strategy
    objective: agent.config?.objective || null,
    conversation_steps: agent.config?.conversation_steps || [],
    objective_instructions: agent.config?.objective_instructions || null,
    escalation_sentiments: agent.config?.escalation_sentiments || [],
    escalation_keywords: agent.config?.escalation_keywords || '',
    // Company info
    company_description: agent.config?.company_description || null,
    value_proposition: agent.config?.value_proposition || null,
    key_differentiators: agent.config?.key_differentiators || null
  };
};

// ==========================================
// HELPER: Validate agent config by type
// ==========================================
const validateAgentConfig = (agentType, config) => {
  switch (agentType) {
    case 'linkedin':
      // LinkedIn agents need specific fields
      if (!config.behavioral_profile) {
        throw new ValidationError('LinkedIn agents require a behavioral_profile');
      }
      break;

    case 'google_maps':
      // Google Maps agents need location and search query
      if (!config.location || !config.location.lat || !config.location.lng) {
        throw new ValidationError('Google Maps agents require location coordinates');
      }
      if (!config.search_query && !config.business_category && !config.business_specification) {
        throw new ValidationError('Google Maps agents require search query or business category');
      }
      break;

    case 'email':
    case 'whatsapp':
      // Email/WhatsApp agents need messaging config
      if (!config.initial_message) {
        throw new ValidationError(`${agentType} agents require initial_message`);
      }
      break;

    case 'facilitador':
      // Facilitador agents need channel and handoff config
      if (!config.facilitador_channel || !['linkedin', 'whatsapp'].includes(config.facilitador_channel)) {
        throw new ValidationError('Facilitador agents require a channel (linkedin or whatsapp)');
      }
      break;

    default:
      // Allow other types without specific validation
      break;
  }

  return true;
};

// ==========================================
// 1. GET ALL AGENTS (with optional type filter)
// ==========================================
const getAgents = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const userSectors = req.user.sectors || [];
    const userRole = req.user.role;

    // Query params
    const { agent_type, is_active, limit = 50, offset = 0 } = req.query;

    // Build query - includes all fields from migrations 066, 067, 068, 098
    let query = `
      SELECT
        id,
        account_id,
        user_id,
        sector_id,
        folder_id,
        name,
        description,
        avatar_url,
        agent_type,
        language,
        response_length,
        config,
        is_active,
        total_interactions,
        successful_interactions,
        failed_interactions,
        daily_limit,
        execution_time,
        last_execution_at,
        next_execution_at,
        created_at,
        updated_at,
        products_services,
        target_audience,
        behavioral_profile,
        connection_strategy,
        wait_time_after_accept,
        require_lead_reply,
        invite_message,
        initial_approach,
        scheduling_link,
        auto_schedule,
        intent_detection_enabled,
        response_style_instructions,
        priority_rules,
        linkedin_variables,
        post_accept_message,
        transfer_triggers,
        conversation_steps,
        transfer_mode,
        transfer_message,
        objective_instructions
      FROM ai_agents
      WHERE account_id = $1
    `;

    const params = [accountId];
    let paramIndex = 2;

    // Filter by agent_type if provided
    if (agent_type) {
      query += ` AND agent_type = $${paramIndex}`;
      params.push(agent_type);
      paramIndex++;
    }

    // Filter by is_active if provided
    if (is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    // Filter by sector access
    const agents = result.rows.filter(agent =>
      checkSectorAccess(userSectors, agent.sector_id, userRole)
    );

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM ai_agents WHERE account_id = $1`;
    const countParams = [accountId];
    let countParamIndex = 2;

    if (agent_type) {
      countQuery += ` AND agent_type = $${countParamIndex}`;
      countParams.push(agent_type);
      countParamIndex++;
    }

    if (is_active !== undefined) {
      countQuery += ` AND is_active = $${countParamIndex}`;
      countParams.push(is_active === 'true');
    }

    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    sendSuccess(res, {
      agents,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: totalCount > (parseInt(offset) + agents.length)
      }
    });

  } catch (error) {
    console.error('Error in getAgents:', error);
    sendError(res, error);
  }
};

// ==========================================
// 2. GET SINGLE AGENT BY ID
// ==========================================
const getAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;
    const userSectors = req.user.sectors || [];
    const userRole = req.user.role;

    const result = await db.query(
      `SELECT * FROM ai_agents WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Agent not found');
    }

    const agent = result.rows[0];

    // Check sector access
    if (!checkSectorAccess(userSectors, agent.sector_id, userRole)) {
      throw new ForbiddenError('You do not have access to this agent');
    }

    sendSuccess(res, { agent });

  } catch (error) {
    console.error('Error in getAgent:', error);
    sendError(res, error);
  }
};

// ==========================================
// 3. CREATE AGENT
// ==========================================
const createAgent = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      name,
      description,
      avatar_url,
      agent_type,
      response_length = 'medium',
      config = {},
      is_active = true,
      sector_id,
      daily_limit = 50,
      execution_time = '09:00:00',
      // New handoff fields
      agent_mode = 'full',
      handoff_after_exchanges = null,
      handoff_silent = true,
      handoff_message = null,
      notify_on_handoff = true,
      // Assignees for rotation
      assignee_user_ids = [],
      // Hire wizard fields
      language,
      products_services,
      target_audience,
      behavioral_profile,
      connection_strategy = 'with-intro',
      wait_time_after_accept = 5,
      require_lead_reply = false,
      invite_message,
      initial_approach,
      scheduling_link,
      auto_schedule = false,
      intent_detection_enabled = true,
      response_style_instructions,
      priority_rules = []
    } = req.body;

    // Validation
    if (!name || !name.trim()) {
      throw new ValidationError('Agent name is required');
    }

    if (!agent_type) {
      throw new ValidationError('Agent type is required');
    }

    if (!['linkedin', 'email', 'whatsapp', 'facilitador'].includes(agent_type)) {
      throw new ValidationError('Invalid agent type');
    }

    if (!['short', 'medium', 'long'].includes(response_length)) {
      throw new ValidationError('Invalid response length');
    }

    // Validate agent_mode
    if (!['full', 'facilitator'].includes(agent_mode)) {
      throw new ValidationError('Invalid agent mode. Must be "full" or "facilitator"');
    }

    // Facilitator mode requires sector_id and handoff_after_exchanges
    if (agent_mode === 'facilitator') {
      if (!sector_id) {
        throw new ValidationError('Facilitator agents require a sector');
      }
      if (!handoff_after_exchanges || handoff_after_exchanges < 1) {
        throw new ValidationError('Facilitator agents require handoff_after_exchanges >= 1');
      }
    }

    // Validate config based on agent type
    validateAgentConfig(agent_type, config);

    // Check sector access if sector_id provided
    if (sector_id) {
      const userSectors = req.user.sectors || [];
      const userRole = req.user.role;
      if (!checkSectorAccess(userSectors, sector_id, userRole)) {
        throw new ForbiddenError('You do not have access to this sector');
      }
    }

    // Insert agent with all hire wizard fields
    const result = await db.query(
      `INSERT INTO ai_agents (
        account_id,
        user_id,
        sector_id,
        name,
        description,
        avatar_url,
        agent_type,
        language,
        response_length,
        config,
        is_active,
        daily_limit,
        execution_time,
        agent_mode,
        handoff_after_exchanges,
        handoff_silent,
        handoff_message,
        notify_on_handoff,
        products_services,
        target_audience,
        behavioral_profile,
        connection_strategy,
        wait_time_after_accept,
        require_lead_reply,
        invite_message,
        initial_approach,
        scheduling_link,
        auto_schedule,
        intent_detection_enabled,
        response_style_instructions,
        priority_rules
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)
      RETURNING *`,
      [
        accountId,
        userId,
        sector_id || null,
        name.trim(),
        description || null,
        avatar_url || null,
        agent_type,
        language || null,
        response_length,
        JSON.stringify(config),
        is_active,
        daily_limit,
        execution_time,
        agent_mode,
        handoff_after_exchanges,
        handoff_silent,
        handoff_message,
        notify_on_handoff,
        products_services ? (typeof products_services === 'string' ? products_services : JSON.stringify(products_services)) : null,
        target_audience ? (typeof target_audience === 'string' ? target_audience : JSON.stringify(target_audience)) : null,
        behavioral_profile || null,
        connection_strategy,
        wait_time_after_accept,
        require_lead_reply,
        invite_message || null,
        initial_approach || null,
        scheduling_link || null,
        auto_schedule,
        intent_detection_enabled,
        response_style_instructions || null,
        JSON.stringify(priority_rules)
      ]
    );

    const agent = result.rows[0];

    // Set assignees if provided
    if (assignee_user_ids && assignee_user_ids.length > 0) {
      await rotationService.setAssignees(agent.id, assignee_user_ids);
    }

    console.log(`✅ Created ${agent_type} agent (mode: ${agent_mode}):`, agent.id);

    sendSuccess(res, { agent }, 201);

  } catch (error) {
    console.error('Error in createAgent:', error);
    sendError(res, error);
  }
};

// ==========================================
// 4. UPDATE AGENT
// ==========================================
const updateAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;
    const userSectors = req.user.sectors || [];
    const userRole = req.user.role;

    // Check if agent exists and user has access
    const checkResult = await db.query(
      `SELECT * FROM ai_agents WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Agent not found');
    }

    const existingAgent = checkResult.rows[0];

    // Check sector access
    if (!checkSectorAccess(userSectors, existingAgent.sector_id, userRole)) {
      throw new ForbiddenError('You do not have access to this agent');
    }

    const {
      name,
      description,
      avatar_url,
      response_length,
      config,
      is_active,
      daily_limit,
      execution_time,
      priority_rules,
      // Hire wizard fields
      language,
      products_services,
      target_audience,
      behavioral_profile,
      connection_strategy,
      wait_time_after_accept,
      require_lead_reply,
      invite_message,
      initial_approach,
      scheduling_link,
      auto_schedule,
      intent_detection_enabled,
      response_style_instructions,
      workflow_definition,
      workflow_enabled
    } = req.body;

    // Validate config if provided
    if (config) {
      validateAgentConfig(existingAgent.agent_type, config);
    }

    // Build update query dynamically
    const updates = [];
    const params = [id, accountId];
    let paramIndex = 3;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(name.trim());
      paramIndex++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(description);
      paramIndex++;
    }

    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramIndex}`);
      params.push(avatar_url);
      paramIndex++;
    }

    if (response_length !== undefined) {
      if (!['short', 'medium', 'long'].includes(response_length)) {
        throw new ValidationError('Invalid response length');
      }
      updates.push(`response_length = $${paramIndex}`);
      params.push(response_length);
      paramIndex++;
    }

    if (config !== undefined) {
      updates.push(`config = $${paramIndex}`);
      params.push(JSON.stringify(config));
      paramIndex++;
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      params.push(is_active);
      paramIndex++;
    }

    if (daily_limit !== undefined) {
      updates.push(`daily_limit = $${paramIndex}`);
      params.push(daily_limit);
      paramIndex++;
    }

    if (execution_time !== undefined) {
      updates.push(`execution_time = $${paramIndex}`);
      params.push(execution_time);
      paramIndex++;
    }

    if (priority_rules !== undefined) {
      updates.push(`priority_rules = $${paramIndex}`);
      params.push(JSON.stringify(priority_rules));
      paramIndex++;
    }

    // Hire wizard fields
    if (language !== undefined) {
      updates.push(`language = $${paramIndex}`);
      params.push(language);
      paramIndex++;
    }

    if (products_services !== undefined) {
      updates.push(`products_services = $${paramIndex}`);
      params.push(typeof products_services === 'string' ? products_services : JSON.stringify(products_services));
      paramIndex++;
    }

    if (target_audience !== undefined) {
      updates.push(`target_audience = $${paramIndex}`);
      params.push(typeof target_audience === 'string' ? target_audience : JSON.stringify(target_audience));
      paramIndex++;
    }

    if (behavioral_profile !== undefined) {
      updates.push(`behavioral_profile = $${paramIndex}`);
      params.push(behavioral_profile);
      paramIndex++;
    }

    if (connection_strategy !== undefined) {
      updates.push(`connection_strategy = $${paramIndex}`);
      params.push(connection_strategy);
      paramIndex++;
    }

    if (wait_time_after_accept !== undefined) {
      updates.push(`wait_time_after_accept = $${paramIndex}`);
      params.push(wait_time_after_accept);
      paramIndex++;
    }

    if (require_lead_reply !== undefined) {
      updates.push(`require_lead_reply = $${paramIndex}`);
      params.push(require_lead_reply);
      paramIndex++;
    }

    if (invite_message !== undefined) {
      updates.push(`invite_message = $${paramIndex}`);
      params.push(invite_message);
      paramIndex++;
    }

    if (initial_approach !== undefined) {
      updates.push(`initial_approach = $${paramIndex}`);
      params.push(initial_approach);
      paramIndex++;
    }

    if (scheduling_link !== undefined) {
      updates.push(`scheduling_link = $${paramIndex}`);
      params.push(scheduling_link);
      paramIndex++;
    }

    if (auto_schedule !== undefined) {
      updates.push(`auto_schedule = $${paramIndex}`);
      params.push(auto_schedule);
      paramIndex++;
    }

    if (intent_detection_enabled !== undefined) {
      updates.push(`intent_detection_enabled = $${paramIndex}`);
      params.push(intent_detection_enabled);
      paramIndex++;
    }

    if (response_style_instructions !== undefined) {
      updates.push(`response_style_instructions = $${paramIndex}`);
      params.push(response_style_instructions);
      paramIndex++;
    }

    if (workflow_definition !== undefined) {
      updates.push(`workflow_definition = $${paramIndex}`);
      params.push(JSON.stringify(workflow_definition));
      paramIndex++;
      console.log('📥 [updateAgent] Saving workflow_definition:', {
        nodesCount: workflow_definition?.nodes?.length || 0,
        edgesCount: workflow_definition?.edges?.length || 0,
        edges: workflow_definition?.edges?.map(e => ({
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle
        }))
      });
    }

    if (workflow_enabled !== undefined) {
      updates.push(`workflow_enabled = $${paramIndex}`);
      params.push(workflow_enabled);
      paramIndex++;
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update');
    }

    // Execute update
    const query = `
      UPDATE ai_agents
      SET ${updates.join(', ')}
      WHERE id = $1 AND account_id = $2
      RETURNING *
    `;

    const result = await db.query(query, params);
    const agent = result.rows[0];

    console.log(`✅ Updated ${agent.agent_type} agent:`, agent.id);

    sendSuccess(res, { agent });

  } catch (error) {
    console.error('Error in updateAgent:', error);
    sendError(res, error);
  }
};

// ==========================================
// 5. DELETE AGENT
// ==========================================
const deleteAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;
    const userSectors = req.user.sectors || [];
    const userRole = req.user.role;

    // Check if agent exists and user has access
    const checkResult = await db.query(
      `SELECT * FROM ai_agents WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Agent not found');
    }

    const agent = checkResult.rows[0];

    // Check sector access
    if (!checkSectorAccess(userSectors, agent.sector_id, userRole)) {
      throw new ForbiddenError('You do not have access to this agent');
    }

    // Check for associated campaigns and pause them
    const campaignsResult = await db.query(
      `SELECT id, name, status FROM campaigns
       WHERE ai_agent_id = $1 AND account_id = $2`,
      [id, accountId]
    );

    const associatedCampaigns = campaignsResult.rows;
    let pausedCount = 0;

    if (associatedCampaigns.length > 0) {
      // Pause all associated campaigns with reason 'agent_deleted'
      const pauseResult = await db.query(
        `UPDATE campaigns
         SET status = 'paused',
             automation_active = false,
             ai_agent_id = NULL,
             paused_reason = 'agent_deleted',
             paused_at = NOW()
         WHERE ai_agent_id = $1 AND account_id = $2
         RETURNING id`,
        [id, accountId]
      );

      pausedCount = pauseResult.rowCount;
      console.log(`⏸️ Paused ${pausedCount} campaigns associated with agent ${id}`);
    }

    // Delete agent
    await db.query(
      `DELETE FROM ai_agents WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    console.log(`✅ Deleted ${agent.agent_type} agent:`, agent.id);

    sendSuccess(res, {
      message: 'Agent deleted successfully',
      paused_campaigns: pausedCount
    });

  } catch (error) {
    console.error('Error in deleteAgent:', error);
    sendError(res, error);
  }
};

// ==========================================
// 6. TEST AGENT
// ==========================================
const testAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;
    const { message, context } = req.body;

    // Check if agent exists
    const agentResult = await db.query(
      `SELECT * FROM ai_agents WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (agentResult.rows.length === 0) {
      throw new NotFoundError('Agent not found');
    }

    const agent = agentResult.rows[0];

    // Get knowledge base for this agent
    const knowledgeResult = await db.query(
      `SELECT content, metadata FROM agent_knowledge
       WHERE agent_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [id]
    );

    const knowledge = knowledgeResult.rows.map(k => k.content).join('\n\n');

    // Generate response based on agent type
    let response = '';

    switch (agent.agent_type) {
      case 'linkedin':
        const initialApproach = agent.config?.initial_approach || 'Olá! Como posso ajudá-lo?';
        const behavioralProfile = agent.config?.behavioral_profile || 'consultivo';

        // Build context-aware response
        const isFirstMessage = !context?.conversation_history || context.conversation_history.length <= 1;

        if (isFirstMessage) {
          // Use initial approach for first message
          response = initialApproach;
        } else {
          // Generate contextual response based on behavioral profile and knowledge
          response = generateLinkedInResponse(message, behavioralProfile, knowledge, agent.response_length);
        }
        break;

      case 'email':
        const emailMessage = agent.config?.initial_message || 'Olá, espero que esteja bem!';
        response = emailMessage;
        break;

      case 'whatsapp':
        const whatsappMessage = agent.config?.initial_message || 'Olá! Como posso ajudá-lo hoje?';
        response = whatsappMessage;
        break;

      default:
        response = `Olá! Sou ${agent.name}. Como posso ajudá-lo?`;
    }

    sendSuccess(res, {
      test_result: {
        agent_id: agent.id,
        agent_type: agent.agent_type,
        test_output: response,
        used_knowledge: knowledge.length > 0,
        status: 'success'
      }
    });

  } catch (error) {
    console.error('Error in testAgent:', error);
    sendError(res, error);
  }
};

// ==========================================
// 8. TEST AGENT - INITIAL MESSAGE (with RAG)
// ==========================================
const testAgentInitialMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;
    const { lead_data } = req.body;

    // Check if agent exists
    const agentResult = await db.query(
      `SELECT * FROM ai_agents WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (agentResult.rows.length === 0) {
      throw new NotFoundError('Agent not found');
    }

    const agent = agentResult.rows[0];

    // Adapt agent format for aiResponseService
    const adaptedAgent = adaptAgentForAIService(agent);

    // Use aiResponseService to generate initial message
    const aiResponseService = require('../services/aiResponseService');
    const result = await aiResponseService.generateInitialMessage({
      ai_agent: adaptedAgent,
      lead_data: lead_data || {},
      campaign: { name: 'Test Campaign' }
    });

    sendSuccess(res, {
      message: result,
      agent_profile: adaptedAgent.behavioral_profile
    });

  } catch (error) {
    console.error('Error in testAgentInitialMessage:', error);
    sendError(res, error);
  }
};

// ==========================================
// 9. TEST AGENT - RESPONSE (with RAG)
// ==========================================
const testAgentResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;
    const { message, conversation_history = [], lead_data = {}, current_step = 0 } = req.body;

    if (!message) {
      throw new ValidationError('Test message is required');
    }

    // Check if agent exists
    const agentResult = await db.query(
      `SELECT * FROM ai_agents WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (agentResult.rows.length === 0) {
      throw new NotFoundError('Agent not found');
    }

    const agent = agentResult.rows[0];

    // Adapt agent format for aiResponseService
    const adaptedAgent = adaptAgentForAIService(agent);

    // Use aiResponseService to generate response with RAG search
    const aiResponseService = require('../services/aiResponseService');
    const result = await aiResponseService.generateResponse({
      conversation_id: 'test',
      lead_message: message,
      conversation_history,
      ai_agent: adaptedAgent,
      lead_data,
      context: { is_test: true },
      current_step  // Pass current step for intelligent progression
    });

    sendSuccess(res, {
      response: result.response,
      intent: result.intent,
      sentiment: result.sentiment,
      sentiment_confidence: result.sentimentConfidence,
      should_escalate: result.shouldEscalate,
      escalation_reasons: result.escalationReasons,
      matched_keywords: result.matchedKeywords,
      should_offer_scheduling: result.should_offer_scheduling,
      scheduling_link: result.scheduling_link,
      tokens_used: result.tokens_used,
      current_step: result.current_step,    // Return updated step
      step_advanced: result.step_advanced   // Indicate if step advanced
    });

  } catch (error) {
    console.error('Error in testAgentResponse:', error);
    sendError(res, error);
  }
};

// ==========================================
// 7. GET AGENT STATS
// ==========================================
const getAgentStats = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;
    const userSectors = req.user.sectors || [];
    const userRole = req.user.role;

    // Check if agent exists
    const result = await db.query(
      `SELECT * FROM ai_agents WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Agent not found');
    }

    const agent = result.rows[0];

    // Check sector access
    if (!checkSectorAccess(userSectors, agent.sector_id, userRole)) {
      throw new ForbiddenError('You do not have access to this agent');
    }

    // Calculate success rate
    const successRate = agent.total_interactions > 0
      ? Math.round((agent.successful_interactions / agent.total_interactions) * 100)
      : 0;

    sendSuccess(res, {
      stats: {
        total_interactions: agent.total_interactions || 0,
        successful_interactions: agent.successful_interactions || 0,
        failed_interactions: agent.failed_interactions || 0,
        success_rate: successRate,
        last_execution_at: agent.last_execution_at,
        next_execution_at: agent.next_execution_at,
        is_active: agent.is_active
      }
    });

  } catch (error) {
    console.error('Error in getAgentStats:', error);
    sendError(res, error);
  }
};

// ==========================================
// ASSIGNEES / ROTATION ENDPOINTS
// ==========================================

/**
 * Get assignees for an agent
 * GET /api/agents/:id/assignees
 */
const getAgentAssignees = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    // Check agent exists and belongs to account
    const agentResult = await db.query(
      `SELECT id FROM ai_agents WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (agentResult.rows.length === 0) {
      throw new NotFoundError('Agent not found');
    }

    const assignees = await rotationService.getAssignees(id);
    const rotationState = await rotationService.getRotationState(id);

    sendSuccess(res, { assignees, rotation_state: rotationState });

  } catch (error) {
    console.error('Error in getAgentAssignees:', error);
    sendError(res, error);
  }
};

/**
 * Set assignees for an agent (replaces existing)
 * POST /api/agents/:id/assignees
 * Body: { user_ids: [1, 2, 3] } - in rotation order
 */
const setAgentAssignees = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;
    const { user_ids = [] } = req.body;

    // Check agent exists and belongs to account
    const agentResult = await db.query(
      `SELECT id, sector_id FROM ai_agents WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (agentResult.rows.length === 0) {
      throw new NotFoundError('Agent not found');
    }

    const agent = agentResult.rows[0];

    // Validate that all users belong to the agent's sector
    if (agent.sector_id && user_ids.length > 0) {
      const sectorUsersResult = await db.query(`
        SELECT u.id
        FROM users u
        JOIN user_sectors us ON u.id = us.user_id
        WHERE us.sector_id = $1 AND u.id = ANY($2)
      `, [agent.sector_id, user_ids]);

      const validUserIds = sectorUsersResult.rows.map(r => r.id);
      const invalidUsers = user_ids.filter(uid => !validUserIds.includes(uid));

      if (invalidUsers.length > 0) {
        throw new ValidationError(`Users ${invalidUsers.join(', ')} do not belong to the agent's sector`);
      }
    }

    const result = await rotationService.setAssignees(id, user_ids);

    sendSuccess(res, {
      success: true,
      assignees_count: result.count,
      message: `${result.count} assignees configured for rotation`
    });

  } catch (error) {
    console.error('Error in setAgentAssignees:', error);
    sendError(res, error);
  }
};

/**
 * Add a single assignee to an agent
 * POST /api/agents/:id/assignees/:userId
 */
const addAgentAssignee = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const accountId = req.user.account_id;

    // Check agent exists
    const agentResult = await db.query(
      `SELECT id, sector_id FROM ai_agents WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (agentResult.rows.length === 0) {
      throw new NotFoundError('Agent not found');
    }

    const agent = agentResult.rows[0];

    // Validate user belongs to sector
    if (agent.sector_id) {
      const sectorCheck = await db.query(`
        SELECT 1 FROM user_sectors WHERE user_id = $1 AND sector_id = $2
      `, [userId, agent.sector_id]);

      if (sectorCheck.rows.length === 0) {
        throw new ValidationError('User does not belong to the agent\'s sector');
      }
    }

    const result = await rotationService.addAssignee(id, parseInt(userId));

    sendSuccess(res, result);

  } catch (error) {
    console.error('Error in addAgentAssignee:', error);
    sendError(res, error);
  }
};

/**
 * Remove an assignee from an agent
 * DELETE /api/agents/:id/assignees/:userId
 */
const removeAgentAssignee = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const accountId = req.user.account_id;

    // Check agent exists
    const agentResult = await db.query(
      `SELECT id FROM ai_agents WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (agentResult.rows.length === 0) {
      throw new NotFoundError('Agent not found');
    }

    await rotationService.removeAssignee(id, parseInt(userId));

    sendSuccess(res, { success: true, message: 'Assignee removed' });

  } catch (error) {
    console.error('Error in removeAgentAssignee:', error);
    sendError(res, error);
  }
};

/**
 * Get rotation state for an agent
 * GET /api/agents/:id/rotation-state
 */
const getAgentRotationState = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    // Check agent exists
    const agentResult = await db.query(
      `SELECT id FROM ai_agents WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (agentResult.rows.length === 0) {
      throw new NotFoundError('Agent not found');
    }

    const rotationState = await rotationService.getRotationState(id);

    sendSuccess(res, { rotation_state: rotationState });

  } catch (error) {
    console.error('Error in getAgentRotationState:', error);
    sendError(res, error);
  }
};

// ==========================================
// ASSIGNMENTS LOG ENDPOINTS
// ==========================================

/**
 * Get assignment history for an agent
 * GET /api/agents/:id/assignments
 */
const getAgentAssignmentHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;
    const {
      page = 1,
      limit = 50,
      user_id,
      start_date,
      end_date
    } = req.query;

    // Check agent exists
    const agentResult = await db.query(
      `SELECT id, name FROM ai_agents WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (agentResult.rows.length === 0) {
      throw new NotFoundError('Agent not found');
    }

    const result = await assignmentLogService.getAssignments({
      agentId: id,
      accountId,
      page: parseInt(page),
      limit: parseInt(limit),
      userId: user_id,
      startDate: start_date,
      endDate: end_date
    });

    sendSuccess(res, {
      agent: agentResult.rows[0],
      ...result
    });

  } catch (error) {
    console.error('Error in getAgentAssignmentHistory:', error);
    sendError(res, error);
  }
};

/**
 * Get assignment statistics for an agent
 * GET /api/agents/:id/assignments/stats
 */
const getAgentAssignmentStats = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    // Check agent exists
    const agentResult = await db.query(
      `SELECT id FROM ai_agents WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (agentResult.rows.length === 0) {
      throw new NotFoundError('Agent not found');
    }

    const stats = await assignmentLogService.getAssignmentStats(id, accountId);

    sendSuccess(res, { stats });

  } catch (error) {
    console.error('Error in getAgentAssignmentStats:', error);
    sendError(res, error);
  }
};

// ==========================================
// AI GENERATION ENDPOINTS
// ==========================================

/**
 * Generate agent configuration from description using AI
 * POST /api/agents/generate-config
 */
const generateAgentConfig = async (req, res) => {
  try {
    const { description, agent_type = 'linkedin', language = 'pt' } = req.body;

    if (!description || description.trim().length < 20) {
      throw new ValidationError('Description must be at least 20 characters');
    }

    const result = await agentGeneratorService.generateAgentConfig(
      description.trim(),
      agent_type,
      language
    );

    sendSuccess(res, result);

  } catch (error) {
    console.error('Error in generateAgentConfig:', error);
    sendError(res, error);
  }
};

/**
 * Refine an existing agent configuration based on feedback
 * POST /api/agents/refine-config
 */
const refineAgentConfig = async (req, res) => {
  try {
    const { current_config, feedback, language = 'pt' } = req.body;

    if (!current_config || !feedback) {
      throw new ValidationError('current_config and feedback are required');
    }

    const result = await agentGeneratorService.refineAgentConfig(
      current_config,
      feedback,
      language
    );

    sendSuccess(res, result);

  } catch (error) {
    console.error('Error in refineAgentConfig:', error);
    sendError(res, error);
  }
};

// ==========================================
// TEMPLATE ENDPOINTS
// ==========================================

/**
 * Get all available templates
 * GET /api/agent-templates
 */
const getAgentTemplates = async (req, res) => {
  try {
    const { company_size, deal_type, industry, sales_cycle } = req.query;

    let templates;
    if (company_size || deal_type || industry || sales_cycle) {
      templates = agentTemplates.getFilteredTemplates({
        company_size,
        deal_type,
        industry,
        sales_cycle
      });
    } else {
      templates = agentTemplates.getTemplates();
    }

    // Return simplified version for listing
    const simplifiedTemplates = templates.map(t => ({
      id: t.id,
      name: t.name,
      author: t.author,
      icon: t.icon,
      cover_url: t.cover_url,
      color: t.color,
      badge: t.badge,
      shortDescription: t.shortDescription,
      philosophy: t.philosophy,
      ideal_for: t.ideal_for
    }));

    sendSuccess(res, { templates: simplifiedTemplates });

  } catch (error) {
    console.error('Error in getAgentTemplates:', error);
    sendError(res, error);
  }
};

/**
 * Get a specific template by ID with full details
 * GET /api/agent-templates/:templateId
 */
const getAgentTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;

    const template = agentTemplates.getTemplateById(templateId);

    if (!template) {
      throw new NotFoundError('Template not found');
    }

    sendSuccess(res, { template });

  } catch (error) {
    console.error('Error in getAgentTemplate:', error);
    sendError(res, error);
  }
};

/**
 * Apply a template to create agent configuration
 * POST /api/agent-templates/:templateId/apply
 *
 * Uses AI to generate a truly personalized configuration
 * combining template methodology + product/service + objective
 */
const applyAgentTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const {
      agent_name,
      company_name,
      products_services,
      productService,
      area,
      objective,
      language = 'pt'
    } = req.body;

    // Use productService if provided, fallback to products_services
    const finalProductService = productService || products_services || '';

    // Get the template
    const template = agentTemplates.getTemplateById(templateId);
    if (!template) {
      throw new NotFoundError(`Template ${templateId} not found`);
    }

    // If no product/service provided, use old static method as fallback
    if (!finalProductService) {
      const config = agentTemplates.applyTemplate(templateId, {
        agent_name,
        company_name,
        products_services: finalProductService,
        area,
        objective
      });
      return sendSuccess(res, { config });
    }

    // Use AI to generate a truly personalized configuration
    const result = await agentGeneratorService.generateFromTemplate(
      template,
      finalProductService,
      objective || 'generate_interest',
      language
    );

    if (result.success) {
      // Override name if provided
      if (agent_name) {
        result.config.name = agent_name;
      }
      sendSuccess(res, { config: result.config, tokens_used: result.tokens_used });
    } else {
      // Fallback to static method if AI fails
      const config = agentTemplates.applyTemplate(templateId, {
        agent_name,
        company_name,
        products_services: finalProductService,
        area,
        objective
      });
      sendSuccess(res, { config });
    }

  } catch (error) {
    console.error('Error in applyAgentTemplate:', error);
    sendError(res, error);
  }
};

module.exports = {
  getAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  testAgent,
  testAgentInitialMessage,
  testAgentResponse,
  getAgentStats,
  // Rotation endpoints
  getAgentAssignees,
  setAgentAssignees,
  addAgentAssignee,
  removeAgentAssignee,
  getAgentRotationState,
  // Assignment log endpoints
  getAgentAssignmentHistory,
  getAgentAssignmentStats,
  // AI Generation endpoints
  generateAgentConfig,
  refineAgentConfig,
  // Template endpoints
  getAgentTemplates,
  getAgentTemplate,
  applyAgentTemplate
};
