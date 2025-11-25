// backend/src/controllers/agentController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const {
  NotFoundError,
  ValidationError,
  ForbiddenError
} = require('../utils/errors');

// ==========================================
// HELPER: Check sector access
// ==========================================
const checkSectorAccess = (userSectors, agentSectorId) => {
  if (!agentSectorId) return true; // No sector restriction
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
    response_style_instructions: agent.config?.response_style_instructions || null
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

    default:
      throw new ValidationError(`Invalid agent type: ${agentType}`);
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

    // Query params
    const { agent_type, is_active, limit = 50, offset = 0 } = req.query;

    // Build query
    let query = `
      SELECT
        id,
        account_id,
        user_id,
        sector_id,
        name,
        description,
        avatar_url,
        agent_type,
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
        updated_at
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
      checkSectorAccess(userSectors, agent.sector_id)
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

    const result = await db.query(
      `SELECT * FROM ai_agents WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Agent not found');
    }

    const agent = result.rows[0];

    // Check sector access
    if (!checkSectorAccess(userSectors, agent.sector_id)) {
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
      execution_time = '09:00:00'
    } = req.body;

    // Validation
    if (!name || !name.trim()) {
      throw new ValidationError('Agent name is required');
    }

    if (!agent_type) {
      throw new ValidationError('Agent type is required');
    }

    if (!['linkedin', 'email', 'whatsapp'].includes(agent_type)) {
      throw new ValidationError('Invalid agent type');
    }

    if (!['short', 'medium', 'long'].includes(response_length)) {
      throw new ValidationError('Invalid response length');
    }

    // Validate config based on agent type
    validateAgentConfig(agent_type, config);

    // Check sector access if sector_id provided
    if (sector_id) {
      const userSectors = req.user.sectors || [];
      if (!checkSectorAccess(userSectors, sector_id)) {
        throw new ForbiddenError('You do not have access to this sector');
      }
    }

    // Insert agent
    const result = await db.query(
      `INSERT INTO ai_agents (
        account_id,
        user_id,
        sector_id,
        name,
        description,
        avatar_url,
        agent_type,
        response_length,
        config,
        is_active,
        daily_limit,
        execution_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        accountId,
        userId,
        sector_id || null,
        name.trim(),
        description || null,
        avatar_url || null,
        agent_type,
        response_length,
        JSON.stringify(config),
        is_active,
        daily_limit,
        execution_time
      ]
    );

    const agent = result.rows[0];

    console.log(`✅ Created ${agent_type} agent:`, agent.id);

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
    if (!checkSectorAccess(userSectors, existingAgent.sector_id)) {
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
      execution_time
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
    if (!checkSectorAccess(userSectors, agent.sector_id)) {
      throw new ForbiddenError('You do not have access to this agent');
    }

    // Delete agent
    await db.query(
      `DELETE FROM ai_agents WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    console.log(`✅ Deleted ${agent.agent_type} agent:`, agent.id);

    sendSuccess(res, { message: 'Agent deleted successfully' });

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
    const { message, conversation_history = [], lead_data = {} } = req.body;

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
      context: { is_test: true }
    });

    sendSuccess(res, {
      response: result.response,
      intent: result.intent,
      should_offer_scheduling: result.should_offer_scheduling,
      scheduling_link: result.scheduling_link,
      tokens_used: result.tokens_used
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
    if (!checkSectorAccess(userSectors, agent.sector_id)) {
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

module.exports = {
  getAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  testAgent,
  testAgentInitialMessage,
  testAgentResponse,
  getAgentStats
};
