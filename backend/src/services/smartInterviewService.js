// backend/src/services/smartInterviewService.js
// Service for smart interview questions and agent generation

const db = require('../config/database');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Base questions for each agent type
const BASE_QUESTIONS = {
  prospeccao: [
    { id: 'company_name', question: 'Qual o nome da sua empresa?', type: 'text', required: true },
    { id: 'product_service', question: 'O que você vende? Descreva seu produto ou serviço principal.', type: 'textarea', required: true },
    { id: 'target_audience', question: 'Quem é seu cliente ideal? (cargo, tamanho de empresa, setor)', type: 'textarea', required: true },
    { id: 'main_pain', question: 'Qual o principal problema que seu produto resolve?', type: 'textarea', required: true },
    { id: 'differentials', question: 'Quais seus principais diferenciais em relação aos concorrentes?', type: 'textarea', required: false },
    { id: 'avg_ticket', question: 'Qual o ticket médio da sua solução? (pode ser aproximado)', type: 'text', required: false },
    { id: 'conversion_goal', question: 'Qual o objetivo principal da prospecção?', type: 'select', options: ['Agendar reunião', 'Enviar proposta', 'Fazer demonstração', 'Qualificar lead', 'Outro'], required: true }
  ],
  atendimento: [
    { id: 'company_name', question: 'Qual o nome da sua empresa/negócio?', type: 'text', required: true },
    { id: 'services', question: 'Quais serviços vocês oferecem? Liste os principais.', type: 'textarea', required: true },
    { id: 'operating_hours', question: 'Qual o horário de funcionamento?', type: 'text', required: true },
    { id: 'address', question: 'Qual o endereço? (se aplicável)', type: 'text', required: false },
    { id: 'accepts_scheduling', question: 'Vocês trabalham com agendamento?', type: 'select', options: ['Sim, agendamento obrigatório', 'Sim, mas aceita encaixe', 'Não, ordem de chegada', 'Depende do serviço'], required: true },
    { id: 'payment_methods', question: 'Quais formas de pagamento aceitam?', type: 'multiselect', options: ['Dinheiro', 'Pix', 'Cartão de crédito', 'Cartão de débito', 'Boleto', 'Convênio'], required: true },
    { id: 'common_questions', question: 'Quais as dúvidas mais frequentes dos clientes?', type: 'textarea', required: false },
    { id: 'escalation_scenarios', question: 'Em quais situações o atendimento deve ser transferido para um humano?', type: 'textarea', required: true }
  ]
};

/**
 * Get next question in the smart interview
 * @param {Object} options - Interview options
 * @returns {Promise<Object>} Next question and progress
 */
async function getNextQuestion(options) {
  const {
    agentType,
    niche,
    templateId,
    answersSoFar = {}
  } = options;

  // Get questions for this context
  let questions = [...(BASE_QUESTIONS[agentType] || BASE_QUESTIONS.prospeccao)];

  // If using a template, get its specific parameters
  if (templateId) {
    const templateResult = await db.query(
      'SELECT niche_parameters FROM agent_templates WHERE id = $1',
      [templateId]
    );

    if (templateResult.rows[0]?.niche_parameters) {
      const templateParams = templateResult.rows[0].niche_parameters;
      if (Array.isArray(templateParams) && templateParams.length > 0) {
        questions = templateParams;
      }
    }
  }

  // Find the next unanswered required question
  const answeredIds = Object.keys(answersSoFar);
  const unansweredQuestions = questions.filter(q => !answeredIds.includes(q.id));

  // Calculate progress
  const totalRequired = questions.filter(q => q.required).length;
  const answeredRequired = questions.filter(q => q.required && answeredIds.includes(q.id)).length;
  const progress = totalRequired > 0 ? answeredRequired / totalRequired : 0;

  // Check if we can generate (all required questions answered)
  const canGenerate = unansweredQuestions.filter(q => q.required).length === 0;

  if (unansweredQuestions.length === 0 || canGenerate) {
    return {
      next_question: null,
      progress: 1,
      can_generate: true,
      remaining_questions: unansweredQuestions.filter(q => !q.required)
    };
  }

  // Return next question (prioritize required)
  const nextRequired = unansweredQuestions.find(q => q.required);
  const nextQuestion = nextRequired || unansweredQuestions[0];

  return {
    next_question: nextQuestion,
    progress,
    can_generate: canGenerate,
    remaining_questions: unansweredQuestions.length
  };
}

/**
 * Generate agent configuration from interview answers
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated agent config
 */
async function generateAgentConfig(options) {
  const {
    accountId,
    userId,
    agentType,
    niche,
    templateId,
    answers,
    workflowDefinition
  } = options;

  // Get template if using one (only if it's a valid UUID)
  let template = null;
  const isValidUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  if (templateId && isValidUUID(templateId)) {
    const templateResult = await db.query(
      'SELECT * FROM agent_templates WHERE id = $1',
      [templateId]
    );
    template = templateResult.rows[0];
  }

  // Build conversation steps from workflow
  let conversationSteps = [];
  if (workflowDefinition?.nodes) {
    conversationSteps = workflowDefinition.nodes
      .filter(n => n.type === 'conversation_step')
      .sort((a, b) => (a.position?.y || 0) - (b.position?.y || 0))
      .map((n, idx) => ({
        step: idx + 1,
        name: n.data?.name || `Etapa ${idx + 1}`,
        description: n.data?.instructions || '',
        is_escalation: n.data?.is_escalation || false
      }));
  } else if (template?.workflow_definition?.nodes) {
    // Use template workflow
    conversationSteps = template.workflow_definition.nodes
      .filter(n => n.type === 'conversation_step')
      .sort((a, b) => (a.position?.y || 0) - (b.position?.y || 0))
      .map((n, idx) => ({
        step: idx + 1,
        name: n.data?.name || `Etapa ${idx + 1}`,
        description: n.data?.instructions || '',
        is_escalation: n.data?.is_escalation || false
      }));
  }

  // Generate agent name
  const agentName = await generateAgentName(agentType, answers);

  // Generate products_services from answers
  const productsServices = generateProductsServices(answers);

  // Determine behavioral profile
  const behavioralProfile = determineBehavioralProfile(agentType, answers, template);

  // Build target audience
  const targetAudience = buildTargetAudience(answers);

  // Determine transfer triggers
  const transferTriggers = determineTransferTriggers(agentType, answers);

  // Build the agent data
  const agentData = {
    account_id: accountId,
    user_id: userId,
    name: agentName,
    avatar_url: answers.avatar_url || null,
    description: `AI Employee - ${agentType === 'prospeccao' ? 'Prospecção' : 'Atendimento'}${niche ? ` - ${niche}` : ''}`,
    agent_type: agentType === 'prospeccao' ? 'linkedin' : 'whatsapp',
    products_services: productsServices,
    behavioral_profile: behavioralProfile,
    target_audience: JSON.stringify(targetAudience),
    conversation_steps: JSON.stringify(conversationSteps),
    transfer_triggers: transferTriggers,
    language: 'pt-BR',
    is_active: true,
    response_length: answers.response_length || 'medium',
    // Workflow fields - save the workflow definition and enable it if provided
    workflow_definition: workflowDefinition ? JSON.stringify(workflowDefinition) : null,
    workflow_enabled: workflowDefinition ? true : false,
    config: JSON.stringify({
      source: 'ai_employees_v2',
      template_id: templateId,
      niche: niche,
      interview_answers: answers,
      workflow: workflowDefinition || null,
      // Profile fields - saved directly for easy access on edit
      tone: answers.tone || 'consultivo',
      objective: answers.objective || 'qualify',
      customObjective: answers.customObjective || '',
      personality: answers.personality || [],
      rules: answers.rules || [],
      // Knowledge base fields
      company: {
        name: answers.company_name || '',
        website: answers.company_website || '',
        description: answers.company_description || '',
        sector: answers.company_sector || '',
        avgTicket: answers.avg_ticket || '',
        icp: answers.target_audience || ''
      },
      product: {
        name: answers.product_name || '',
        description: answers.product_description || '',
        benefits: answers.product_benefits || [],
        differentials: answers.product_differentials || []
      },
      faq: answers.faq || [],
      objections: answers.objections || [],
      // Config fields
      formality: answers.formality || 50,
      assertiveness: answers.assertiveness || 50,
      responseLength: answers.response_length || 'medium',
      language: answers.language || 'pt-BR',
      latency: answers.latency || { min: 30, minUnit: 'seconds', max: 2, maxUnit: 'minutes' },
      workingHours: answers.workingHours || { enabled: false }
    })
  };

  // Create the agent
  const insertQuery = `
    INSERT INTO ai_agents (
      account_id, user_id, name, avatar_url, description, agent_type, products_services,
      behavioral_profile, target_audience, conversation_steps, transfer_triggers,
      language, is_active, response_length, config, workflow_definition, workflow_enabled,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW()
    )
    RETURNING *
  `;

  const result = await db.query(insertQuery, [
    agentData.account_id,
    agentData.user_id,
    agentData.name,
    agentData.avatar_url,
    agentData.description,
    agentData.agent_type,
    agentData.products_services,
    agentData.behavioral_profile,
    agentData.target_audience,
    agentData.conversation_steps,
    agentData.transfer_triggers,
    agentData.language,
    agentData.is_active,
    agentData.response_length,
    agentData.config,
    agentData.workflow_definition,
    agentData.workflow_enabled
  ]);

  return {
    agent: result.rows[0],
    agentId: result.rows[0].id,
    conversationSteps,
    message: 'AI Employee criado com sucesso!'
  };
}

/**
 * Generate a creative agent name
 */
async function generateAgentName(agentType, answers) {
  // Use provided agent_name if available
  if (answers.agent_name) {
    return answers.agent_name;
  }

  const companyName = answers.company_name || answers.clinic_name || 'Empresa';

  // Simple names based on type
  const prospeccaoNames = ['Alex', 'Sofia', 'Lucas', 'Marina', 'Pedro', 'Julia'];
  const atendimentoNames = ['Ana', 'Carlos', 'Bia', 'Miguel', 'Lara', 'Gabriel'];

  const names = agentType === 'prospeccao' ? prospeccaoNames : atendimentoNames;
  const randomName = names[Math.floor(Math.random() * names.length)];

  return `${randomName} - ${companyName}`;
}

/**
 * Generate products/services description from answers
 */
function generateProductsServices(answers) {
  const parts = [];

  if (answers.product_service) {
    parts.push(answers.product_service);
  }

  if (answers.services) {
    const services = Array.isArray(answers.services)
      ? answers.services.join(', ')
      : answers.services;
    parts.push(`Serviços: ${services}`);
  }

  if (answers.main_pain) {
    parts.push(`Problema que resolve: ${answers.main_pain}`);
  }

  if (answers.differentials) {
    parts.push(`Diferenciais: ${answers.differentials}`);
  }

  return parts.join('\n\n') || 'Produtos e serviços da empresa';
}

/**
 * Determine behavioral profile based on context
 */
function determineBehavioralProfile(agentType, answers, template) {
  // If template has default config, use it
  if (template?.default_config?.behavioral_profile) {
    return template.default_config.behavioral_profile;
  }

  // Default based on type
  if (agentType === 'prospeccao') {
    return 'consultivo';
  } else {
    return 'amigavel';
  }
}

/**
 * Build target audience from answers
 */
function buildTargetAudience(answers) {
  const audience = {};

  if (answers.target_audience) {
    audience.description = answers.target_audience;
  }

  if (answers.target_roles) {
    audience.roles = answers.target_roles;
  }

  if (answers.target_company_size) {
    audience.companySizes = answers.target_company_size;
  }

  return audience;
}

/**
 * Determine transfer triggers based on context
 */
function determineTransferTriggers(agentType, answers) {
  const triggers = ['qualified']; // Always transfer when qualified

  if (agentType === 'prospeccao') {
    triggers.push('price', 'demo');
  } else {
    triggers.push('doubt', 'frustration');

    // If emergency scenarios mentioned
    if (answers.escalation_scenarios?.toLowerCase().includes('emergenc')) {
      triggers.push('urgency');
    }
  }

  return triggers;
}

module.exports = {
  getNextQuestion,
  generateAgentConfig
};
