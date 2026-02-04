// backend/src/controllers/aiAgentController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { buildSystemPrompt } = require('../services/aiResponseService');
const { syncKnowledgeFromConfig } = require('../services/ragService');

// PERFIS COMPORTAMENTAIS DISPONÍVEIS
const BEHAVIORAL_PROFILES = {
  consultivo: {
    name: 'Consultivo',
    description: 'Faz perguntas, entende problemas antes de oferecer soluções',
    icon: '🎯',
    systemPrompt: `Você é um consultor experiente. Seu objetivo é entender as necessidades do lead antes de apresentar soluções. Faça perguntas abertas, seja empático e construa relacionamento. Respostas SEMPRE curtas (máximo 2-3 frases). Dê espaço para o lead falar.`,
    suggestedApproach: `Olá {{nome}}! 👋\n\nVi que você trabalha como {{cargo}} na {{empresa}}. Como tem sido sua experiência com [mencionar área relacionada]?`
  },
  direto: {
    name: 'Direto ao Ponto',
    description: 'Apresenta valor rapidamente, vai direto à solução',
    icon: '⚡',
    systemPrompt: `Você é direto e objetivo. Apresente o valor da sua solução rapidamente. Não enrole, vá direto ao ponto. Respostas SEMPRE curtas (1-2 frases). Seja profissional e objetivo.`,
    suggestedApproach: `Olá {{nome}}!\n\nAjudo empresas como a {{empresa}} a [benefício principal]. Faz sentido conversarmos?`
  },
  educativo: {
    name: 'Educativo',
    description: 'Compartilha insights, agrega valor antes de vender',
    icon: '📚',
    systemPrompt: `Você é um educador. Compartilhe insights valiosos sobre o tema antes de apresentar sua solução. Posicione-se como especialista. Respostas curtas com dicas práticas (2-3 frases). Agregue valor primeiro.`,
    suggestedApproach: `Olá {{nome}}!\n\nNotei que você atua em {{industria}}. Você sabia que [insight relevante]? Isso pode impactar seus resultados.`
  },
  amigavel: {
    name: 'Amigável',
    description: 'Tom casual e próximo, cria conexão pessoal',
    icon: '😊',
    systemPrompt: `Você é amigável e autêntico. Use linguagem casual mas profissional. Crie conexão pessoal com o lead. Respostas curtas e descontraídas (2-3 frases). Seja genuíno e próximo.`,
    suggestedApproach: `E aí, {{nome}}! 😊\n\nVi seu perfil e achei super interessante o que você faz na {{empresa}}. Trabalho com [área] e acho que podemos trocar ideias!`
  }
};

const LINKEDIN_VARIABLES = [
  { variable: '{{nome}}', description: 'Nome do lead', example: 'João Silva' },
  { variable: '{{empresa}}', description: 'Empresa atual', example: 'Tech Solutions' },
  { variable: '{{cargo}}', description: 'Cargo/título', example: 'CEO' },
  { variable: '{{localizacao}}', description: 'Localização', example: 'São Paulo, SP' },
  { variable: '{{industria}}', description: 'Indústria/setor', example: 'Tecnologia' },
  { variable: '{{conexoes}}', description: 'Número de conexões', example: '500+' },
  { variable: '{{resumo}}', description: 'Resumo do perfil', example: 'Especialista em...' }
];

const getBehavioralProfiles = async (req, res) => {
  try {
    sendSuccess(res, {
      profiles: BEHAVIORAL_PROFILES,
      variables: LINKEDIN_VARIABLES
    });
  } catch (error) {
    sendError(res, error);
  }
};

// Connection strategy defaults
const CONNECTION_STRATEGY_DEFAULTS = {
  'silent': { wait_time: 5, require_reply: false },      // No message, wait 5min
  'with-intro': { wait_time: 60, require_reply: false }, // With message, wait 1h
  'icebreaker': { wait_time: 0, require_reply: true }    // Simple message, only if reply
};

const createAIAgent = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      name,
      products_services,
      behavioral_profile,
      initial_approach,
      auto_schedule,
      scheduling_link,
      target_audience,
      avatar_url,
      config,
      agent_type = 'linkedin',
      priority_rules,
      // Connection strategy fields
      connection_strategy,
      invite_message,
      post_accept_message,
      wait_time_after_accept,
      require_lead_reply,
      // Language and transfer triggers
      language = 'pt-BR',
      transfer_triggers
    } = req.body;

    console.log('🆕 Creating AI agent with data:', {
      name,
      post_accept_message,
      connection_strategy,
      language,
      transfer_triggers
    });

    if (!name || !products_services || !behavioral_profile) {
      throw new ValidationError('Nome, produtos/serviços e perfil são obrigatórios');
    }

    if (!BEHAVIORAL_PROFILES[behavioral_profile]) {
      throw new ValidationError('Perfil comportamental inválido');
    }

    if (auto_schedule && !scheduling_link) {
      throw new ValidationError('Link de agendamento obrigatório quando auto-agendamento está ativo');
    }

    // Validate connection strategy
    const validStrategies = ['silent', 'with-intro', 'icebreaker'];
    const finalStrategy = validStrategies.includes(connection_strategy) ? connection_strategy : 'with-intro';
    const strategyDefaults = CONNECTION_STRATEGY_DEFAULTS[finalStrategy];

    const profile = BEHAVIORAL_PROFILES[behavioral_profile];
    const usedVariables = LINKEDIN_VARIABLES
      .filter(v => initial_approach && initial_approach.includes(v.variable))
      .map(v => v.variable);

    // Handle products_services as object or string
    let productsDescription = products_services;
    if (typeof products_services === 'object' && products_services !== null) {
      // Extract description from object
      productsDescription = products_services.description ||
        (products_services.categories?.length > 0 ? products_services.categories.join(', ') : '');
    }

    // Handle target_audience as object or string
    let targetDescription = '';
    if (typeof target_audience === 'object' && target_audience !== null) {
      const roles = target_audience.roles?.length > 0 ? target_audience.roles.join(', ') : '';
      targetDescription = roles;
    } else if (typeof target_audience === 'string') {
      targetDescription = target_audience;
    }

    // Build agent description
    let agentDescription = `Agente ${profile.name}`;
    if (productsDescription) {
      agentDescription += ` para ${productsDescription}`;
    }
    if (targetDescription) {
      agentDescription += ` - ${targetDescription}`;
    }

    // MULTI-TENANCY: Include account_id when creating AI agent
    console.log('📝 Inserting ai_agent with post_accept_message:', post_accept_message);
    const agent = await db.insert('ai_agents', {
      user_id: userId,
      account_id: accountId,
      name,
      description: agentDescription,
      avatar_url: avatar_url || null,
      agent_type: agent_type || 'linkedin',
      products_services: typeof products_services === 'object' ? JSON.stringify(products_services) : products_services,
      target_audience: typeof target_audience === 'object' ? JSON.stringify(target_audience) : target_audience,
      behavioral_profile,
      initial_approach: initial_approach || profile.suggestedApproach,
      linkedin_variables: JSON.stringify({
        available: LINKEDIN_VARIABLES.map(v => v.variable),
        used: usedVariables
      }),
      auto_schedule: auto_schedule || false,
      scheduling_link: scheduling_link || null,
      intent_detection_enabled: true,
      response_style_instructions: profile.systemPrompt,
      is_active: true,
      config: config ? JSON.stringify(config) : null,
      priority_rules: priority_rules ? JSON.stringify(priority_rules) : '[]',
      // Connection strategy fields
      connection_strategy: finalStrategy,
      invite_message: invite_message || null,
      post_accept_message: post_accept_message || null,
      wait_time_after_accept: wait_time_after_accept ?? strategyDefaults.wait_time,
      require_lead_reply: require_lead_reply ?? strategyDefaults.require_reply,
      // Language and transfer triggers
      language: language || 'pt-BR',
      transfer_triggers: Array.isArray(transfer_triggers) ? transfer_triggers : []
    });

    console.log('✅ Agent created successfully with id:', agent.id, 'post_accept_message:', agent.post_accept_message);
    sendSuccess(res, agent, 'Agente criado com sucesso', 201);
  } catch (error) {
    sendError(res, error);
  }
};

const getAIAgents = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    // MULTI-TENANCY: Filter by account_id
    const agents = await db.query(
      'SELECT * FROM ai_agents WHERE account_id = $1 ORDER BY created_at DESC',
      [accountId]
    );

    const parsed = agents.rows.map(a => ({
      ...a,
      linkedin_variables: typeof a.linkedin_variables === 'string'
        ? JSON.parse(a.linkedin_variables)
        : a.linkedin_variables
    }));

    sendSuccess(res, parsed);
  } catch (error) {
    sendError(res, error);
  }
};

const getAIAgent = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    // MULTI-TENANCY: Filter by account_id
    const result = await db.query(
      'SELECT * FROM ai_agents WHERE id = $1 AND account_id = $2',
      [req.params.id, accountId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Agente não encontrado');
    }

    const agent = result.rows[0];
    agent.linkedin_variables = typeof agent.linkedin_variables === 'string'
      ? JSON.parse(agent.linkedin_variables)
      : agent.linkedin_variables;
    sendSuccess(res, agent);
  } catch (error) {
    sendError(res, error);
  }
};

const updateAIAgent = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    // MULTI-TENANCY: Filter by account_id
    const agentCheck = await db.query(
      'SELECT * FROM ai_agents WHERE id = $1 AND account_id = $2',
      [req.params.id, accountId]
    );

    if (agentCheck.rows.length === 0) {
      throw new NotFoundError('Agente não encontrado');
    }

    // Preparar dados para atualização, convertendo objetos para JSON
    const updateData = { ...req.body };

    // Converter campos de objeto para JSON string
    if (typeof updateData.products_services === 'object' && updateData.products_services !== null) {
      updateData.products_services = JSON.stringify(updateData.products_services);
    }
    if (typeof updateData.target_audience === 'object' && updateData.target_audience !== null) {
      updateData.target_audience = JSON.stringify(updateData.target_audience);
    }
    if (typeof updateData.escalation_rules === 'object' && updateData.escalation_rules !== null) {
      updateData.escalation_rules = JSON.stringify(updateData.escalation_rules);
    }
    if (typeof updateData.priority_rules === 'object' && updateData.priority_rules !== null) {
      updateData.priority_rules = JSON.stringify(updateData.priority_rules);
    }
    // Ensure transfer_triggers is an array
    if (updateData.transfer_triggers !== undefined) {
      updateData.transfer_triggers = Array.isArray(updateData.transfer_triggers)
        ? updateData.transfer_triggers
        : [];
    }
    // Convert config to JSON string
    if (typeof updateData.config === 'object' && updateData.config !== null) {
      updateData.config = JSON.stringify(updateData.config);
    }
    // Convert conversation_steps to JSON string
    if (typeof updateData.conversation_steps === 'object' && updateData.conversation_steps !== null) {
      updateData.conversation_steps = JSON.stringify(updateData.conversation_steps);
    }

    console.log('🔄 Updating AI agent with data:', {
      post_accept_message: updateData.post_accept_message,
      connection_strategy: updateData.connection_strategy,
      language: updateData.language,
      transfer_triggers: updateData.transfer_triggers,
      transfer_mode: updateData.transfer_mode,
      conversation_steps: updateData.conversation_steps,
      objective_instructions: updateData.objective_instructions
    });

    const updated = await db.update('ai_agents', updateData, { id: req.params.id });
    console.log('✅ Agent updated successfully:', {
      conversation_steps: updated.conversation_steps,
      transfer_mode: updated.transfer_mode,
      objective_instructions: updated.objective_instructions
    });
    updated.linkedin_variables = typeof updated.linkedin_variables === 'string'
      ? JSON.parse(updated.linkedin_variables)
      : updated.linkedin_variables;

    // Sincronizar FAQ e objeções do config com o banco vetorial (RAG)
    // Isso permite busca semântica de FAQs e objeções na hora de responder
    if (updateData.config) {
      try {
        // Parse config para log
        const configForLog = typeof updateData.config === 'string'
          ? JSON.parse(updateData.config)
          : updateData.config;
        console.log('📥 [updateAIAgent] Config recebido, iniciando sync RAG:', {
          agentId: req.params.id,
          faqCount: configForLog.faq?.length || 0,
          objectionsCount: configForLog.objections?.length || 0
        });
        await syncKnowledgeFromConfig(req.params.id, updateData.config);
      } catch (syncError) {
        console.error('⚠️ Erro ao sincronizar conhecimento (não crítico):', syncError.message);
        // Não falha o update se a sincronização falhar
      }
    } else {
      console.log('⚠️ [updateAIAgent] updateData.config não existe, sync RAG não executado');
    }

    sendSuccess(res, updated);
  } catch (error) {
    sendError(res, error);
  }
};

const deleteAIAgent = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    // MULTI-TENANCY: Filter by account_id
    const agentCheck = await db.query(
      'SELECT * FROM ai_agents WHERE id = $1 AND account_id = $2',
      [req.params.id, accountId]
    );

    if (agentCheck.rows.length === 0) {
      throw new NotFoundError('Agente não encontrado');
    }

    // Check if agent is in use (within same account)
    const campaigns = await db.query(
      'SELECT COUNT(*) as count FROM campaigns WHERE ai_agent_id = $1 AND account_id = $2 AND status = $3',
      [req.params.id, accountId, 'active']
    );

    if (campaigns.rows[0].count > 0) {
      throw new ValidationError('Agente em uso por campanhas ativas');
    }

    await db.delete('ai_agents', { id: req.params.id });
    sendSuccess(res, null, 'Agente deletado');
  } catch (error) {
    sendError(res, error);
  }
};

const testAIAgent = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    // MULTI-TENANCY: Filter by account_id
    const agentCheck = await db.query(
      'SELECT * FROM ai_agents WHERE id = $1 AND account_id = $2',
      [req.params.id, accountId]
    );

    if (agentCheck.rows.length === 0) {
      throw new NotFoundError('Agente não encontrado');
    }

    const agent = agentCheck.rows[0];
    const { message } = req.body;
    if (!message) throw new ValidationError('Mensagem de teste obrigatória');

    // TODO: Implementar teste real com OpenAI
    sendSuccess(res, {
      agent_id: agent.id,
      test_message: message,
      response: 'Teste de agente - implementação futura',
      profile: agent.behavioral_profile
    }, 'Teste simulado');
  } catch (error) {
    sendError(res, error);
  }
};

// Testar mensagem inicial do agente
const testAIAgentInitialMessage = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    // MULTI-TENANCY: Filter by account_id
    const agentCheck = await db.query(
      'SELECT * FROM ai_agents WHERE id = $1 AND account_id = $2',
      [req.params.id, accountId]
    );

    if (agentCheck.rows.length === 0) {
      throw new NotFoundError('Agente não encontrado');
    }

    const agent = agentCheck.rows[0];
    const { lead_data } = req.body;

    const aiResponseService = require('../services/aiResponseService');
    const result = await aiResponseService.generateInitialMessage({
      ai_agent: agent,
      lead_data: lead_data || {},
      campaign: { name: 'Teste' }
    });

    sendSuccess(res, {
      message: result,
      agent_profile: agent.behavioral_profile
    });
  } catch (error) {
    console.error('Erro ao testar mensagem inicial:', error);
    sendError(res, error);
  }
};

// Testar resposta do agente
const testAIAgentResponse = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    // MULTI-TENANCY: Filter by account_id
    const agentCheck = await db.query(
      'SELECT * FROM ai_agents WHERE id = $1 AND account_id = $2',
      [req.params.id, accountId]
    );

    if (agentCheck.rows.length === 0) {
      throw new NotFoundError('Agente não encontrado');
    }

    const agent = agentCheck.rows[0];
    const { message, conversation_history = [], lead_data = {}, current_step = 0 } = req.body;

    if (!message) {
      throw new ValidationError('Mensagem de teste obrigatória');
    }

    const aiResponseService = require('../services/aiResponseService');

    // Gerar resposta usando o serviço de IA
    const result = await aiResponseService.generateResponse({
      conversation_id: 'test',
      lead_message: message,
      conversation_history,
      ai_agent: agent,
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
    console.error('Erro ao testar resposta do agente:', error);
    sendError(res, error);
  }
};

const cloneAIAgent = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    // MULTI-TENANCY: Filter by account_id
    const agentCheck = await db.query(
      'SELECT * FROM ai_agents WHERE id = $1 AND account_id = $2',
      [req.params.id, accountId]
    );

    if (agentCheck.rows.length === 0) {
      throw new NotFoundError('Agente não encontrado');
    }

    const agent = agentCheck.rows[0];
    const { id, created_at, updated_at, ...agentData } = agent;

    // MULTI-TENANCY: Ensure account_id is preserved in clone
    const cloned = await db.insert('ai_agents', {
      ...agentData,
      account_id: accountId,
      name: `${agent.name} (Cópia)`,
      is_active: false
    });

    sendSuccess(res, cloned, 'Agente clonado com sucesso', 201);
  } catch (error) {
    sendError(res, error);
  }
};

const getAIAgentStats = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    // MULTI-TENANCY: Filter by account_id
    const agentCheck = await db.query(
      'SELECT * FROM ai_agents WHERE id = $1 AND account_id = $2',
      [req.params.id, accountId]
    );

    if (agentCheck.rows.length === 0) {
      throw new NotFoundError('Agente não encontrado');
    }

    const agent = agentCheck.rows[0];

    // TODO: Implementar estatísticas reais
    sendSuccess(res, {
      agent_id: agent.id,
      total_conversations: 0,
      total_leads: 0,
      conversion_rate: 0,
      average_response_time: 0
    });
  } catch (error) {
    sendError(res, error);
  }
};

/**
 * Get prompt preview for an agent
 */
const getAgentPromptPreview = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const agentId = req.params.id;

    // MULTI-TENANCY: Filter by account_id
    const agentResult = await db.query(
      'SELECT * FROM ai_agents WHERE id = $1 AND account_id = $2',
      [agentId, accountId]
    );

    if (agentResult.rows.length === 0) {
      throw new NotFoundError('Agente não encontrado');
    }

    const agent = agentResult.rows[0];

    // Parse JSON fields
    if (typeof agent.conversation_steps === 'string') {
      try {
        agent.conversation_steps = JSON.parse(agent.conversation_steps);
      } catch {
        agent.conversation_steps = [];
      }
    }

    if (typeof agent.priority_rules === 'string') {
      try {
        agent.priority_rules = JSON.parse(agent.priority_rules);
      } catch {
        agent.priority_rules = [];
      }
    }

    // Get behavioral profile
    const behavioralProfile = BEHAVIORAL_PROFILES[agent.behavioral_profile] || BEHAVIORAL_PROFILES.consultivo;

    // Generate prompt with sample lead data
    const sampleLeadData = {
      name: 'João Silva',
      title: 'CEO',
      company: 'TechCorp',
      location: 'São Paulo, SP',
      industry: 'Tecnologia'
    };

    const prompt = await buildSystemPrompt({
      ai_agent: agent,
      behavioralProfile,
      lead_data: sampleLeadData,
      knowledgeContext: ''
    });

    sendSuccess(res, { prompt });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  getBehavioralProfiles,
  createAIAgent,
  getAIAgents,
  getAIAgent,
  updateAIAgent,
  deleteAIAgent,
  testAIAgent,
  testAIAgentInitialMessage,
  testAIAgentResponse,
  cloneAIAgent,
  getAIAgentStats,
  getAgentPromptPreview
};
