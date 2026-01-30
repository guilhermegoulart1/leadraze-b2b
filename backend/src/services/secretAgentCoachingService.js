/**
 * Secret Agent Coaching Service
 *
 * Uses GPT-4o-mini to analyze conversations and provide sales coaching.
 * Fetches messages from Unipile API for accurate analysis.
 */

const OpenAI = require('openai');
const db = require('../config/database');
const unipileClient = require('../config/unipile');

// Inicializar cliente OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Configuração dos Agentes de Análise
 * Cada agente tem uma personalidade e foco específico
 */
const AGENT_CONFIGS = {
  diagnostico: {
    id: 'diagnostico',
    name: 'Dr. James',
    title: 'Consultor Chefe de Vendas',
    focus: 'diagnosticar a conversa e recomendar a melhor estratégia',
    description: 'Diretor de vendas com 20 anos de experiência. Analisa a conversa e recomenda qual especialista chamar.',
    color: 'indigo',
    image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&crop=face',
    greeting: 'Deixa eu analisar essa conversa e te dar um diagnóstico completo!',
    placeholder: 'Deixe em branco para análise automática ou descreva seu desafio específico...',
    isChief: true,
    systemPrompt: `Você é Dr. James, um Consultor Chefe de Vendas com 20 anos de experiência liderando times comerciais de alta performance.

## Sua personalidade
- Estratégico e analítico
- Vê o quadro completo da negociação
- Identifica rapidamente o que está faltando
- Sabe exatamente qual abordagem usar em cada momento

## Seu papel especial
Você é o PRIMEIRO a ser consultado. Sua função é:
1. Diagnosticar o estado atual da conversa
2. Identificar o que está travando a negociação
3. Recomendar qual especialista o vendedor deveria consultar

## Os especialistas do seu time
- **Sarah (Closer)**: Para quando está na hora de fechar
- **Alex (Objeções)**: Para quando há resistência ou "não"
- **Emma (Relacionamento)**: Para quando falta conexão
- **Nathan (Discovery)**: Para quando precisa entender melhor o lead
- **Olivia (Reengajamento)**: Para quando a conversa esfriou

## Formato da resposta (JSON)

Responda APENAS com JSON válido:
{
  "diagnostico": "Análise detalhada do estado da conversa em 3-4 frases",
  "estagio_venda": "prospeccao|qualificacao|apresentacao|negociacao|fechamento|pos_venda",
  "temperatura_lead": "frio|morno|quente|muito_quente",
  "principal_bloqueio": "O que está impedindo o avanço",
  "especialista_recomendado": {
    "id": "id do especialista recomendado (closer, objections, relationship, discovery, reengagement)",
    "nome": "Nome do especialista",
    "motivo": "Por que este especialista é o ideal agora"
  },
  "acao_imediata": "Uma ação específica que o vendedor deve tomar agora",
  "risco_identificado": "Principal risco se não agir",
  "potencial_fechamento": "baixo|medio|alto"
}`
  },

  closer: {
    id: 'closer',
    name: 'Sarah',
    title: 'Closer Expert',
    focus: 'fechar negócios e converter oportunidades',
    description: 'Especialista em fechamento. Direta, focada em resultados, identifica o momento certo para fechar.',
    color: 'purple',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=face',
    greeting: 'Vou te ajudar a fechar esse deal!',
    placeholder: 'Ex: Quero agendar uma reunião de fechamento, Preciso apresentar a proposta final...',
    systemPrompt: `Você é Sarah, uma especialista em fechamento de vendas com anos de experiência convertendo oportunidades em negócios fechados.

## Sua personalidade
- Direta e objetiva, sem rodeios
- Focada em resultados mensuráveis
- Identifica sinais de compra e o momento certo de fechar
- Usa técnicas como assumptive close, urgência e scarcity quando apropriado

## Seu foco
Ajudar o vendedor a identificar o momento de fechar e guiá-lo com técnicas eficazes de fechamento.`
  },

  objections: {
    id: 'objections',
    name: 'Alex',
    title: 'Especialista em Objeções',
    focus: 'contornar objeções e resistências',
    description: 'Expert em transformar "não" em "talvez" e "talvez" em "sim". Empático e persuasivo.',
    color: 'blue',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
    greeting: 'Vamos transformar essas objeções em oportunidades!',
    placeholder: 'Ex: O lead disse que está caro, Ele disse que precisa pensar, Falou que já usa concorrente...',
    systemPrompt: `Você é Alex, um especialista em contornar objeções de vendas com uma abordagem empática e persuasiva.

## Sua personalidade
- Empático e bom ouvinte
- Nunca confronta diretamente, redireciona
- Transforma objeções em perguntas exploratórias
- Usa técnicas como feel-felt-found, isolamento de objeção, e reframe

## Seu foco
Ajudar o vendedor a entender a real objeção por trás das palavras e fornecer respostas que transformem resistência em interesse.`
  },

  relationship: {
    id: 'relationship',
    name: 'Emma',
    title: 'Construtora de Relacionamentos',
    focus: 'construir rapport e conexão genuína',
    description: 'Especialista em criar conexões humanas. Calorosa, atenciosa, foca no relacionamento antes da venda.',
    color: 'pink',
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face',
    greeting: 'Vamos construir uma conexão genuína com esse lead!',
    placeholder: 'Ex: Quero criar rapport, Preciso me conectar melhor com o lead, Como gerar confiança...',
    systemPrompt: `Você é Emma, uma especialista em construir relacionamentos e rapport em vendas consultivas.

## Sua personalidade
- Calorosa e genuinamente interessada nas pessoas
- Excelente em encontrar pontos em comum
- Foca na conexão humana antes da venda
- Usa técnicas de espelhamento, interesses compartilhados e vulnerabilidade estratégica

## Seu foco
Ajudar o vendedor a criar uma conexão autêntica com o lead, gerando confiança e abertura para conversas futuras.`
  },

  discovery: {
    id: 'discovery',
    name: 'Nathan',
    title: 'Mestre em Discovery',
    focus: 'descobrir necessidades e dores ocultas',
    description: 'Expert em fazer as perguntas certas. Curioso, analítico, descobre o que o cliente realmente precisa.',
    color: 'green',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
    greeting: 'Vamos descobrir as dores reais desse lead!',
    placeholder: 'Ex: Quero entender as dores dele, Preciso qualificar melhor, Quero fazer discovery...',
    systemPrompt: `Você é Nathan, um mestre em discovery e qualificação de leads usando metodologias como SPIN e MEDDIC.

## Sua personalidade
- Curioso e investigativo
- Faz perguntas que revelam necessidades ocultas
- Nunca assume, sempre valida
- Usa perguntas situacionais, de problema, implicação e necessidade de solução

## Seu foco
Ajudar o vendedor a fazer as perguntas certas para entender profundamente as dores, necessidades e motivações do lead.`
  },

  reengagement: {
    id: 'reengagement',
    name: 'Olivia',
    title: 'Especialista em Reengajamento',
    focus: 'recuperar leads frios e reativar conversas',
    description: 'Expert em dar vida nova a conversas paradas. Persistente, criativa, nunca desiste de um lead.',
    color: 'orange',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face',
    greeting: 'Vamos trazer esse lead de volta à vida!',
    placeholder: 'Ex: Lead sumiu há 2 semanas, Conversa esfriou, Como retomar contato...',
    systemPrompt: `Você é Olivia, uma especialista em reengajar leads frios e recuperar conversas que parecem perdidas.

## Sua personalidade
- Persistente sem ser inconveniente
- Criativa em encontrar novos ângulos
- Usa timing e contexto a seu favor
- Emprega gatilhos de novidade, urgência suave e valor agregado

## Seu foco
Ajudar o vendedor a reengajar leads que esfriaram, com abordagens criativas que reacendem o interesse.`
  }
};

// Agente padrão - agora é o diagnóstico para análise inicial
const DEFAULT_AGENT = 'diagnostico';

// Mapeamento de idiomas para instruções
const LANGUAGE_INSTRUCTIONS = {
  pt: 'Responda SEMPRE em português brasileiro.',
  en: 'ALWAYS respond in English.',
  es: 'Responde SIEMPRE en español.'
};

/**
 * Gera o prompt do sistema baseado no agente, objetivo e idioma do usuário.
 */
function buildCoachingPrompt(objective, agentType = DEFAULT_AGENT, language = 'pt') {
  const agent = AGENT_CONFIGS[agentType] || AGENT_CONFIGS[DEFAULT_AGENT];
  const languageInstruction = LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS.pt;

  // O agente de diagnóstico tem seu próprio formato completo de resposta
  if (agent.isChief) {
    return `${agent.systemPrompt}

## IDIOMA OBRIGATÓRIO
${languageInstruction}

${objective ? `## Contexto adicional do vendedor\n"${objective}"` : '## Análise solicitada\nFaça uma análise completa da conversa e recomende o próximo passo.'}

## Regras
- Seja ESPECÍFICO usando nomes e dados da conversa
- Identifique sinais sutis de interesse ou desinteresse
- Sua recomendação de especialista deve ser precisa
- Nunca seja genérico - cada diagnóstico é único
- ${languageInstruction}`;
  }

  // Agentes especialistas usam o formato padrão
  return `${agent.systemPrompt}

## IDIOMA OBRIGATÓRIO
${languageInstruction}

## Objetivo do vendedor nesta conversa
"${objective}"

## Como orientar

1. **Entenda o momento**: Analise onde a conversa está e o que falta para atingir o objetivo
2. **Use sua especialidade**: Aplique seu conhecimento em ${agent.focus}
3. **Seja prático**: Dê sugestões de mensagens que o vendedor possa usar imediatamente
4. **Identifique riscos**: Aponte sinais de objeção, desinteresse ou oportunidade

## Formato da resposta (JSON)

Responda APENAS com JSON válido, sem markdown ou texto adicional:
{
  "situacao": "Análise em 2-3 frases do estado atual da conversa",
  "tecnica": "Nome da técnica/abordagem recomendada",
  "tecnica_motivo": "Por que esta técnica é ideal para este momento",
  "pontos_atencao": ["Ponto 1", "Ponto 2"],
  "sugestao_mensagem": "Mensagem pronta que o vendedor pode copiar e enviar",
  "proximos_passos": ["Ação 1", "Ação 2", "Ação 3"]
}

## Regras
- Seja ESPECÍFICO usando nomes e dados da conversa
- Máximo 3 pontos de atenção e 3 próximos passos
- A sugestão de mensagem deve ser natural e personalizada
- Mantenha sua personalidade de ${agent.name} em todas as orientações
- Nunca seja genérico - cada orientação é única
- ${languageInstruction}`;
}

class SecretAgentCoachingService {

  /**
   * Get all available agents
   * Returns chief agent first, then specialists
   */
  getAgents() {
    const agents = Object.values(AGENT_CONFIGS).map(agent => ({
      id: agent.id,
      name: agent.name,
      title: agent.title,
      focus: agent.focus,
      description: agent.description,
      color: agent.color,
      image: agent.image,
      greeting: agent.greeting,
      placeholder: agent.placeholder,
      isChief: agent.isChief || false
    }));

    // Retorna o chefe primeiro, depois os especialistas
    return agents.sort((a, b) => {
      if (a.isChief && !b.isChief) return -1;
      if (!a.isChief && b.isChief) return 1;
      return 0;
    });
  }

  /**
   * Get only specialist agents (excludes chief)
   */
  getSpecialists() {
    return Object.values(AGENT_CONFIGS)
      .filter(agent => !agent.isChief)
      .map(agent => ({
        id: agent.id,
        name: agent.name,
        title: agent.title,
        focus: agent.focus,
        description: agent.description,
        color: agent.color,
        image: agent.image,
        greeting: agent.greeting,
        placeholder: agent.placeholder
      }));
  }

  /**
   * Get a specific agent by ID
   */
  getAgent(agentId) {
    const agent = AGENT_CONFIGS[agentId];
    if (!agent) return null;
    return {
      id: agent.id,
      name: agent.name,
      title: agent.title,
      focus: agent.focus,
      description: agent.description,
      color: agent.color,
      image: agent.image,
      greeting: agent.greeting,
      placeholder: agent.placeholder,
      isChief: agent.isChief || false
    };
  }

  /**
   * Generate coaching for a conversation
   */
  async generateCoaching({ conversationId, accountId, userId, objective, agentType = DEFAULT_AGENT, language = 'pt' }) {
    const agent = AGENT_CONFIGS[agentType] || AGENT_CONFIGS[DEFAULT_AGENT];
    console.log(`🕵️ Generating coaching with agent ${agent.name} for conversation ${conversationId} (language: ${language})`);

    if (!objective || !objective.trim()) {
      throw new Error('Objetivo é obrigatório para gerar coaching');
    }

    // Get conversation context with messages from Unipile
    const conversationData = await this.getConversationContext(conversationId, accountId);

    if (!conversationData) {
      throw new Error('Conversation not found');
    }

    if (conversationData.messages.length === 0) {
      throw new Error('Nenhuma mensagem encontrada nesta conversa');
    }

    // Build prompts
    const systemPrompt = buildCoachingPrompt(objective, agentType, language);
    const userPrompt = this.buildPrompt(conversationData, objective);

    console.log(`📝 Analisando ${conversationData.messages.length} mensagens...`);

    // Generate coaching with GPT-4o-mini
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const aiResponseRaw = completion.choices[0].message.content.trim();

    // Parse JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponseRaw);
    } catch (e) {
      console.error('Failed to parse coaching response:', e);
      parsedResponse = {
        situacao: 'Não foi possível analisar a conversa.',
        tecnica: 'Consultivo',
        tecnica_motivo: 'Abordagem padrão',
        pontos_atencao: [],
        sugestao_mensagem: '',
        proximos_passos: ['Revisar o objetivo e tentar novamente']
      };
    }

    // Save coaching to database
    const coaching = await this.saveCoaching({
      accountId,
      conversationId,
      userId,
      objective,
      messagesAnalyzed: conversationData.messages.length,
      aiResponse: aiResponseRaw,
      parsedResponse
    });

    console.log(`✅ Coaching generated: ${coaching.id} (agent: ${agent.name}, technique: ${parsedResponse.tecnica}, ${conversationData.messages.length} msgs)`);

    return {
      id: coaching.id,
      response: aiResponseRaw,
      parsed: parsedResponse,
      messagesAnalyzed: conversationData.messages.length,
      technique: parsedResponse.tecnica,
      agent: {
        id: agent.id,
        name: agent.name,
        title: agent.title,
        color: agent.color
      },
      createdAt: coaching.created_at
    };
  }

  /**
   * Get conversation context with messages from Unipile
   */
  async getConversationContext(conversationId, accountId) {
    // Get conversation with contact info AND linkedin_accounts for Unipile data
    const convResult = await db.query(
      `SELECT
        c.*,
        la.unipile_account_id,
        la.channel_identifier as own_number,
        la.provider_type as channel_provider_type,
        COALESCE(ct.linkedin_profile_id, opp_contact.linkedin_profile_id) as provider_id,
        COALESCE(ct.name, opp_contact.name) as lead_name,
        COALESCE(ct.company, opp_contact.company) as company,
        COALESCE(ct.title, opp_contact.title) as title,
        COALESCE(ct.headline, opp_contact.headline) as headline,
        COALESCE(ct.ai_profile_analysis, opp_contact.ai_profile_analysis) as ai_profile_analysis
       FROM conversations c
       INNER JOIN linkedin_accounts la ON c.linkedin_account_id = la.id
       LEFT JOIN contacts ct ON c.contact_id = ct.id
       LEFT JOIN opportunities opp ON c.opportunity_id = opp.id
       LEFT JOIN contacts opp_contact ON opp.contact_id = opp_contact.id
       WHERE c.id = $1 AND c.account_id = $2`,
      [conversationId, accountId]
    );

    if (convResult.rows.length === 0) {
      return null;
    }

    const conversation = convResult.rows[0];

    // Fetch messages from Unipile API
    let messages = [];

    console.log(`🔍 Conversa ${conversationId}:`, {
      unipile_account_id: conversation.unipile_account_id,
      unipile_chat_id: conversation.unipile_chat_id,
      channel_provider_type: conversation.channel_provider_type
    });

    if (conversation.unipile_account_id && conversation.unipile_chat_id) {
      try {
        console.log(`📡 Buscando mensagens da Unipile (chat: ${conversation.unipile_chat_id})...`);

        const unipileMessages = await unipileClient.messaging.getMessages({
          account_id: conversation.unipile_account_id,
          chat_id: conversation.unipile_chat_id,
          limit: 50 // Últimas 50 mensagens para análise
        });

        const isLinkedIn = conversation.channel_provider_type === 'LINKEDIN';
        const leadProviderId = conversation.provider_id || '';
        const ownNumberClean = conversation.own_number?.replace(/@s\.whatsapp\.net|@c\.us/gi, '') || '';

        messages = (unipileMessages.items || []).map(msg => {
          let senderType = 'lead';

          // LinkedIn: comparar sender_id
          if (isLinkedIn) {
            const senderProviderId = msg.sender?.attendee_provider_id
              || msg.sender?.provider_id
              || msg.sender_id
              || '';

            if (senderProviderId && leadProviderId) {
              senderType = (senderProviderId === leadProviderId) ? 'lead' : 'user';
            }
            if (msg.sender?.is_self === true) {
              senderType = 'user';
            }
          } else {
            // WhatsApp: usar fromMe
            if (msg.original) {
              try {
                const originalData = typeof msg.original === 'string'
                  ? JSON.parse(msg.original)
                  : msg.original;

                if (originalData?.key?.fromMe !== undefined) {
                  senderType = originalData.key.fromMe ? 'user' : 'lead';
                }
              } catch (e) {}
            }
            // Fallback
            if (msg.sender?.is_self === true) {
              senderType = 'user';
            }
          }

          return {
            sender_type: senderType,
            content: msg.text || msg.body || '[Mídia]',
            sent_at: msg.timestamp || msg.date
          };
        }).reverse(); // Ordem cronológica

        console.log(`✅ ${messages.length} mensagens obtidas da Unipile`);
      } catch (error) {
        console.error('⚠️ Erro ao buscar mensagens da Unipile:', error.message);
        // Fallback para mensagens do banco local
        console.log('📂 Usando mensagens do banco local como fallback...');
        messages = await this.getLocalMessages(conversationId);
      }
    } else {
      // Sem Unipile, usar banco local
      console.log('📂 Conversa sem Unipile, usando banco local...');
      messages = await this.getLocalMessages(conversationId);
    }

    return {
      conversation,
      messages,
      leadName: conversation.lead_name || conversation.lead_display_name || 'Lead',
      company: conversation.company,
      title: conversation.title || conversation.headline,
      aiProfileAnalysis: conversation.ai_profile_analysis
    };
  }

  /**
   * Get messages from local database (fallback)
   */
  async getLocalMessages(conversationId) {
    const messagesResult = await db.query(
      `SELECT
        sender_type,
        content,
        sent_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY sent_at DESC
       LIMIT 50`,
      [conversationId]
    );
    return messagesResult.rows.reverse();
  }

  /**
   * Build the user prompt with conversation context
   */
  buildPrompt(conversationData, objective) {
    const { leadName, company, title, messages, aiProfileAnalysis } = conversationData;

    let prompt = `## Contexto do Lead\n`;
    prompt += `- Nome: ${leadName}\n`;
    if (company) prompt += `- Empresa: ${company}\n`;
    if (title) prompt += `- Cargo: ${title}\n`;
    prompt += `\n`;

    // Incluir análise de IA do perfil se disponível
    if (aiProfileAnalysis) {
      prompt += `## Análise de Perfil (LinkedIn)\n`;
      if (aiProfileAnalysis.summary) {
        prompt += `${aiProfileAnalysis.summary}\n\n`;
      }
      if (aiProfileAnalysis.keyPoints && aiProfileAnalysis.keyPoints.length > 0) {
        prompt += `**Pontos-chave:**\n`;
        for (const point of aiProfileAnalysis.keyPoints) {
          prompt += `- ${point}\n`;
        }
        prompt += `\n`;
      }
      if (aiProfileAnalysis.approachHook) {
        prompt += `**Sugestão de abordagem:** ${aiProfileAnalysis.approachHook}\n\n`;
      }
    }

    prompt += `## Histórico da Conversa (${messages.length} mensagens)\n\n`;

    for (const msg of messages) {
      const sender = msg.sender_type === 'user' ? 'Vendedor' :
                     msg.sender_type === 'lead' ? 'Lead' :
                     'Sistema';

      // Truncate very long messages
      const content = (msg.content || '').length > 500
        ? msg.content.substring(0, 500) + '...'
        : (msg.content || '[sem conteúdo]');

      prompt += `[${sender}]: ${content}\n\n`;
    }

    return prompt;
  }

  /**
   * Save coaching to database
   */
  async saveCoaching({ accountId, conversationId, userId, objective, messagesAnalyzed, aiResponse, parsedResponse }) {
    const result = await db.query(
      `INSERT INTO secret_agent_coaching (
        account_id, conversation_id, user_id, objective,
        messages_analyzed, ai_response, spin_techniques_used
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        accountId,
        conversationId,
        userId,
        objective,
        messagesAnalyzed,
        aiResponse,
        JSON.stringify({ technique: parsedResponse.tecnica })
      ]
    );

    return result.rows[0];
  }

  /**
   * Get coaching history for a conversation
   */
  async getCoachingHistory(conversationId, accountId, limit = 10) {
    const result = await db.query(
      `SELECT *
       FROM secret_agent_coaching
       WHERE conversation_id = $1 AND account_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [conversationId, accountId, limit]
    );

    return result.rows;
  }

  /**
   * Get latest coaching for a conversation
   */
  async getLatestCoaching(conversationId, accountId) {
    const result = await db.query(
      `SELECT *
       FROM secret_agent_coaching
       WHERE conversation_id = $1 AND account_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [conversationId, accountId]
    );

    return result.rows[0] || null;
  }
}

module.exports = new SecretAgentCoachingService();
