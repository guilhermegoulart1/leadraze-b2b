// backend/src/workers/conversationSyncWorker.js
const db = require('../config/database');
const unipileClient = require('../config/unipile');

/**
 * Conversation Sync Worker
 * Polls Unipile for new messages and updates conversation cache
 */

const SYNC_INTERVAL = 30000; // 30 seconds
const BATCH_SIZE = 20; // Process 20 conversations per batch

let isRunning = false;
let syncTimer = null;

/**
 * Start the worker
 */
const start = () => {
  if (isRunning) {
    console.log('⚠️ Conversation sync worker is already running');
    return;
  }

  console.log('🚀 Starting conversation sync worker...');
  isRunning = true;

  // Run immediately
  syncConversations();

  // Then run at intervals
  syncTimer = setInterval(syncConversations, SYNC_INTERVAL);
};

/**
 * Stop the worker
 */
const stop = () => {
  if (!isRunning) {
    console.log('⚠️ Conversation sync worker is not running');
    return;
  }

  console.log('🛑 Stopping conversation sync worker...');
  isRunning = false;

  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
};

/**
 * Main sync function
 */
const syncConversations = async () => {
  if (!unipileClient.isInitialized()) {
    console.log('⚠️ Unipile not initialized, skipping sync');
    return;
  }

  try {
    console.log('🔄 Syncing conversations...');

    // Get active conversations that need syncing
    // Only sync conversations with ai_active status
    const conversationsQuery = `
      SELECT
        conv.id,
        conv.unipile_chat_id,
        conv.last_message_at,
        la.unipile_account_id
      FROM conversations conv
      INNER JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      WHERE conv.status = 'ai_active'
        AND conv.unipile_chat_id IS NOT NULL
        AND la.unipile_account_id IS NOT NULL
      ORDER BY conv.last_message_at DESC NULLS LAST
      LIMIT $1
    `;

    const result = await db.query(conversationsQuery, [BATCH_SIZE]);
    const conversations = result.rows;

    if (conversations.length === 0) {
      console.log('✅ No conversations to sync');
      return;
    }

    console.log(`📊 Processing ${conversations.length} conversations`);

    // Sync each conversation
    const syncPromises = conversations.map(conv => syncConversation(conv));
    const results = await Promise.allSettled(syncPromises);

    // Count successes and failures
    const successes = results.filter(r => r.status === 'fulfilled').length;
    const failures = results.filter(r => r.status === 'rejected').length;

    console.log(`✅ Sync complete: ${successes} success, ${failures} failures`);

  } catch (error) {
    console.error('❌ Error in conversation sync:', error.message);
  }
};

/**
 * Sync a single conversation
 */
const syncConversation = async (conversation) => {
  try {
    const { id, unipile_chat_id, unipile_account_id } = conversation;

    // Fetch latest messages from Unipile
    const messagesResponse = await unipileClient.messaging.getMessages({
      account_id: unipile_account_id,
      chat_id: unipile_chat_id,
      limit: 5 // Only check last 5 messages
    });

    const messages = messagesResponse?.items || [];

    if (messages.length === 0) {
      return; // No new messages
    }

    // Get the most recent message
    const latestMessage = messages[0];

    // Update conversation cache
    const updateQuery = `
      UPDATE conversations
      SET
        last_message_preview = $1,
        last_message_at = $2,
        unread_count = CASE
          WHEN $3 = 'incoming' THEN unread_count + 1
          ELSE unread_count
        END,
        updated_at = NOW()
      WHERE id = $4
    `;

    await db.query(updateQuery, [
      latestMessage.text?.substring(0, 200) || '',
      latestMessage.date || new Date(),
      latestMessage.type || 'incoming',
      id
    ]);

    console.log(`✅ Synced conversation ${id}`);

    // TODO: Trigger AI response if needed
    // This would check if message is incoming and ai_active is true
    // Then call the AI agent to generate and send a response

  } catch (error) {
    console.error(`❌ Error syncing conversation ${conversation.id}:`, error.message);
    throw error;
  }
};

/**
 * Force sync specific conversation
 */
const forceSyncConversation = async (conversationId) => {
  try {
    console.log(`🔄 Force syncing conversation ${conversationId}`);

    const conversationQuery = `
      SELECT
        conv.id,
        conv.unipile_chat_id,
        conv.last_message_at,
        la.unipile_account_id
      FROM conversations conv
      INNER JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      WHERE conv.id = $1
        AND conv.unipile_chat_id IS NOT NULL
        AND la.unipile_account_id IS NOT NULL
    `;

    const result = await db.query(conversationQuery, [conversationId]);

    if (result.rows.length === 0) {
      throw new Error('Conversation not found or missing Unipile data');
    }

    await syncConversation(result.rows[0]);

    console.log(`✅ Force sync complete for conversation ${conversationId}`);

  } catch (error) {
    console.error(`❌ Error force syncing conversation ${conversationId}:`, error.message);
    throw error;
  }
};

module.exports = {
  start,
  stop,
  syncConversations,
  forceSyncConversation,
  isRunning: () => isRunning
};
