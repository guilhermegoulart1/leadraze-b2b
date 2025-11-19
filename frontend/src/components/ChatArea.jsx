// frontend/src/components/ChatArea.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Bot, User, Loader, AlertCircle, Linkedin,
  ToggleLeft, ToggleRight, SidebarOpen, SidebarClose
} from 'lucide-react';
import api from '../services/api';

const ChatArea = ({ conversationId, onToggleDetails, showDetailsPanel, onConversationRead }) => {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (conversationId) {
      loadConversation();
      loadMessages();
      markAsRead(); // Marcar como lida ao abrir
    } else {
      setConversation(null);
      setMessages([]);
    }
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversation = async () => {
    try {
      const response = await api.getConversation(conversationId);
      if (response.success) {
        setConversation(response.data);
      }
    } catch (error) {
      console.error('Erro ao carregar conversa:', error);
    }
  };

  const loadMessages = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.getMessages(conversationId, { limit: 100 });

      if (response.success) {
        // ✅ Backend agora busca da Unipile API e retorna já ordenado corretamente
        // (mais antiga primeiro, mais recente embaixo)
        const messagesData = response.data.messages || [];
        setMessages(messagesData);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      setError('Falha ao carregar mensagens');
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async () => {
    try {
      await api.markAsRead(conversationId);
      // Atualizar conversa local para zerar unread_count
      if (conversation) {
        setConversation({ ...conversation, unread_count: 0 });
      }
      // Notificar o componente pai para atualizar a lista
      if (onConversationRead) {
        onConversationRead(conversationId);
      }
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
      // Não mostrar erro ao usuário, apenas logar
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!newMessage.trim()) return;

    try {
      setIsSending(true);
      setError(null);

      const response = await api.sendMessage(conversationId, newMessage.trim());

      if (response.success) {
        // Add message optimistically to local state
        const sentMessage = {
          id: response.data.id || Date.now(),
          content: newMessage.trim(),
          sender_type: 'user',
          sent_at: new Date().toISOString(),
          ...response.data
        };

        setMessages([...messages, sentMessage]);
        setNewMessage('');

        // Reset textarea height
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }

        // ✅ Não recarregar automaticamente - a mensagem já foi adicionada ao estado local
        // Se precisar de mensagens novas do lead, elas virão via webhook ou ao reabrir a conversa
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setError('Falha ao enviar mensagem');
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleAI = async () => {
    if (!conversation) return;

    try {
      const newStatus = conversation.status === 'ai_active' ? 'manual' : 'ai_active';
      await api.updateConversationStatus(conversationId, newStatus);

      // Update local state
      setConversation({ ...conversation, status: newStatus });
    } catch (error) {
      console.error('Erro ao alternar modo IA:', error);
      setError('Falha ao alternar modo IA');
    }
  };

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';

    const date = new Date(timestamp);

    // Verificar se a data é válida
    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', timestamp);
      return '';
    }

    // Formatar hora
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const linkifyText = (text) => {
    if (!text) return text;

    // Regex mais abrangente para detectar URLs:
    // - https://... ou http://...
    // - www....
    // - dominio.com/caminho (sem protocolo)
    // Captura caracteres especiais válidos em URLs: _ - ~ : / ? # [ ] @ ! $ & ' ( ) * + , ; = %
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=%-]*)?)/gi;

    const parts = [];
    let lastIndex = 0;
    let match;

    // Reset regex index
    urlRegex.lastIndex = 0;

    while ((match = urlRegex.exec(text)) !== null) {
      const url = match[0];

      // Verificar se não é parte de um email (evitar false positives)
      const textBefore = text.substring(Math.max(0, match.index - 1), match.index);
      if (textBefore === '@') {
        continue;
      }

      // Adicionar texto antes do link
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Determinar o href correto
      let href;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        href = url;
      } else if (url.startsWith('www.')) {
        href = `https://${url}`;
      } else {
        // Domínio sem protocolo (ex: app.onstrider.com/r/arthur_2v3cde)
        href = `https://${url}`;
      }

      parts.push(
        <a
          key={match.index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
      );

      lastIndex = match.index + match[0].length;
    }

    // Adicionar o texto restante
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  const handleTextareaChange = (e) => {
    setNewMessage(e.target.value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Empty State
  if (!conversationId) {
    return (
      <div className="flex-1 bg-white flex items-center justify-center">
        <div className="text-center">
          <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Selecione uma conversa</p>
          <p className="text-sm text-gray-500 mt-1">
            Escolha uma conversa da lista para começar
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white flex flex-col h-full">
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          {conversation?.lead_picture ? (
            <img
              src={conversation.lead_picture}
              alt={conversation.lead_name}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold">
                {conversation?.lead_name?.charAt(0) || '?'}
              </span>
            </div>
          )}

          {/* Info */}
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-900 truncate">
              {conversation?.lead_name}
            </h2>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <span className="truncate">{conversation?.lead_title}</span>
              {conversation?.lead_company && (
                <>
                  <span>•</span>
                  <span className="truncate">{conversation?.lead_company}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* AI Toggle */}
          <button
            onClick={handleToggleAI}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              conversation?.status === 'ai_active'
                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
            }`}
          >
            {conversation?.status === 'ai_active' ? (
              <>
                <ToggleRight className="w-4 h-4" />
                <span>IA Ativa</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-4 h-4" />
                <span>Manual</span>
              </>
            )}
          </button>

          {/* LinkedIn Link */}
          {conversation?.lead_profile_url && (
            <a
              href={conversation.lead_profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Ver perfil no LinkedIn"
            >
              <Linkedin className="w-5 h-5" />
            </a>
          )}

          {/* Toggle Details Panel */}
          <button
            onClick={onToggleDetails}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title={showDetailsPanel ? 'Esconder detalhes' : 'Mostrar detalhes'}
          >
            {showDetailsPanel ? (
              <SidebarClose className="w-5 h-5" />
            ) : (
              <SidebarOpen className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Carregando mensagens...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 font-medium">{error}</p>
              <button
                onClick={loadMessages}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Nenhuma mensagem ainda</p>
              <p className="text-sm text-gray-500 mt-1">
                Envie a primeira mensagem para iniciar a conversa
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages.map((message, index) => {
              const isUser = message.sender_type === 'user' || message.type === 'outgoing';
              const isAI = message.sender_type === 'ai';

              return (
                <div
                  key={message.id || index}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`flex items-start gap-2 max-w-lg ${
                      isUser ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isUser
                          ? 'bg-purple-600 text-white'
                          : isAI
                          ? 'bg-green-600 text-white'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {isUser ? (
                        <User className="w-4 h-4" />
                      ) : isAI ? (
                        <Bot className="w-4 h-4" />
                      ) : (
                        <span className="text-xs font-semibold">
                          {conversation?.lead_name?.charAt(0) || 'L'}
                        </span>
                      )}
                    </div>

                    {/* Message Bubble */}
                    <div>
                      <div
                        className={`rounded-2xl px-4 py-2 ${
                          isUser
                            ? 'bg-purple-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-900'
                        }`}
                      >
                        <p className={`text-sm whitespace-pre-wrap ${isUser ? '[&_a]:text-white [&_a]:underline [&_a:hover]:text-blue-100' : '[&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800'}`}>
                          {linkifyText(message.content || message.text)}
                        </p>
                      </div>
                      <p
                        className={`text-xs mt-1 ${
                          isUser ? 'text-right text-gray-500' : 'text-left text-gray-500'
                        }`}
                      >
                        {formatMessageTime(message.sent_at || message.date)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
        {error && (
          <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-end gap-3">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem... (Enter para enviar)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              rows="1"
              style={{ maxHeight: '120px' }}
              disabled={isSending}
            />
          </div>

          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
          >
            {isSending ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Enviar</span>
              </>
            )}
          </button>
        </form>

        <p className="text-xs text-gray-500 mt-2">
          {conversation?.status === 'ai_active'
            ? 'A IA está monitorando esta conversa e responderá automaticamente'
            : 'Você está no controle manual desta conversa'}
        </p>
      </div>
    </div>
  );
};

export default ChatArea;
