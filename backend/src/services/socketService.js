/**
 * Socket.io Service
 *
 * Real-time WebSocket service with Redis pub/sub for scalability
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { createRedisClient } = require('../config/redis');

let io = null;
let pubClient = null;
let subClient = null;

// Channels for Redis pub/sub
const CHANNELS = {
  NEW_MESSAGE: 'realtime:new_message',
  MESSAGE_READ: 'realtime:message_read',
  CONVERSATION_UPDATED: 'realtime:conversation_updated',
  NEW_CONVERSATION: 'realtime:new_conversation'
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
      socket.accountId = decoded.accountId;

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
  cleanup,
  CHANNELS
};
