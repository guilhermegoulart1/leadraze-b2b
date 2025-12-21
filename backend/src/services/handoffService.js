/**
 * Handoff Service
 *
 * Manages the handoff process from AI to human agents.
 * Handles:
 * - Deactivating AI for the conversation
 * - Selecting next assignee via rotation
 * - Sending handoff message to lead (if configured)
 * - Creating notifications for the assignee
 */

const db = require('../config/database');
const unipileClient = require('../config/unipile');
const rotationService = require('./rotationService');

/**
 * Execute handoff from AI to human
 * @param {number} conversationId - The conversation ID
 * @param {object} agent - The AI agent configuration
 * @param {string} reason - The reason for handoff ('exchange_limit', 'escalation_sentiment', 'escalation_keyword', 'manual')
 * @returns {Promise<object>}
 */
async function executeHandoff(conversationId, agent, reason) {
  try {
    console.log(`🔄 [HandoffService] Executing handoff for conversation ${conversationId}, reason: ${reason}`);

    // 1. Get conversation details
    const conversationResult = await db.query(`
      SELECT c.*,
             l.name as lead_name, l.id as lead_id,
             la.unipile_account_id,
             la.account_id
      FROM conversations c
      JOIN leads l ON c.lead_id = l.id
      LEFT JOIN linkedin_accounts la ON c.linkedin_account_id = la.id
      WHERE c.id = $1
    `, [conversationId]);

    const conversation = conversationResult.rows[0];

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // 2. Deactivate AI for this conversation
    await db.query(`
      UPDATE conversations
      SET ai_active = false,
          manual_control_taken = true,
          handoff_at = NOW(),
          handoff_reason = $1,
          status = 'manual',
          updated_at = NOW()
      WHERE id = $2
    `, [reason, conversationId]);

    console.log(`✅ [HandoffService] AI deactivated for conversation ${conversationId}`);

    // 3. Select next assignee via rotation (if configured)
    let assignee = null;
    if (agent.id) {
      assignee = await rotationService.getNextAssignee(agent.id);

      if (assignee) {
        // Assign conversation to the user
        await rotationService.recordAssignment(agent.id, assignee.userId, conversationId);
        console.log(`✅ [HandoffService] Conversation assigned to ${assignee.userName}`);
      } else {
        console.log(`⚠️ [HandoffService] No assignees configured for agent ${agent.id}`);
      }
    }

    // 4. Send handoff message to lead (if not silent)
    // Support both old (handoff_silent/handoff_message) and new (transfer_mode/transfer_message) field names
    const isSilent = agent.transfer_mode === 'silent' || agent.handoff_silent;
    const handoffMessage = agent.transfer_message || agent.handoff_message;

    if (!isSilent && handoffMessage) {
      try {
        await sendHandoffMessage(conversation, handoffMessage);
        console.log(`✅ [HandoffService] Handoff message sent to lead`);
      } catch (error) {
        console.error(`⚠️ [HandoffService] Failed to send handoff message:`, error.message);
        // Don't fail the entire handoff if message sending fails
      }
    }

    // 5. Create notification for assignee(s)
    if (agent.notify_on_handoff !== false) {
      await createHandoffNotification(conversation, agent, assignee, reason);
    }

    return {
      success: true,
      conversationId,
      assignee,
      reason,
      messageSent: !isSilent && !!handoffMessage
    };

  } catch (error) {
    console.error(`❌ [HandoffService] Error executing handoff:`, error);
    throw error;
  }
}

/**
 * Send handoff message to the lead via Unipile
 * @param {object} conversation - The conversation object
 * @param {string} message - The handoff message
 */
async function sendHandoffMessage(conversation, message) {
  try {
    // Get the lead's Unipile ID
    const leadResult = await db.query(`
      SELECT unipile_user_id FROM leads WHERE id = $1
    `, [conversation.lead_id]);

    const leadUnipileId = leadResult.rows[0]?.unipile_user_id;

    if (!leadUnipileId || !conversation.unipile_account_id) {
      console.log(`⚠️ [HandoffService] Missing Unipile IDs for handoff message`);
      return;
    }

    // Send message via Unipile
    await unipileClient.messaging.send({
      account_id: conversation.unipile_account_id,
      user_id: leadUnipileId,
      text: message
    });

    // Save the handoff message in the database
    await db.query(`
      INSERT INTO messages (conversation_id, sender_type, content, sent_at)
      VALUES ($1, 'system', $2, NOW())
    `, [conversation.id, message]);

    console.log(`✅ [HandoffService] Handoff message sent and saved`);

  } catch (error) {
    console.error(`❌ [HandoffService] Error sending handoff message:`, error);
    throw error;
  }
}

/**
 * Create notification for the assignee about the handoff
 * @param {object} conversation - The conversation object
 * @param {object} agent - The agent configuration
 * @param {object} assignee - The selected assignee (or null)
 * @param {string} reason - The handoff reason
 */
async function createHandoffNotification(conversation, agent, assignee, reason) {
  try {
    const reasonMessages = {
      'exchange_limit': 'atingiu o limite de trocas',
      'escalation_sentiment': 'detectou sentimento de escalação',
      'escalation_keyword': 'detectou palavra-chave de escalação',
      'manual': 'foi transferida manualmente',
      'trigger_doubt': 'detectou dúvida do lead',
      'trigger_qualified': 'identificou lead qualificado',
      'trigger_price': 'lead perguntou sobre preço',
      'trigger_demo': 'lead solicitou demonstração',
      'trigger_competitor': 'lead mencionou concorrente',
      'trigger_urgency': 'detectou urgência do lead',
      'trigger_frustration': 'detectou frustração do lead',
      'trigger_ai_requested': 'IA identificou necessidade de transferência'
    };

    const reasonText = reasonMessages[reason] || reason;

    // If we have an assignee, notify them specifically
    if (assignee) {
      await db.query(`
        INSERT INTO notifications (
          account_id, user_id, type, title, message,
          conversation_id, lead_id, agent_id, metadata
        ) VALUES ($1, $2, 'handoff', $3, $4, $5, $6, $7, $8)
      `, [
        conversation.account_id,
        assignee.userId,
        'Nova conversa transferida',
        `A conversa com ${conversation.lead_name} ${reasonText} e foi transferida para você.`,
        conversation.id,
        conversation.lead_id,
        agent.id,
        JSON.stringify({
          reason,
          exchange_count: conversation.exchange_count,
          agent_name: agent.name
        })
      ]);

      console.log(`✅ [HandoffService] Notification created for user ${assignee.userId}`);
    } else {
      // If no specific assignee, notify all users of the sector
      if (agent.sector_id) {
        const sectorUsersResult = await db.query(`
          SELECT u.id, u.account_id
          FROM users u
          JOIN user_sectors us ON u.id = us.user_id
          WHERE us.sector_id = $1 AND u.is_active = true
        `, [agent.sector_id]);

        for (const user of sectorUsersResult.rows) {
          await db.query(`
            INSERT INTO notifications (
              account_id, user_id, type, title, message,
              conversation_id, lead_id, agent_id, metadata
            ) VALUES ($1, $2, 'handoff', $3, $4, $5, $6, $7, $8)
          `, [
            user.account_id,
            user.id,
            'Nova conversa transferida',
            `A conversa com ${conversation.lead_name} ${reasonText}.`,
            conversation.id,
            conversation.lead_id,
            agent.id,
            JSON.stringify({
              reason,
              exchange_count: conversation.exchange_count,
              agent_name: agent.name
            })
          ]);
        }

        console.log(`✅ [HandoffService] Notifications created for ${sectorUsersResult.rows.length} sector users`);
      }
    }

  } catch (error) {
    console.error(`❌ [HandoffService] Error creating notification:`, error);
    // Don't throw - notification failure shouldn't fail the handoff
  }
}

/**
 * Check if conversation should trigger handoff based on exchange count
 * @param {number} conversationId - The conversation ID
 * @param {number} limit - The exchange limit for handoff
 * @returns {Promise<boolean>}
 * @deprecated Use checkTransferTriggers instead
 */
async function shouldTriggerHandoff(conversationId, limit) {
  if (!limit || limit <= 0) {
    return false;
  }

  const result = await db.query(`
    SELECT exchange_count FROM conversations WHERE id = $1
  `, [conversationId]);

  const exchangeCount = result.rows[0]?.exchange_count || 0;

  return exchangeCount >= limit;
}

/**
 * Transfer trigger definitions with keywords and sentiment indicators
 */
const TRANSFER_TRIGGER_DEFINITIONS = {
  doubt: {
    keywords: ['não entendi', 'como funciona', 'dúvida', 'não sei', 'pode explicar', 'confuso', 'complexo'],
    sentiment: 'confusion'
  },
  qualified: {
    keywords: ['interessado', 'quero saber mais', 'me conta mais', 'parece bom', 'gostei', 'vamos conversar'],
    sentiment: 'high_interest'
  },
  price: {
    keywords: ['preço', 'quanto custa', 'valor', 'investimento', 'custo', 'orçamento', 'budget', 'pricing', 'planos']
  },
  demo: {
    keywords: ['demo', 'demonstração', 'apresentação', 'mostrar', 'ver funcionando', 'teste', 'trial', 'experimentar']
  },
  competitor: {
    keywords: ['concorrente', 'outra empresa', 'já uso', 'comparar', 'diferença entre', 'vs', 'versus']
  },
  urgency: {
    keywords: ['urgente', 'preciso agora', 'rápido', 'prazo', 'deadline', 'imediato', 'hoje', 'amanhã'],
    sentiment: 'urgency'
  },
  frustration: {
    keywords: ['frustrado', 'irritado', 'problema', 'não funciona', 'péssimo', 'horrível', 'decepcionado', 'cansado'],
    sentiment: 'frustration'
  }
};

/**
 * Check if a message should trigger handoff based on agent's transfer triggers
 * @param {string} message - The lead's message content
 * @param {object} agent - The AI agent configuration (must have transfer_triggers array)
 * @returns {object} { shouldTransfer: boolean, matchedTriggers: string[], reason: string }
 */
function checkTransferTriggers(message, agent) {
  const transferTriggers = agent.transfer_triggers || [];

  if (!transferTriggers.length || !message) {
    return { shouldTransfer: false, matchedTriggers: [], reason: null };
  }

  const messageLower = message.toLowerCase();
  const matchedTriggers = [];

  for (const triggerId of transferTriggers) {
    const trigger = TRANSFER_TRIGGER_DEFINITIONS[triggerId];
    if (!trigger) continue;

    // Check keywords
    if (trigger.keywords && trigger.keywords.some(keyword => messageLower.includes(keyword.toLowerCase()))) {
      matchedTriggers.push(triggerId);
    }
  }

  if (matchedTriggers.length > 0) {
    const reasonMap = {
      doubt: 'dúvida detectada',
      qualified: 'lead qualificado',
      price: 'pergunta sobre preço',
      demo: 'solicitação de demo',
      competitor: 'menção a concorrente',
      urgency: 'urgência detectada',
      frustration: 'frustração detectada'
    };

    const reasons = matchedTriggers.map(t => reasonMap[t] || t);

    return {
      shouldTransfer: true,
      matchedTriggers,
      reason: `trigger_${matchedTriggers[0]}`, // Primary reason for database
      reasonText: reasons.join(', ')
    };
  }

  return { shouldTransfer: false, matchedTriggers: [], reason: null };
}

/**
 * Increment the exchange count for a conversation
 * Called after AI responds to a lead message
 * @param {number} conversationId - The conversation ID
 * @returns {Promise<number>} The new exchange count
 */
async function incrementExchangeCount(conversationId) {
  const result = await db.query(`
    UPDATE conversations
    SET exchange_count = COALESCE(exchange_count, 0) + 1,
        updated_at = NOW()
    WHERE id = $1
    RETURNING exchange_count
  `, [conversationId]);

  const newCount = result.rows[0]?.exchange_count || 0;
  console.log(`📊 [HandoffService] Exchange count for conversation ${conversationId}: ${newCount}`);

  return newCount;
}

/**
 * Get handoff statistics for an agent
 * @param {number} agentId - The agent ID
 * @returns {Promise<object>}
 */
async function getHandoffStats(agentId) {
  const result = await db.query(`
    SELECT
      COUNT(*) as total_handoffs,
      COUNT(CASE WHEN handoff_reason = 'exchange_limit' THEN 1 END) as exchange_limit_handoffs,
      COUNT(CASE WHEN handoff_reason = 'escalation_sentiment' THEN 1 END) as sentiment_handoffs,
      COUNT(CASE WHEN handoff_reason = 'escalation_keyword' THEN 1 END) as keyword_handoffs,
      COUNT(CASE WHEN handoff_reason = 'manual' THEN 1 END) as manual_handoffs,
      AVG(exchange_count) as avg_exchanges_before_handoff
    FROM conversations
    WHERE ai_agent_id = $1 AND handoff_at IS NOT NULL
  `, [agentId]);

  return result.rows[0];
}

module.exports = {
  executeHandoff,
  sendHandoffMessage,
  createHandoffNotification,
  shouldTriggerHandoff,
  checkTransferTriggers,
  incrementExchangeCount,
  getHandoffStats,
  TRANSFER_TRIGGER_DEFINITIONS
};
