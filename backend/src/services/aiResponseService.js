// backend/src/services/aiResponseService.js

const OpenAI = require('openai');
const db = require('../config/database');
const TemplateProcessor = require('../utils/templateProcessor');
const ragService = require('./ragService');

// Lazy load to avoid circular dependencies
let emailBrandingService = null;
const getEmailBrandingService = () => {
  if (!emailBrandingService) {
    emailBrandingService = require('./emailBrandingService');
  }
  return emailBrandingService;
};

// Inicializar cliente OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Email tone configurations
 */
const EMAIL_TONES = {
  professional: {
    description: 'Tom profissional e formal',
    instructions: 'Use linguagem formal, evite coloquialismos, mantenha distância profissional apropriada'
  },
  casual: {
    description: 'Tom casual e descontraído',
    instructions: 'Use linguagem mais informal, seja amigável, pode usar expressões mais leves'
  },
  formal: {
    description: 'Tom muito formal e corporativo',
    instructions: 'Use linguagem extremamente formal, evite qualquer informalidade, seja muito respeitoso'
  },
  friendly: {
    description: 'Tom amigável e acolhedor',
    instructions: 'Seja caloroso e empático, crie conexão pessoal, demonstre interesse genuíno'
  }
};

/**
 * Email greeting styles
 */
const EMAIL_GREETINGS = {
  name: (leadName) => `Olá ${leadName || ''},`,
  title: (leadData) => `Prezado(a) ${leadData.title || ''} ${leadData.name || ''},`,
  generic: () => 'Olá,',
  formal: (leadName) => `Prezado(a) Sr(a). ${leadName || ''},`
};

/**
 * Email closing styles
 */
const EMAIL_CLOSINGS = {
  best_regards: 'Atenciosamente',
  thanks: 'Obrigado',
  sincerely: 'Cordialmente',
  warm_regards: 'Um abraço',
  cheers: 'Até breve'
};

/**
 * Perfis comportamentais pré-definidos para os agentes
 */
const BEHAVIORAL_PROFILES = {
  consultivo: {
    style: 'Consultivo e estratégico',
    tone: 'Profissional, educado, focado em entender necessidades antes de propor soluções',
    approach: 'Fazer perguntas estratégicas, demonstrar expertise sem ser invasivo'
  },
  direto: {
    style: 'Direto e objetivo',
    tone: 'Claro, sem rodeios, focado em resultados',
    approach: 'Ir direto ao ponto, apresentar valor rapidamente, propor próximos passos claros'
  },
  educativo: {
    style: 'Educativo e informativo',
    tone: 'Didático, prestativo, compartilha conhecimento',
    approach: 'Educar o lead sobre o mercado/solução, compartilhar insights valiosos'
  },
  amigavel: {
    style: 'Amigável e conversacional',
    tone: 'Caloroso, empático, constrói relacionamento',
    approach: 'Construir rapport primeiro, criar conexão pessoal, ser genuíno'
  }
};

/**
 * Gerar resposta personalizada usando IA
 * @param {Object} params - Parâmetros para geração da resposta
 * @returns {Promise<Object>} Resposta gerada
 */
async function generateResponse(params) {
  const {
    conversation_id,
    lead_message,
    conversation_history = [],      // Legacy support
    conversation_context = null,    // New format with summary + recent messages
    ai_agent,
    lead_data = {},
    context = {}
  } = params;

  try {
    console.log(`🤖 Gerando resposta IA para conversa ${conversation_id}`);

    // Validar agente IA
    if (!ai_agent) {
      throw new Error('AI agent configuration is required');
    }

    // Obter perfil comportamental
    const behavioralProfile = BEHAVIORAL_PROFILES[ai_agent.behavioral_profile] || BEHAVIORAL_PROFILES.consultivo;

    // 🔍 BUSCAR CONHECIMENTO RELEVANTE usando RAG
    let knowledgeContext = '';
    try {
      const relevantKnowledge = await ragService.searchRelevantKnowledge(
        ai_agent.id,
        lead_message,
        {
          limit: 5,
          minSimilarity: 0.7
        }
      );

      if (relevantKnowledge && relevantKnowledge.length > 0) {
        knowledgeContext = ragService.formatKnowledgeForPrompt(relevantKnowledge);
        console.log(`📚 ${relevantKnowledge.length} itens de conhecimento relevantes encontrados e injetados no contexto`);
      } else {
        console.log(`📭 Nenhum conhecimento relevante encontrado para a query`);
      }
    } catch (error) {
      console.error('⚠️ Erro ao buscar conhecimento (continuando sem RAG):', error.message);
      // Continuar sem RAG em caso de erro
    }

    // Construir system prompt com conhecimento relevante
    const systemPrompt = buildSystemPrompt({
      ai_agent,
      behavioralProfile,
      lead_data,
      knowledgeContext
    });

    // Construir mensagens para o contexto
    const messages = buildConversationMessages({
      systemPrompt,
      conversation_history,
      conversation_context,  // New format
      lead_message,
      ai_agent
    });

    if (conversation_context?.stats) {
      console.log(`📝 Mensagens preparadas: ${messages.length} no contexto ` +
                  `(tokens: ${conversation_context.stats.totalTokens})`);
    } else {
      console.log(`📝 Mensagens preparadas: ${messages.length} no contexto`);
    }

    // Chamar OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
      presence_penalty: 0.6,
      frequency_penalty: 0.3
    });

    const generatedResponse = completion.choices[0].message.content.trim();

    console.log(`✅ Resposta gerada com sucesso (${generatedResponse.length} caracteres)`);

    // Detectar intenção do lead se habilitado
    let intent = null;
    if (ai_agent.intent_detection_enabled) {
      intent = await detectIntent(lead_message);
      console.log(`🎯 Intenção detectada: ${intent}`);
    }

    // Detectar sentimento e verificar escalação
    let sentimentResult = { sentiment: 'neutral', confidence: 0, shouldEscalate: false };
    let keywordResult = { hasKeyword: false, matchedKeywords: [] };
    let shouldEscalate = false;
    let escalationReasons = [];

    // Check sentiment-based escalation
    if (ai_agent.escalation_sentiments && ai_agent.escalation_sentiments.length > 0) {
      sentimentResult = await detectSentiment(lead_message, ai_agent.escalation_sentiments);
      console.log(`💭 Sentimento detectado: ${sentimentResult.sentiment} (confiança: ${sentimentResult.confidence})`);

      if (sentimentResult.shouldEscalate) {
        shouldEscalate = true;
        escalationReasons.push(sentimentResult.escalationReason);
      }
    }

    // Check keyword-based escalation
    if (ai_agent.escalation_keywords) {
      keywordResult = checkEscalationKeywords(lead_message, ai_agent.escalation_keywords);

      if (keywordResult.hasKeyword) {
        shouldEscalate = true;
        escalationReasons.push(`Palavras-chave detectadas: ${keywordResult.matchedKeywords.join(', ')}`);
        console.log(`🔑 Palavras-chave de escalação detectadas: ${keywordResult.matchedKeywords.join(', ')}`);
      }
    }

    // Verificar se deve oferecer agendamento
    let should_offer_scheduling = false;
    if (ai_agent.auto_schedule && intent && ['interested', 'ready_to_buy', 'asking_details'].includes(intent)) {
      should_offer_scheduling = true;
    }

    return {
      response: generatedResponse,
      intent,
      sentiment: sentimentResult.sentiment,
      sentimentConfidence: sentimentResult.confidence,
      shouldEscalate,
      escalationReasons,
      matchedKeywords: keywordResult.matchedKeywords,
      should_offer_scheduling,
      scheduling_link: should_offer_scheduling ? ai_agent.scheduling_link : null,
      tokens_used: completion.usage.total_tokens,
      model: completion.model
    };

  } catch (error) {
    console.error('❌ Erro ao gerar resposta IA:', error);
    throw error;
  }
}

/**
 * Construir system prompt baseado no agente IA
 */
function buildSystemPrompt({ ai_agent, behavioralProfile, lead_data, knowledgeContext = '' }) {
  const leadInfo = lead_data.name ? `

INFORMAÇÕES DO LEAD:
- Nome: ${lead_data.name || 'Não disponível'}
- Cargo: ${lead_data.title || 'Não disponível'}
- Empresa: ${lead_data.company || 'Não disponível'}
- Localização: ${lead_data.location || 'Não disponível'}
- Setor: ${lead_data.industry || 'Não disponível'}` : '';

  // Build objective section
  const objectiveLabels = {
    schedule_meeting: 'Agendar uma reunião ou demonstração',
    qualify_lead: 'Qualificar o lead e descobrir se é potencial cliente',
    generate_interest: 'Gerar interesse e despertar curiosidade sobre o produto',
    get_contact: 'Obter informações de contato (email ou telefone)',
    start_conversation: 'Iniciar conversa e criar relacionamento',
    direct_sale: 'Realizar venda direta pelo chat'
  };

  const objectiveText = ai_agent.objective
    ? objectiveLabels[ai_agent.objective] || ai_agent.objective
    : 'Qualificar o lead e identificar oportunidades de negócio';

  // Build conversation steps section
  let stepsSection = '';
  if (ai_agent.conversation_steps && ai_agent.conversation_steps.length > 0) {
    stepsSection = `

ETAPAS DA CONVERSA (siga esta sequência):
${ai_agent.conversation_steps.map((step, index) => {
  const stepData = typeof step === 'object' ? step : { text: step, is_escalation: false };
  const escalationMark = stepData.is_escalation ? ' [TRANSFERIR PARA HUMANO APÓS ESTA ETAPA]' : '';
  return `${index + 1}. ${stepData.text || step}${escalationMark}`;
}).join('\n')}

IMPORTANTE: Siga estas etapas na ordem. Não pule etapas. Você pode demorar várias mensagens em uma única etapa se necessário.`;
  }

  // Build escalation section
  let escalationSection = '';
  const hasSentiments = ai_agent.escalation_sentiments && ai_agent.escalation_sentiments.length > 0;
  const hasKeywords = ai_agent.escalation_keywords && ai_agent.escalation_keywords.trim();

  if (hasSentiments || hasKeywords) {
    const sentimentLabels = {
      frustration: 'frustração',
      confusion: 'confusão',
      high_interest: 'interesse alto',
      urgency: 'urgência',
      dissatisfaction: 'insatisfação'
    };

    escalationSection = `

GATILHOS DE ESCALAÇÃO (transferir para humano quando detectar):`;

    if (hasSentiments) {
      const sentiments = ai_agent.escalation_sentiments.map(s => sentimentLabels[s] || s).join(', ');
      escalationSection += `
- Sentimentos: ${sentiments}`;
    }

    if (hasKeywords) {
      escalationSection += `
- Palavras-chave: ${ai_agent.escalation_keywords}`;
    }

    escalationSection += `

Quando detectar estes gatilhos, informe que vai conectar com um especialista humano.`;
  }

  // Build company info section
  let companySection = '';
  if (ai_agent.company_description || ai_agent.value_proposition || ai_agent.key_differentiators) {
    companySection = `

SOBRE A EMPRESA:
${ai_agent.company_description ? `Descrição: ${ai_agent.company_description}` : ''}
${ai_agent.value_proposition ? `Proposta de Valor: ${ai_agent.value_proposition}` : ''}
${ai_agent.key_differentiators ? `Diferenciais: ${ai_agent.key_differentiators}` : ''}`;
  }

  // Build additional instructions
  let additionalInstructions = '';
  if (ai_agent.objective_instructions) {
    additionalInstructions = `

INSTRUÇÕES ESPECÍFICAS:
${ai_agent.objective_instructions}`;
  }

  let basePrompt = `Você é ${ai_agent.name}, um agente de vendas B2B especializado em prospecção no LinkedIn.

PERFIL COMPORTAMENTAL: ${behavioralProfile.style}
Tom de comunicação: ${behavioralProfile.tone}
Abordagem: ${behavioralProfile.approach}

SEU NEGÓCIO/PRODUTO:
${ai_agent.products_services || 'Não especificado'}
${companySection}
${knowledgeContext}

OBJETIVO PRINCIPAL:
${objectiveText}
${stepsSection}
${escalationSection}
${leadInfo}
${additionalInstructions}

INSTRUÇÕES DE ESTILO:
${ai_agent.response_style_instructions || '- Seja profissional mas acessível\n- Use linguagem clara e direta\n- Mostre interesse genuíno no lead'}

REGRAS IMPORTANTES:
1. Suas respostas devem ser CURTAS e DIRETAS (máximo 3-4 frases)
2. LinkedIn é uma plataforma profissional - mantenha formalidade apropriada
3. Não seja muito vendedor logo de cara - construa relacionamento primeiro
4. Faça UMA pergunta por vez para manter a conversa fluindo
5. Se o lead demonstrar interesse, seja mais específico sobre a solução
6. Use SEMPRE o conhecimento da base de conhecimento acima quando relevante para responder perguntas
7. NUNCA invente informações sobre produtos/serviços que não foram descritos na base de conhecimento
8. Se não souber algo que não está na base de conhecimento, seja honesto e ofereça descobrir mais
9. Adapte seu tom ao do lead - se ele for informal, seja um pouco mais informal também
10. SIGA AS ETAPAS DA CONVERSA na ordem definida, não pule etapas

QUANDO O LEAD DEMONSTRAR INTERESSE CLARO:
- Ofereça valor concreto (case, material, demo)
- Sugira próximos passos claros
${ai_agent.auto_schedule && ai_agent.scheduling_link ? `- Ofereça agendar uma conversa usando: ${ai_agent.scheduling_link}` : ''}

Responda de forma natural, como se fosse uma conversa real no LinkedIn. Evite soar como um bot.`;

  return basePrompt;
}

/**
 * Construir array de mensagens para contexto da IA
 */
function buildConversationMessages({ systemPrompt, conversation_history, conversation_context, lead_message, ai_agent }) {
  const messages = [
    {
      role: 'system',
      content: systemPrompt
    }
  ];

  // Use new optimized context if available
  if (conversation_context && conversation_context.summary) {
    // Add summary as a system message
    messages.push({
      role: 'system',
      content: `CONTEXTO DA CONVERSA (resumo das mensagens anteriores):\n${conversation_context.summary}`
    });

    // Add recent messages in full
    for (const msg of conversation_context.recentMessages) {
      messages.push({
        role: msg.sender_type === 'ai' ? 'assistant' : 'user',
        content: msg.content
      });
    }
  } else if (conversation_context && conversation_context.recentMessages) {
    // No summary yet, just use recent messages
    for (const msg of conversation_context.recentMessages) {
      messages.push({
        role: msg.sender_type === 'ai' ? 'assistant' : 'user',
        content: msg.content
      });
    }
  } else {
    // Fallback to old format (legacy support)
    const recentHistory = conversation_history.slice(-10);

    for (const msg of recentHistory) {
      messages.push({
        role: msg.sender_type === 'ai' ? 'assistant' : 'user',
        content: msg.content
      });
    }
  }

  // Adicionar mensagem atual do lead
  messages.push({
    role: 'user',
    content: lead_message
  });

  return messages;
}

/**
 * Detectar sentimento da mensagem do lead
 * @param {string} message - Mensagem do lead
 * @param {Array} escalationSentiments - Sentimentos configurados para escalação
 * @returns {Promise<Object>} Sentimento detectado e se deve escalar
 */
async function detectSentiment(message, escalationSentiments = []) {
  try {
    const prompt = `Analise a seguinte mensagem e classifique o SENTIMENTO PREDOMINANTE em UMA das categorias:

- frustration: Frustração, irritação, impaciência
- confusion: Confusão, dúvida, não entendimento
- high_interest: Alto interesse, entusiasmo, empolgação
- urgency: Urgência, pressa, necessidade imediata
- dissatisfaction: Insatisfação, descontentamento, decepção
- neutral: Neutro, sem sentimento forte detectado
- positive: Positivo geral, satisfação, agradecimento

Mensagem: "${message}"

Responda no formato JSON: {"sentiment": "categoria", "confidence": 0.0-1.0}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 50
    });

    const responseText = completion.choices[0].message.content.trim();

    // Parse JSON response
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      // If JSON parsing fails, try to extract sentiment from text
      const validSentiments = ['frustration', 'confusion', 'high_interest', 'urgency', 'dissatisfaction', 'neutral', 'positive'];
      const found = validSentiments.find(s => responseText.toLowerCase().includes(s));
      result = { sentiment: found || 'neutral', confidence: 0.5 };
    }

    // Check if this sentiment should trigger escalation
    const shouldEscalate = escalationSentiments.includes(result.sentiment);

    return {
      sentiment: result.sentiment,
      confidence: result.confidence || 0.7,
      shouldEscalate,
      escalationReason: shouldEscalate ? `Sentimento detectado: ${result.sentiment}` : null
    };

  } catch (error) {
    console.error('❌ Erro ao detectar sentimento:', error);
    return {
      sentiment: 'neutral',
      confidence: 0,
      shouldEscalate: false,
      escalationReason: null
    };
  }
}

/**
 * Verificar se mensagem contém palavras-chave de escalação
 * @param {string} message - Mensagem do lead
 * @param {string} keywords - Palavras-chave separadas por vírgula
 * @returns {Object} Resultado da verificação
 */
function checkEscalationKeywords(message, keywords) {
  if (!keywords || !keywords.trim()) {
    return { hasKeyword: false, matchedKeywords: [] };
  }

  const keywordList = keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
  const messageLower = message.toLowerCase();
  const matchedKeywords = keywordList.filter(keyword => messageLower.includes(keyword));

  return {
    hasKeyword: matchedKeywords.length > 0,
    matchedKeywords
  };
}

/**
 * Detectar intenção da mensagem do lead
 * @param {string} message - Mensagem do lead
 * @returns {Promise<string>} Intenção detectada
 */
async function detectIntent(message) {
  try {
    const prompt = `Analise a seguinte mensagem de um lead no LinkedIn e classifique a intenção em UMA das categorias:

- interested: Lead demonstra interesse claro no produto/serviço
- not_interested: Lead declina educadamente ou não demonstra interesse
- asking_details: Lead está pedindo mais informações/detalhes
- ready_to_buy: Lead está pronto para avançar (quer reunião, demo, proposta)
- neutral: Resposta cortês mas sem sinal claro
- objection: Lead levanta objeção ou preocupação

Mensagem: "${message}"

Responda APENAS com a categoria, sem explicações.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 20
    });

    const intent = completion.choices[0].message.content.trim().toLowerCase();

    // Validar que é uma das categorias válidas
    const validIntents = ['interested', 'not_interested', 'asking_details', 'ready_to_buy', 'neutral', 'objection'];

    return validIntents.includes(intent) ? intent : 'neutral';

  } catch (error) {
    console.error('❌ Erro ao detectar intenção:', error);
    return 'neutral';
  }
}

/**
 * Gerar mensagem inicial personalizada para quando convite for aceito
 * @param {Object} params - Parâmetros para geração
 * @returns {Promise<string>} Mensagem inicial gerada
 */
async function generateInitialMessage(params) {
  const { ai_agent, lead_data, campaign } = params;

  try {
    console.log(`💬 Gerando mensagem inicial para ${lead_data.name}`);

    // Se há template inicial configurado, usar ele
    if (ai_agent.initial_approach) {
      const leadDataProcessed = TemplateProcessor.extractLeadData(lead_data);
      const message = TemplateProcessor.processTemplate(ai_agent.initial_approach, leadDataProcessed);

      console.log(`✅ Mensagem gerada via template (${message.length} caracteres)`);
      return message;
    }

    // Caso contrário, gerar com IA
    const behavioralProfile = BEHAVIORAL_PROFILES[ai_agent.behavioral_profile] || BEHAVIORAL_PROFILES.consultivo;

    const prompt = `Você é ${ai_agent.name}, e acabou de ter seu convite de conexão aceito por ${lead_data.name || 'um lead'} no LinkedIn.

INFORMAÇÕES DO LEAD:
- Nome: ${lead_data.name || 'Não disponível'}
- Cargo: ${lead_data.title || 'Não disponível'}
- Empresa: ${lead_data.company || 'Não disponível'}
- Setor: ${lead_data.industry || 'Não disponível'}

SEU NEGÓCIO:
${ai_agent.products_services || 'Não especificado'}

ESTILO DE COMUNICAÇÃO: ${behavioralProfile.style}
Tom: ${behavioralProfile.tone}

Escreva uma mensagem de PRIMEIRO CONTATO curta (2-3 frases) para agradecer a conexão e iniciar um diálogo profissional.

REGRAS:
1. Seja genuíno e profissional
2. Personalize com base no cargo/empresa do lead
3. NÃO seja vendedor demais - ainda é o primeiro contato
4. Demonstre interesse real no perfil do lead
5. Termine com uma pergunta leve ou comentário que convide resposta
6. Máximo de 3 frases

Escreva APENAS a mensagem, sem aspas ou explicações:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 200
    });

    const message = completion.choices[0].message.content.trim();

    console.log(`✅ Mensagem inicial gerada com IA (${message.length} caracteres)`);

    return message;

  } catch (error) {
    console.error('❌ Erro ao gerar mensagem inicial:', error);

    // Fallback para mensagem padrão
    return `Olá ${lead_data.name || ''}! Obrigado por aceitar minha conexão. Gostei do seu perfil e seria ótimo trocar ideias sobre ${ai_agent.products_services || 'o mercado'}. Como estão as coisas na ${lead_data.company || 'sua empresa'}?`;
  }
}

/**
 * Verificar se mensagem requer resposta urgente
 * @param {string} message - Mensagem do lead
 * @returns {Promise<boolean>} Se requer resposta urgente
 */
async function requiresUrgentResponse(message) {
  try {
    const urgentKeywords = [
      'urgente', 'quanto custa', 'preço', 'proposta',
      'reunião', 'demo', 'apresentação', 'agora',
      'hoje', 'amanhã', 'essa semana'
    ];

    const messageLower = message.toLowerCase();

    return urgentKeywords.some(keyword => messageLower.includes(keyword));

  } catch (error) {
    console.error('Erro ao verificar urgência:', error);
    return false;
  }
}

/**
 * Build email-specific system prompt instructions
 * @param {Object} emailConfig - Email configuration from ai_agent
 * @param {Object} leadData - Lead information
 * @returns {string} Email instructions for the AI
 */
function buildEmailInstructions(emailConfig, leadData) {
  const config = emailConfig || {};
  const tone = EMAIL_TONES[config.tone] || EMAIL_TONES.professional;
  const closing = EMAIL_CLOSINGS[config.closing_style] || EMAIL_CLOSINGS.best_regards;

  // Get greeting based on style
  let greetingExample = '';
  switch (config.greeting_style) {
    case 'name':
      greetingExample = `"Olá ${leadData.name || '[Nome]'},"`;
      break;
    case 'title':
      greetingExample = `"Prezado(a) ${leadData.title || ''} ${leadData.name || '[Nome]'},"`;
      break;
    case 'formal':
      greetingExample = `"Prezado(a) Sr(a). ${leadData.name || '[Nome]'},"`;
      break;
    default:
      greetingExample = '"Olá,"';
  }

  // Response length guidance
  let lengthGuidance = '';
  switch (config.response_length) {
    case 'short':
      lengthGuidance = 'Respostas CURTAS (2-3 parágrafos, máximo 100 palavras)';
      break;
    case 'long':
      lengthGuidance = 'Respostas DETALHADAS (4-6 parágrafos, 200-300 palavras)';
      break;
    default:
      lengthGuidance = 'Respostas de tamanho MÉDIO (3-4 parágrafos, 100-150 palavras)';
  }

  // Personalization level
  let personalizationGuidance = '';
  switch (config.personalization_level) {
    case 'low':
      personalizationGuidance = 'Use personalização BÁSICA (apenas nome do lead)';
      break;
    case 'high':
      personalizationGuidance = 'Use personalização AVANÇADA (mencione cargo, empresa, setor, contexto anterior)';
      break;
    default:
      personalizationGuidance = 'Use personalização MODERADA (nome, empresa quando relevante)';
  }

  return `
=== FORMATO DE EMAIL ===

ESTILO DE COMUNICAÇÃO:
- Tom: ${tone.description}
- ${tone.instructions}

ESTRUTURA DO EMAIL:
1. Saudação: Comece com ${greetingExample}
2. Corpo: ${lengthGuidance}
3. Encerramento: Finalize com "${closing}"

FORMATAÇÃO HTML:
- Use tags HTML básicas para formatação: <p>, <br>, <b>, <i>, <ul>, <li>
- Cada parágrafo em tags <p></p>
- Use <b> para destacar pontos importantes
- Use <ul>/<li> para listas quando apropriado

PERSONALIZAÇÃO:
- ${personalizationGuidance}

REGRAS IMPORTANTES:
1. Gere o email COMPLETO incluindo saudação e encerramento
2. NÃO inclua assinatura (será adicionada automaticamente pelo sistema)
3. Mantenha o tom ${config.tone || 'professional'} consistentemente
4. Responda de forma profissional e relevante ao contexto da conversa
5. Se houver perguntas do lead, responda-as diretamente
`;
}

/**
 * Generate email response with full formatting
 * @param {Object} params - Parameters for email generation
 * @returns {Promise<Object>} Generated email response
 */
async function generateEmailResponse(params) {
  const {
    conversation_id,
    lead_message,
    conversation_history = [],
    conversation_context = null,
    ai_agent,
    lead_data = {},
    context = {}
  } = params;

  try {
    console.log(`📧 Gerando resposta de EMAIL para conversa ${conversation_id}`);

    // Validate AI agent
    if (!ai_agent) {
      throw new Error('AI agent configuration is required');
    }

    // Get agent email config
    const emailConfig = ai_agent.email_config || {};

    // Get behavioral profile
    const behavioralProfile = BEHAVIORAL_PROFILES[ai_agent.behavioral_profile] || BEHAVIORAL_PROFILES.consultivo;

    // Search for relevant knowledge using RAG
    let knowledgeContext = '';
    try {
      const relevantKnowledge = await ragService.searchRelevantKnowledge(
        ai_agent.id,
        lead_message,
        { limit: 5, minSimilarity: 0.7 }
      );

      if (relevantKnowledge && relevantKnowledge.length > 0) {
        knowledgeContext = ragService.formatKnowledgeForPrompt(relevantKnowledge);
        console.log(`📚 ${relevantKnowledge.length} itens de conhecimento relevantes encontrados`);
      }
    } catch (error) {
      console.error('⚠️ Erro ao buscar conhecimento (continuando sem RAG):', error.message);
    }

    // Build system prompt with email instructions
    const basePrompt = buildSystemPrompt({
      ai_agent,
      behavioralProfile,
      lead_data,
      knowledgeContext
    });

    const emailInstructions = buildEmailInstructions(emailConfig, lead_data);
    const systemPrompt = basePrompt + emailInstructions;

    // Build conversation messages
    const messages = buildConversationMessages({
      systemPrompt,
      conversation_history,
      conversation_context,
      lead_message,
      ai_agent
    });

    console.log(`📝 Mensagens preparadas: ${messages.length} no contexto`);

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 800, // More tokens for email format
      presence_penalty: 0.6,
      frequency_penalty: 0.3
    });

    const generatedResponse = completion.choices[0].message.content.trim();

    console.log(`✅ Email gerado com sucesso (${generatedResponse.length} caracteres)`);

    // Detect intent
    let intent = null;
    if (ai_agent.intent_detection_enabled) {
      intent = await detectIntent(lead_message);
      console.log(`🎯 Intenção detectada: ${intent}`);
    }

    // Check if should offer scheduling
    let should_offer_scheduling = false;
    if (ai_agent.auto_schedule && intent && ['interested', 'ready_to_buy', 'asking_details'].includes(intent)) {
      should_offer_scheduling = true;
    }

    return {
      response: generatedResponse,
      intent,
      should_offer_scheduling,
      scheduling_link: should_offer_scheduling ? ai_agent.scheduling_link : null,
      tokens_used: completion.usage.total_tokens,
      model: completion.model,
      format: 'html', // Indicate this is HTML content
      emailConfig: {
        includeSignature: emailConfig.include_signature !== false,
        includeLogo: emailConfig.include_logo !== false,
        signatureId: emailConfig.signature_id || null,
      }
    };

  } catch (error) {
    console.error('❌ Erro ao gerar resposta de email:', error);
    throw error;
  }
}

/**
 * Generate initial email message for outreach
 * @param {Object} params - Parameters for email generation
 * @returns {Promise<Object>} Generated initial email
 */
async function generateInitialEmail(params) {
  const { ai_agent, lead_data, campaign } = params;

  try {
    console.log(`📧 Gerando email inicial para ${lead_data.name}`);

    const emailConfig = ai_agent.email_config || {};
    const behavioralProfile = BEHAVIORAL_PROFILES[ai_agent.behavioral_profile] || BEHAVIORAL_PROFILES.consultivo;
    const tone = EMAIL_TONES[emailConfig.tone] || EMAIL_TONES.professional;
    const closing = EMAIL_CLOSINGS[emailConfig.closing_style] || EMAIL_CLOSINGS.best_regards;

    // Build greeting
    let greeting = 'Olá,';
    if (emailConfig.greeting_style === 'name' && lead_data.name) {
      greeting = `Olá ${lead_data.name},`;
    } else if (emailConfig.greeting_style === 'title' && lead_data.title) {
      greeting = `Prezado(a) ${lead_data.title} ${lead_data.name || ''},`;
    } else if (emailConfig.greeting_style === 'formal' && lead_data.name) {
      greeting = `Prezado(a) Sr(a). ${lead_data.name},`;
    }

    const prompt = `Você é ${ai_agent.name}, escrevendo um EMAIL de primeiro contato para ${lead_data.name || 'um lead'}.

INFORMAÇÕES DO LEAD:
- Nome: ${lead_data.name || 'Não disponível'}
- Cargo: ${lead_data.title || 'Não disponível'}
- Empresa: ${lead_data.company || 'Não disponível'}
- Setor: ${lead_data.industry || 'Não disponível'}
- Email: ${lead_data.email || 'Não disponível'}

SEU NEGÓCIO:
${ai_agent.products_services || 'Não especificado'}

ESTILO DE COMUNICAÇÃO: ${behavioralProfile.style}
Tom: ${tone.description}
${tone.instructions}

ESTRUTURA DO EMAIL:
1. Comece com: "${greeting}"
2. Escreva 2-3 parágrafos breves apresentando-se e o motivo do contato
3. Finalize com: "${closing}"

FORMATAÇÃO:
- Use tags HTML: <p> para parágrafos, <b> para ênfase
- Cada parágrafo em <p></p>

REGRAS:
1. Seja genuíno e profissional
2. Personalize com base no cargo/empresa do lead
3. NÃO seja muito vendedor - é o primeiro contato
4. Demonstre interesse real
5. Inclua uma chamada para ação sutil
6. NÃO inclua assinatura (será adicionada automaticamente)

Escreva APENAS o conteúdo HTML do email:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 500
    });

    const emailContent = completion.choices[0].message.content.trim();

    console.log(`✅ Email inicial gerado (${emailContent.length} caracteres)`);

    return {
      content: emailContent,
      format: 'html',
      emailConfig: {
        includeSignature: emailConfig.include_signature !== false,
        includeLogo: emailConfig.include_logo !== false,
        signatureId: emailConfig.signature_id || null,
      }
    };

  } catch (error) {
    console.error('❌ Erro ao gerar email inicial:', error);

    // Fallback
    const closing = EMAIL_CLOSINGS[ai_agent.email_config?.closing_style] || 'Atenciosamente';
    return {
      content: `<p>Olá ${lead_data.name || ''},</p>
<p>Meu nome é ${ai_agent.name} e trabalho com ${ai_agent.products_services || 'soluções B2B'}.</p>
<p>Vi seu perfil e achei que poderíamos trocar algumas ideias sobre como posso ajudar a ${lead_data.company || 'sua empresa'}.</p>
<p>${closing}</p>`,
      format: 'html',
      emailConfig: {
        includeSignature: true,
        includeLogo: true,
      }
    };
  }
}

module.exports = {
  generateResponse,
  generateInitialMessage,
  generateEmailResponse,
  generateInitialEmail,
  detectIntent,
  detectSentiment,
  checkEscalationKeywords,
  requiresUrgentResponse,
  buildEmailInstructions,
  BEHAVIORAL_PROFILES,
  EMAIL_TONES,
  EMAIL_GREETINGS,
  EMAIL_CLOSINGS
};
