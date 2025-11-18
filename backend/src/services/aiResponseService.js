// backend/src/services/aiResponseService.js

const OpenAI = require('openai');
const db = require('../config/database');
const TemplateProcessor = require('../utils/templateProcessor');
const ragService = require('./ragService');

// Inicializar cliente OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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
    conversation_history = [],
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
      lead_message,
      ai_agent
    });

    console.log(`📝 Mensagens preparadas: ${messages.length} no contexto`);

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

    // Verificar se deve oferecer agendamento
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

  let basePrompt = `Você é ${ai_agent.name}, um agente de vendas B2B especializado em prospecção no LinkedIn.

PERFIL COMPORTAMENTAL: ${behavioralProfile.style}
Tom de comunicação: ${behavioralProfile.tone}
Abordagem: ${behavioralProfile.approach}

SEU NEGÓCIO/PRODUTO:
${ai_agent.products_services || 'Não especificado'}
${knowledgeContext}

OBJETIVO DA CONVERSA:
${ai_agent.system_prompt || 'Qualificar o lead e identificar oportunidades de negócio'}
${leadInfo}

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
function buildConversationMessages({ systemPrompt, conversation_history, lead_message, ai_agent }) {
  const messages = [
    {
      role: 'system',
      content: systemPrompt
    }
  ];

  // Adicionar histórico da conversa (últimas 10 mensagens)
  const recentHistory = conversation_history.slice(-10);

  for (const msg of recentHistory) {
    messages.push({
      role: msg.sender_type === 'ai' ? 'assistant' : 'user',
      content: msg.content
    });
  }

  // Adicionar mensagem atual do lead
  messages.push({
    role: 'user',
    content: lead_message
  });

  return messages;
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

module.exports = {
  generateResponse,
  generateInitialMessage,
  detectIntent,
  requiresUrgentResponse,
  BEHAVIORAL_PROFILES
};
