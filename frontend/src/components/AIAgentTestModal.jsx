// frontend/src/components/AIAgentTestModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, User, Bot, Loader, RotateCcw, Info } from 'lucide-react';
import api from '../services/api';

const AIAgentTestModal = ({ isOpen, onClose, agent }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testLeadData, setTestLeadData] = useState({
    name: 'João Silva',
    company: 'Tech Solutions LTDA',
    title: 'CEO',
    location: 'São Paulo, Brasil',
    industry: 'Tecnologia da Informação',
    connections: '500+',
    summary: 'Profissional experiente em transformação digital'
  });
  const [showLeadData, setShowLeadData] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && agent) {
      // Adicionar mensagem inicial do agente quando abrir
      addInitialMessage();
    }
  }, [isOpen, agent]);

  const addInitialMessage = async () => {
    setMessages([]);
    setIsLoading(true);

    try {
      // Try new unified system first
      let response;
      try {
        response = await api.testAgentInitialMessage(agent.id, {
          lead_data: testLeadData
        });
      } catch (error) {
        // Fallback to old system if agent is from ai_agents table
        console.log('Trying legacy AI agent API...');
        response = await api.testAIAgentInitialMessage(agent.id, {
          lead_data: testLeadData
        });
      }

      setMessages([{
        id: Date.now(),
        sender: 'bot',
        content: response.data.message,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Erro ao gerar mensagem inicial:', error);
      // Fallback para mensagem padrão baseada na configuração do agente
      let initialMsg = 'Olá! Como posso ajudar?';

      if (agent.config?.initial_approach) {
        initialMsg = agent.config.initial_approach;
      } else if (agent.config?.initial_message) {
        initialMsg = agent.config.initial_message;
      } else if (agent.initial_approach) {
        initialMsg = agent.initial_approach;
      }

      setMessages([{
        id: Date.now(),
        sender: 'bot',
        content: initialMsg,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Try new unified system first
      let response;
      try {
        response = await api.testAgentResponse(agent.id, {
          message: inputMessage,
          conversation_history: messages.map(m => ({
            sender_type: m.sender === 'user' ? 'lead' : 'ai',
            content: m.content
          })),
          lead_data: testLeadData
        });
      } catch (error) {
        // Fallback to old system if agent is from ai_agents table
        console.log('Trying legacy AI agent API...');
        response = await api.testAIAgentResponse(agent.id, {
          message: inputMessage,
          conversation_history: messages.map(m => ({
            sender_type: m.sender === 'user' ? 'lead' : 'ai',
            content: m.content
          })),
          lead_data: testLeadData
        });
      }

      const botMessage = {
        id: Date.now() + 1,
        sender: 'bot',
        content: response.data.response,
        intent: response.data.intent,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Erro ao gerar resposta:', error);

      const errorMessage = {
        id: Date.now() + 1,
        sender: 'bot',
        content: 'Desculpe, houve um erro ao processar sua mensagem. Tente novamente.',
        error: true,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleReset = () => {
    addInitialMessage();
    setInputMessage('');
  };

  const handleClose = () => {
    setMessages([]);
    setInputMessage('');
    onClose();
  };

  const getIntentColor = (intent) => {
    const colors = {
      interested: 'text-green-600 bg-green-50',
      ready_to_buy: 'text-purple-600 bg-purple-50',
      not_interested: 'text-red-600 bg-red-50',
      asking_details: 'text-blue-600 bg-blue-50',
      objection: 'text-orange-600 bg-orange-50',
      neutral: 'text-gray-600 bg-gray-50'
    };
    return colors[intent] || colors.neutral;
  };

  const getIntentLabel = (intent) => {
    const labels = {
      interested: 'Interessado',
      ready_to_buy: 'Pronto para comprar',
      not_interested: 'Não interessado',
      asking_details: 'Pedindo detalhes',
      objection: 'Objeção',
      neutral: 'Neutro',
      initial_contact: 'Contato inicial'
    };
    return labels[intent] || intent;
  };

  if (!isOpen || !agent) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {agent.avatar_url ? (
                <img
                  src={agent.avatar_url}
                  alt={agent.name}
                  className="w-10 h-10 rounded-lg object-cover"
                />
              ) : (
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-gray-900">Testar Agente: {agent.name}</h2>
                <p className="text-sm text-gray-600">Simule uma conversa e veja como o agente responde</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLeadData(!showLeadData)}
                className="p-2 hover:bg-white rounded-lg transition-colors text-gray-600"
                title="Ver/editar dados do lead de teste"
              >
                <Info className="w-5 h-5" />
              </button>
              <button
                onClick={handleReset}
                className="p-2 hover:bg-white rounded-lg transition-colors text-gray-600"
                title="Reiniciar conversa"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Lead Data Editor */}
        {showLeadData && (
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
            <p className="text-sm font-medium text-gray-700 mb-3">Dados do Lead de Teste:</p>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                value={testLeadData.name}
                onChange={(e) => setTestLeadData({ ...testLeadData, name: e.target.value })}
                placeholder="Nome"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                type="text"
                value={testLeadData.company}
                onChange={(e) => setTestLeadData({ ...testLeadData, company: e.target.value })}
                placeholder="Empresa"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                type="text"
                value={testLeadData.title}
                onChange={(e) => setTestLeadData({ ...testLeadData, title: e.target.value })}
                placeholder="Cargo"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <button
              onClick={handleReset}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Aplicar mudanças e reiniciar conversa
            </button>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.sender === 'bot' && (
                agent.avatar_url ? (
                  <img
                    src={agent.avatar_url}
                    alt={agent.name}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                )
              )}

              <div className={`flex flex-col gap-1 max-w-[70%] ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`px-4 py-2 rounded-2xl ${
                    message.sender === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.error
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-white text-gray-900 border border-gray-200'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>

                {message.intent && (
                  <div className={`text-xs px-2 py-1 rounded-full ${getIntentColor(message.intent)}`}>
                    🎯 {getIntentLabel(message.intent)}
                  </div>
                )}

                <span className="text-xs text-gray-500">
                  {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {message.sender === 'user' && (
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              {agent.avatar_url ? (
                <img
                  src={agent.avatar_url}
                  alt={agent.name}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader className="w-4 h-4 text-purple-600 animate-spin" />
                  <span className="text-sm text-gray-600">Pensando...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="px-6 py-4 border-t border-gray-200 bg-white">
          <div className="flex gap-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem como se fosse um lead..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
              Enviar
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Pressione Enter para enviar • Shift+Enter para quebra de linha
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIAgentTestModal;
