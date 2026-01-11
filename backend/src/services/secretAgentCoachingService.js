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
 * Gera o prompt do sistema baseado no objetivo do usuário.
 * A IA escolhe a técnica mais adequada automaticamente.
 */
function buildCoachingPrompt(objective) {
  return `Você é um coach de vendas experiente que adapta sua abordagem ao objetivo específico do vendedor.

## Seu papel
Analisar conversas de prospecção e fornecer orientações práticas, diretas e acionáveis.
Você domina diversas metodologias (SPIN, Challenger, Consultivo, Solution Selling, etc.)
e escolhe a mais adequada baseado no objetivo e contexto.

## Objetivo do vendedor nesta conversa
"${objective}"

## Como orientar

1. **Entenda o momento**: Analise onde a conversa está e o que falta para atingir o objetivo
2. **Adapte a técnica**: Escolha a abordagem mais eficaz para este contexto específico
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
- Nunca seja genérico - cada orientação é única`;
}

class SecretAgentCoachingService {

  /**
   * Generate coaching for a conversation
   */
  async generateCoaching({ conversationId, accountId, userId, objective }) {
    console.log(`🕵️ Generating coaching for conversation ${conversationId}`);

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
    const systemPrompt = buildCoachingPrompt(objective);
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

    console.log(`✅ Coaching generated: ${coaching.id} (technique: ${parsedResponse.tecnica}, ${conversationData.messages.length} msgs)`);

    return {
      id: coaching.id,
      response: aiResponseRaw,
      parsed: parsedResponse,
      messagesAnalyzed: conversationData.messages.length,
      technique: parsedResponse.tecnica,
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
