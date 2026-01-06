// frontend/src/components/AIAgentTestModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, User, Bot, Loader, RotateCcw, Info, UserX, AlertTriangle, CheckCircle, Globe, Clock, FastForward } from 'lucide-react';
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
  const inputRef = useRef(null);

  // Estados para simulação de fluxo de convite LinkedIn
  const [inviteState, setInviteState] = useState('none'); // 'none', 'pending', 'accepted'
  const [showAcceptOptions, setShowAcceptOptions] = useState(false);

  // Estados para nó de espera (wait action)
  const [waitInfo, setWaitInfo] = useState(null); // { waitTime, waitUnit, formattedDuration }
  const [showWaitBanner, setShowWaitBanner] = useState(false);
  const [workflowState, setWorkflowState] = useState(null); // Estado do workflow para agentes com workflow

  // Obter etapas da conversa do agente (pode estar em agent.conversation_steps ou agent.config)
  const getConversationSteps = () => {
    // Primeiro tenta do campo direto (novo formato)
    if (agent?.conversation_steps) {
      if (typeof agent.conversation_steps === 'string') {
        try {
          return JSON.parse(agent.conversation_steps);
        } catch {
          return [];
        }
      }
      return agent.conversation_steps;
    }
    // Fallback para config (formato antigo)
    return agent?.config?.conversation_steps || [];
  };
  const conversationSteps = getConversationSteps();
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
      // Resetar estados
      setMessages([]);
      setEscalationTriggered(false);
      setEscalationReason(null);
      setInviteState('none');
      setShowAcceptOptions(false);
      setWaitInfo(null);
      setShowWaitBanner(false);
      setWorkflowState(null);

      // Verificar estratégia de conexão do agente
      const strategy = agent.connection_strategy || agent.config?.connection_strategy;

      if (agent.agent_type === 'linkedin' && strategy) {
        if (strategy === 'silent') {
          // Conexão Silenciosa: não mostrar mensagem inicial, aguardar usuário
          setInviteState('accepted'); // Já aceito (sem convite)
          // Não chamar addInitialMessage - usuário deve iniciar
        } else if (strategy === 'with-intro' || strategy === 'icebreaker') {
          // Mostrar convite pendente
          setInviteState('pending');

          // Mostrar mensagem do convite
          const inviteMsg = agent.invite_message || agent.config?.invite_message || agent.initial_approach;
          if (inviteMsg) {
            setMessages([{
              id: Date.now(),
              sender: 'bot',
              content: processTemplate(inviteMsg, testLeadData),
              isInvite: true,
              timestamp: new Date()
            }]);
          }
        } else {
          // Estratégia não reconhecida, comportamento padrão
          addInitialMessage();
        }
      } else {
        // Não é LinkedIn ou sem estratégia definida - comportamento padrão
        addInitialMessage();
      }
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

  // Handler para aceitar convite (simulação)
  const handleAcceptInvite = () => {
    setInviteState('accepted');
    setShowAcceptOptions(true);
  };

  // Handler para recusar convite (simulação)
  const handleRejectInvite = () => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      sender: 'system',
      content: '❌ Convite recusado pelo lead.',
      isSystem: true,
      timestamp: new Date()
    }]);
    setInviteState('none');
  };

  // Handler quando usuário escolhe deixar o agente iniciar após aceitar
  const handleAgentStartsConversation = async () => {
    setShowAcceptOptions(false);
    setIsLoading(true);

    // Se agente tem workflow, processar evento invite_accepted
    if (agent.workflow_enabled && agent.workflow_definition) {
      try {
        // Chamar API de teste com evento invite_accepted
        const response = await api.testAgentResponse(agent.id, {
          message: null, // Sem mensagem do lead
          conversation_history: messages.map(m => ({
            sender_type: m.sender === 'user' ? 'lead' : 'ai',
            content: m.content
          })),
          lead_data: testLeadData,
          current_step: currentStep,
          workflow_state: workflowState || { status: 'active', step_history: [] },
          event_type: 'invite_accepted' // Evento especial de aceite
        });

        const data = response.data;

        // ✅ Verificar se há múltiplas respostas
        if (data.allResponses && data.allResponses.length > 1) {
          const newMessages = data.allResponses.map((r, index) => ({
            id: Date.now() + index,
            sender: 'bot',
            content: r.message,
            nodeLabel: r.nodeLabel,
            timestamp: new Date(Date.now() + index * 100)
          }));
          setMessages(prev => [...prev, ...newMessages]);
        } else if (data.response) {
          // Única resposta
          setMessages(prev => [...prev, {
            id: Date.now(),
            sender: 'bot',
            content: data.response,
            timestamp: new Date()
          }]);
        }

        // Atualizar workflow state
        if (data.workflow_state) {
          setWorkflowState(data.workflow_state);
        }

        // Verificar se há waitInfo (nó Aguardar ativado)
        if (data.waitInfo?.isWaitAction) {
          setWaitInfo(data.waitInfo);
          setShowWaitBanner(true);
        }
      } catch (error) {
        console.error('Erro ao processar invite_accepted no workflow:', error);
        // Fallback para mensagem genérica
        setMessages(prev => [...prev, {
          id: Date.now(),
          sender: 'bot',
          content: processTemplate('Olá {{first_name}}! Que bom que conectamos! Como posso ajudar você hoje?', testLeadData),
          timestamp: new Date()
        }]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Fluxo legado para agentes sem workflow
    // Usar post_accept_message se disponível, senão gerar via IA
    const postAcceptMsg = agent.post_accept_message || agent.config?.post_accept_message;

    if (postAcceptMsg) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'bot',
        content: processTemplate(postAcceptMsg, testLeadData),
        timestamp: new Date()
      }]);
      setIsLoading(false);
    } else {
      // Gerar mensagem inicial via IA (diferente da mensagem do convite)
      try {
        let response;
        try {
          response = await api.testAgentInitialMessage(agent.id, {
            lead_data: testLeadData,
            context: 'post_accept' // Indica que é após aceite
          });
        } catch (error) {
          response = await api.testAIAgentInitialMessage(agent.id, {
            lead_data: testLeadData
          });
        }

        setMessages(prev => [...prev, {
          id: Date.now(),
          sender: 'bot',
          content: response.data.message,
          timestamp: new Date()
        }]);
      } catch (error) {
        console.error('Erro ao gerar mensagem pós-aceite:', error);
        // Fallback para mensagem genérica
        setMessages(prev => [...prev, {
          id: Date.now(),
          sender: 'bot',
          content: processTemplate('Olá {{first_name}}! Que bom que conectamos! Como posso ajudar você hoje?', testLeadData),
          timestamp: new Date()
        }]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handler quando usuário escolhe enviar mensagem (ele digita como lead)
  const handleUserStartsConversation = () => {
    setShowAcceptOptions(false);
    // Apenas habilita o input para o usuário digitar
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    // Esconder opções de aceite quando usuário envia mensagem
    setShowAcceptOptions(false);

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
          lead_data: testLeadData,
          current_step: currentStep,  // Pass current step to backend for intelligent progression
          workflow_state: workflowState  // Pass workflow state for agents with workflow
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
          lead_data: testLeadData,
          current_step: currentStep  // Pass current step to backend for intelligent progression
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

      // Atualizar etapa baseado na análise inteligente do backend
      // O backend analisa a conversa e determina se deve avançar de etapa
      // usando a tag [NEXT_STEP] quando a IA determina que o objetivo da etapa foi cumprido
      let newStep = currentStep;
      if (response.data.current_step !== undefined) {
        newStep = response.data.current_step;
        setCurrentStep(newStep);

        // Log step advancement for debugging
        if (response.data.step_advanced) {
          console.log(`📈 Etapa avançou: ${currentStep + 1} → ${newStep + 1}`);
        }
      }

      // Verificar se a nova etapa é de escalação
      if (conversationSteps.length > 0 && newStep < conversationSteps.length) {
        const currentStepData = conversationSteps[newStep];
        const stepData = typeof currentStepData === 'object' ? currentStepData : { text: currentStepData, is_escalation: false };
        if (stepData.is_escalation && !escalationTriggered) {
          setEscalationTriggered(true);
          setEscalationReason({ type: 'step', value: stepData.text || `Etapa ${newStep + 1}` });
        }
      }

      // Se backend indicou escalação
      if (shouldEscalate && !escalationTriggered) {
        setEscalationTriggered(true);
        setEscalationReason({ type: 'ai', value: escalationInfo || 'Decisão da IA' });
      }

      // Get current step info for the message (use newStep que acabamos de calcular)
      const messageStep = conversationSteps.length > 0 ? newStep : null;
      const messageStepData = messageStep !== null ? (
        typeof conversationSteps[messageStep] === 'object'
          ? conversationSteps[messageStep]
          : { text: conversationSteps[messageStep], is_escalation: false }
      ) : null;

      // ✅ Verificar se há múltiplas respostas (quando múltiplos nós executam em sequência)
      const allResponses = response.data.allResponses;

      if (allResponses && allResponses.length > 1) {
        // Múltiplas respostas - adicionar cada uma como mensagem separada
        console.log(`📬 Múltiplas respostas (${allResponses.length}):`, allResponses.map(r => r.nodeLabel));

        const newMessages = allResponses.map((r, index) => ({
          id: Date.now() + index + 1,
          sender: 'bot',
          content: r.message,
          nodeLabel: r.nodeLabel, // Label do nó para debug
          nodeType: r.type,       // Tipo do nó (action, conversationStep)
          intent: index === allResponses.length - 1 ? response.data.intent : null, // Intent só na última
          sentiment: index === allResponses.length - 1 ? detectedSentiment : null,
          shouldEscalate: index === allResponses.length - 1 ? shouldEscalate : false,
          matchedKeywords: index === allResponses.length - 1 ? matchedKeywords : [],
          escalationInfo: index === allResponses.length - 1 ? escalationInfo : null,
          stepNumber: messageStep !== null ? messageStep + 1 : null,
          stepText: messageStepData?.text || null,
          stepIsEscalation: messageStepData?.is_escalation || false,
          timestamp: new Date(Date.now() + index * 100) // Pequena diferença para ordenação
        }));

        setMessages(prev => [...prev, ...newMessages]);
      } else {
        // Única resposta - comportamento original
        const botMessage = {
          id: Date.now() + 1,
          sender: 'bot',
          content: response.data.response,
          intent: response.data.intent,
          sentiment: detectedSentiment,
          shouldEscalate,
          matchedKeywords,
          escalationInfo,
          stepNumber: messageStep !== null ? messageStep + 1 : null,
          stepText: messageStepData?.text || null,
          stepIsEscalation: messageStepData?.is_escalation || false,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, botMessage]);
      }

      // Atualizar workflow state se retornado (para agentes com workflow)
      if (response.data.workflow_state) {
        setWorkflowState(response.data.workflow_state);
      }

      // Verificar se há waitInfo (nó Aguardar ativado)
      if (response.data.waitInfo?.isWaitAction) {
        setWaitInfo(response.data.waitInfo);
        setShowWaitBanner(true);
      } else {
        setWaitInfo(null);
        setShowWaitBanner(false);
      }
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
    setWaitInfo(null);
    setShowWaitBanner(false);
  };

  // Handler para pular espera no modo teste
  const handleSkipWait = async () => {
    if (!waitInfo || !workflowState) return;

    setIsLoading(true);
    setShowWaitBanner(false);

    try {
      // Modificar workflow state para continuar (pular wait)
      const modifiedWorkflowState = {
        ...workflowState,
        status: 'active',
        pausedReason: null
      };

      // Chamar API com estado modificado para continuar o workflow
      const response = await api.testAgentResponse(agent.id, {
        message: '__SKIP_WAIT__', // Mensagem especial que indica pular espera
        conversation_history: messages.map(m => ({
          sender_type: m.sender === 'user' ? 'lead' : 'ai',
          content: m.content
        })),
        lead_data: testLeadData,
        current_step: currentStep,
        workflow_state: modifiedWorkflowState,
        skip_wait: true
      });

      const data = response.data;

      // ✅ Verificar se há múltiplas respostas
      if (data.allResponses && data.allResponses.length > 1) {
        const newMessages = data.allResponses.map((r, index) => ({
          id: Date.now() + index,
          sender: 'bot',
          content: r.message,
          nodeLabel: r.nodeLabel,
          timestamp: new Date(Date.now() + index * 100),
          waitSkipped: index === 0
        }));
        setMessages(prev => [...prev, ...newMessages]);
      } else if (data.response) {
        // Única resposta
        setMessages(prev => [...prev, {
          id: Date.now(),
          sender: 'bot',
          content: data.response,
          timestamp: new Date(),
          waitSkipped: true
        }]);
      }

      // Atualizar workflow state
      if (data.workflow_state) {
        setWorkflowState(data.workflow_state);
      }

      // Verificar se há novo wait
      if (data.waitInfo?.isWaitAction) {
        setWaitInfo(data.waitInfo);
        setShowWaitBanner(true);
      } else {
        setWaitInfo(null);
      }
    } catch (error) {
      console.error('Erro ao pular espera:', error);
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'bot',
        content: 'Erro ao continuar após espera. Tente novamente.',
        error: true,
        timestamp: new Date()
      }]);
      // Restaurar banner de wait em caso de erro
      setShowWaitBanner(true);
    } finally {
      setIsLoading(false);
    }
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
          <div className="px-6 py-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-b border-purple-200 dark:border-purple-700">
            {/* Current Step Display */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {currentStep + 1}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">ETAPA ATUAL</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {(() => {
                        const step = conversationSteps[currentStep];
                        const stepData = typeof step === 'object' ? step : { text: step, is_escalation: false };
                        return stepData.text || `Etapa ${currentStep + 1}`;
                      })()}
                    </p>
                  </div>
                </div>
                {(() => {
                  const step = conversationSteps[currentStep];
                  const stepData = typeof step === 'object' ? step : { text: step, is_escalation: false };
                  if (stepData.is_escalation) {
                    return (
                      <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-xs font-medium flex items-center gap-1">
                        <UserX className="w-3 h-3" />
                        Ponto de transferência
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Status de Escalação */}
              {escalationTriggered ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-lg">
                  <UserX className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                    Transferência ativada
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                  <Bot className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-xs text-green-700 dark:text-green-300 font-medium">IA respondendo</span>
                </div>
              )}
            </div>

            {/* Steps Progress Bar */}
            <div className="flex items-center gap-1">
              {conversationSteps.map((step, index) => {
                const stepData = typeof step === 'object' ? step : { text: step, is_escalation: false };
                const isActive = index === currentStep;
                const isPast = index < currentStep;
                const isEscalation = stepData.is_escalation;

                return (
                  <div key={index} className="flex items-center flex-1">
                    <div className={`relative group flex-1`}>
                      {/* Progress line */}
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          isPast
                            ? 'bg-green-500'
                            : isActive
                            ? isEscalation
                              ? 'bg-orange-500'
                              : 'bg-purple-500'
                            : isEscalation
                            ? 'bg-orange-200 dark:bg-orange-800'
                            : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      />
                      {/* Step indicator dot */}
                      <div
                        className={`absolute -top-1 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 transition-all ${
                          isPast
                            ? 'bg-green-500 border-green-600'
                            : isActive
                            ? isEscalation
                              ? 'bg-orange-500 border-orange-600 ring-2 ring-orange-200'
                              : 'bg-purple-500 border-purple-600 ring-2 ring-purple-200'
                            : isEscalation
                            ? 'bg-orange-100 border-orange-300 dark:bg-orange-900 dark:border-orange-600'
                            : 'bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-600'
                        }`}
                      >
                        {isPast && <CheckCircle className="w-2.5 h-2.5 text-white absolute top-0 left-0" />}
                        {isEscalation && !isPast && (
                          <UserX className="w-2 h-2 text-orange-500 dark:text-orange-400 absolute top-0 left-0.5" />
                        )}
                      </div>
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-2 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 max-w-[200px] text-center">
                        <span className="font-semibold">{index + 1}.</span> {stepData.text || `Etapa ${index + 1}`}
                        {isEscalation && <span className="block text-orange-300 text-[10px] mt-0.5">Ponto de transferência</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Step labels below */}
            <div className="flex items-center justify-between mt-1 px-1">
              <span className="text-[10px] text-gray-500 dark:text-gray-400">Início</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">{conversationSteps.length} etapas</span>
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

        {/* Wait Action Banner */}
        {showWaitBanner && waitInfo && (
          <div className="px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Aguardando {waitInfo.waitTime} {waitInfo.waitUnit === 'seconds' ? 'segundos' : waitInfo.waitUnit === 'minutes' ? 'minutos' : waitInfo.waitUnit === 'days' ? 'dias' : 'horas'}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Em produção, o workflow aguardaria este tempo antes de continuar
                </p>
              </div>
            </div>
            <button
              onClick={handleSkipWait}
              disabled={isLoading}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FastForward className="w-4 h-4" />
              Pular Espera
            </button>
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

                {/* Indicadores de Etapa e Escalação */}
                <div className="flex flex-wrap gap-1">
                  {/* Step indicator for bot messages */}
                  {message.sender === 'bot' && message.stepNumber && (
                    <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                      message.stepIsEscalation
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-700'
                        : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-300 dark:border-purple-700'
                    }`}>
                      <span className="font-semibold">Etapa {message.stepNumber}</span>
                      {message.stepText && <span className="opacity-75">• {message.stepText.substring(0, 30)}{message.stepText.length > 30 ? '...' : ''}</span>}
                      {message.stepIsEscalation && <UserX className="w-3 h-3 ml-1" />}
                    </div>
                  )}

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

          {/* Indicador de Conexão Silenciosa com opções */}
          {inviteState === 'accepted' && messages.length === 0 && agent.agent_type === 'linkedin' && (agent.connection_strategy === 'silent' || agent.config?.connection_strategy === 'silent') && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700 mx-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Modo Conexão Silenciosa
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 mb-3">
                    O lead acabou de aceitar a conexão sem mensagem. O que você quer testar?
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => inputRef.current?.focus()}
                      className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-left transition-colors"
                    >
                      <span className="font-medium text-gray-900 dark:text-gray-100">Lead envia mensagem primeiro</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Digite "Oi" ou outra mensagem no campo abaixo
                      </span>
                    </button>
                    <button
                      onClick={handleAgentStartsConversation}
                      disabled={isLoading}
                      className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-left transition-colors"
                    >
                      <span className="font-medium">Agente inicia a conversa</span>
                      <span className="block text-xs text-purple-200 mt-0.5">
                        {(agent.post_accept_message || agent.config?.post_accept_message)
                          ? 'Testar a mensagem pós-aceite configurada'
                          : 'Ver o que a IA gera para iniciar (após timeout)'
                        }
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botões de Aceitar/Recusar Convite */}
          {inviteState === 'pending' && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700 mx-4">
              <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                O lead recebeu seu convite de conexão. Simule a resposta:
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleAcceptInvite}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Aceitar convite
                </button>
                <button
                  onClick={handleRejectInvite}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                >
                  Recusar
                </button>
              </div>
            </div>
          )}

          {/* Opções após aceitar convite */}
          {showAcceptOptions && (
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700 mx-4">
              <p className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-3">
                ✓ Lead aceitou a conexão! O que acontece agora?
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleUserStartsConversation}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-600 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 text-left transition-colors"
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">Enviar uma mensagem</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Você digita como se fosse o lead
                  </span>
                </button>
                <button
                  onClick={handleAgentStartsConversation}
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-left transition-colors"
                >
                  <span className="font-medium">Deixar o agente iniciar</span>
                  <span className="block text-xs text-purple-200 mt-0.5">
                    Agente envia mensagem pós-aceite
                  </span>
                </button>
              </div>
            </div>
          )}

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
              ref={inputRef}
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
