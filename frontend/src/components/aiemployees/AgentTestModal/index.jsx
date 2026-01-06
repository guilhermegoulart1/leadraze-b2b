// frontend/src/components/aiemployees/AgentTestModal/index.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Send, RefreshCw, User, Bot, Settings, Loader,
  ChevronRight, CheckCircle, AlertCircle, Info, Zap,
  Play, Square, Clock, MessageSquare, GitBranch, Search,
  Target, Hash, UserCheck, UserX, ThumbsUp, ThumbsDown,
  FastForward, Timer
} from 'lucide-react';
import api from '../../../services/api';

// Log type colors and icons
const LOG_STYLES = {
  SESSION_STARTED: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: Play },
  SESSION_ENDED: { color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900/20', icon: Square },
  SESSION_RESET: { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', icon: RefreshCw },
  MESSAGE_RECEIVED: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', icon: MessageSquare },
  INVITE_ACCEPTED: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', icon: UserCheck },
  INVITE_IGNORED: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', icon: UserX },
  NO_RESPONSE: { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', icon: Clock },
  NODE_ENTERED: { color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', icon: GitBranch },
  TRIGGER_FIRED: { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', icon: Zap },
  CONDITION_EVALUATED: { color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/20', icon: GitBranch },
  ACTION_STARTED: { color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20', icon: Target },
  ACTION_COMPLETED: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', icon: CheckCircle },
  ACTION_FAILED: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', icon: AlertCircle },
  MESSAGE_GENERATED: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: Bot },
  RAG_SEARCH: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: Search },
  INTENT_DETECTED: { color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-900/20', icon: Target },
  WORKFLOW_STARTED: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', icon: Play },
  WORKFLOW_COMPLETED: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: CheckCircle },
  WORKFLOW_PAUSED: { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', icon: Clock },
  ERROR: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', icon: AlertCircle },
  LEAD_SIMULATION_UPDATED: { color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900/20', icon: User },
};

const AgentTestModal = ({ agent, onClose }) => {
  // Session state
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  // Messages and logs
  const [messages, setMessages] = useState([]);
  const [logs, setLogs] = useState([]);
  const [inputMessage, setInputMessage] = useState('');

  // Event simulation state
  const [inviteStatus, setInviteStatus] = useState(null); // null, 'accepted', 'ignored'
  const [showEventPanel, setShowEventPanel] = useState(true);

  // Lead simulation
  const [showLeadConfig, setShowLeadConfig] = useState(false);
  const [leadSimulation, setLeadSimulation] = useState({
    name: 'Lead de Teste',
    title: 'Diretor de Tecnologia',
    company: 'Empresa Teste Ltda',
    location: 'São Paulo, Brasil',
    industry: 'Tecnologia'
  });

  // Wait action state
  const [waitInfo, setWaitInfo] = useState(null);
  const [waitCountdown, setWaitCountdown] = useState(null); // Countdown in seconds for waits <= 1 min

  // Refs for auto-scroll
  const messagesEndRef = useRef(null);
  const logsEndRef = useRef(null);

  // Start session when modal opens
  useEffect(() => {
    startSession();
    return () => {
      // Cleanup: end session when modal closes
      if (sessionId) {
        endSession();
      }
    };
  }, []);

  // Auto-scroll messages and logs
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Countdown effect for wait actions <= 1 minute
  useEffect(() => {
    if (!waitInfo) {
      setWaitCountdown(null);
      return;
    }

    // Calculate total wait in seconds
    const multipliers = { seconds: 1, minutes: 60, hours: 3600, days: 86400 };
    const totalSeconds = (waitInfo.waitTime || 0) * (multipliers[waitInfo.waitUnit] || 1);

    // Only show countdown for waits <= 60 seconds
    if (totalSeconds <= 60) {
      setWaitCountdown(totalSeconds);

      const interval = setInterval(() => {
        setWaitCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            // Auto-skip when countdown reaches 0
            handleSkipWait();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setWaitCountdown(null);
    }
  }, [waitInfo]);

  // Skip wait action in test mode
  const handleSkipWait = async () => {
    if (!waitInfo || sending || !sessionId) return;

    setSending(true);
    setWaitInfo(null);
    setWaitCountdown(null);

    try {
      const response = await api.sendAgentTestMessage(sessionId, null, 'message_received', true);

      if (response.success) {
        const { data } = response;

        // ✅ Verificar se há múltiplas respostas (quando múltiplos nós executam em sequência)
        if (data.allResponses && data.allResponses.length > 1) {
          const newMessages = data.allResponses.map((r, index) => ({
            id: Date.now() + index,
            sender: 'ai',
            content: r.message,
            nodeLabel: r.nodeLabel,
            timestamp: new Date(Date.now() + index * 100).toISOString()
          }));
          setMessages(prev => [...prev, ...newMessages]);
        } else if (data.response) {
          // Única resposta
          setMessages(prev => [...prev, {
            id: Date.now(),
            sender: 'ai',
            content: data.response,
            timestamp: new Date().toISOString()
          }]);
        }

        // Update logs
        if (data.logs && data.logs.length > 0) {
          setLogs(prev => [...prev, ...data.logs.map(log => ({
            ...log,
            id: log.id || Date.now() + Math.random()
          }))]);
        }

        // Check for new wait action
        if (data.waitInfo?.isWaitAction) {
          setWaitInfo(data.waitInfo);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  // Start a new test session
  const startSession = async () => {
    try {
      setLoading(true);
      setError(null);
      setMessages([]);
      setLogs([]);
      setWaitInfo(null);
      setWaitCountdown(null);

      const response = await api.startAgentTestSession(agent.id, leadSimulation);

      if (response.success) {
        setSessionId(response.data.sessionId);
        setLogs([{
          id: Date.now(),
          timestamp: new Date().toISOString(),
          eventType: 'SESSION_STARTED',
          message: `Sessão de teste iniciada para ${agent.name}`,
          data: { workflowEnabled: response.data.workflowEnabled }
        }]);
      } else {
        throw new Error(response.error || 'Failed to start session');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Simulate an event (invite_accepted, invite_ignored, etc.)
  const simulateEvent = async (eventType) => {
    if (sending || !sessionId) return;

    setSending(true);

    // Add system message to UI
    const eventLabels = {
      invite_accepted: '✅ Convite aceito pelo lead',
      invite_ignored: '❌ Convite ignorado pelo lead',
      no_response: '⏰ Lead não respondeu (timeout)'
    };

    setMessages(prev => [...prev, {
      id: Date.now(),
      sender: 'system',
      content: eventLabels[eventType] || `Evento: ${eventType}`,
      timestamp: new Date().toISOString(),
      isSystemEvent: true
    }]);

    try {
      const response = await api.sendAgentTestMessage(sessionId, null, eventType);

      if (response.success) {
        const { data } = response;

        // Update invite status
        if (eventType === 'invite_accepted') {
          setInviteStatus('accepted');
          setShowEventPanel(false);
        } else if (eventType === 'invite_ignored') {
          setInviteStatus('ignored');
        }

        // ✅ Verificar se há múltiplas respostas (quando múltiplos nós executam em sequência)
        if (data.allResponses && data.allResponses.length > 1) {
          const newMessages = data.allResponses.map((r, index) => ({
            id: Date.now() + index,
            sender: 'ai',
            content: r.message,
            nodeLabel: r.nodeLabel,
            timestamp: new Date(Date.now() + index * 100).toISOString()
          }));
          setMessages(prev => [...prev, ...newMessages]);
        } else if (data.response) {
          // Única resposta
          setMessages(prev => [...prev, {
            id: Date.now(),
            sender: 'ai',
            content: data.response,
            timestamp: new Date().toISOString()
          }]);
        }

        // Update logs
        if (data.logs && data.logs.length > 0) {
          setLogs(prev => [...prev, ...data.logs.map(log => ({
            ...log,
            id: log.id || Date.now() + Math.random()
          }))]);
        }

        // Check for wait action
        if (data.waitInfo?.isWaitAction) {
          setWaitInfo(data.waitInfo);
        }
      } else {
        throw new Error(response.error || 'Failed to simulate event');
      }
    } catch (err) {
      setError(err.message);
      setLogs(prev => [...prev, {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        eventType: 'ERROR',
        message: `Erro ao simular evento: ${err.message}`
      }]);
    } finally {
      setSending(false);
    }
  };

  // Send a test message
  const sendMessage = async () => {
    if (!inputMessage.trim() || sending || !sessionId) return;

    const messageText = inputMessage.trim();
    setInputMessage('');
    setSending(true);

    // Add user message to UI immediately
    const userMessage = {
      id: Date.now(),
      sender: 'lead',
      content: messageText,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await api.sendAgentTestMessage(sessionId, messageText, 'message_received');

      if (response.success) {
        const { data } = response;

        // ✅ Verificar se há múltiplas respostas (quando múltiplos nós executam em sequência)
        if (data.allResponses && data.allResponses.length > 1) {
          console.log(`📬 Múltiplas respostas (${data.allResponses.length}):`, data.allResponses.map(r => r.nodeLabel));
          const newMessages = data.allResponses.map((r, index) => ({
            id: Date.now() + index,
            sender: 'ai',
            content: r.message,
            nodeLabel: r.nodeLabel,
            timestamp: new Date(Date.now() + index * 100).toISOString()
          }));
          setMessages(prev => [...prev, ...newMessages]);
        } else if (data.response) {
          // Única resposta
          setMessages(prev => [...prev, {
            id: Date.now(),
            sender: 'ai',
            content: data.response,
            timestamp: new Date().toISOString()
          }]);
        }

        // Update logs
        if (data.logs && data.logs.length > 0) {
          setLogs(prev => [...prev, ...data.logs.map(log => ({
            ...log,
            id: log.id || Date.now() + Math.random()
          }))]);
        }

        // Check for wait action
        if (data.waitInfo?.isWaitAction) {
          setWaitInfo(data.waitInfo);
        }
      } else {
        throw new Error(response.error || 'Failed to send message');
      }
    } catch (err) {
      setError(err.message);
      // Add error log
      setLogs(prev => [...prev, {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        eventType: 'ERROR',
        message: `Erro ao enviar mensagem: ${err.message}`
      }]);
    } finally {
      setSending(false);
    }
  };

  // Reset the session
  const resetSession = async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      const response = await api.resetAgentTestSession(sessionId);

      if (response.success) {
        setMessages([]);
        setInviteStatus(null);
        setShowEventPanel(true);
        setWaitInfo(null);
        setWaitCountdown(null);
        setLogs([{
          id: Date.now(),
          timestamp: new Date().toISOString(),
          eventType: 'SESSION_RESET',
          message: 'Sessão reiniciada'
        }]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // End the session
  const endSession = async () => {
    if (!sessionId) return;

    try {
      await api.endAgentTestSession(sessionId);
    } catch (err) {
      console.error('Error ending session:', err);
    }
  };

  // Update lead simulation
  const updateLeadSimulation = async (newData) => {
    setLeadSimulation(newData);

    if (sessionId) {
      try {
        await api.updateAgentTestLead(sessionId, newData);
        setLogs(prev => [...prev, {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          eventType: 'LEAD_SIMULATION_UPDATED',
          message: 'Dados do lead atualizados',
          data: newData
        }]);
      } catch (err) {
        console.error('Error updating lead simulation:', err);
      }
    }
  };

  // Handle Enter key
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Format log event type for display
  const formatEventType = (eventType) => {
    const labels = {
      SESSION_STARTED: 'Sessão Iniciada',
      SESSION_ENDED: 'Sessão Encerrada',
      SESSION_RESET: 'Sessão Reiniciada',
      MESSAGE_RECEIVED: 'Mensagem Recebida',
      INVITE_ACCEPTED: 'Convite Aceito',
      INVITE_IGNORED: 'Convite Ignorado',
      NO_RESPONSE: 'Sem Resposta',
      NODE_ENTERED: 'Nó Executado',
      TRIGGER_FIRED: 'Trigger Ativado',
      CONDITION_EVALUATED: 'Condição Avaliada',
      ACTION_STARTED: 'Ação Iniciada',
      ACTION_COMPLETED: 'Ação Concluída',
      ACTION_FAILED: 'Ação Falhou',
      MESSAGE_GENERATED: 'Resposta Gerada',
      RAG_SEARCH: 'Busca RAG',
      INTENT_DETECTED: 'Intenção Detectada',
      WORKFLOW_STARTED: 'Workflow Iniciado',
      WORKFLOW_COMPLETED: 'Workflow Concluído',
      WORKFLOW_PAUSED: 'Workflow Pausado',
      ERROR: 'Erro',
      LEAD_SIMULATION_UPDATED: 'Lead Atualizado'
    };
    return labels[eventType] || eventType;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-6xl mx-4 h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-900 dark:bg-gray-100 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white dark:text-gray-900" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Testar: {agent.name}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Simule uma conversa para testar o comportamento do agente
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLeadConfig(!showLeadConfig)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Configurar Lead Simulado"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={resetSession}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Reiniciar Sessão"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {
                endSession();
                onClose();
              }}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Lead Configuration Panel (collapsible) */}
        {showLeadConfig && (
          <div className="flex-shrink-0 px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Dados do Lead Simulado
            </h3>
            <div className="grid grid-cols-5 gap-3">
              <input
                type="text"
                value={leadSimulation.name}
                onChange={(e) => setLeadSimulation(prev => ({ ...prev, name: e.target.value }))}
                onBlur={() => updateLeadSimulation(leadSimulation)}
                placeholder="Nome"
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <input
                type="text"
                value={leadSimulation.title}
                onChange={(e) => setLeadSimulation(prev => ({ ...prev, title: e.target.value }))}
                onBlur={() => updateLeadSimulation(leadSimulation)}
                placeholder="Cargo"
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <input
                type="text"
                value={leadSimulation.company}
                onChange={(e) => setLeadSimulation(prev => ({ ...prev, company: e.target.value }))}
                onBlur={() => updateLeadSimulation(leadSimulation)}
                placeholder="Empresa"
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <input
                type="text"
                value={leadSimulation.location}
                onChange={(e) => setLeadSimulation(prev => ({ ...prev, location: e.target.value }))}
                onBlur={() => updateLeadSimulation(leadSimulation)}
                placeholder="Localização"
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <input
                type="text"
                value={leadSimulation.industry}
                onChange={(e) => setLeadSimulation(prev => ({ ...prev, industry: e.target.value }))}
                onBlur={() => updateLeadSimulation(leadSimulation)}
                placeholder="Setor"
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="flex-shrink-0 px-6 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Wait Action Banner */}
        {waitInfo && (
          <div className="flex-shrink-0 px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {waitCountdown !== null ? (
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-800/50">
                  <span className="text-lg font-bold text-amber-700 dark:text-amber-300">{waitCountdown}</span>
                </div>
              ) : (
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              )}
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {waitCountdown !== null
                    ? `Aguardando ${waitCountdown}s...`
                    : `Aguardando ${waitInfo.waitTime} ${
                        waitInfo.waitUnit === 'seconds' ? 'segundos' :
                        waitInfo.waitUnit === 'minutes' ? 'minutos' :
                        waitInfo.waitUnit === 'days' ? 'dias' : 'horas'
                      }`
                  }
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {waitCountdown !== null
                    ? 'O workflow continuará automaticamente ou clique para pular'
                    : 'Em produção, o workflow aguardaria este tempo antes de continuar'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={handleSkipWait}
              disabled={sending}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FastForward className="w-4 h-4" />
              Pular Espera
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Chat Panel */}
          <div className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-700 min-h-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loading && messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Iniciando sessão...</p>
                  </div>
                </div>
              ) : messages.length === 0 && showEventPanel ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-md">
                    <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
                      <Zap className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Simular Eventos
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                      Escolha como o lead responde ao convite de conexão para testar os diferentes fluxos do workflow
                    </p>

                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => simulateEvent('invite_accepted')}
                        disabled={sending || loading}
                        className="flex items-center justify-center gap-3 w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors disabled:opacity-50"
                      >
                        <UserCheck className="w-5 h-5" />
                        <span className="font-medium">Aceitar Convite</span>
                      </button>

                      <button
                        onClick={() => simulateEvent('invite_ignored')}
                        disabled={sending || loading}
                        className="flex items-center justify-center gap-3 w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors disabled:opacity-50"
                      >
                        <UserX className="w-5 h-5" />
                        <span className="font-medium">Ignorar Convite</span>
                      </button>

                      <div className="relative my-2">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                        </div>
                        <div className="relative flex justify-center">
                          <span className="px-3 bg-white dark:bg-gray-800 text-xs text-gray-500">ou</span>
                        </div>
                      </div>

                      <button
                        onClick={() => setShowEventPanel(false)}
                        className="flex items-center justify-center gap-2 w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-sm">Pular e enviar mensagem diretamente</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                      Envie uma mensagem para iniciar a conversa
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                      O agente responderá como faria em uma conversa real
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.sender === 'lead'
                          ? 'justify-end'
                          : message.sender === 'system'
                            ? 'justify-center'
                            : 'justify-start'
                      }`}
                    >
                      {message.sender === 'system' ? (
                        <div className="bg-gray-200 dark:bg-gray-700 rounded-full px-4 py-1.5">
                          <p className="text-xs text-gray-600 dark:text-gray-300">{message.content}</p>
                        </div>
                      ) : (
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                            message.sender === 'lead'
                              ? 'bg-blue-600 text-white rounded-br-md'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-md'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <p className={`text-xs mt-1 ${
                            message.sender === 'lead'
                              ? 'text-blue-200'
                              : 'text-gray-400 dark:text-gray-500'
                          }`}>
                            {formatTime(message.timestamp)}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                  {sending && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-bl-md px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Loader className="w-4 h-4 text-gray-400 animate-spin" />
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Processando...
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Digite uma mensagem..."
                  disabled={sending || loading || !sessionId}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || loading || !inputMessage.trim() || !sessionId}
                  className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Logs Panel */}
          <div className="w-96 flex flex-col bg-gray-50 dark:bg-gray-900/50 min-h-0">
            <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Logs de Execução
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {logs.length === 0 ? (
                <div className="text-center py-8">
                  <Info className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Os logs aparecerão aqui
                  </p>
                </div>
              ) : (
                <>
                  {logs.map((log) => {
                    const style = LOG_STYLES[log.eventType] || LOG_STYLES.INFO;
                    const Icon = style?.icon || Info;

                    return (
                      <div
                        key={log.id}
                        className={`${style?.bg || 'bg-gray-100 dark:bg-gray-800'} rounded-lg p-2.5 text-xs`}
                      >
                        <div className="flex items-start gap-2">
                          <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${style?.color || 'text-gray-600'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`font-medium ${style?.color || 'text-gray-600'}`}>
                                {formatEventType(log.eventType)}
                              </span>
                              <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">
                                {formatTime(log.timestamp || log.createdAt || log.created_at)}
                              </span>
                            </div>
                            {(log.nodeLabel || log.node_label) && (
                              <div className="text-gray-600 dark:text-gray-400 mt-0.5">
                                {log.nodeType || log.node_type}: <span className="font-medium">{log.nodeLabel || log.node_label}</span>
                              </div>
                            )}
                            {log.message && (
                              <div className="text-gray-600 dark:text-gray-400 mt-0.5">
                                {log.message}
                              </div>
                            )}
                            {(log.decisionReason || log.decision_reason) && (
                              <div className="text-gray-500 dark:text-gray-500 mt-0.5 italic">
                                → {log.decisionReason || log.decision_reason}
                              </div>
                            )}
                            {(log.outputData?.response || log.output_data?.response) && (
                              <div className="text-gray-600 dark:text-gray-400 mt-1 p-2 bg-white/50 dark:bg-gray-800/50 rounded line-clamp-2">
                                {log.outputData?.response || log.output_data?.response}
                              </div>
                            )}
                            {(log.outputData?.foundItems !== undefined || log.output_data?.foundItems !== undefined) && (
                              <div className="text-gray-500 dark:text-gray-500 mt-0.5">
                                {log.outputData?.foundItems ?? log.output_data?.foundItems} documentos encontrados
                              </div>
                            )}
                            {(log.outputData?.intent || log.output_data?.intent) && (
                              <div className="text-gray-500 dark:text-gray-500 mt-0.5">
                                Intenção: {log.outputData?.intent || log.output_data?.intent}
                              </div>
                            )}
                            {(log.errorMessage || log.error_message) && (
                              <div className="text-red-600 dark:text-red-400 mt-0.5">
                                {log.errorMessage || log.error_message}
                              </div>
                            )}
                            {(log.durationMs || log.duration_ms) && (
                              <div className="text-gray-400 dark:text-gray-600 mt-0.5">
                                {log.durationMs || log.duration_ms}ms
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={logsEndRef} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentTestModal;
