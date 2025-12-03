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
  new_conversation: []
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

/**
 * Remove todos os listeners
 */
export function removeAllListeners() {
  listeners.new_message = [];
  listeners.message_read = [];
  listeners.conversation_updated = [];
  listeners.new_conversation = [];
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
  removeAllListeners,
  getSocket
};
