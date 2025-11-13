import React, { useState, useEffect } from 'react';
import { Send, Bot, User, Search } from 'lucide-react';
import api from '../services/api';

const ConversationsPage = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await api.getConversations();
      if (response.success) {
        setConversations(response.data.conversations);
        if (response.data.conversations.length > 0) {
          setSelectedConversation(response.data.conversations[0]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const response = await api.getConversation(conversationId);
      if (response.success) {
        setMessages(response.data.messages || []);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const response = await api.sendMessage(selectedConversation.id, newMessage);
      if (response.success) {
        setMessages([...messages, response.data]);
        setNewMessage('');
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando conversas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      
      {/* Conversations List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Conversas</h2>
          <div className="relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar conversas..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => setSelectedConversation(conversation)}
              className={`
                w-full p-4 border-b border-gray-200 text-left transition-colors
                ${selectedConversation?.id === conversation.id 
                  ? 'bg-purple-50 border-l-4 border-l-purple-600' 
                  : 'hover:bg-gray-50'
                }
              `}
            >
              <div className="flex items-start space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                  {conversation.lead_name?.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-gray-900 truncate">
                      {conversation.lead_name}
                    </p>
                    {conversation.unread_count > 0 && (
                      <span className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                        {conversation.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-1">{conversation.lead_company}</p>
                  <p className="text-sm text-gray-600 truncate">
                    {conversation.last_message_preview || 'Sem mensagens'}
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    {conversation.ai_active && (
                      <span className="flex items-center space-x-1 text-xs text-green-600">
                        <Bot className="w-3 h-3" />
                        <span>IA Ativa</span>
                      </span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      conversation.status === 'hot' ? 'bg-red-100 text-red-700' :
                      conversation.status === 'warm' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {conversation.status === 'hot' ? '🔥 Hot' :
                       conversation.status === 'warm' ? '⚡ Warm' :
                       '❄️ Cold'}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-50">
        
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center text-white font-bold">
                  {selectedConversation.lead_name?.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{selectedConversation.lead_name}</p>
                  <p className="text-xs text-gray-500">
                    {selectedConversation.lead_title} • {selectedConversation.lead_company}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {selectedConversation.ai_active ? (
                  <button className="px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-lg">
                    IA Ativa
                  </button>
                ) : (
                  <button className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg">
                    Controle Manual
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start space-x-2 max-w-lg ${
                    message.sender_type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.sender_type === 'user'
                        ? 'bg-purple-600 text-white'
                        : message.sender_type === 'ai'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-600 text-white'
                    }`}>
                      {message.sender_type === 'user' ? (
                        <User className="w-5 h-5" />
                      ) : message.sender_type === 'ai' ? (
                        <Bot className="w-5 h-5" />
                      ) : (
                        message.sender_type?.substring(0, 1).toUpperCase()
                      )}
                    </div>
                    <div className={`rounded-2xl px-4 py-2 ${
                      message.sender_type === 'user'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-900'
                    }`}>
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.sender_type === 'user' ? 'text-purple-200' : 'text-gray-400'
                      }`}>
                        {new Date(message.sent_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input */}
            <div className="bg-white p-4 border-t border-gray-200">
              <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center space-x-2"
                >
                  <Send className="w-5 h-5" />
                  <span>Enviar</span>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Selecione uma conversa para começar</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default ConversationsPage;