// backend/src/services/aiResponseService.js

const OpenAI = require('openai');
const db = require('../config/database');
const TemplateProcessor = require('../utils/templateProcessor');
const ragService = require('./ragService');
const objectionService = require('./objectionService');
const playbookService = require('./playbookService');
const profileAnalysisService = require('./profileAnalysisService');

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
 * Mapeamento de códigos de idioma para nomes completos
 * Usado para instruir a IA sobre qual idioma usar nas respostas
 */
const LANGUAGE_NAMES = {
  'pt-BR': 'Português do Brasil',
  'pt-PT': 'Português de Portugal',
  'en': 'English (Inglês)',
  'es': 'Español (Espanhol)',
  'fr': 'Français (Francês)',
  'it': 'Italiano',
  'de': 'Deutsch (Alemão)',
  'nl': 'Nederlands (Holandês)',
  'pl': 'Polski (Polonês)',
  'ru': 'Русский (Russo)',
  'ja': '日本語 (Japonês)',
  'zh-CN': '简体中文 (Chinês Simplificado)',
  'ko': '한국어 (Coreano)',
  'ar': 'العربية (Árabe)',
  'tr': 'Türkçe (Turco)',
  'hi': 'हिन्दी (Hindi)'
};

/**
 * Get human-readable language name from code
 * @param {string} code - Language code (e.g., 'pt-BR', 'en')
 * @returns {string} Human-readable language name
 */
function getLanguageName(code) {
  return LANGUAGE_NAMES[code] || code || 'Português do Brasil';
}

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
    context = {},
    current_step = 0                // Current conversation step (0-indexed)
  } = params;

  try {
    console.log(`🤖 Gerando resposta IA para conversa ${conversation_id}`);

    // Validar agente IA
    if (!ai_agent) {
      throw new Error('AI agent configuration is required');
    }

    // Obter perfil comportamental
    const behavioralProfile = BEHAVIORAL_PROFILES[ai_agent.behavioral_profile] || BEHAVIORAL_PROFILES.consultivo;

    // 🔍 ANALISAR PERFIL DO LEAD para personalização
    let profileAnalysisContext = '';
    try {
      if (lead_data && (lead_data.headline || lead_data.title || lead_data.company)) {
        const profileResult = profileAnalysisService.analyzeProfile(lead_data, ai_agent);

        if (profileResult.promptContext) {
          profileAnalysisContext = profileResult.promptContext;
          console.log(`👤 Análise de perfil: Score ${profileResult.analysis?.overallScore || 0}, ${profileResult.hooks?.length || 0} ganchos gerados`);
        }
      }
    } catch (error) {
      console.error('⚠️ Erro ao analisar perfil (continuando sem análise):', error.message);
    }

    // 🔍 BUSCAR PLAYBOOK do agente (metodologia de vendas)
    let playbookContext = '';
    try {
      const playbook = await playbookService.getPlaybookForAgent(ai_agent);

      if (playbook) {
        playbookContext = playbookService.formatPlaybookForPrompt(playbook, lead_data);
        console.log(`📚 Playbook "${playbook.name}" (${playbook.methodology}) carregado`);
      }
    } catch (error) {
      console.error('⚠️ Erro ao buscar playbook (continuando sem metodologia):', error.message);
    }

    // 🔍 BUSCAR OBJEÇÕES para injetar no prompt
    let objectionsContext = '';
    try {
      // Buscar objeções do sistema + customizadas da conta
      const agentLanguage = ai_agent.language || 'pt-BR';
      const objections = await objectionService.getSystemObjections(agentLanguage);

      if (objections && objections.length > 0) {
        objectionsContext = objectionService.formatObjectionsForPrompt(objections);
        console.log(`📋 ${objections.length} objeções carregadas para o contexto`);
      }
    } catch (error) {
      console.error('⚠️ Erro ao buscar objeções (continuando sem biblioteca):', error.message);
    }

    // 🔍 BUSCAR CONHECIMENTO usando RAG + Essencial
    let knowledgeContext = '';
    try {
      // 1. Buscar conhecimento ESSENCIAL (sempre incluído, independente de busca)
      let essentialKnowledge = [];
      try {
        essentialKnowledge = await ragService.getEssentialKnowledge(ai_agent.id);
        if (essentialKnowledge.length > 0) {
          console.log(`📌 ${essentialKnowledge.length} itens de conhecimento essencial encontrados`);
        }
      } catch (error) {
        console.error('⚠️ Erro ao buscar conhecimento essencial:', error.message);
      }

      // 2. Buscar conhecimento CONTEXTUAL (via busca vetorial)
      let contextualKnowledge = [];
      try {
        const similarityThreshold = ai_agent.knowledge_similarity_threshold
          ? parseFloat(ai_agent.knowledge_similarity_threshold)
          : 0.7;

        contextualKnowledge = await ragService.searchRelevantKnowledge(
          ai_agent.id,
          lead_message,
          {
            limit: 5,
            minSimilarity: similarityThreshold
          }
        );

        if (contextualKnowledge && contextualKnowledge.length > 0) {
          console.log(`📚 ${contextualKnowledge.length} itens de conhecimento contextual encontrados via RAG`);
        }
      } catch (error) {
        console.error('⚠️ Erro ao buscar conhecimento contextual:', error.message);
      }

      // 3. Combinar: essencial + contextual (sem duplicatas)
      const allKnowledge = [...essentialKnowledge];
      const essentialIds = new Set(essentialKnowledge.map(k => k.id));

      for (const item of contextualKnowledge) {
        if (!essentialIds.has(item.id)) {
          allKnowledge.push(item);
        }
      }

      if (allKnowledge.length > 0) {
        knowledgeContext = ragService.formatKnowledgeForPrompt(allKnowledge);
        console.log(`✅ Total: ${allKnowledge.length} itens de conhecimento injetados no contexto (${essentialKnowledge.length} essenciais + ${allKnowledge.length - essentialKnowledge.length} contextuais)`);
      } else {
        console.log(`📭 Nenhum conhecimento encontrado para a query`);
      }
    } catch (error) {
      console.error('⚠️ Erro ao buscar conhecimento (continuando sem RAG):', error.message);
      // Continuar sem RAG em caso de erro
    }

    // Construir system prompt com conhecimento relevante, objeções, playbook e análise de perfil
    const systemPrompt = buildSystemPrompt({
      ai_agent,
      behavioralProfile,
      lead_data,
      knowledgeContext,
      objectionsContext,
      playbookContext,
      profileAnalysisContext,
      currentStep: current_step
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

    // Check if AI response contains [TRANSFER] tag (from transfer triggers)
    let aiRequestedTransfer = false;
    let cleanedResponse = generatedResponse;
    if (generatedResponse.includes('[TRANSFER]')) {
      aiRequestedTransfer = true;
      shouldEscalate = true;
      escalationReasons.push('IA detectou gatilho de transferência');
      cleanedResponse = generatedResponse.replace('[TRANSFER]', '').trim();
      console.log(`🔄 IA solicitou transferência via [TRANSFER] tag`);
    }

    // Check if AI indicated step completion with [NEXT_STEP] tag
    let stepAdvanced = false;
    let newStep = current_step;
    const conversationSteps = ai_agent.conversation_steps || [];
    if (cleanedResponse.includes('[NEXT_STEP]')) {
      cleanedResponse = cleanedResponse.replace('[NEXT_STEP]', '').trim();
      if (current_step < conversationSteps.length - 1) {
        newStep = current_step + 1;
        stepAdvanced = true;
        console.log(`📈 IA indicou conclusão da etapa ${current_step + 1}, avançando para etapa ${newStep + 1}`);
      }
    }

    // Verificar se deve oferecer agendamento
    let should_offer_scheduling = false;
    if (ai_agent.auto_schedule && intent && ['interested', 'ready_to_buy', 'asking_details'].includes(intent)) {
      should_offer_scheduling = true;
    }

    return {
      response: cleanedResponse,
      intent,
      sentiment: sentimentResult.sentiment,
      sentimentConfidence: sentimentResult.confidence,
      shouldEscalate,
      escalationReasons,
      matchedKeywords: keywordResult.matchedKeywords,
      aiRequestedTransfer,
      should_offer_scheduling,
      scheduling_link: should_offer_scheduling ? ai_agent.scheduling_link : null,
      tokens_used: completion.usage.total_tokens,
      model: completion.model,
      current_step: newStep,
      step_advanced: stepAdvanced
    };

  } catch (error) {
    console.error('❌ Erro ao gerar resposta IA:', error);
    throw error;
  }
}

/**
 * Construir system prompt baseado no agente IA
 */
function buildSystemPrompt({ ai_agent, behavioralProfile, lead_data, knowledgeContext = '', objectionsContext = '', playbookContext = '', profileAnalysisContext = '', currentStep = 0 }) {
  // Incluímos todas as informações para contexto interno, mas instruímos a IA a NÃO mencionar diretamente
  const leadInfo = lead_data.name ? `

CONTEXTO INTERNO DO LEAD (use para entender, NÃO mencione diretamente na conversa):
- Nome: ${lead_data.name || 'Não disponível'}
- Empresa: ${lead_data.company || 'Não disponível'}
- Cargo: ${lead_data.title || 'Não disponível'}
- Setor: ${lead_data.industry || 'Não disponível'}
- Localização: ${lead_data.location || 'Não disponível'}

⚠️ IMPORTANTE: Estas informações são para você ENTENDER o contexto do lead, NÃO para mencionar diretamente.
Exemplo ERRADO: "Vi que você trabalha na Tech Solutions como CEO..."
Exemplo CERTO: "Como tem sido o cenário por aí?" (natural, sem forçar dados)
Use apenas o PRIMEIRO NOME do lead de forma natural.` : '';

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

  // Build conversation steps section with intelligent progression
  let stepsSection = '';
  if (ai_agent.conversation_steps && ai_agent.conversation_steps.length > 0) {
    const steps = ai_agent.conversation_steps;
    const currentStepData = typeof steps[currentStep] === 'object'
      ? steps[currentStep]
      : { text: steps[currentStep], is_escalation: false };

    stepsSection = `

ETAPAS DA CONVERSA:
${steps.map((step, index) => {
  const stepData = typeof step === 'object' ? step : { text: step, is_escalation: false };
  const escalationMark = stepData.is_escalation ? ' [TRANSFERIR PARA HUMANO]' : '';
  const currentMark = index === currentStep ? ' ← VOCÊ ESTÁ AQUI' : '';
  const completedMark = index < currentStep ? '✓ ' : '';
  return `${completedMark}${index + 1}. ${stepData.text || step}${escalationMark}${currentMark}`;
}).join('\n')}

ETAPA ATUAL: ${currentStep + 1} - ${currentStepData.text || steps[currentStep]}

REGRAS DE PROGRESSÃO DE ETAPAS:
1. Você ESTÁ na etapa ${currentStep + 1}. Foque em cumprir o objetivo desta etapa.
2. Uma etapa SÓ é concluída quando o OBJETIVO foi alcançado na conversa.
3. Você pode demorar VÁRIAS mensagens na mesma etapa - isso é normal e esperado.
4. NÃO avance de etapa só porque trocou mensagens. Avance quando o objetivo foi REALMENTE cumprido.
5. Quando você DETERMINAR que o objetivo da etapa atual foi cumprido (baseado na resposta do lead),
   inclua [NEXT_STEP] no final da sua mensagem para sinalizar ao sistema.

QUANDO AVANÇAR DE ETAPA:
- O lead deu uma resposta que indica que o objetivo da etapa foi atingido
- Exemplo: Na etapa "Descobrir dor do lead", só avance quando o lead REALMENTE compartilhar uma dor/desafio
- NÃO avance só porque fez uma pergunta - espere a resposta relevante

QUANDO NÃO AVANÇAR:
- O lead deu uma resposta genérica ou evasiva
- Você ainda não cumpriu o objetivo da etapa
- A conversa está em fase de aquecimento/rapport`;
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

  // Build transfer triggers section (new system based on checkboxes)
  let transferTriggersSection = '';
  const transferTriggers = ai_agent.transfer_triggers || [];
  if (transferTriggers.length > 0) {
    const triggerLabels = {
      doubt: 'O lead expressa dúvidas, confusão ou pede explicações mais detalhadas',
      qualified: 'O lead demonstra alto interesse, está qualificado e pronto para avançar',
      price: 'O lead pergunta sobre preços, valores, custos ou planos',
      demo: 'O lead solicita demo, demonstração, apresentação ou teste',
      competitor: 'O lead menciona concorrentes ou compara com outras soluções',
      urgency: 'O lead demonstra urgência, pressa ou necessidade imediata',
      frustration: 'O lead expressa frustração, irritação ou insatisfação'
    };

    const activeTriggersText = transferTriggers
      .map(t => triggerLabels[t])
      .filter(Boolean)
      .join('\n- ');

    transferTriggersSection = `

GATILHOS DE TRANSFERÊNCIA PARA HUMANO:
Quando detectar QUALQUER uma destas situações, você DEVE:
1. Informar gentilmente que vai conectar o lead com um especialista
2. Incluir [TRANSFER] no final da sua mensagem para sinalizar ao sistema

Situações que exigem transferência:
- ${activeTriggersText}

IMPORTANTE: Ao detectar um gatilho de transferência, responda de forma empática, informe que entendeu a necessidade e que vai conectar com alguém da equipe que pode ajudar melhor. Termine a mensagem com [TRANSFER].`;
  }

  // Build priority rules section (user-defined behavioral rules)
  let priorityRulesSection = '';
  if (ai_agent.priority_rules && Array.isArray(ai_agent.priority_rules) && ai_agent.priority_rules.length > 0) {
    const rules = ai_agent.priority_rules.map(rule => {
      const prefix = rule.prefix || 'SEMPRE';
      const instruction = rule.instruction || '';
      return `- ${prefix}: ${instruction}`;
    }).join('\n');

    priorityRulesSection = `

REGRAS PRIORITÁRIAS (SIGA RIGOROSAMENTE):
${rules}

IMPORTANTE: Estas regras têm prioridade máxima e devem ser seguidas em todas as interações.`;
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

  // Get channel-specific context
  const agentType = ai_agent.agent_type || 'linkedin';
  const channelContext = getChannelContext(agentType);

  // Build language instruction
  const agentLanguage = ai_agent.language || 'pt-BR';
  const languageName = getLanguageName(agentLanguage);
  const languageInstruction = `
IDIOMA DE RESPOSTA OBRIGATÓRIO: ${languageName}
Você DEVE responder SEMPRE em ${languageName}.
Mesmo que o lead escreva em outro idioma, sua resposta deve ser EXCLUSIVAMENTE em ${languageName}.
NÃO mude de idioma em nenhuma circunstância. Mantenha TODAS as suas respostas em ${languageName}.`;

  let basePrompt = `Você é ${ai_agent.name}, ${channelContext.agentDescription}

PERFIL COMPORTAMENTAL: ${behavioralProfile.style}
Tom de comunicação: ${behavioralProfile.tone}
Abordagem: ${behavioralProfile.approach}

SEU NEGÓCIO/PRODUTO:
${ai_agent.products_services || 'Não especificado'}
${companySection}
${knowledgeContext}
${playbookContext}

OBJETIVO PRINCIPAL:
${objectiveText}
${stepsSection}
${escalationSection}
${transferTriggersSection}
${priorityRulesSection}
${leadInfo}
${profileAnalysisContext}
${additionalInstructions}
${objectionsContext}

INSTRUÇÕES DE ESTILO:
${ai_agent.response_style_instructions || '- Seja profissional mas acessível\n- Use linguagem clara e direta\n- Mostre interesse genuíno no lead'}

⚠️ REGRA MAIS IMPORTANTE - SEJA HUMANO:
Você é uma PESSOA REAL tendo uma conversa genuína. NÃO é um vendedor tentando qualificar.

COMO CONVERSAR (siga isso rigorosamente):
1. Respostas CURTAS - ${channelContext.maxSentences}
2. Converse como AMIGO, não como vendedor
3. NÃO faça perguntas sobre "desafios", "dores" ou "necessidades" nas primeiras mensagens
4. NÃO diga coisas como "estou aqui para ajudar" ou "entender suas necessidades" - isso é linguagem de bot
5. Se o lead não te conhece, NÃO force conversa sobre negócios - apenas bata papo primeiro
6. Adapte seu tom ao do lead - se ele for informal, seja informal também
7. Se o lead parecer confuso ou resistente, recue e seja mais casual

EXEMPLOS DO QUE NÃO FAZER:
❌ "Algum desafio que você gostaria de compartilhar?"
❌ "Estou aqui para construir um relacionamento"
❌ "Como posso ajudar você?"
❌ "Entender melhor suas necessidades"
❌ "Na sua área de [X]..." ou "Na [empresa]..."

EXEMPLOS DO QUE FAZER:
✅ "E aí, tudo bem?"
✅ "Show! E como tá o mercado por aí?"
✅ "Ah entendi. E você, curte o que faz?"
✅ Responder de forma CURTA e natural como um humano faria

QUANDO O LEAD DER ABERTURA (depois de algumas trocas):
- Aí sim você pode explorar o que ele faz
- Mas de forma natural, não interrogatório
${ai_agent.auto_schedule && ai_agent.scheduling_link ? `- Se mostrar interesse real: ${ai_agent.scheduling_link}` : ''}
${languageInstruction}

Lembre: você é uma pessoa, não um bot. Converse como tal.`;

  return basePrompt;
}

/**
 * Get channel-specific context for prompts
 * @param {string} agentType - The agent type (linkedin, whatsapp, email)
 * @returns {Object} Channel-specific context
 */
function getChannelContext(agentType) {
  const contexts = {
    linkedin: {
      agentDescription: 'um profissional que gosta de conhecer pessoas e trocar ideias no LinkedIn.',
      maxSentences: 'máximo 2-3 frases CURTAS',
      platformRule: 'LinkedIn - seja casual mas profissional, como um colega de trabalho',
      naturalConversation: 'como uma pessoa real conversando no LinkedIn'
    },
    whatsapp: {
      agentDescription: 'uma pessoa que conversa naturalmente via WhatsApp.',
      maxSentences: 'máximo 1-2 frases curtas - WhatsApp é rápido',
      platformRule: 'WhatsApp - seja bem informal e direto, como um amigo',
      naturalConversation: 'como um amigo conversando no WhatsApp'
    },
    email: {
      agentDescription: 'um profissional que se comunica por email de forma clara.',
      maxSentences: 'máximo 3-4 frases por email',
      platformRule: 'Email - seja profissional mas acessível',
      naturalConversation: 'como um email profissional mas humano'
    }
  };

  return contexts[agentType] || contexts.linkedin;
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
    console.log(`💬 Gerando mensagem inicial para ${lead_data.name} (canal: ${ai_agent.agent_type}, idioma: ${ai_agent.language || 'pt-BR'})`);

    // Verificar idioma do agente - se não for português, SEMPRE gerar via IA
    const agentLanguage = ai_agent.language || 'pt-BR';
    const isPortuguese = agentLanguage.startsWith('pt');

    // Se há template inicial configurado E o idioma é português, usar template
    // Caso contrário, gerar via IA para respeitar o idioma configurado
    if (ai_agent.initial_approach && isPortuguese) {
      const leadDataProcessed = TemplateProcessor.extractLeadData(lead_data);
      const message = TemplateProcessor.processTemplate(ai_agent.initial_approach, leadDataProcessed);

      console.log(`✅ Mensagem gerada via template (${message.length} caracteres)`);
      return message;
    }

    // Gerar com IA (sempre para idiomas não-português ou quando não há template)
    const behavioralProfile = BEHAVIORAL_PROFILES[ai_agent.behavioral_profile] || BEHAVIORAL_PROFILES.consultivo;
    const agentType = ai_agent.agent_type || 'linkedin';

    // Build channel-specific prompt
    const prompt = buildChannelSpecificInitialPrompt({
      agentType,
      ai_agent,
      lead_data,
      behavioralProfile
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 200
    });

    const message = completion.choices[0].message.content.trim();

    console.log(`✅ Mensagem inicial gerada com IA para ${agentType} (${message.length} caracteres)`);

    return message;

  } catch (error) {
    console.error('❌ Erro ao gerar mensagem inicial:', error);

    // Fallback para mensagem padrão baseada no canal
    const agentType = ai_agent.agent_type || 'linkedin';
    if (agentType === 'whatsapp') {
      return `Olá ${lead_data.name || ''}! 👋 Tudo bem? Sou ${ai_agent.name}. ${ai_agent.products_services ? `Trabalho com ${ai_agent.products_services}.` : ''} Como posso te ajudar?`;
    } else {
      return `Olá ${lead_data.name || ''}! Obrigado por aceitar minha conexão. Gostei do seu perfil e seria ótimo trocar ideias sobre ${ai_agent.products_services || 'o mercado'}. Como estão as coisas na ${lead_data.company || 'sua empresa'}?`;
    }
  }
}

/**
 * Build channel-specific prompt for initial message generation
 * @param {Object} params - Parameters for building the prompt
 * @returns {string} Channel-specific prompt
 */
function buildChannelSpecificInitialPrompt({ agentType, ai_agent, lead_data, behavioralProfile }) {
  const leadInfo = `
INFORMAÇÕES DO LEAD:
- Nome: ${lead_data.name || 'Não disponível'}
- Cargo: ${lead_data.title || 'Não disponível'}
- Empresa: ${lead_data.company || 'Não disponível'}
- Setor: ${lead_data.industry || 'Não disponível'}`;

  const businessInfo = `
SEU NEGÓCIO:
${ai_agent.products_services || 'Não especificado'}

ESTILO DE COMUNICAÇÃO: ${behavioralProfile.style}
Tom: ${behavioralProfile.tone}`;

  // Build language instruction for initial messages
  const agentLanguage = ai_agent.language || 'pt-BR';
  const languageName = getLanguageName(agentLanguage);

  // WhatsApp-specific prompt
  if (agentType === 'whatsapp') {
    return `Você é ${ai_agent.name}, um assistente de vendas via WhatsApp. Um novo lead entrou em contato ou foi adicionado ao seu fluxo de atendimento.
${leadInfo}
${businessInfo}

Escreva uma mensagem de PRIMEIRO CONTATO via WhatsApp curta e amigável (2-3 frases).

REGRAS PARA WHATSAPP:
1. Seja informal mas profissional - WhatsApp é mais descontraído
2. Use uma saudação calorosa (pode usar emoji se apropriado para o tom)
3. Se apresente brevemente
4. Seja direto mas não invasivo
5. Faça uma pergunta aberta para entender a necessidade do lead
6. Máximo de 3 frases curtas (WhatsApp exige mensagens concisas)
7. NÃO mencione LinkedIn ou "conexão aceita"
8. RESPONDA OBRIGATORIAMENTE em ${languageName}. NÃO use outro idioma.

Escreva APENAS a mensagem, sem aspas ou explicações:`;
  }

  // Email-specific prompt
  if (agentType === 'email') {
    return `Você é ${ai_agent.name}, enviando um email de primeiro contato para um lead.
${leadInfo}
${businessInfo}

Escreva um EMAIL de PRIMEIRO CONTATO profissional e conciso.

REGRAS PARA EMAIL:
1. Comece com uma saudação apropriada
2. Se apresente brevemente e mencione o contexto
3. Seja profissional mas não robótico
4. Demonstre valor logo no início
5. Termine com um call-to-action claro
6. Máximo de 4-5 frases no corpo do email
7. NÃO inclua assunto, apenas o corpo da mensagem
8. RESPONDA OBRIGATORIAMENTE em ${languageName}. NÃO use outro idioma.

Escreva APENAS a mensagem, sem aspas ou explicações:`;
  }

  // LinkedIn-specific prompt (default)
  return `Você é ${ai_agent.name}, e acabou de ter seu convite de conexão aceito por ${lead_data.name || 'um lead'} no LinkedIn.
${leadInfo}
${businessInfo}

Escreva uma mensagem de PRIMEIRO CONTATO curta (2-3 frases) para agradecer a conexão e iniciar um diálogo profissional.

REGRAS PARA LINKEDIN:
1. Seja genuíno e profissional
2. Personalize com base no cargo/empresa do lead
3. NÃO seja vendedor demais - ainda é o primeiro contato
4. Demonstre interesse real no perfil do lead
5. Termine com uma pergunta leve ou comentário que convide resposta
6. Máximo de 3 frases
7. RESPONDA OBRIGATORIAMENTE em ${languageName}. NÃO use outro idioma.

Escreva APENAS a mensagem, sem aspas ou explicações:`;
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

    // Search for relevant knowledge using RAG + Essential
    let knowledgeContext = '';
    try {
      // 1. Buscar conhecimento ESSENCIAL
      let essentialKnowledge = [];
      try {
        essentialKnowledge = await ragService.getEssentialKnowledge(ai_agent.id);
      } catch (error) {
        console.error('⚠️ Erro ao buscar conhecimento essencial:', error.message);
      }

      // 2. Buscar conhecimento CONTEXTUAL
      let contextualKnowledge = [];
      try {
        const similarityThreshold = ai_agent.knowledge_similarity_threshold
          ? parseFloat(ai_agent.knowledge_similarity_threshold)
          : 0.7;

        contextualKnowledge = await ragService.searchRelevantKnowledge(
          ai_agent.id,
          lead_message,
          { limit: 5, minSimilarity: similarityThreshold }
        );
      } catch (error) {
        console.error('⚠️ Erro ao buscar conhecimento contextual:', error.message);
      }

      // 3. Combinar sem duplicatas
      const allKnowledge = [...essentialKnowledge];
      const essentialIds = new Set(essentialKnowledge.map(k => k.id));
      for (const item of contextualKnowledge) {
        if (!essentialIds.has(item.id)) {
          allKnowledge.push(item);
        }
      }

      if (allKnowledge.length > 0) {
        knowledgeContext = ragService.formatKnowledgeForPrompt(allKnowledge);
        console.log(`📚 ${allKnowledge.length} itens de conhecimento encontrados (${essentialKnowledge.length} essenciais)`);
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

    // Get language for initial email
    const agentLanguage = ai_agent.language || 'pt-BR';
    const languageName = getLanguageName(agentLanguage);

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
7. RESPONDA OBRIGATORIAMENTE em ${languageName}. NÃO use outro idioma.

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
  buildSystemPrompt,
  BEHAVIORAL_PROFILES,
  EMAIL_TONES,
  EMAIL_GREETINGS,
  EMAIL_CLOSINGS
};
