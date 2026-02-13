// frontend/src/services/ably.js
import Ably from 'ably';
import api from './api';

/**
 * Ably Realtime Service
 *
 * Replaces Socket.io for real-time communication.
 * Uses Ably for managed WebSocket connections.
 */

let ablyClient = null;
let accountChannel = null;
let conversationChannel = null;
let currentAccountId = null;
let currentConversationId = null;
let isInitializing = false;
let connectionAttempts = 0;
const MAX_RECONNECTION_ATTEMPTS = 5;

// Event listeners registered
const listeners = {
  new_message: [],
  message_read: [],
  message_edited: [],
  message_deleted: [],
  message_delivered: [],
  message_reaction: [],
  conversation_updated: [],
  new_conversation: [],
  // Secret Agent events
  investigation_queued: [],
  investigation_started: [],
  agent_started: [],
  agent_progress: [],
  agent_completed: [],
  director_compiling: [],
  investigation_complete: [],
  agent_error: [],
  // Google Maps Agent events
  gmaps_agent_progress: [],
  // Account events
  account_disconnected: [],
  account_connected: []
};

/**
 * Get auth token for Ably from backend
 */
async function getAblyToken() {
  try {
    const response = await api.get('/realtime/token');
    if (response.success && response.tokenRequest) {
      return response.tokenRequest;
    }
    throw new Error('Invalid token response');
  } catch (error) {
    console.error('Ably: Failed to get token:', error);
    throw error;
  }
}

/**
 * Initialize Ably connection
 */
export async function initializeAbly(accountId) {
  const token = localStorage.getItem('authToken');

  if (!token) {
    console.warn('Ably: Token not found, connection not started');
    return null;
  }

  // Prevent multiple simultaneous initializations
  if (isInitializing) {
    console.log('Ably: Already initializing, skipping');
    return ablyClient;
  }

  // If already connected to same account, skip
  if (ablyClient?.connection?.state === 'connected' && currentAccountId === accountId) {
    console.log('Ably: Already connected to this account');
    return ablyClient;
  }

  // If connecting to different account, disconnect first
  if (ablyClient && currentAccountId !== accountId) {
    console.log('Ably: Switching accounts, disconnecting first');
    disconnectAbly();
  }

  isInitializing = true;
  currentAccountId = accountId;

  console.log('Ably: Starting connection...');

  try {
    ablyClient = new Ably.Realtime({
      authCallback: async (tokenParams, callback) => {
        try {
          const tokenRequest = await getAblyToken();
          callback(null, tokenRequest);
        } catch (error) {
          callback(error, null);
        }
      }
    });

    // Connection events
    ablyClient.connection.once('connected', () => {
      console.log('Ably: Connected successfully');
      connectionAttempts = 0;
      isInitializing = false;

      // Subscribe to account channel after connection
      if (currentAccountId) {
        subscribeToAccountChannel(currentAccountId);
      }
    });

    ablyClient.connection.on('disconnected', () => {
      console.log('Ably: Disconnected');
    });

    ablyClient.connection.on('suspended', () => {
      console.log('Ably: Connection suspended');
    });

    ablyClient.connection.on('failed', (error) => {
      connectionAttempts++;
      isInitializing = false;
      console.error('Ably: Connection failed -', error?.message || error);

      if (connectionAttempts >= MAX_RECONNECTION_ATTEMPTS) {
        console.error('Ably: Maximum reconnection attempts reached');
      }
    });

    return ablyClient;
  } catch (error) {
    isInitializing = false;
    console.error('Ably: Failed to initialize:', error);
    return null;
  }
}

/**
 * Subscribe to account-wide channel for notifications
 */
function subscribeToAccountChannel(accountId) {
  if (!ablyClient) return;

  const channelName = `account:${accountId}`;

  // If already subscribed to this channel, skip
  if (accountChannel && accountChannel.name === channelName) {
    console.log(`Ably: Already subscribed to ${channelName}`);
    return;
  }

  accountChannel = ablyClient.channels.get(channelName);
  console.log(`Ably: Subscribing to ${channelName}`);

  // Message events
  accountChannel.subscribe('new_message', (message) => {
    console.log('Ably: new_message received', message.data);
    listeners.new_message.forEach(callback => callback(message.data));
  });

  accountChannel.subscribe('conversation_updated', (message) => {
    console.log('Ably: conversation_updated received', message.data);
    listeners.conversation_updated.forEach(callback => callback(message.data));
  });

  accountChannel.subscribe('new_conversation', (message) => {
    console.log('Ably: new_conversation received', message.data);
    listeners.new_conversation.forEach(callback => callback(message.data));
  });

  accountChannel.subscribe('message_edited', (message) => {
    listeners.message_edited.forEach(callback => callback(message.data));
  });

  accountChannel.subscribe('message_deleted', (message) => {
    listeners.message_deleted.forEach(callback => callback(message.data));
  });

  // Secret Agent Investigation events
  accountChannel.subscribe('investigation_queued', (message) => {
    console.log('Ably: investigation_queued received', message.data);
    listeners.investigation_queued.forEach(callback => callback(message.data));
  });

  accountChannel.subscribe('investigation_started', (message) => {
    console.log('Ably: investigation_started received', message.data);
    listeners.investigation_started.forEach(callback => callback(message.data));
  });

  accountChannel.subscribe('agent_started', (message) => {
    console.log('Ably: agent_started received', message.data);
    listeners.agent_started.forEach(callback => callback(message.data));
  });

  accountChannel.subscribe('agent_progress', (message) => {
    console.log('Ably: agent_progress received', message.data);
    listeners.agent_progress.forEach(callback => callback(message.data));
  });

  accountChannel.subscribe('agent_completed', (message) => {
    console.log('Ably: agent_completed received', message.data);
    listeners.agent_completed.forEach(callback => callback(message.data));
  });

  accountChannel.subscribe('director_compiling', (message) => {
    console.log('Ably: director_compiling received', message.data);
    listeners.director_compiling.forEach(callback => callback(message.data));
  });

  accountChannel.subscribe('investigation_complete', (message) => {
    console.log('Ably: investigation_complete received', message.data);
    listeners.investigation_complete.forEach(callback => callback(message.data));
  });

  accountChannel.subscribe('agent_error', (message) => {
    console.log('Ably: agent_error received', message.data);
    listeners.agent_error.forEach(callback => callback(message.data));
  });

  // Google Maps Agent events
  accountChannel.subscribe('gmaps_agent_progress', (message) => {
    console.log('Ably: gmaps_agent_progress received', message.data);
    listeners.gmaps_agent_progress.forEach(callback => callback(message.data));
  });

  // Account events
  accountChannel.subscribe('account_disconnected', (message) => {
    console.log('Ably: account_disconnected received', message.data);
    listeners.account_disconnected.forEach(callback => callback(message.data));
  });

  accountChannel.subscribe('account_connected', (message) => {
    console.log('Ably: account_connected received', message.data);
    listeners.account_connected.forEach(callback => callback(message.data));
  });
}

/**
 * Disconnect Ably
 */
export function disconnectAbly() {
  if (ablyClient) {
    console.log('Ably: Disconnecting...');

    // Just close the client - it will handle channel cleanup
    ablyClient.close();
    ablyClient = null;
    accountChannel = null;
    conversationChannel = null;
    currentAccountId = null;
    currentConversationId = null;
    isInitializing = false;
  }
}

/**
 * Check if connected
 */
export function isConnected() {
  return ablyClient?.connection?.state === 'connected';
}

/**
 * Join a conversation room (subscribe to conversation channel)
 */
export function joinConversation(conversationId) {
  if (!ablyClient || ablyClient.connection.state !== 'connected') return;

  // If already in this conversation, skip
  if (currentConversationId === conversationId && conversationChannel) {
    console.log(`Ably: Already in conversation ${conversationId}`);
    return;
  }

  // Leave previous conversation if any
  if (conversationChannel && currentConversationId !== conversationId) {
    conversationChannel.unsubscribe();
  }

  currentConversationId = conversationId;
  const channelName = `conversation:${conversationId}`;
  conversationChannel = ablyClient.channels.get(channelName);

  console.log(`Ably: Joined conversation ${conversationId}`);

  // Subscribe to conversation-specific events
  conversationChannel.subscribe('new_message', (message) => {
    console.log('Ably: new_message (conversation) received', message.data);
    listeners.new_message.forEach(callback => callback(message.data));
  });

  conversationChannel.subscribe('message_read', (message) => {
    console.log('Ably: message_read received', message.data);
    listeners.message_read.forEach(callback => callback(message.data));
  });

  conversationChannel.subscribe('message_edited', (message) => {
    listeners.message_edited.forEach(callback => callback(message.data));
  });

  conversationChannel.subscribe('message_deleted', (message) => {
    listeners.message_deleted.forEach(callback => callback(message.data));
  });

  conversationChannel.subscribe('message_delivered', (message) => {
    listeners.message_delivered.forEach(callback => callback(message.data));
  });

  conversationChannel.subscribe('message_reaction', (message) => {
    listeners.message_reaction.forEach(callback => callback(message.data));
  });
}

/**
 * Leave a conversation room
 */
export function leaveConversation(conversationId) {
  if (conversationChannel && currentConversationId === conversationId) {
    conversationChannel.unsubscribe();
    conversationChannel = null;
    currentConversationId = null;
    console.log(`Ably: Left conversation ${conversationId}`);
  }
}

// ============================================
// Event Listener Registration
// ============================================

export function onNewMessage(callback) {
  listeners.new_message.push(callback);
  return () => {
    listeners.new_message = listeners.new_message.filter(cb => cb !== callback);
  };
}

export function onMessageRead(callback) {
  listeners.message_read.push(callback);
  return () => {
    listeners.message_read = listeners.message_read.filter(cb => cb !== callback);
  };
}

export function onConversationUpdated(callback) {
  listeners.conversation_updated.push(callback);
  return () => {
    listeners.conversation_updated = listeners.conversation_updated.filter(cb => cb !== callback);
  };
}

export function onNewConversation(callback) {
  listeners.new_conversation.push(callback);
  return () => {
    listeners.new_conversation = listeners.new_conversation.filter(cb => cb !== callback);
  };
}

export function onMessageEdited(callback) {
  listeners.message_edited.push(callback);
  return () => { listeners.message_edited = listeners.message_edited.filter(cb => cb !== callback); };
}

export function onMessageDeleted(callback) {
  listeners.message_deleted.push(callback);
  return () => { listeners.message_deleted = listeners.message_deleted.filter(cb => cb !== callback); };
}

export function onMessageDelivered(callback) {
  listeners.message_delivered.push(callback);
  return () => { listeners.message_delivered = listeners.message_delivered.filter(cb => cb !== callback); };
}

export function onMessageReaction(callback) {
  listeners.message_reaction.push(callback);
  return () => { listeners.message_reaction = listeners.message_reaction.filter(cb => cb !== callback); };
}

// ============================================
// Secret Agent Investigation Event Listeners
// ============================================

export function onInvestigationQueued(callback) {
  listeners.investigation_queued.push(callback);
  return () => {
    listeners.investigation_queued = listeners.investigation_queued.filter(cb => cb !== callback);
  };
}

export function onInvestigationStarted(callback) {
  listeners.investigation_started.push(callback);
  return () => {
    listeners.investigation_started = listeners.investigation_started.filter(cb => cb !== callback);
  };
}

export function onAgentStarted(callback) {
  listeners.agent_started.push(callback);
  return () => {
    listeners.agent_started = listeners.agent_started.filter(cb => cb !== callback);
  };
}

export function onAgentProgress(callback) {
  listeners.agent_progress.push(callback);
  return () => {
    listeners.agent_progress = listeners.agent_progress.filter(cb => cb !== callback);
  };
}

export function onAgentCompleted(callback) {
  listeners.agent_completed.push(callback);
  return () => {
    listeners.agent_completed = listeners.agent_completed.filter(cb => cb !== callback);
  };
}

export function onDirectorCompiling(callback) {
  listeners.director_compiling.push(callback);
  return () => {
    listeners.director_compiling = listeners.director_compiling.filter(cb => cb !== callback);
  };
}

export function onInvestigationComplete(callback) {
  listeners.investigation_complete.push(callback);
  return () => {
    listeners.investigation_complete = listeners.investigation_complete.filter(cb => cb !== callback);
  };
}

export function onAgentError(callback) {
  listeners.agent_error.push(callback);
  return () => {
    listeners.agent_error = listeners.agent_error.filter(cb => cb !== callback);
  };
}

// ============================================
// Google Maps Agent Event Listeners
// ============================================

export function onGmapsAgentProgress(callback) {
  listeners.gmaps_agent_progress.push(callback);
  return () => {
    listeners.gmaps_agent_progress = listeners.gmaps_agent_progress.filter(cb => cb !== callback);
  };
}

// ============================================
// Account Event Listeners
// ============================================

export function onAccountDisconnected(callback) {
  listeners.account_disconnected.push(callback);
  return () => {
    listeners.account_disconnected = listeners.account_disconnected.filter(cb => cb !== callback);
  };
}

export function onAccountConnected(callback) {
  listeners.account_connected.push(callback);
  return () => {
    listeners.account_connected = listeners.account_connected.filter(cb => cb !== callback);
  };
}

/**
 * Remove all listeners
 */
export function removeAllListeners() {
  listeners.new_message = [];
  listeners.message_read = [];
  listeners.message_edited = [];
  listeners.message_deleted = [];
  listeners.message_delivered = [];
  listeners.message_reaction = [];
  listeners.conversation_updated = [];
  listeners.new_conversation = [];
  // Secret Agent events
  listeners.investigation_queued = [];
  listeners.investigation_started = [];
  listeners.agent_started = [];
  listeners.agent_progress = [];
  listeners.agent_completed = [];
  listeners.director_compiling = [];
  listeners.investigation_complete = [];
  listeners.agent_error = [];
  // Google Maps Agent events
  listeners.gmaps_agent_progress = [];
  // Account events
  listeners.account_disconnected = [];
  listeners.account_connected = [];
}

/**
 * Get Ably client instance
 */
export function getAblyClient() {
  return ablyClient;
}

export default {
  initializeAbly,
  disconnectAbly,
  isConnected,
  joinConversation,
  leaveConversation,
  onNewMessage,
  onMessageRead,
  onConversationUpdated,
  onNewConversation,
  onMessageEdited,
  onMessageDeleted,
  onMessageDelivered,
  onMessageReaction,
  // Secret Agent events
  onInvestigationQueued,
  onInvestigationStarted,
  onAgentStarted,
  onAgentProgress,
  onAgentCompleted,
  onDirectorCompiling,
  onInvestigationComplete,
  onAgentError,
  // Google Maps Agent events
  onGmapsAgentProgress,
  // Account events
  onAccountDisconnected,
  onAccountConnected,
  removeAllListeners,
  getAblyClient
};
