/**
 * Socket.io Service
 *
 * Real-time WebSocket service with Redis pub/sub for scalability
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { createRedisClient } = require('../config/redis');
const db = require('../config/database');

let io = null;
let pubClient = null;
let subClient = null;

// Channels for Redis pub/sub
const CHANNELS = {
  NEW_MESSAGE: 'realtime:new_message',
  MESSAGE_READ: 'realtime:message_read',
  CONVERSATION_UPDATED: 'realtime:conversation_updated',
  NEW_CONVERSATION: 'realtime:new_conversation',
  // Secret Agent Investigation channels
  INVESTIGATION_QUEUED: 'realtime:investigation_queued',
  INVESTIGATION_STARTED: 'realtime:investigation_started',
  AGENT_STARTED: 'realtime:agent_started',
  AGENT_PROGRESS: 'realtime:agent_progress',
  AGENT_COMPLETED: 'realtime:agent_completed',
  DIRECTOR_COMPILING: 'realtime:director_compiling',
  INVESTIGATION_COMPLETE: 'realtime:investigation_complete',
  AGENT_ERROR: 'realtime:agent_error',
  // Google Maps Agent channels
  GMAPS_AGENT_PROGRESS: 'realtime:gmaps_agent_progress'
};

/**
 * Initialize Socket.io server
 */
function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Initialize Redis pub/sub
  initializeRedisPubSub();

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;

      // Get accountId from token or fetch from database
      let accountId = decoded.accountId || decoded.account_id;

      if (!accountId && socket.userId) {
        try {
          const result = await db.query(
            'SELECT account_id FROM users WHERE id = $1',
            [socket.userId]
          );
          if (result.rows[0]) {
            accountId = result.rows[0].account_id;
          }
        } catch (dbError) {
          console.error('Socket: Error fetching accountId:', dbError.message);
        }
      }

      socket.accountId = accountId;

      next();
    } catch (error) {
      console.error('Socket auth error:', error.message);
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id} (user: ${socket.userId}, account: ${socket.accountId})`);

    // Join user-specific room (for direct messages to user)
    socket.join(`user:${socket.userId}`);

    // Join account room (for account-wide broadcasts)
    socket.join(`account:${socket.accountId}`);

    // Handle joining conversation room
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`   User ${socket.userId} joined conversation:${conversationId}`);
    });

    // Handle leaving conversation room
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`   User ${socket.userId} left conversation:${conversationId}`);
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} (reason: ${reason})`);
    });
  });

  console.log('✅ Socket.io server initialized');
  return io;
}

/**
 * Initialize Redis pub/sub for cross-instance communication
 */
function initializeRedisPubSub() {
  try {
    pubClient = createRedisClient();
    subClient = createRedisClient();

    // Subscribe to all channels
    Object.values(CHANNELS).forEach(channel => {
      subClient.subscribe(channel);
    });

    // Handle incoming messages from Redis
    subClient.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        handleRedisMessage(channel, data);
      } catch (error) {
        console.error('Error parsing Redis message:', error);
      }
    });

    console.log('✅ Redis pub/sub initialized for WebSocket');
  } catch (error) {
    console.error('❌ Failed to initialize Redis pub/sub:', error.message);
  }
}

/**
 * Handle messages from Redis pub/sub
 */
function handleRedisMessage(channel, data) {
  if (!io) return;

  switch (channel) {
    case CHANNELS.NEW_MESSAGE:
      // Emit to conversation room
      io.to(`conversation:${data.conversationId}`).emit('new_message', data);
      // Also emit to account room for sidebar updates
      io.to(`account:${data.accountId}`).emit('conversation_updated', {
        conversationId: data.conversationId,
        lastMessage: data.message,
        unreadCount: data.unreadCount
      });
      break;

    case CHANNELS.MESSAGE_READ:
      io.to(`conversation:${data.conversationId}`).emit('message_read', data);
      io.to(`account:${data.accountId}`).emit('conversation_updated', {
        conversationId: data.conversationId,
        unreadCount: 0
      });
      break;

    case CHANNELS.CONVERSATION_UPDATED:
      io.to(`account:${data.accountId}`).emit('conversation_updated', data);
      break;

    case CHANNELS.NEW_CONVERSATION:
      io.to(`account:${data.accountId}`).emit('new_conversation', data);
      break;

    // Secret Agent Investigation events
    case CHANNELS.INVESTIGATION_QUEUED:
      io.to(`account:${data.accountId}`).emit('investigation_queued', data);
      break;

    case CHANNELS.INVESTIGATION_STARTED:
      io.to(`account:${data.accountId}`).emit('investigation_started', data);
      break;

    case CHANNELS.AGENT_STARTED:
      io.to(`account:${data.accountId}`).emit('agent_started', data);
      break;

    case CHANNELS.AGENT_PROGRESS:
      io.to(`account:${data.accountId}`).emit('agent_progress', data);
      break;

    case CHANNELS.AGENT_COMPLETED:
      io.to(`account:${data.accountId}`).emit('agent_completed', data);
      break;

    case CHANNELS.DIRECTOR_COMPILING:
      io.to(`account:${data.accountId}`).emit('director_compiling', data);
      break;

    case CHANNELS.INVESTIGATION_COMPLETE:
      io.to(`account:${data.accountId}`).emit('investigation_complete', data);
      break;

    case CHANNELS.AGENT_ERROR:
      io.to(`account:${data.accountId}`).emit('agent_error', data);
      break;

    case CHANNELS.GMAPS_AGENT_PROGRESS:
      io.to(`account:${data.accountId}`).emit('gmaps_agent_progress', data);
      break;
  }
}

/**
 * Publish new message event
 */
function publishNewMessage(data) {
  if (pubClient) {
    pubClient.publish(CHANNELS.NEW_MESSAGE, JSON.stringify(data));
  }
}

/**
 * Publish message read event
 */
function publishMessageRead(data) {
  if (pubClient) {
    pubClient.publish(CHANNELS.MESSAGE_READ, JSON.stringify(data));
  }
}

/**
 * Publish conversation updated event
 */
function publishConversationUpdated(data) {
  if (pubClient) {
    pubClient.publish(CHANNELS.CONVERSATION_UPDATED, JSON.stringify(data));
  }
}

/**
 * Publish new conversation event
 */
function publishNewConversation(data) {
  if (pubClient) {
    pubClient.publish(CHANNELS.NEW_CONVERSATION, JSON.stringify(data));
  }
}

// ============================================
// Secret Agent Investigation Events
// ============================================

/**
 * Publish investigation queued event
 * @param {Object} data - { accountId, investigationId, caseNumber, target, objective, queuePosition, estimatedMinutes }
 */
function publishInvestigationQueued(data) {
  if (pubClient) {
    pubClient.publish(CHANNELS.INVESTIGATION_QUEUED, JSON.stringify(data));
  }
}

/**
 * Publish investigation started event
 * @param {Object} data - { accountId, investigationId, caseNumber, agents[] }
 */
function publishInvestigationStarted(data) {
  if (pubClient) {
    pubClient.publish(CHANNELS.INVESTIGATION_STARTED, JSON.stringify(data));
  }
}

/**
 * Publish agent started event
 * @param {Object} data - { accountId, investigationId, agentId, agentName, task }
 */
function publishAgentStarted(data) {
  if (pubClient) {
    pubClient.publish(CHANNELS.AGENT_STARTED, JSON.stringify(data));
  }
}

/**
 * Publish agent progress event
 * @param {Object} data - { accountId, investigationId, agentId, progress, currentTask }
 */
function publishAgentProgress(data) {
  if (pubClient) {
    pubClient.publish(CHANNELS.AGENT_PROGRESS, JSON.stringify(data));
  }
}

/**
 * Publish agent completed event
 * @param {Object} data - { accountId, investigationId, agentId, agentName, report: { summary, findings[], sourcesUsed[] } }
 */
function publishAgentCompleted(data) {
  if (pubClient) {
    pubClient.publish(CHANNELS.AGENT_COMPLETED, JSON.stringify(data));
  }
}

/**
 * Publish director compiling event
 * @param {Object} data - { accountId, investigationId, message }
 */
function publishDirectorCompiling(data) {
  if (pubClient) {
    pubClient.publish(CHANNELS.DIRECTOR_COMPILING, JSON.stringify(data));
  }
}

/**
 * Publish investigation complete event
 * @param {Object} data - { accountId, investigationId, briefingId, caseNumber, classification, totalFindings, duration, suggestedCampaigns[] }
 */
function publishInvestigationComplete(data) {
  if (pubClient) {
    pubClient.publish(CHANNELS.INVESTIGATION_COMPLETE, JSON.stringify(data));
  }
}

/**
 * Publish agent error event
 * @param {Object} data - { accountId, investigationId, agentId, agentName, error, willRetry, retryIn }
 */
function publishAgentError(data) {
  if (pubClient) {
    pubClient.publish(CHANNELS.AGENT_ERROR, JSON.stringify(data));
  }
}

/**
 * Publish Google Maps agent progress event
 * @param {Object} data - { accountId, agentId, status, leadsFound, leadsInserted, message }
 */
function publishGmapsAgentProgress(data) {
  console.log(`📡 [WS] Publishing gmaps_agent_progress:`, {
    agentId: data.agentId,
    status: data.status,
    step: data.step,
    stepLabel: data.stepLabel?.substring(0, 50),
    leadsFound: data.leadsFound,
    leadsInserted: data.leadsInserted
  });
  if (pubClient) {
    pubClient.publish(CHANNELS.GMAPS_AGENT_PROGRESS, JSON.stringify(data));
  } else {
    console.warn('⚠️ [WS] pubClient not available for gmaps_agent_progress');
  }
}

/**
 * Get Socket.io instance
 */
function getIO() {
  return io;
}

/**
 * Cleanup on shutdown
 */
async function cleanup() {
  if (pubClient) await pubClient.quit();
  if (subClient) await subClient.quit();
  if (io) io.close();
}

module.exports = {
  initializeSocket,
  getIO,
  publishNewMessage,
  publishMessageRead,
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
  cleanup,
  CHANNELS
};
