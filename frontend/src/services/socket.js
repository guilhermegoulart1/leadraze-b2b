// frontend/src/services/socket.js
import { io } from 'socket.io-client';

/**
 * Socket.io Client Service
 *
 * Gerencia conexão WebSocket com o backend para atualizações em tempo real
 */

let socket = null;
let connectionAttempts = 0;
const MAX_RECONNECTION_ATTEMPTS = 5;

// Event listeners registrados
const listeners = {
  new_message: [],
  message_read: [],
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
  gmaps_agent_progress: []
};

/**
 * Deriva a URL do socket de forma robusta
 */
function getSocketUrl() {
  // 1. Tentar usar VITE_API_URL se disponível e válida
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl && apiUrl.startsWith('http')) {
    // Remover apenas /api do FINAL da URL (não do meio do domínio)
    return apiUrl.replace(/\/api$/, '');
  }

  // 2. Em produção, derivar do hostname atual
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    // Se estamos em app.getraze.co, o backend está em api.getraze.co
    const hostname = window.location.hostname;
    if (hostname.includes('getraze.co')) {
      return 'https://api.getraze.co';
    }
    // Fallback: mesmo host na porta 3001
    return `${window.location.protocol}//${hostname}:3001`;
  }

  // 3. Fallback para desenvolvimento local
  return 'http://localhost:3001';
}

/**
 * Inicializa conexão WebSocket
 */
export function initializeSocket() {
  const token = localStorage.getItem('authToken');

  if (!token) {
    console.warn('Socket: Token não encontrado, conexão não iniciada');
    return null;
  }

  if (socket?.connected) {
    console.log('Socket: Já conectado');
    return socket;
  }

  const socketUrl = getSocketUrl();

  console.log('Socket: Iniciando conexão...', socketUrl);

  socket = io(socketUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECTION_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  });

  // Connection events
  socket.on('connect', () => {
    console.log('Socket: Conectado com sucesso');
    connectionAttempts = 0;
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket: Desconectado -', reason);
  });

  socket.on('connect_error', (error) => {
    connectionAttempts++;
    console.error('Socket: Erro de conexão -', error.message);

    if (connectionAttempts >= MAX_RECONNECTION_ATTEMPTS) {
      console.error('Socket: Máximo de tentativas atingido');
    }
  });

  // Registrar handlers para eventos do servidor
  socket.on('new_message', (data) => {
    console.log('Socket: new_message recebido', data);
    listeners.new_message.forEach(callback => callback(data));
  });

  socket.on('message_read', (data) => {
    console.log('Socket: message_read recebido', data);
    listeners.message_read.forEach(callback => callback(data));
  });

  socket.on('conversation_updated', (data) => {
    console.log('Socket: conversation_updated recebido', data);
    listeners.conversation_updated.forEach(callback => callback(data));
  });

  socket.on('new_conversation', (data) => {
    console.log('Socket: new_conversation recebido', data);
    listeners.new_conversation.forEach(callback => callback(data));
  });

  // Secret Agent Investigation events
  socket.on('investigation_queued', (data) => {
    console.log('Socket: investigation_queued recebido', data);
    listeners.investigation_queued.forEach(callback => callback(data));
  });

  socket.on('investigation_started', (data) => {
    console.log('Socket: investigation_started recebido', data);
    listeners.investigation_started.forEach(callback => callback(data));
  });

  socket.on('agent_started', (data) => {
    console.log('Socket: agent_started recebido', data);
    listeners.agent_started.forEach(callback => callback(data));
  });

  socket.on('agent_progress', (data) => {
    console.log('Socket: agent_progress recebido', data);
    listeners.agent_progress.forEach(callback => callback(data));
  });

  socket.on('agent_completed', (data) => {
    console.log('Socket: agent_completed recebido', data);
    listeners.agent_completed.forEach(callback => callback(data));
  });

  socket.on('director_compiling', (data) => {
    console.log('Socket: director_compiling recebido', data);
    listeners.director_compiling.forEach(callback => callback(data));
  });

  socket.on('investigation_complete', (data) => {
    console.log('Socket: investigation_complete recebido', data);
    listeners.investigation_complete.forEach(callback => callback(data));
  });

  socket.on('agent_error', (data) => {
    console.log('Socket: agent_error recebido', data);
    listeners.agent_error.forEach(callback => callback(data));
  });

  // Google Maps Agent events
  socket.on('gmaps_agent_progress', (data) => {
    console.log('Socket: gmaps_agent_progress recebido', data);
    listeners.gmaps_agent_progress.forEach(callback => callback(data));
  });

  return socket;
}

/**
 * Desconecta o WebSocket
 */
export function disconnectSocket() {
  if (socket) {
    console.log('Socket: Desconectando...');
    socket.disconnect();
    socket = null;
  }
}

/**
 * Verifica se está conectado
 */
export function isConnected() {
  return socket?.connected || false;
}

/**
 * Entrar em uma sala de conversa (para receber mensagens específicas)
 */
export function joinConversation(conversationId) {
  if (socket?.connected) {
    socket.emit('join_conversation', conversationId);
    console.log(`Socket: Entrou na conversa ${conversationId}`);
  }
}

/**
 * Sair de uma sala de conversa
 */
export function leaveConversation(conversationId) {
  if (socket?.connected) {
    socket.emit('leave_conversation', conversationId);
    console.log(`Socket: Saiu da conversa ${conversationId}`);
  }
}

/**
 * Registra listener para evento
 */
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

/**
 * Remove todos os listeners
 */
export function removeAllListeners() {
  listeners.new_message = [];
  listeners.message_read = [];
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
}

/**
 * Retorna a instância do socket
 */
export function getSocket() {
  return socket;
}

export default {
  initializeSocket,
  disconnectSocket,
  isConnected,
  joinConversation,
  leaveConversation,
  onNewMessage,
  onMessageRead,
  onConversationUpdated,
  onNewConversation,
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
  removeAllListeners,
  getSocket
};
