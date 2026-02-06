// backend/src/services/aiResponseService.js

const OpenAI = require('openai');
const db = require('../config/database');
const TemplateProcessor = require('../utils/templateProcessor');
const ragService = require('./ragService');
const objectionService = require('./objectionService');
const playbookService = require('./playbookService');
const profileAnalysisService = require('./profileAnalysisService');
const businessHoursService = require('./businessHoursService');

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

    // 🕐 VERIFICAR HORÁRIO DE FUNCIONAMENTO
    const agentConfig = typeof ai_agent.config === 'string'
      ? JSON.parse(ai_agent.config || '{}')
      : (ai_agent.config || {});

    if (agentConfig.workingHours?.enabled && !context.isTest) {
      const isWithinHours = businessHoursService.isWithinBusinessHours(agentConfig.workingHours);

      if (!isWithinHours) {
        const outOfHoursResponse = businessHoursService.getOutOfHoursResponse(agentConfig.workingHours);
        console.log(`🕐 Fora do horário de funcionamento - Ação: ${outOfHoursResponse.action}`);

        if (outOfHoursResponse.action === 'message') {
          // Retornar mensagem de ausência
          return {
            message: outOfHoursResponse.message,
            isOutOfHours: true,
            skipAI: true,
            sentiment: 'neutral',
            intent: 'out_of_hours',
            action: 'auto_reply'
          };
        } else if (outOfHoursResponse.action === 'ignore') {
          // Não responder nada
          return {
            message: null,
            isOutOfHours: true,
            skipAI: true,
            ignored: true,
            action: 'ignore'
          };
        }
        // 'queue' - continua normalmente, mas marca como fora do horário
        // O sistema pode processar depois ou simplesmente responder normalmente
        console.log(`🕐 Modo 'queue' - processando resposta mesmo fora do horário`);
      }
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
        // FALLBACK: Se nao encontrou via RAG, tentar ler do config diretamente
        // Isso e util para agentes criados antes do sync de FAQ/objecoes
        console.log(`📭 Nenhum conhecimento via RAG - tentando fallback do config...`);

        const config = typeof ai_agent.config === 'string'
          ? JSON.parse(ai_agent.config || '{}')
          : (ai_agent.config || {});

        const fallbackFaqs = config.faq || [];
        const fallbackObjections = config.objections || [];

        if (fallbackFaqs.length > 0 || fallbackObjections.length > 0) {
          let fallbackContext = '';

          if (fallbackFaqs.length > 0) {
            fallbackContext += '\n\n=== PERGUNTAS FREQUENTES (FAQ) ===\n';
            fallbackFaqs.forEach((faq, i) => {
              if (faq.question && faq.answer) {
                fallbackContext += `\nP${i + 1}: ${faq.question}\nR: ${faq.answer}\n`;
              }
            });
          }

          if (fallbackObjections.length > 0) {
            fallbackContext += '\n\n=== TRATAMENTO DE OBJECOES ===\n';
            fallbackObjections.forEach((obj, i) => {
              if (obj.objection && obj.response) {
                fallbackContext += `\nObjecao ${i + 1}: ${obj.objection}\nResposta: ${obj.response}\n`;
              }
            });
          }

          knowledgeContext = fallbackContext;
          console.log(`📋 Fallback: ${fallbackFaqs.length} FAQs e ${fallbackObjections.length} objecoes carregados do config`);
        } else {
          console.log(`📭 Nenhum conhecimento disponivel (nem via RAG, nem no config)`);
        }
      }
    } catch (error) {
      console.error('⚠️ Erro ao buscar conhecimento (continuando sem RAG):', error.message);
      // Continuar sem RAG em caso de erro
    }

    // Construir system prompt com conhecimento relevante, objeções, playbook e análise de perfil
    const systemPrompt = await buildSystemPrompt({
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
    // Se tem objective_instructions, forçar resposta em JSON
    const useJsonMode = !!ai_agent.objective_instructions;

    const completionParams = {
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
      presence_penalty: 0.6,
      frequency_penalty: 0.3
    };

    // Forçar JSON mode quando objetivo está definido
    if (useJsonMode) {
      completionParams.response_format = { type: 'json_object' };
      console.log(`🔧 [AI] JSON mode ENABLED for objective evaluation`);
    }

    const completion = await openai.chat.completions.create(completionParams);

    const generatedResponse = completion.choices[0].message.content.trim();

    // DEBUG: Log da resposta bruta da IA
    console.log(`🤖 [AI RAW RESPONSE] >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>`);
    console.log(generatedResponse);
    console.log(`🤖 [AI RAW RESPONSE] <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<`);
    console.log(`📝 [AI] Has objective_instructions: ${!!ai_agent.objective_instructions}`);

    // Tentar parsear como JSON estruturado (quando objective_instructions existe)
    let parsedResponse = null;
    let objectiveAchievedByAI = false;
    let extractedData = null;
    let qualification = null;
    let objection = null;
    let messageContent = generatedResponse;

    if (ai_agent.objective_instructions) {
      try {
        // Tentar extrair JSON da resposta
        const jsonMatch = generatedResponse.match(/\{[\s\S]*\}/);
        console.log(`🔍 [JSON MATCH] Found JSON: ${!!jsonMatch}`);
        if (jsonMatch) {
          console.log(`🔍 [JSON MATCH] JSON string: ${jsonMatch[0].substring(0, 200)}...`);
          parsedResponse = JSON.parse(jsonMatch[0]);
          console.log(`✅ [JSON PARSED] objectiveAchieved = ${parsedResponse.objectiveAchieved}`);

          // Extrair campos do JSON
          objectiveAchievedByAI = parsedResponse.objectiveAchieved === true;
          messageContent = parsedResponse.message || generatedResponse;

          // Extrair dados do lead (filtrar nulls)
          if (parsedResponse.extractedData) {
            const data = parsedResponse.extractedData;
            extractedData = {};
            if (data.email && data.email !== 'null') extractedData.email = data.email;
            if (data.phone && data.phone !== 'null') extractedData.phone = data.phone;
            if (data.company && data.company !== 'null') extractedData.company = data.company;
            if (data.role && data.role !== 'null') extractedData.role = data.role;
            if (data.company_size && data.company_size !== 'null') extractedData.company_size = data.company_size;
            if (data.budget && data.budget !== 'null') extractedData.budget = data.budget;
            if (data.timeline && data.timeline !== 'null') extractedData.timeline = data.timeline;
            // Se não extraiu nada, set null
            if (Object.keys(extractedData).length === 0) extractedData = null;
          }

          // Extrair qualificação
          if (parsedResponse.qualification && typeof parsedResponse.qualification.score === 'number') {
            qualification = {
              score: parsedResponse.qualification.score,
              stage: parsedResponse.qualification.stage || 'warm',
              reasons: parsedResponse.qualification.reasons || []
            };
          }

          // Extrair objeção
          if (parsedResponse.objection?.detected === true) {
            objection = {
              detected: true,
              type: parsedResponse.objection.type || 'unknown',
              text: parsedResponse.objection.text || null,
              severity: parsedResponse.objection.severity || 'medium'
            };
          }

          // Logs detalhados
          console.log(`🎯 Avaliação da IA: objectiveAchieved = ${objectiveAchievedByAI}`);
          if (extractedData) console.log(`📋 Dados extraídos do lead:`, JSON.stringify(extractedData));
          if (qualification) console.log(`⭐ Qualificação: ${qualification.score} (${qualification.stage})`);
          if (objection) console.log(`⚠️ Objeção detectada: ${objection.type} (${objection.severity})`);
        }
      } catch (e) {
        console.log(`⚠️ Resposta não veio em JSON, usando como texto: ${e.message}`);
        messageContent = generatedResponse;
      }
    }

    console.log(`✅ Resposta gerada com sucesso (${messageContent.length} caracteres)`);

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

    // Check if AI response contains [TRANSFER] or [TRANSFER:rule_id] tag
    let aiRequestedTransfer = false;
    let transferRuleIdFromAI = null;
    let cleanedResponse = messageContent;
    const transferMatch = messageContent.match(/\[TRANSFER(?::([a-f0-9-]+))?\]/i);
    if (transferMatch) {
      aiRequestedTransfer = true;
      shouldEscalate = true;
      transferRuleIdFromAI = transferMatch[1] || null;
      escalationReasons.push(transferRuleIdFromAI
        ? `IA detectou gatilho de transferência (regra: ${transferRuleIdFromAI})`
        : 'IA detectou gatilho de transferência');
      cleanedResponse = messageContent.replace(/\[TRANSFER(?::[a-f0-9-]+)?\]/gi, '').trim();
      console.log(`[aiResponseService] IA solicitou transferência via [TRANSFER${transferRuleIdFromAI ? ':' + transferRuleIdFromAI : ''}] tag`);
    }

    // Check if AI indicated step completion
    let stepAdvanced = false;
    let newStep = current_step;
    const conversationSteps = ai_agent.conversation_steps || [];

    // MÉTODO 1: Via JSON estruturado (quando objective_instructions existe)
    console.log(`🔍 [STEP_ADVANCED] objectiveAchievedByAI = ${objectiveAchievedByAI}, has objective_instructions = ${!!ai_agent.objective_instructions}`);
    if (objectiveAchievedByAI) {
      stepAdvanced = true;
      console.log(`📈 IA avaliou objetivo como ATINGIDO via JSON estruturado`);
    }

    // MÉTODO 2: Via token [NEXT_STEP] (fallback para compatibilidade)
    if (!stepAdvanced && cleanedResponse.includes('[NEXT_STEP]')) {
      cleanedResponse = cleanedResponse.replace('[NEXT_STEP]', '').trim();
      stepAdvanced = true;
      console.log(`📈 IA indicou conclusão via [NEXT_STEP] tag`);
    }

    // Aplicar avanço se indicado
    if (stepAdvanced && current_step < conversationSteps.length - 1) {
      newStep = current_step + 1;
      console.log(`📈 Avançando da etapa ${current_step + 1} para ${newStep + 1}`);
    }

    // Verificar se deve oferecer agendamento
    let should_offer_scheduling = false;
    if (ai_agent.auto_schedule && intent && ['interested', 'ready_to_buy', 'asking_details'].includes(intent)) {
      should_offer_scheduling = true;
    }

    console.log(`🚀 [RETURN] step_advanced = ${stepAdvanced}, objectiveAchievedByAI = ${objectiveAchievedByAI}`);

    return {
      response: cleanedResponse,
      intent,
      sentiment: sentimentResult.sentiment,
      sentimentConfidence: sentimentResult.confidence,
      shouldEscalate,
      escalationReasons,
      matchedKeywords: keywordResult.matchedKeywords,
      aiRequestedTransfer,
      transferRuleIdFromAI,
      should_offer_scheduling,
      scheduling_link: should_offer_scheduling ? ai_agent.scheduling_link : null,
      tokens_used: completion.usage.total_tokens,
      model: completion.model,
      current_step: newStep,
      step_advanced: stepAdvanced,
      // Novos campos enriquecidos
      extractedData,     // Dados extraídos do lead (email, phone, company, etc)
      qualification,     // Score e estágio de qualificação
      objection          // Objeção detectada (type, severity)
    };

  } catch (error) {
    console.error('❌ Erro ao gerar resposta IA:', error);
    throw error;
  }
}

/**
 * Construir system prompt baseado no agente IA
 */
async function buildSystemPrompt({ ai_agent, behavioralProfile, lead_data, knowledgeContext = '', objectionsContext = '', playbookContext = '', profileAnalysisContext = '', currentStep = 0 }) {
  // Parse config JSON (pode vir como string ou objeto)
  const config = typeof ai_agent.config === 'string'
    ? JSON.parse(ai_agent.config || '{}')
    : (ai_agent.config || {});

  // Extrair dados de empresa e produto do config
  const companyInfo = config.company || {};
  const productInfo = config.product || {};

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
    direct_sale: 'Realizar venda direta pelo chat',
    support: 'Prestar suporte ao cliente e resolver dúvidas',
    suporte: 'Prestar suporte ao cliente e resolver dúvidas'
  };

  // Usar customObjective quando objetivo é "other"
  const configObjective = config.objective || ai_agent.objective;
  const customObjective = config.customObjective;
  const objectiveText = configObjective === 'other' && customObjective
    ? customObjective
    : (configObjective
        ? objectiveLabels[configObjective] || configObjective
        : 'Qualificar o lead e identificar oportunidades de negócio');

  // Build conversation steps section with intelligent progression
  let stepsSection = '';

  // Prioridade: Se objective_instructions existe (workflow visual), usa JSON estruturado
  // Isso garante que agentes com workflow visual não usem conversation_steps legado
  if (ai_agent.objective_instructions) {
    stepsSection = `

OBJETIVO DESTA ETAPA:
${ai_agent.objective_instructions}

⚠️ FORMATO DE RESPOSTA (JSON):
{
  "message": "sua resposta para o lead",
  "objectiveAchieved": true/false,
  "extractedData": {
    "email": "email se mencionado ou null",
    "phone": "telefone se mencionado ou null",
    "company": "empresa se mencionada ou null",
    "role": "cargo se mencionado ou null"
  }
}

COMO AVALIAR objectiveAchieved:
- Analise o histórico completo da conversa e as instruções acima
- Se o objetivo descreve algo que VOCÊ (assistente) deveria fazer (ex: se apresentar, explicar o produto) e você JÁ fez isso em mensagens anteriores → TRUE
- Se o objetivo descreve algo que o LEAD deveria fazer (ex: fazer uma pergunta, fornecer um dado) e o lead fez → TRUE
- Se o objetivo envolve uma interação (ex: iniciar conversa) e a interação já aconteceu → TRUE
- Quando objectiveAchieved = true, o campo "message" deve ser VAZIO ("") pois a próxima etapa enviará sua própria mensagem
- Na dúvida, se a essência do objetivo já foi cumprida, defina como TRUE para avançar o fluxo

⚠️ Responda APENAS com o JSON, sem texto adicional.`;
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

  // Build transfer triggers section from centralized transfer rules
  let transferTriggersSection = '';
  try {
    const transferRuleService = require('./transferRuleService');
    transferTriggersSection = await transferRuleService.buildTransferPromptSection(ai_agent.id);
  } catch (err) {
    console.error('[aiResponseService] Error building transfer prompt section:', err.message);
  }

  // Build priority rules section (user-defined behavioral rules)
  // Aceitar regras de config.rules (novo formato) ou ai_agent.priority_rules (legado)
  let priorityRulesSection = '';
  const rulesSource = config.rules || ai_agent.priority_rules || [];

  if (Array.isArray(rulesSource) && rulesSource.length > 0) {
    const rules = rulesSource.map(rule => {
      const prefix = rule.prefix || 'SEMPRE';
      // Aceitar tanto 'instruction' quanto 'text' (frontend usa 'text')
      const instruction = rule.instruction || rule.text || '';
      return `- ${prefix}: ${instruction}`;
    }).filter(r => r !== '- SEMPRE: ').join('\n'); // Filtrar regras vazias

    if (rules) {
      priorityRulesSection = `

REGRAS PRIORITÁRIAS (SIGA RIGOROSAMENTE):
${rules}

IMPORTANTE: Estas regras têm prioridade máxima e devem ser seguidas em todas as interações.`;
    }
  }

  // Build company info section (from config.company)
  let companySection = '';
  const hasCompanyInfo = companyInfo.name || companyInfo.description || companyInfo.website || companyInfo.sector;
  const hasLegacyCompanyInfo = ai_agent.company_description || ai_agent.value_proposition || ai_agent.key_differentiators;

  if (hasCompanyInfo) {
    // Usar dados do novo formato (config.company)
    const companyParts = [];
    if (companyInfo.name) companyParts.push(`Nome: ${companyInfo.name}`);
    if (companyInfo.website) companyParts.push(`Website: ${companyInfo.website}`);
    if (companyInfo.sector) companyParts.push(`Setor: ${companyInfo.sector}`);
    if (companyInfo.description) companyParts.push(`Descrição: ${companyInfo.description}`);
    if (companyInfo.avgTicket) companyParts.push(`Ticket Médio: ${companyInfo.avgTicket}`);
    if (companyInfo.icp) companyParts.push(`Cliente Ideal (ICP): ${companyInfo.icp}`);

    companySection = `

SOBRE A EMPRESA:
${companyParts.join('\n')}`;
  } else if (hasLegacyCompanyInfo) {
    // Fallback para formato legado (colunas diretas)
    companySection = `

SOBRE A EMPRESA:
${ai_agent.company_description ? `Descrição: ${ai_agent.company_description}` : ''}
${ai_agent.value_proposition ? `Proposta de Valor: ${ai_agent.value_proposition}` : ''}
${ai_agent.key_differentiators ? `Diferenciais: ${ai_agent.key_differentiators}` : ''}`;
  }

  // Build product info section (from config.product)
  let productSection = '';
  const hasProductInfo = productInfo.name || productInfo.description || productInfo.benefits?.length || productInfo.differentials?.length;

  if (hasProductInfo) {
    const productParts = [];
    if (productInfo.name) productParts.push(`Nome: ${productInfo.name}`);
    if (productInfo.description) productParts.push(`Descrição: ${productInfo.description}`);
    if (productInfo.benefits?.length) productParts.push(`Benefícios:\n- ${productInfo.benefits.join('\n- ')}`);
    if (productInfo.differentials?.length) productParts.push(`Diferenciais:\n- ${productInfo.differentials.join('\n- ')}`);

    productSection = `

PRODUTO/SERVIÇO:
${productParts.join('\n')}`;
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

  // Build personality section (from config.personality)
  let personalitySection = '';
  const personality = config.personality || [];
  if (personality.length > 0) {
    personalitySection = `

TRAÇOS DE PERSONALIDADE:
Você deve demonstrar os seguintes traços em suas respostas: ${personality.join(', ')}.
Adapte seu tom e linguagem para refletir esses traços de forma natural.`;
  }

  // Build style section based on formality and assertiveness (from config)
  let styleSection = '';
  const formality = config.formality ?? 50;
  const assertiveness = config.assertiveness ?? 50;
  const styleParts = [];

  if (formality < 30) {
    styleParts.push('Use linguagem INFORMAL e descontraída, como uma conversa entre colegas.');
  } else if (formality > 70) {
    styleParts.push('Use linguagem FORMAL e respeitosa, mantendo distância profissional.');
  }

  if (assertiveness < 30) {
    styleParts.push('Seja SUTIL e consultivo, faça perguntas antes de sugerir soluções.');
  } else if (assertiveness > 70) {
    styleParts.push('Seja DIRETO e assertivo, proponha próximos passos claros.');
  }

  if (styleParts.length > 0) {
    styleSection = `

ESTILO DE COMUNICAÇÃO:
${styleParts.join('\n')}`;
  }

  // Build base instructions section (from config.baseInstructions)
  let baseInstructionsSection = '';
  const baseInstructions = config.baseInstructions || ai_agent.description || '';
  if (baseInstructions.trim()) {
    baseInstructionsSection = `

${baseInstructions}`;
  }

  let basePrompt = `Você é ${ai_agent.name}, ${channelContext.agentDescription}
${baseInstructionsSection}

PERFIL COMPORTAMENTAL: ${behavioralProfile.style}
Tom de comunicação: ${behavioralProfile.tone}
Abordagem: ${behavioralProfile.approach}
${personalitySection}
${styleSection}

SEU NEGÓCIO/PRODUTO:
${ai_agent.products_services || 'Não especificado'}
${companySection}
${productSection}
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
${objectionsContext}

${ai_agent.response_style_instructions ? `
INSTRUÇÕES DE ESTILO E COMUNICAÇÃO:
${ai_agent.response_style_instructions}` : ''}
${ai_agent.auto_schedule && ai_agent.scheduling_link ? `
AGENDAMENTO:
Link para agendamento quando apropriado: ${ai_agent.scheduling_link}` : ''}
${languageInstruction}
${ai_agent.objective_instructions ? `

⚠️ INSTRUÇÕES DESTA ETAPA DA CONVERSA:
${ai_agent.objective_instructions}

Siga as instruções acima para esta etapa específica do fluxo.` : ''}`;

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
    const basePrompt = await buildSystemPrompt({
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
