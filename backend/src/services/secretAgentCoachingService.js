/**
 * Secret Agent Coaching Service
 *
 * Uses Gemini AI to analyze conversations and provide sales coaching
 * based on SPIN Selling methodology.
 *
 * SPIN Selling:
 * - S (Situation): Questions to understand the client's context
 * - P (Problem): Questions to identify pain points and challenges
 * - I (Implication): Questions about consequences of problems
 * - N (Need-payoff): Questions that lead to perceived value
 */

const { geminiService } = require('../config/gemini');
const db = require('../config/database');

const SYSTEM_PROMPT = `Você é um coach de vendas especialista em SPIN Selling e técnicas de persuasão.
Sua missão é analisar conversas de prospecção e fornecer orientações práticas, diretas e acionáveis.

## SPIN Selling - Metodologia

**S (Situação)**: Perguntas para entender o contexto atual do cliente
- "Como funciona seu processo atual de X?"
- "Qual ferramenta vocês usam hoje?"

**P (Problema)**: Perguntas para identificar dores e desafios
- "Quais dificuldades você enfrenta com isso?"
- "O que mais te incomoda nesse processo?"

**I (Implicação)**: Perguntas sobre as consequências dos problemas
- "Como isso impacta seus resultados?"
- "Quanto tempo/dinheiro você perde com isso?"

**N (Necessidade de solução)**: Perguntas que levam à percepção de valor
- "Se pudesse resolver isso, o que mudaria?"
- "Imagina economizar X horas por semana?"

## Regras para suas orientações

1. Seja ESPECÍFICO - use nomes, dados e contexto da conversa
2. Dê FRASES PRONTAS que o vendedor pode copiar e usar
3. Identifique em que fase SPIN a conversa está
4. Sugira a PRÓXIMA FASE do SPIN para avançar
5. Seja conciso - máximo 400 palavras
6. Use formatação markdown para facilitar leitura
7. Nunca seja genérico - cada orientação deve ser única para esta conversa

## Formato da resposta

**📊 Análise da Situação**
[2-3 frases sobre onde está a conversa]

**🎯 Fase SPIN Atual**: [Situação/Problema/Implicação/Necessidade]

**⚠️ Pontos de Atenção**
- [Bullet point 1]
- [Bullet point 2]

**💬 Sugestões de Mensagem**
\`\`\`
[Mensagem pronta para enviar - adaptada ao contexto]
\`\`\`

**📋 Próximos Passos**
1. [Ação concreta 1]
2. [Ação concreta 2]

---
Analise a conversa abaixo e forneça orientações específicas.`;

class SecretAgentCoachingService {

  /**
   * Generate coaching for a conversation
   * @param {Object} params
   * @param {string} params.conversationId - Conversation ID
   * @param {string} params.accountId - Account ID
   * @param {string} params.userId - User ID
   * @param {string} params.objective - User's objective
   * @param {string} params.productId - Optional product ID
   * @param {string} params.difficulties - Optional difficulties description
   * @returns {Object} Coaching result
   */
  async generateCoaching({ conversationId, accountId, userId, objective, productId, difficulties }) {
    console.log(`🕵️ Generating coaching for conversation ${conversationId}`);

    // Check if Gemini is configured
    if (!geminiService.isConfigured()) {
      throw new Error('Gemini API not configured. Please set GEMINI_API_KEY.');
    }

    // Get conversation context
    const conversationData = await this.getConversationContext(conversationId, accountId);

    if (!conversationData) {
      throw new Error('Conversation not found');
    }

    // Get product info if provided
    let productInfo = null;
    if (productId) {
      const productResult = await db.query(
        `SELECT name, description, default_price FROM products WHERE id = $1 AND account_id = $2`,
        [productId, accountId]
      );
      if (productResult.rows.length > 0) {
        productInfo = productResult.rows[0];
      }
    }

    // Build user prompt
    const userPrompt = this.buildPrompt(conversationData, objective, productInfo, difficulties);

    // Generate coaching with Gemini
    const aiResponse = await geminiService.generateText(SYSTEM_PROMPT, userPrompt, {
      temperature: 0.7,
      maxTokens: 1500
    });

    // Identify SPIN techniques used (basic detection)
    const spinTechniques = this.detectSpinTechniques(aiResponse);

    // Save coaching to database
    const coaching = await this.saveCoaching({
      accountId,
      conversationId,
      userId,
      objective,
      productId,
      difficulties,
      messagesAnalyzed: conversationData.messages.length,
      aiResponse,
      spinTechniques
    });

    console.log(`✅ Coaching generated: ${coaching.id}`);

    return {
      id: coaching.id,
      response: aiResponse,
      messagesAnalyzed: conversationData.messages.length,
      spinTechniques,
      createdAt: coaching.created_at
    };
  }

  /**
   * Get conversation context (last 30 messages)
   */
  async getConversationContext(conversationId, accountId) {
    // Get conversation with lead info
    const convResult = await db.query(
      `SELECT
        c.*,
        l.name as lead_name,
        l.company,
        l.title,
        l.headline
       FROM conversations c
       LEFT JOIN leads l ON c.lead_id = l.id
       WHERE c.id = $1 AND c.account_id = $2`,
      [conversationId, accountId]
    );

    if (convResult.rows.length === 0) {
      return null;
    }

    const conversation = convResult.rows[0];

    // Get last 30 messages
    const messagesResult = await db.query(
      `SELECT
        sender_type,
        content,
        sent_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY sent_at DESC
       LIMIT 30`,
      [conversationId]
    );

    // Reverse to get chronological order
    const messages = messagesResult.rows.reverse();

    return {
      conversation,
      messages,
      leadName: conversation.lead_name || 'Lead',
      company: conversation.company,
      title: conversation.title || conversation.headline
    };
  }

  /**
   * Build the prompt for Gemini
   */
  buildPrompt(conversationData, objective, productInfo, difficulties) {
    const { leadName, company, title, messages } = conversationData;

    let prompt = `## Contexto do Lead\n`;
    prompt += `- **Nome**: ${leadName}\n`;
    if (company) prompt += `- **Empresa**: ${company}\n`;
    if (title) prompt += `- **Cargo**: ${title}\n`;
    prompt += `\n`;

    prompt += `## Objetivo do Vendedor\n`;
    prompt += `${objective}\n\n`;

    if (productInfo) {
      prompt += `## Produto/Serviço em Foco\n`;
      prompt += `- **Nome**: ${productInfo.name}\n`;
      if (productInfo.description) prompt += `- **Descrição**: ${productInfo.description}\n`;
      if (productInfo.default_price) prompt += `- **Valor**: R$ ${productInfo.default_price}\n`;
      prompt += `\n`;
    }

    if (difficulties) {
      prompt += `## Dificuldades Relatadas pelo Vendedor\n`;
      prompt += `${difficulties}\n\n`;
    }

    prompt += `## Histórico da Conversa (${messages.length} mensagens)\n\n`;

    for (const msg of messages) {
      const sender = msg.sender_type === 'user' ? '🟣 Vendedor' :
                     msg.sender_type === 'lead' ? '🟢 Lead' :
                     '⚙️ Sistema';

      // Truncate very long messages
      const content = msg.content.length > 500
        ? msg.content.substring(0, 500) + '...'
        : msg.content;

      prompt += `**${sender}**: ${content}\n\n`;
    }

    return prompt;
  }

  /**
   * Detect SPIN techniques mentioned in the response
   */
  detectSpinTechniques(response) {
    const techniques = {
      situation: false,
      problem: false,
      implication: false,
      needPayoff: false
    };

    const lowerResponse = response.toLowerCase();

    if (lowerResponse.includes('situação') || lowerResponse.includes('contexto') || lowerResponse.includes('situation')) {
      techniques.situation = true;
    }
    if (lowerResponse.includes('problema') || lowerResponse.includes('dor') || lowerResponse.includes('desafio') || lowerResponse.includes('problem')) {
      techniques.problem = true;
    }
    if (lowerResponse.includes('implicação') || lowerResponse.includes('consequência') || lowerResponse.includes('impacto') || lowerResponse.includes('implication')) {
      techniques.implication = true;
    }
    if (lowerResponse.includes('necessidade') || lowerResponse.includes('benefício') || lowerResponse.includes('solução') || lowerResponse.includes('need')) {
      techniques.needPayoff = true;
    }

    return techniques;
  }

  /**
   * Save coaching to database
   */
  async saveCoaching({ accountId, conversationId, userId, objective, productId, difficulties, messagesAnalyzed, aiResponse, spinTechniques }) {
    const result = await db.query(
      `INSERT INTO secret_agent_coaching (
        account_id, conversation_id, user_id, objective, product_id,
        difficulties, messages_analyzed, ai_response, spin_techniques_used
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        accountId,
        conversationId,
        userId,
        objective,
        productId || null,
        difficulties || null,
        messagesAnalyzed,
        aiResponse,
        JSON.stringify(spinTechniques)
      ]
    );

    return result.rows[0];
  }

  /**
   * Get coaching history for a conversation
   */
  async getCoachingHistory(conversationId, accountId, limit = 10) {
    const result = await db.query(
      `SELECT
        sac.*,
        p.name as product_name
       FROM secret_agent_coaching sac
       LEFT JOIN products p ON sac.product_id = p.id
       WHERE sac.conversation_id = $1 AND sac.account_id = $2
       ORDER BY sac.created_at DESC
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
      `SELECT
        sac.*,
        p.name as product_name
       FROM secret_agent_coaching sac
       LEFT JOIN products p ON sac.product_id = p.id
       WHERE sac.conversation_id = $1 AND sac.account_id = $2
       ORDER BY sac.created_at DESC
       LIMIT 1`,
      [conversationId, accountId]
    );

    return result.rows[0] || null;
  }
}

module.exports = new SecretAgentCoachingService();
