// backend/src/controllers/aiAgentController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { NotFoundError, ValidationError } = require('../utils/errors');

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

const createAIAgent = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      products_services,
      behavioral_profile,
      initial_approach,
      auto_schedule,
      scheduling_link
    } = req.body;

    if (!name || !products_services || !behavioral_profile) {
      throw new ValidationError('Nome, produtos/serviços e perfil são obrigatórios');
    }

    if (!BEHAVIORAL_PROFILES[behavioral_profile]) {
      throw new ValidationError('Perfil comportamental inválido');
    }

    if (auto_schedule && !scheduling_link) {
      throw new ValidationError('Link de agendamento obrigatório quando auto-agendamento está ativo');
    }

    const profile = BEHAVIORAL_PROFILES[behavioral_profile];
    const usedVariables = LINKEDIN_VARIABLES
      .filter(v => initial_approach && initial_approach.includes(v.variable))
      .map(v => v.variable);

    const agent = await db.insert('ai_agents', {
      user_id: userId,
      name,
      description: `Agente ${profile.name} para ${products_services}`,
      products_services,
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
      is_active: true
    });

    sendSuccess(res, agent, 'Agente criado com sucesso', 201);
  } catch (error) {
    sendError(res, error);
  }
};

const getAIAgents = async (req, res) => {
  try {
    const agents = await db.findMany('ai_agents', { user_id: req.user.id }, {
      orderBy: 'created_at DESC'
    });

    const parsed = agents.map(a => ({
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
    const agent = await db.findOne('ai_agents', { id: req.params.id, user_id: req.user.id });
    if (!agent) throw new NotFoundError('Agente não encontrado');

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
    const agent = await db.findOne('ai_agents', { id: req.params.id, user_id: req.user.id });
    if (!agent) throw new NotFoundError('Agente não encontrado');

    const updated = await db.update('ai_agents', req.body, { id: req.params.id });
    updated.linkedin_variables = typeof updated.linkedin_variables === 'string'
      ? JSON.parse(updated.linkedin_variables)
      : updated.linkedin_variables;

    sendSuccess(res, updated);
  } catch (error) {
    sendError(res, error);
  }
};

const deleteAIAgent = async (req, res) => {
  try {
    const agent = await db.findOne('ai_agents', { id: req.params.id, user_id: req.user.id });
    if (!agent) throw new NotFoundError('Agente não encontrado');

    const campaigns = await db.query(
      'SELECT COUNT(*) as count FROM campaigns WHERE ai_agent_id = $1 AND status = $2',
      [req.params.id, 'active']
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
    const agent = await db.findOne('ai_agents', { id: req.params.id, user_id: req.user.id });
    if (!agent) throw new NotFoundError('Agente não encontrado');

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
    const agent = await db.findOne('ai_agents', { id: req.params.id, user_id: req.user.id });
    if (!agent) throw new NotFoundError('Agente não encontrado');

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
    const agent = await db.findOne('ai_agents', { id: req.params.id, user_id: req.user.id });
    if (!agent) throw new NotFoundError('Agente não encontrado');

    const { message, conversation_history = [], lead_data = {} } = req.body;

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
    console.error('Erro ao testar resposta do agente:', error);
    sendError(res, error);
  }
};

const cloneAIAgent = async (req, res) => {
  try {
    const agent = await db.findOne('ai_agents', { id: req.params.id, user_id: req.user.id });
    if (!agent) throw new NotFoundError('Agente não encontrado');

    const { id, created_at, updated_at, ...agentData } = agent;

    const cloned = await db.insert('ai_agents', {
      ...agentData,
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
    const agent = await db.findOne('ai_agents', { id: req.params.id, user_id: req.user.id });
    if (!agent) throw new NotFoundError('Agente não encontrado');

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
  getAIAgentStats
};
