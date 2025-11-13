// backend/src/controllers/aiAgentController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { 
  ValidationError,
  NotFoundError,
  ForbiddenError 
} = require('../utils/errors');

// ================================
// 1. LISTAR AGENTES DE IA
// ================================
const getAIAgents = async (req, res) => {
  try {
    const userId = req.user.id;
    const { is_active, page = 1, limit = 20 } = req.query;

    console.log(`📋 Listando agentes de IA do usuário ${userId}`);

    // Construir query
    let whereConditions = ['user_id = $1'];
    let queryParams = [userId];
    let paramIndex = 2;

    // Filtro por status ativo
    if (is_active !== undefined) {
      whereConditions.push(`is_active = $${paramIndex}`);
      queryParams.push(is_active === 'true');
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.join(' AND ');

    // Query principal
    const query = `
      SELECT 
        id,
        name,
        description,
        personality_tone,
        communication_style,
        ai_model,
        temperature,
        max_tokens,
        is_active,
        usage_count,
        created_at,
        updated_at
      FROM ai_agents
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const agents = await db.query(query, queryParams);

    // Contar total
    const countQuery = `SELECT COUNT(*) FROM ai_agents WHERE ${whereClause}`;
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    // Contar campanhas usando cada agente
    const campaignCountsQuery = `
      SELECT ai_agent_id, COUNT(*) as campaign_count
      FROM campaigns
      WHERE ai_agent_id = ANY($1)
      GROUP BY ai_agent_id
    `;

    const agentIds = agents.rows.map(a => a.id);
    let campaignCounts = {};

    if (agentIds.length > 0) {
      const countsResult = await db.query(campaignCountsQuery, [agentIds]);
      countsResult.rows.forEach(row => {
        campaignCounts[row.ai_agent_id] = parseInt(row.campaign_count);
      });
    }

    // Adicionar contagem de campanhas
    const agentsWithCounts = agents.rows.map(agent => ({
      ...agent,
      campaigns_count: campaignCounts[agent.id] || 0
    }));

    console.log(`✅ Encontrados ${agents.rows.length} agentes`);

    sendSuccess(res, {
      agents: agentsWithCounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 2. OBTER AGENTE ESPECÍFICO
// ================================
const getAIAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`🔍 Buscando agente de IA ${id}`);

    const agent = await db.findOne('ai_agents', { id, user_id: userId });

    if (!agent) {
      throw new NotFoundError('AI Agent not found');
    }

    // Buscar campanhas usando este agente
    const campaignsQuery = `
      SELECT id, name, status
      FROM campaigns
      WHERE ai_agent_id = $1
      ORDER BY created_at DESC
    `;

    const campaigns = await db.query(campaignsQuery, [id]);

    console.log(`✅ Agente encontrado: ${agent.name}`);

    sendSuccess(res, {
      ...agent,
      campaigns: campaigns.rows
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 3. CRIAR AGENTE DE IA
// ================================
const createAIAgent = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      description,
      personality_tone,
      communication_style,
      behavior_rules,
      response_guidelines,
      ai_model,
      temperature,
      max_tokens
    } = req.body;

    console.log(`📝 Criando novo agente de IA: ${name}`);

    // Validações
    if (!name) {
      throw new ValidationError('Agent name is required');
    }

    if (!personality_tone) {
      throw new ValidationError('Personality tone is required');
    }

    // Criar agente
    const agentData = {
      user_id: userId,
      name,
      description: description || null,
      personality_tone: personality_tone || 'professional',
      communication_style: communication_style || null,
      behavior_rules: behavior_rules ? JSON.stringify(behavior_rules) : null,
      response_guidelines: response_guidelines || null,
      ai_model: ai_model || 'gpt-4o-mini',
      temperature: temperature !== undefined ? temperature : 0.7,
      max_tokens: max_tokens || 500,
      is_active: true,
      usage_count: 0
    };

    const agent = await db.insert('ai_agents', agentData);

    console.log(`✅ Agente criado: ${agent.id}`);

    sendSuccess(res, agent, 'AI Agent created successfully', 201);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 4. ATUALIZAR AGENTE DE IA
// ================================
const updateAIAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      name,
      description,
      personality_tone,
      communication_style,
      behavior_rules,
      response_guidelines,
      ai_model,
      temperature,
      max_tokens,
      is_active
    } = req.body;

    console.log(`📝 Atualizando agente de IA ${id}`);

    // Verificar se agente pertence ao usuário
    const agent = await db.findOne('ai_agents', { id, user_id: userId });

    if (!agent) {
      throw new NotFoundError('AI Agent not found');
    }

    // Preparar dados para atualização
    const updateData = {};
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (personality_tone !== undefined) updateData.personality_tone = personality_tone;
    if (communication_style !== undefined) updateData.communication_style = communication_style;
    if (behavior_rules !== undefined) updateData.behavior_rules = JSON.stringify(behavior_rules);
    if (response_guidelines !== undefined) updateData.response_guidelines = response_guidelines;
    if (ai_model !== undefined) updateData.ai_model = ai_model;
    if (temperature !== undefined) updateData.temperature = temperature;
    if (max_tokens !== undefined) updateData.max_tokens = max_tokens;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No fields to update');
    }

    // Atualizar
    const updatedAgent = await db.update('ai_agents', updateData, { id });

    console.log('✅ Agente atualizado');

    sendSuccess(res, updatedAgent, 'AI Agent updated successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 5. DELETAR AGENTE DE IA
// ================================
const deleteAIAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`🗑️ Deletando agente de IA ${id}`);

    // Verificar se agente pertence ao usuário
    const agent = await db.findOne('ai_agents', { id, user_id: userId });

    if (!agent) {
      throw new NotFoundError('AI Agent not found');
    }

    // Verificar se está sendo usado em campanhas ativas
    const activeCampaigns = await db.query(
      `SELECT COUNT(*) FROM campaigns 
       WHERE ai_agent_id = $1 AND status IN ('active', 'paused')`,
      [id]
    );

    const activeCount = parseInt(activeCampaigns.rows[0].count);

    if (activeCount > 0) {
      throw new ForbiddenError(
        `Cannot delete AI Agent. It is being used by ${activeCount} active campaign(s). ` +
        `Please remove it from campaigns first.`
      );
    }

    // Remover referências em campanhas inativas
    await db.query(
      'UPDATE campaigns SET ai_agent_id = NULL WHERE ai_agent_id = $1',
      [id]
    );

    // Remover referências em conversas
    await db.query(
      'UPDATE conversations SET ai_agent_id = NULL WHERE ai_agent_id = $1',
      [id]
    );

    // Deletar agente
    await db.delete('ai_agents', { id });

    console.log('✅ Agente deletado');

    sendSuccess(res, null, 'AI Agent deleted successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 6. TESTAR AGENTE
// ================================
const testAIAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { test_message } = req.body;

    console.log(`🧪 Testando agente de IA ${id}`);

    // Validação
    if (!test_message) {
      throw new ValidationError('test_message is required');
    }

    // Verificar se agente pertence ao usuário
    const agent = await db.findOne('ai_agents', { id, user_id: userId });

    if (!agent) {
      throw new NotFoundError('AI Agent not found');
    }

    // Simular resposta do agente
    // Em produção, aqui você chamaria a API do OpenAI
    const response = {
      agent_id: agent.id,
      agent_name: agent.name,
      test_message,
      ai_response: `[Simulação] Olá! Sou o agente ${agent.name}. ` +
                   `Minha personalidade é ${agent.personality_tone}. ` +
                   `Em produção, eu responderia à sua mensagem: "${test_message}" ` +
                   `usando o modelo ${agent.ai_model} com temperatura ${agent.temperature}.`,
      model: agent.ai_model,
      temperature: agent.temperature,
      timestamp: new Date()
    };

    console.log('✅ Teste simulado concluído');

    sendSuccess(res, response, 'AI Agent test completed (simulated)');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 7. CLONAR AGENTE
// ================================
const cloneAIAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { new_name } = req.body;

    console.log(`📋 Clonando agente de IA ${id}`);

    // Verificar se agente pertence ao usuário
    const agent = await db.findOne('ai_agents', { id, user_id: userId });

    if (!agent) {
      throw new NotFoundError('AI Agent not found');
    }

    // Criar clone
    const cloneData = {
      user_id: userId,
      name: new_name || `${agent.name} (Copy)`,
      description: agent.description,
      personality_tone: agent.personality_tone,
      communication_style: agent.communication_style,
      behavior_rules: agent.behavior_rules,
      response_guidelines: agent.response_guidelines,
      ai_model: agent.ai_model,
      temperature: agent.temperature,
      max_tokens: agent.max_tokens,
      is_active: false, // Começar desativado
      usage_count: 0
    };

    const clonedAgent = await db.insert('ai_agents', cloneData);

    console.log(`✅ Agente clonado: ${clonedAgent.id}`);

    sendSuccess(res, clonedAgent, 'AI Agent cloned successfully', 201);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 8. OBTER ESTATÍSTICAS DO AGENTE
// ================================
const getAIAgentStats = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`📊 Buscando estatísticas do agente ${id}`);

    // Verificar se agente pertence ao usuário
    const agent = await db.findOne('ai_agents', { id, user_id: userId });

    if (!agent) {
      throw new NotFoundError('AI Agent not found');
    }

    // Campanhas usando este agente
    const campaignsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'paused') as paused,
        COUNT(*) FILTER (WHERE status = 'completed') as completed
      FROM campaigns
      WHERE ai_agent_id = $1
    `;

    const campaignsResult = await db.query(campaignsQuery, [id]);
    const campaigns = campaignsResult.rows[0];

    // Conversas usando este agente
    const conversationsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE ai_active = true) as ai_active,
        COUNT(*) FILTER (WHERE manual_control_taken = true) as manual_control,
        COUNT(*) FILTER (WHERE status = 'hot') as hot,
        COUNT(*) FILTER (WHERE status = 'warm') as warm,
        COUNT(*) FILTER (WHERE status = 'cold') as cold
      FROM conversations
      WHERE ai_agent_id = $1
    `;

    const conversationsResult = await db.query(conversationsQuery, [id]);
    const conversations = conversationsResult.rows[0];

    // Mensagens enviadas pela IA
    const messagesQuery = `
      SELECT COUNT(*) as total_messages
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.ai_agent_id = $1 AND m.sender_type = 'ai'
    `;

    const messagesResult = await db.query(messagesQuery, [id]);

    const stats = {
      agent_id: id,
      agent_name: agent.name,
      usage_count: agent.usage_count,
      campaigns: {
        total: parseInt(campaigns.total),
        active: parseInt(campaigns.active),
        paused: parseInt(campaigns.paused),
        completed: parseInt(campaigns.completed)
      },
      conversations: {
        total: parseInt(conversations.total),
        ai_active: parseInt(conversations.ai_active),
        manual_control: parseInt(conversations.manual_control),
        by_status: {
          hot: parseInt(conversations.hot),
          warm: parseInt(conversations.warm),
          cold: parseInt(conversations.cold)
        }
      },
      messages_sent: parseInt(messagesResult.rows[0].total_messages)
    };

    console.log('✅ Estatísticas calculadas');

    sendSuccess(res, stats);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  getAIAgents,
  getAIAgent,
  createAIAgent,
  updateAIAgent,
  deleteAIAgent,
  testAIAgent,
  cloneAIAgent,
  getAIAgentStats
};