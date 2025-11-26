/**
 * Conversation Summary Service
 *
 * Manages progressive summaries for long conversations to optimize AI context and reduce token costs.
 *
 * Strategy:
 * - Keeps last 15-20 messages in full detail (recent context)
 * - Summarizes older messages progressively
 * - Updates summary incrementally as new messages arrive
 * - When summary gets too large (>500 tokens), creates "summary of summary"
 */

const { OpenAI } = require('openai');
const db = require('../config/database');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configuration
const CONFIG = {
  // When to start summarizing
  MIN_MESSAGES_FOR_SUMMARY: 20,

  // How many recent messages to keep in full
  RECENT_MESSAGES_WINDOW: 15,

  // Max tokens for summary before re-summarizing
  MAX_SUMMARY_TOKENS: 500,

  // How often to update summary (in number of new messages)
  UPDATE_FREQUENCY: 5,
};

/**
 * Estimate token count for text (rough approximation)
 * @param {string} text
 * @returns {number} Estimated token count
 */
function estimateTokens(text) {
  if (!text) return 0;
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Check if conversation needs summary update
 * @param {object} conversation - Conversation record
 * @returns {boolean}
 */
function shouldUpdateSummary(conversation) {
  const messagesCount = conversation.messages_count || 0;

  // Don't summarize short conversations
  if (messagesCount < CONFIG.MIN_MESSAGES_FOR_SUMMARY) {
    return false;
  }

  // No summary yet - needs initial summary
  if (!conversation.context_summary) {
    return true;
  }

  // Count messages since last summary
  // (messages_count is total, we update every N messages)
  const messagesSinceLastUpdate = messagesCount % CONFIG.UPDATE_FREQUENCY;

  return messagesSinceLastUpdate === 0;
}

/**
 * Get messages for a conversation
 * @param {string} conversationId
 * @param {number} limit - Max messages to fetch
 * @param {string} beforeMessageId - Get messages before this ID
 * @returns {Promise<Array>}
 */
async function getMessages(conversationId, limit = 100, beforeMessageId = null) {
  let query = `
    SELECT id, sender_type, content, sent_at, ai_intent
    FROM messages
    WHERE conversation_id = $1
  `;

  const params = [conversationId];

  if (beforeMessageId) {
    query += ` AND sent_at < (SELECT sent_at FROM messages WHERE id = $2)`;
    params.push(beforeMessageId);
  }

  query += ` ORDER BY sent_at ASC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Format messages for summary prompt
 * @param {Array} messages
 * @returns {string}
 */
function formatMessagesForSummary(messages) {
  return messages.map((msg, idx) => {
    const sender = msg.sender_type === 'lead' ? 'Lead' :
                   msg.sender_type === 'ai' ? 'AI' : 'User';
    const intent = msg.ai_intent ? ` [${msg.ai_intent}]` : '';
    return `${idx + 1}. ${sender}${intent}: ${msg.content}`;
  }).join('\n');
}

/**
 * Generate initial summary for a conversation
 * @param {string} conversationId
 * @returns {Promise<object>} Summary data
 */
async function generateInitialSummary(conversationId) {
  console.log(`📝 Generating initial summary for conversation ${conversationId}`);

  // Get all messages except the most recent ones
  const allMessages = await getMessages(conversationId);

  if (allMessages.length < CONFIG.MIN_MESSAGES_FOR_SUMMARY) {
    console.log(`⏭️  Too few messages (${allMessages.length}), skipping summary`);
    return null;
  }

  // Messages to summarize (all except recent window)
  const messagesToSummarize = allMessages.slice(0, -CONFIG.RECENT_MESSAGES_WINDOW);

  if (messagesToSummarize.length === 0) {
    console.log(`⏭️  No messages to summarize yet`);
    return null;
  }

  const formattedMessages = formatMessagesForSummary(messagesToSummarize);

  // Generate summary using OpenAI
  const prompt = `You are summarizing a B2B sales conversation between an AI sales agent and a lead on LinkedIn.

CONVERSATION MESSAGES (${messagesToSummarize.length} messages):
${formattedMessages}

Create a concise summary that captures:
1. Main topics discussed
2. Lead's interests, concerns, or objections
3. Key information shared (company details, needs, pain points)
4. Any commitments or next steps mentioned
5. Overall sentiment and stage of conversation

Keep the summary clear and factual. Maximum 300 words.

SUMMARY:`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates concise summaries of sales conversations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const summary = completion.choices[0].message.content.trim();
    const tokenCount = estimateTokens(summary);
    const lastMessageId = messagesToSummarize[messagesToSummarize.length - 1].id;

    // Update database
    await db.query(`
      UPDATE conversations
      SET
        context_summary = $1,
        summary_up_to_message_id = $2,
        summary_token_count = $3,
        summary_updated_at = NOW(),
        messages_count = $4
      WHERE id = $5
    `, [summary, lastMessageId, tokenCount, allMessages.length, conversationId]);

    console.log(`✅ Initial summary created (${tokenCount} tokens, ${messagesToSummarize.length} messages summarized)`);

    return {
      summary,
      tokenCount,
      messagesSummarized: messagesToSummarize.length,
      lastMessageId,
    };

  } catch (error) {
    console.error('❌ Error generating initial summary:', error);
    throw error;
  }
}

/**
 * Update summary incrementally with new messages
 * @param {string} conversationId
 * @param {object} conversation - Current conversation data
 * @returns {Promise<object>} Updated summary data
 */
async function updateSummaryIncremental(conversationId, conversation) {
  console.log(`📝 Updating summary incrementally for conversation ${conversationId}`);

  if (!conversation.context_summary) {
    // No existing summary, generate initial one
    return await generateInitialSummary(conversationId);
  }

  // Get all messages
  const allMessages = await getMessages(conversationId);

  // Find messages after the last summarized one
  const lastSummarizedIndex = allMessages.findIndex(
    msg => msg.id === conversation.summary_up_to_message_id
  );

  if (lastSummarizedIndex === -1) {
    // Can't find last summarized message, regenerate summary
    console.log('⚠️  Last summarized message not found, regenerating summary');
    return await generateInitialSummary(conversationId);
  }

  // Get messages between last summary and recent window
  const recentWindowStart = Math.max(0, allMessages.length - CONFIG.RECENT_MESSAGES_WINDOW);
  const newMessagesToSummarize = allMessages.slice(lastSummarizedIndex + 1, recentWindowStart);

  if (newMessagesToSummarize.length === 0) {
    console.log('⏭️  No new messages to summarize');
    return {
      summary: conversation.context_summary,
      tokenCount: conversation.summary_token_count,
      messagesSummarized: 0,
    };
  }

  const formattedNewMessages = formatMessagesForSummary(newMessagesToSummarize);

  // Check if summary is getting too large
  const currentTokenCount = conversation.summary_token_count || 0;
  const needsCompression = currentTokenCount > CONFIG.MAX_SUMMARY_TOKENS;

  let prompt;

  if (needsCompression) {
    // Compress existing summary + add new info
    prompt = `You are updating a summary of a B2B sales conversation that has become too long.

CURRENT SUMMARY (needs compression):
${conversation.context_summary}

NEW MESSAGES since summary:
${formattedNewMessages}

Create a NEW comprehensive summary that:
1. Condenses the current summary to its most important points
2. Incorporates the new messages
3. Maintains key information about lead's interests, objections, and commitments
4. Removes redundant or less relevant details

Keep it concise but informative. Maximum 300 words.

UPDATED SUMMARY:`;
  } else {
    // Simply extend existing summary
    prompt = `You are updating a summary of a B2B sales conversation with new messages.

CURRENT SUMMARY:
${conversation.context_summary}

NEW MESSAGES since summary:
${formattedNewMessages}

Update the summary to incorporate the new messages. Keep the structure similar but add:
- New topics or questions raised
- Any changes in lead's sentiment or interest
- New information shared
- Updated next steps or commitments

Maintain continuity with the existing summary. Maximum 300 words.

UPDATED SUMMARY:`;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that updates summaries of sales conversations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const updatedSummary = completion.choices[0].message.content.trim();
    const tokenCount = estimateTokens(updatedSummary);
    const lastMessageId = newMessagesToSummarize[newMessagesToSummarize.length - 1].id;

    // Update database
    await db.query(`
      UPDATE conversations
      SET
        context_summary = $1,
        summary_up_to_message_id = $2,
        summary_token_count = $3,
        summary_updated_at = NOW(),
        messages_count = $4
      WHERE id = $5
    `, [updatedSummary, lastMessageId, tokenCount, allMessages.length, conversationId]);

    const action = needsCompression ? 'compressed and updated' : 'updated incrementally';
    console.log(`✅ Summary ${action} (${tokenCount} tokens, ${newMessagesToSummarize.length} new messages)`);

    return {
      summary: updatedSummary,
      tokenCount,
      messagesSummarized: newMessagesToSummarize.length,
      lastMessageId,
      wasCompressed: needsCompression,
    };

  } catch (error) {
    console.error('❌ Error updating summary:', error);
    throw error;
  }
}

/**
 * Get optimized context for AI (summary + recent messages)
 * @param {string} conversationId
 * @returns {Promise<object>} Context object
 */
async function getContextForAI(conversationId) {
  // Get conversation with summary
  const convResult = await db.query(`
    SELECT
      id, context_summary, summary_up_to_message_id,
      summary_token_count, messages_count, created_at
    FROM conversations
    WHERE id = $1
  `, [conversationId]);

  if (convResult.rows.length === 0) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  const conversation = convResult.rows[0];

  // Get all messages
  const allMessages = await getMessages(conversationId);

  // Get recent messages (full content)
  const recentMessages = allMessages.slice(-CONFIG.RECENT_MESSAGES_WINDOW);

  // Calculate tokens
  const summaryTokens = conversation.summary_token_count || 0;
  const recentTokens = estimateTokens(
    recentMessages.map(m => m.content).join(' ')
  );
  const totalTokens = summaryTokens + recentTokens;

  return {
    summary: conversation.context_summary,
    recentMessages: recentMessages.map(msg => ({
      sender_type: msg.sender_type,
      content: msg.content,
      sent_at: msg.sent_at,
      ai_intent: msg.ai_intent,
    })),
    stats: {
      totalMessages: allMessages.length,
      recentMessagesCount: recentMessages.length,
      summaryTokens,
      recentTokens,
      totalTokens,
      hasSummary: !!conversation.context_summary,
      conversationStarted: conversation.created_at,
    }
  };
}

/**
 * Update message count for conversation
 * @param {string} conversationId
 * @returns {Promise<number>} New message count
 */
async function updateMessageCount(conversationId) {
  const result = await db.query(`
    UPDATE conversations
    SET messages_count = (
      SELECT COUNT(*) FROM messages WHERE conversation_id = $1
    )
    WHERE id = $1
    RETURNING messages_count
  `, [conversationId]);

  return result.rows[0]?.messages_count || 0;
}

/**
 * Process conversation for summary updates
 * Called after new message is added
 * @param {string} conversationId
 * @returns {Promise<object|null>} Summary update result or null
 */
async function processConversation(conversationId) {
  try {
    // Update message count
    await updateMessageCount(conversationId);

    // Get fresh conversation data
    const convResult = await db.query(`
      SELECT * FROM conversations WHERE id = $1
    `, [conversationId]);

    if (convResult.rows.length === 0) {
      console.log(`⚠️  Conversation ${conversationId} not found`);
      return null;
    }

    const conversation = convResult.rows[0];

    // Check if update needed
    if (!shouldUpdateSummary(conversation)) {
      console.log(`⏭️  Summary update not needed yet (${conversation.messages_count} messages)`);
      return null;
    }

    // Update or create summary
    const result = await updateSummaryIncremental(conversationId, conversation);

    return result;

  } catch (error) {
    console.error(`❌ Error processing conversation ${conversationId}:`, error);
    throw error;
  }
}

module.exports = {
  shouldUpdateSummary,
  generateInitialSummary,
  updateSummaryIncremental,
  getContextForAI,
  processConversation,
  updateMessageCount,
  estimateTokens,
  CONFIG,
};
