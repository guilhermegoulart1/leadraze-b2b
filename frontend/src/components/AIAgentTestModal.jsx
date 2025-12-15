// frontend/src/components/AIAgentTestModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, User, Bot, Loader, RotateCcw, Info, UserX, AlertTriangle, CheckCircle, Globe } from 'lucide-react';
import api from '../services/api';

// Mapeamento de códigos de idioma para nomes
const LANGUAGE_NAMES = {
  'pt-BR': 'Português (Brasil)',
  'pt-PT': 'Português (Portugal)',
  'en': 'English',
  'es': 'Español',
  'fr': 'Français',
  'it': 'Italiano',
  'de': 'Deutsch',
  'nl': 'Nederlands',
  'pl': 'Polski',
  'ru': 'Русский',
  'ja': '日本語',
  'zh-CN': '简体中文',
  'ko': '한국어',
  'ar': 'العربية',
  'tr': 'Türkçe',
  'hi': 'हिन्दी'
};

// Processar template substituindo variáveis
const processTemplate = (template, leadData) => {
  if (!template || !leadData) return template;

  let processed = template;
  const firstName = leadData.name ? leadData.name.split(' ')[0] : '';

  const variables = {
    '{{first_name}}': firstName,
    '{{primeiro_nome}}': firstName,
    '{{name}}': leadData.name || '',
    '{{nome}}': leadData.name || '',
    '{{company}}': leadData.company || '',
    '{{empresa}}': leadData.company || '',
    '{{title}}': leadData.title || '',
    '{{cargo}}': leadData.title || '',
    '{{location}}': leadData.location || '',
    '{{localizacao}}': leadData.location || '',
    '{{industry}}': leadData.industry || '',
    '{{industria}}': leadData.industry || '',
  };

  Object.entries(variables).forEach(([variable, value]) => {
    const regex = new RegExp(variable.replace(/[{}]/g, '\\$&'), 'gi');
    processed = processed.replace(regex, value);
  });

  return processed;
};

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
  const [currentStep, setCurrentStep] = useState(0);
  const [escalationTriggered, setEscalationTriggered] = useState(false);
  const [escalationReason, setEscalationReason] = useState(null);
  const messagesEndRef = useRef(null);

  // Obter etapas da conversa do agente
  const conversationSteps = agent?.config?.conversation_steps || [];
  const escalationSentiments = agent?.config?.escalation_sentiments || [];
  const escalationKeywords = agent?.config?.escalation_keywords || '';

  // Verificar se há palavras-chave de escalação na mensagem
  const checkEscalationKeywords = (message) => {
    if (!escalationKeywords) return null;
    const keywords = escalationKeywords.toLowerCase().split(',').map(k => k.trim());
    const messageLower = message.toLowerCase();

    for (const keyword of keywords) {
      if (keyword && messageLower.includes(keyword)) {
        return keyword;
      }
    }
    return null;
  };

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

      // Processar template substituindo variáveis com dados do lead de teste
      initialMsg = processTemplate(initialMsg, testLeadData);

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

    // Verificar palavras-chave de escalação na mensagem do usuário
    const keywordFound = checkEscalationKeywords(inputMessage);
    if (keywordFound && !escalationTriggered) {
      setEscalationTriggered(true);
      setEscalationReason({ type: 'keyword', value: keywordFound });
    }

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      content: inputMessage,
      keywordTrigger: keywordFound,
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

      // Verificar se a resposta indica escalação (do backend)
      const shouldEscalate = response.data.should_escalate || response.data.escalation;
      const escalationReasons = response.data.escalation_reasons || [];
      const escalationInfo = escalationReasons.length > 0 ? escalationReasons.join(', ') : response.data.escalation_reason;
      const detectedSentiment = response.data.sentiment || response.data.detected_sentiment;
      const matchedKeywords = response.data.matched_keywords || [];

      // Verificar se sentimento detectado está na lista de escalação
      if (detectedSentiment && escalationSentiments.includes(detectedSentiment) && !escalationTriggered) {
        setEscalationTriggered(true);
        setEscalationReason({ type: 'sentiment', value: detectedSentiment });
      }

      // Verificar se palavras-chave foram detectadas pelo backend
      if (matchedKeywords.length > 0 && !escalationTriggered) {
        setEscalationTriggered(true);
        setEscalationReason({ type: 'keyword', value: matchedKeywords.join(', ') });
      }

      // Atualizar etapa se necessário
      if (response.data.current_step !== undefined) {
        setCurrentStep(response.data.current_step);
      } else if (conversationSteps.length > 0) {
        // Avançar etapa automaticamente baseado no número de interações
        const botMessages = messages.filter(m => m.sender === 'bot').length;
        const newStep = Math.min(botMessages + 1, conversationSteps.length - 1);
        setCurrentStep(newStep);

        // Verificar se a nova etapa é de escalação
        const currentStepData = conversationSteps[newStep];
        if (currentStepData?.is_escalation && !escalationTriggered) {
          setEscalationTriggered(true);
          setEscalationReason({ type: 'step', value: currentStepData.text || `Etapa ${newStep + 1}` });
        }
      }

      // Se backend indicou escalação
      if (shouldEscalate && !escalationTriggered) {
        setEscalationTriggered(true);
        setEscalationReason({ type: 'ai', value: escalationInfo || 'Decisão da IA' });
      }

      const botMessage = {
        id: Date.now() + 1,
        sender: 'bot',
        content: response.data.response,
        intent: response.data.intent,
        sentiment: detectedSentiment,
        shouldEscalate,
        matchedKeywords,
        escalationInfo,
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
    setCurrentStep(0);
    setEscalationTriggered(false);
    setEscalationReason(null);
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-purple-800 bg-[#7229f7]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {agent.avatar_url ? (
                <img
                  src={agent.avatar_url}
                  alt={agent.name}
                  className="w-10 h-10 rounded-lg object-cover border-2 border-white/30"
                />
              ) : (
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-white">Testar Agente: {agent.name}</h2>
                <div className="flex items-center gap-3 text-sm text-purple-100">
                  <span>Simule uma conversa e veja como o agente responde</span>
                  {agent.language && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                      <Globe className="w-3 h-3" />
                      {LANGUAGE_NAMES[agent.language] || agent.language}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLeadData(!showLeadData)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
                title="Ver/editar dados do lead de teste"
              >
                <Info className="w-5 h-5" />
              </button>
              <button
                onClick={handleReset}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
                title="Reiniciar conversa"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Lead Data Editor */}
        {showLeadData && (
          <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-700">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Dados do Lead de Teste:</p>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                value={testLeadData.name}
                onChange={(e) => setTestLeadData({ ...testLeadData, name: e.target.value })}
                placeholder="Nome"
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <input
                type="text"
                value={testLeadData.company}
                onChange={(e) => setTestLeadData({ ...testLeadData, company: e.target.value })}
                placeholder="Empresa"
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <input
                type="text"
                value={testLeadData.title}
                onChange={(e) => setTestLeadData({ ...testLeadData, title: e.target.value })}
                placeholder="Cargo"
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <button
              onClick={handleReset}
              className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            >
              Aplicar mudanças e reiniciar conversa
            </button>
          </div>
        )}

        {/* Status Panel - Etapas e Escalação */}
        {conversationSteps.length > 0 && (
          <div className="px-6 py-3 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              {/* Etapas da Conversa */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Etapa:</span>
                <div className="flex items-center gap-1">
                  {conversationSteps.map((step, index) => {
                    const stepData = typeof step === 'object' ? step : { text: step, is_escalation: false };
                    const isActive = index === currentStep;
                    const isPast = index < currentStep;
                    const isEscalation = stepData.is_escalation;

                    return (
                      <div
                        key={index}
                        className={`relative group`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                            isActive
                              ? isEscalation
                                ? 'bg-orange-500 text-white ring-2 ring-orange-300'
                                : 'bg-purple-600 text-white ring-2 ring-purple-300'
                              : isPast
                              ? 'bg-green-500 text-white'
                              : isEscalation
                              ? 'bg-orange-100 text-orange-600 border border-orange-300'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          {isPast ? (
                            <CheckCircle className="w-3.5 h-3.5" />
                          ) : isEscalation ? (
                            <UserX className="w-3 h-3" />
                          ) : (
                            index + 1
                          )}
                        </div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          {stepData.text || `Etapa ${index + 1}`}
                          {isEscalation && <span className="text-orange-300 ml-1">(Escalação)</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status de Escalação */}
              {escalationTriggered ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-lg">
                  <UserX className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                    Transferência ativada
                    {escalationReason && (
                      <span className="ml-1 text-orange-600 dark:text-orange-400">
                        ({escalationReason.type === 'keyword' && `palavra: "${escalationReason.value}"`}
                        {escalationReason.type === 'sentiment' && `sentimento: ${escalationReason.value}`}
                        {escalationReason.type === 'step' && `etapa de escalação`}
                        {escalationReason.type === 'ai' && `decisão da IA`})
                      </span>
                    )}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <Bot className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">Agente em operação</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Escalation Alert Banner */}
        {escalationTriggered && (
          <div className="px-6 py-3 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-700 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-500 dark:text-orange-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                Transferência para humano será realizada
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400">
                {escalationReason?.type === 'keyword' && `Palavra-chave detectada: "${escalationReason.value}"`}
                {escalationReason?.type === 'sentiment' && `Sentimento detectado: ${
                  escalationReason.value === 'frustration' ? 'Frustração' :
                  escalationReason.value === 'confusion' ? 'Confusão' :
                  escalationReason.value === 'high_interest' ? 'Interesse Alto' :
                  escalationReason.value === 'urgency' ? 'Urgência' :
                  escalationReason.value === 'dissatisfaction' ? 'Insatisfação' :
                  escalationReason.value
                }`}
                {escalationReason?.type === 'step' && `Etapa de escalação atingida`}
                {escalationReason?.type === 'ai' && `Decisão automática da IA`}
              </p>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-gray-900">
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
                      ? message.keywordTrigger
                        ? 'bg-orange-500 text-white'
                        : 'bg-blue-600 text-white'
                      : message.error
                      ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700'
                      : message.shouldEscalate
                      ? 'bg-orange-50 dark:bg-orange-900/30 text-gray-900 dark:text-gray-100 border-2 border-orange-300 dark:border-orange-600'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>

                {/* Indicadores de Escalação */}
                <div className="flex flex-wrap gap-1">
                  {message.keywordTrigger && (
                    <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-700">
                      <AlertTriangle className="w-3 h-3" />
                      Palavra-chave: "{message.keywordTrigger}"
                    </div>
                  )}

                  {message.shouldEscalate && (
                    <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-700">
                      <UserX className="w-3 h-3" />
                      Transferir para humano
                    </div>
                  )}

                  {message.sentiment && (
                    <div className={`text-xs px-2 py-1 rounded-full ${
                      escalationSentiments.includes(message.sentiment)
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-700'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}>
                      {message.sentiment === 'frustration' && '😤 Frustração'}
                      {message.sentiment === 'confusion' && '😕 Confusão'}
                      {message.sentiment === 'high_interest' && '🤩 Interesse Alto'}
                      {message.sentiment === 'urgency' && '⚡ Urgência'}
                      {message.sentiment === 'dissatisfaction' && '😒 Insatisfação'}
                      {message.sentiment === 'neutral' && '😐 Neutro'}
                      {message.sentiment === 'positive' && '😊 Positivo'}
                      {!['frustration', 'confusion', 'high_interest', 'urgency', 'dissatisfaction', 'neutral', 'positive'].includes(message.sentiment) && `💬 ${message.sentiment}`}
                      {escalationSentiments.includes(message.sentiment) && (
                        <span className="ml-1">(gatilho)</span>
                      )}
                    </div>
                  )}

                  {message.intent && (
                    <div className={`text-xs px-2 py-1 rounded-full ${getIntentColor(message.intent)}`}>
                      🎯 {getIntentLabel(message.intent)}
                    </div>
                  )}
                </div>

                <span className="text-xs text-gray-500 dark:text-gray-400">
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
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-spin" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Pensando...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex gap-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem como se fosse um lead..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Pressione Enter para enviar • Shift+Enter para quebra de linha
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIAgentTestModal;
