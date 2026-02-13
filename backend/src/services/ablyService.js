/**
 * Ably Realtime Service
 *
 * Replaces Socket.io + Redis pub/sub for real-time communication.
 * All realtime events (messages, conversations, agent progress) go through Ably.
 */

const Ably = require('ably');

let ablyClient = null;
let isConnected = false;

// Channel names for different event types
const CHANNELS = {
  // Conversations & Messages
  NEW_MESSAGE: 'new_message',
  MESSAGE_READ: 'message_read',
  MESSAGE_EDITED: 'message_edited',
  MESSAGE_DELETED: 'message_deleted',
  MESSAGE_DELIVERED: 'message_delivered',
  MESSAGE_REACTION: 'message_reaction',
  CONVERSATION_UPDATED: 'conversation_updated',
  NEW_CONVERSATION: 'new_conversation',

  // Secret Agent Investigation
  INVESTIGATION_QUEUED: 'investigation_queued',
  INVESTIGATION_STARTED: 'investigation_started',
  AGENT_STARTED: 'agent_started',
  AGENT_PROGRESS: 'agent_progress',
  AGENT_COMPLETED: 'agent_completed',
  DIRECTOR_COMPILING: 'director_compiling',
  INVESTIGATION_COMPLETE: 'investigation_complete',
  AGENT_ERROR: 'agent_error',

  // Google Maps Agent
  GMAPS_AGENT_PROGRESS: 'gmaps_agent_progress',

  // Account Events
  ACCOUNT_DISCONNECTED: 'account_disconnected',
  ACCOUNT_CONNECTED: 'account_connected'
};

/**
 * Initialize Ably client
 */
function initializeAbly() {
  const apiKey = process.env.ABLY_API_KEY;

  if (!apiKey) {
    console.warn('⚠️ ABLY_API_KEY not set - realtime features disabled');
    return null;
  }

  try {
    ablyClient = new Ably.Realtime({
      key: apiKey,
      clientId: 'getraze-backend'
    });

    ablyClient.connection.on('connected', () => {
      isConnected = true;
      console.log('✅ Ably: Connected');
    });

    ablyClient.connection.on('disconnected', () => {
      isConnected = false;
      console.log('⚠️ Ably: Disconnected');
    });

    ablyClient.connection.on('failed', (error) => {
      isConnected = false;
      console.error('❌ Ably: Connection failed:', error);
    });

    ablyClient.connection.on('suspended', () => {
      isConnected = false;
      console.warn('⚠️ Ably: Connection suspended');
    });

    return ablyClient;
  } catch (error) {
    console.error('❌ Ably: Failed to initialize:', error.message);
    return null;
  }
}

/**
 * Get the Ably client instance
 */
function getAblyClient() {
  return ablyClient;
}

/**
 * Check if Ably is connected
 */
function isAblyConnected() {
  return isConnected && ablyClient?.connection?.state === 'connected';
}

/**
 * Publish event to a specific channel
 * @param {string} channelName - Channel name (e.g., 'account:123')
 * @param {string} eventName - Event name (e.g., 'new_message')
 * @param {Object} data - Event data
 */
async function publishToChannel(channelName, eventName, data) {
  if (!ablyClient || !isConnected) {
    console.warn(`[Ably] Not connected, skipping publish to ${channelName}:${eventName}`);
    return false;
  }

  try {
    const channel = ablyClient.channels.get(channelName);
    await channel.publish(eventName, data);
    return true;
  } catch (error) {
    console.error(`[Ably] Failed to publish to ${channelName}:${eventName}:`, error.message);
    return false;
  }
}

/**
 * Create a token request for frontend authentication
 * @param {string} userId - User ID
 * @param {string} accountId - Account ID
 * @returns {Promise<Object>} Token request object
 */
async function createTokenRequest(userId, accountId) {
  if (!ablyClient) {
    throw new Error('Ably client not initialized');
  }

  const tokenParams = {
    clientId: String(userId),
    capability: {
      // Account-wide channel - for conversation list updates
      [`account:${accountId}`]: ['subscribe'],
      // Conversation channels - for individual chat updates
      [`conversation:*`]: ['subscribe'],
      // User-specific channel
      [`user:${userId}`]: ['subscribe', 'publish']
    }
  };

  return await ablyClient.auth.createTokenRequest(tokenParams);
}

// ============================================
// Convenience publish functions
// ============================================

/**
 * Publish new message event
 * @param {Object} data - { accountId, conversationId, message, unreadCount }
 */
function publishNewMessage(data) {
  // Publish to conversation channel
  publishToChannel(`conversation:${data.conversationId}`, CHANNELS.NEW_MESSAGE, data);
  // Also publish to account channel for sidebar updates
  publishToChannel(`account:${data.accountId}`, CHANNELS.CONVERSATION_UPDATED, {
    conversationId: data.conversationId,
    lastMessage: data.message,
    unreadCount: data.unreadCount
  });
}

/**
 * Publish message read event
 * @param {Object} data - { accountId, conversationId, messageIds }
 */
function publishMessageRead(data) {
  publishToChannel(`conversation:${data.conversationId}`, CHANNELS.MESSAGE_READ, data);
  publishToChannel(`account:${data.accountId}`, CHANNELS.CONVERSATION_UPDATED, {
    conversationId: data.conversationId,
    unreadCount: 0
  });
}

/**
 * Publish conversation updated event
 * @param {Object} data - { accountId, conversationId, ... }
 */
function publishConversationUpdated(data) {
  publishToChannel(`account:${data.accountId}`, CHANNELS.CONVERSATION_UPDATED, data);
}

/**
 * Publish new conversation event
 * @param {Object} data - { accountId, conversation }
 */
function publishNewConversation(data) {
  publishToChannel(`account:${data.accountId}`, CHANNELS.NEW_CONVERSATION, data);
}

/**
 * Publish message edited event
 * @param {Object} data - { accountId, conversationId, messageId, unipileMessageId, newContent }
 */
function publishMessageEdited(data) {
  publishToChannel(`conversation:${data.conversationId}`, CHANNELS.MESSAGE_EDITED, data);
  publishToChannel(`account:${data.accountId}`, CHANNELS.MESSAGE_EDITED, data);
}

/**
 * Publish message deleted event
 * @param {Object} data - { accountId, conversationId, messageId, unipileMessageId }
 */
function publishMessageDeleted(data) {
  publishToChannel(`conversation:${data.conversationId}`, CHANNELS.MESSAGE_DELETED, data);
  publishToChannel(`account:${data.accountId}`, CHANNELS.MESSAGE_DELETED, data);
}

/**
 * Publish message delivered event
 * @param {Object} data - { accountId, conversationId, messageId, unipileMessageId, deliveredAt }
 */
function publishMessageDelivered(data) {
  publishToChannel(`conversation:${data.conversationId}`, CHANNELS.MESSAGE_DELIVERED, data);
}

/**
 * Publish message reaction event
 * @param {Object} data - { accountId, conversationId, messageId, unipileMessageId, reaction, reactorName, reactorId }
 */
function publishMessageReaction(data) {
  publishToChannel(`conversation:${data.conversationId}`, CHANNELS.MESSAGE_REACTION, data);
}

// ============================================
// Secret Agent Investigation Events
// ============================================

/**
 * Publish investigation queued event
 * @param {Object} data - { accountId, investigationId, caseNumber, target, objective, queuePosition, estimatedMinutes }
 */
function publishInvestigationQueued(data) {
  publishToChannel(`account:${data.accountId}`, CHANNELS.INVESTIGATION_QUEUED, data);
}

/**
 * Publish investigation started event
 * @param {Object} data - { accountId, investigationId, caseNumber, agents[] }
 */
function publishInvestigationStarted(data) {
  publishToChannel(`account:${data.accountId}`, CHANNELS.INVESTIGATION_STARTED, data);
}

/**
 * Publish agent started event
 * @param {Object} data - { accountId, investigationId, agentId, agentName, task }
 */
function publishAgentStarted(data) {
  publishToChannel(`account:${data.accountId}`, CHANNELS.AGENT_STARTED, data);
}

/**
 * Publish agent progress event
 * @param {Object} data - { accountId, investigationId, agentId, progress, currentTask }
 */
function publishAgentProgress(data) {
  publishToChannel(`account:${data.accountId}`, CHANNELS.AGENT_PROGRESS, data);
}

/**
 * Publish agent completed event
 * @param {Object} data - { accountId, investigationId, agentId, agentName, report }
 */
function publishAgentCompleted(data) {
  publishToChannel(`account:${data.accountId}`, CHANNELS.AGENT_COMPLETED, data);
}

/**
 * Publish director compiling event
 * @param {Object} data - { accountId, investigationId, message }
 */
function publishDirectorCompiling(data) {
  publishToChannel(`account:${data.accountId}`, CHANNELS.DIRECTOR_COMPILING, data);
}

/**
 * Publish investigation complete event
 * @param {Object} data - { accountId, investigationId, briefingId, caseNumber, classification, totalFindings, duration, suggestedCampaigns[] }
 */
function publishInvestigationComplete(data) {
  publishToChannel(`account:${data.accountId}`, CHANNELS.INVESTIGATION_COMPLETE, data);
}

/**
 * Publish agent error event
 * @param {Object} data - { accountId, investigationId, agentId, agentName, error, willRetry, retryIn }
 */
function publishAgentError(data) {
  publishToChannel(`account:${data.accountId}`, CHANNELS.AGENT_ERROR, data);
}

// ============================================
// Google Maps Agent Events
// ============================================

/**
 * Publish Google Maps agent progress event
 * @param {Object} data - { accountId, agentId, status, leadsFound, leadsInserted, message }
 */
function publishGmapsAgentProgress(data) {
  console.log(`📡 [Ably] Publishing gmaps_agent_progress:`, {
    agentId: data.agentId,
    status: data.status,
    step: data.step,
    stepLabel: data.stepLabel?.substring(0, 50),
    leadsFound: data.leadsFound,
    leadsInserted: data.leadsInserted
  });
  publishToChannel(`account:${data.accountId}`, CHANNELS.GMAPS_AGENT_PROGRESS, data);
}

// ============================================
// Account Events
// ============================================

/**
 * Publish account disconnected event
 * @param {Object} data - { accountId, channelId, channelName, providerType }
 */
function publishAccountDisconnected(data) {
  console.log(`📡 [Ably] Publishing account_disconnected:`, {
    accountId: data.accountId,
    channelId: data.channelId,
    channelName: data.channelName,
    providerType: data.providerType
  });
  publishToChannel(`account:${data.accountId}`, CHANNELS.ACCOUNT_DISCONNECTED, data);
}

/**
 * Publish account connected event
 * @param {Object} data - { accountId, channelId, channelName, providerType }
 */
function publishAccountConnected(data) {
  console.log(`📡 [Ably] Publishing account_connected:`, {
    accountId: data.accountId,
    channelId: data.channelId,
    channelName: data.channelName,
    providerType: data.providerType
  });
  publishToChannel(`account:${data.accountId}`, CHANNELS.ACCOUNT_CONNECTED, data);
}

/**
 * Cleanup on shutdown
 */
async function cleanup() {
  if (ablyClient) {
    console.log('🔄 Ably: Closing connection...');
    await ablyClient.close();
    ablyClient = null;
    isConnected = false;
    console.log('✅ Ably: Connection closed');
  }
}

module.exports = {
  initializeAbly,
  getAblyClient,
  isAblyConnected,
  publishToChannel,
  createTokenRequest,
  // Message events
  publishNewMessage,
  publishMessageRead,
  publishMessageEdited,
  publishMessageDeleted,
  publishMessageDelivered,
  publishMessageReaction,
  publishConversationUpdated,
  publishNewConversation,
  // Secret Agent events
  publishInvestigationQueued,
  publishInvestigationStarted,
  publishAgentStarted,
  publishAgentProgress,
  publishAgentCompleted,
  publishDirectorCompiling,
  publishInvestigationComplete,
  publishAgentError,
  // Google Maps Agent events
  publishGmapsAgentProgress,
  // Account events
  publishAccountDisconnected,
  publishAccountConnected,
  cleanup,
  CHANNELS
};
