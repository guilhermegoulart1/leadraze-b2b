import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, Loader, Sparkles, Target, AlertCircle, RefreshCw,
  AlertTriangle, Lightbulb, Copy, Check, ChevronRight, MessageSquare, Download,
  ArrowLeft, Thermometer, TrendingUp, Shield, Users, Zap, Heart, Search, RotateCcw
} from 'lucide-react';
import api from '../services/api';

// Mapeamento de cores para classes Tailwind
const COLOR_CLASSES = {
  indigo: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    text: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-200 dark:border-indigo-800',
    ring: 'ring-indigo-500',
    badge: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
  },
  purple: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
    ring: 'ring-purple-500',
    badge: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
  },
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
    ring: 'ring-blue-500',
    badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
  },
  pink: {
    bg: 'bg-pink-100 dark:bg-pink-900/30',
    text: 'text-pink-600 dark:text-pink-400',
    border: 'border-pink-200 dark:border-pink-800',
    ring: 'ring-pink-500',
    badge: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300'
  },
  green: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-600 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
    ring: 'ring-green-500',
    badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
  },
  orange: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800',
    ring: 'ring-orange-500',
    badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
  }
};

const SecretAgentModal = ({ isOpen, onClose, conversationId, onSuccess }) => {
  const { t, i18n } = useTranslation('secretAgentCoaching');

  // Estados principais
  const [view, setView] = useState('team'); // team | input | result | diagnostic-result
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [objective, setObjective] = useState('');

  // Result state
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // Carregar agentes ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      loadAgents();
      resetState();
    }
  }, [isOpen]);

  const loadAgents = async () => {
    setLoadingAgents(true);
    try {
      const response = await api.getCoachingAgents();
      if (response.success) {
        setAgents(response.data.agents || []);
      }
    } catch (err) {
      console.error('Error loading agents:', err);
      setError(t('errors.loadingAgents'));
    } finally {
      setLoadingAgents(false);
    }
  };

  const resetState = () => {
    setView('team');
    setSelectedAgent(null);
    setObjective('');
    setResult(null);
    setError('');
    setCopied(false);
  };

  const handleSelectAgent = (agent) => {
    setSelectedAgent(agent);
    setObjective('');
    setError('');
    setView('input');
  };

  const handleBack = () => {
    if (view === 'input') {
      setView('team');
      setSelectedAgent(null);
    } else if (view === 'result' || view === 'diagnostic-result') {
      setView('team');
      setSelectedAgent(null);
      setResult(null);
    }
  };

  const handleSubmit = async () => {
    // Diagnóstico não precisa de objetivo
    if (!selectedAgent.isChief && !objective.trim()) {
      setError(t('errors.objectiveRequired'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.generateSecretAgentCoaching(conversationId, {
        objective: objective.trim() || 'Análise automática da conversa',
        agent_type: selectedAgent.id,
        language: i18n.language || 'pt'
      });

      if (response.success) {
        const data = response.data;
        let parsed = data.parsed;

        if (!parsed && data.response) {
          try {
            parsed = JSON.parse(data.response);
          } catch (e) {
            parsed = { situacao: data.response };
          }
        }

        setResult({
          ...data,
          parsed: parsed || {}
        });

        // Define a view baseada no tipo de agente
        setView(selectedAgent.isChief ? 'diagnostic-result' : 'result');
        onSuccess?.(data);
      }
    } catch (err) {
      console.error('Error generating coaching:', err);
      setError(err.message || t('errors.generateFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyMessage = async () => {
    if (!result?.parsed?.sugestao_mensagem) return;
    try {
      await navigator.clipboard.writeText(result.parsed.sugestao_mensagem);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleConsultSpecialist = (specialistId) => {
    const specialist = agents.find(a => a.id === specialistId);
    if (specialist) {
      setSelectedAgent(specialist);
      setObjective('');
      setResult(null);
      setView('input');
    }
  };

  const handleDownload = () => {
    if (!result?.parsed) return;

    const p = result.parsed;
    const date = new Date().toLocaleDateString('pt-BR');
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let content = `ORIENTAÇÃO DE VENDAS - ${selectedAgent?.name?.toUpperCase() || 'AGENTE'}\n`;
    content += `${'='.repeat(50)}\n`;
    content += `Gerado em: ${date} às ${time}\n`;
    content += `Agente: ${selectedAgent?.name} - ${selectedAgent?.title}\n`;
    if (objective) content += `Objetivo: ${objective}\n`;
    content += `Mensagens analisadas: ${result.messagesAnalyzed}\n\n`;

    if (selectedAgent?.isChief) {
      // Formato de diagnóstico
      if (p.diagnostico) content += `DIAGNÓSTICO\n${'-'.repeat(30)}\n${p.diagnostico}\n\n`;
      if (p.estagio_venda) content += `Estágio da Venda: ${p.estagio_venda}\n`;
      if (p.temperatura_lead) content += `Temperatura do Lead: ${p.temperatura_lead}\n`;
      if (p.potencial_fechamento) content += `Potencial de Fechamento: ${p.potencial_fechamento}\n\n`;
      if (p.principal_bloqueio) content += `Principal Bloqueio: ${p.principal_bloqueio}\n\n`;
      if (p.especialista_recomendado) {
        content += `ESPECIALISTA RECOMENDADO\n${'-'.repeat(30)}\n`;
        content += `${p.especialista_recomendado.nome}: ${p.especialista_recomendado.motivo}\n\n`;
      }
      if (p.acao_imediata) content += `Ação Imediata: ${p.acao_imediata}\n`;
      if (p.risco_identificado) content += `Risco: ${p.risco_identificado}\n`;
    } else {
      // Formato padrão
      if (p.tecnica) content += `TÉCNICA RECOMENDADA: ${p.tecnica}\n`;
      if (p.tecnica_motivo) content += `Motivo: ${p.tecnica_motivo}\n\n`;
      if (p.situacao) content += `ANÁLISE DA SITUAÇÃO\n${'-'.repeat(30)}\n${p.situacao}\n\n`;
      if (p.pontos_atencao?.length > 0) {
        content += `PONTOS DE ATENÇÃO\n${'-'.repeat(30)}\n`;
        p.pontos_atencao.forEach((ponto, i) => content += `${i + 1}. ${ponto}\n`);
        content += `\n`;
      }
      if (p.sugestao_mensagem) content += `SUGESTÃO DE MENSAGEM\n${'-'.repeat(30)}\n${p.sugestao_mensagem}\n\n`;
      if (p.proximos_passos?.length > 0) {
        content += `PRÓXIMOS PASSOS\n${'-'.repeat(30)}\n`;
        p.proximos_passos.forEach((passo, i) => content += `${i + 1}. ${passo}\n`);
      }
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orientacao-${selectedAgent?.id || 'vendas'}-${date.replace(/\//g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const chiefAgent = agents.find(a => a.isChief);
  const specialists = agents.filter(a => !a.isChief);
  const colors = selectedAgent ? COLOR_CLASSES[selectedAgent.color] || COLOR_CLASSES.purple : COLOR_CLASSES.purple;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {(view !== 'team') && (
                <button
                  onClick={handleBack}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              {selectedAgent ? (
                <div className="flex items-center gap-3">
                  <img
                    src={selectedAgent.image}
                    alt={selectedAgent.name}
                    className={`w-10 h-10 rounded-full object-cover ring-2 ${colors.ring}`}
                  />
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                      {selectedAgent.name}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedAgent.title}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                      {t('team.title')}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('team.subtitle')}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Error */}
          {error && (
            <div className="mx-5 mt-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Loading agents */}
          {loadingAgents && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader className="w-8 h-8 text-purple-600 animate-spin mb-4" />
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('modal.generating')}</p>
            </div>
          )}

          {/* Team View */}
          {!loadingAgents && view === 'team' && (
            <div className="p-5 space-y-6">
              {/* Chief Agent - Diagnóstico */}
              {chiefAgent && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      {t('team.dontKnowWhereToStart')}
                    </span>
                  </div>
                  <button
                    onClick={() => handleSelectAgent(chiefAgent)}
                    className="w-full p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl hover:shadow-lg transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={chiefAgent.image}
                        alt={chiefAgent.name}
                        className="w-16 h-16 rounded-full object-cover ring-2 ring-indigo-500 group-hover:ring-4 transition-all"
                      />
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {chiefAgent.name}
                          </h3>
                          <span className="px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full">
                            {t('team.chiefConsultant')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                          {chiefAgent.description}
                        </p>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {t('team.analyzesAndRecommends')}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-indigo-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                </div>
              )}

              {/* Specialists Grid */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    {t('team.orChooseSpecialist')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {specialists.map((agent) => {
                    const agentColors = COLOR_CLASSES[agent.color] || COLOR_CLASSES.purple;
                    return (
                      <button
                        key={agent.id}
                        onClick={() => handleSelectAgent(agent)}
                        className={`p-4 rounded-xl border ${agentColors.border} hover:shadow-md transition-all text-left group`}
                      >
                        <div className="flex items-start gap-3">
                          <img
                            src={agent.image}
                            alt={agent.name}
                            className={`w-12 h-12 rounded-full object-cover ring-2 ${agentColors.ring} group-hover:ring-4 transition-all`}
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                              {agent.name}
                            </h3>
                            <p className={`text-xs ${agentColors.text} font-medium`}>
                              {agent.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                              {agent.focus}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Input View */}
          {view === 'input' && selectedAgent && (
            <div className="p-5 space-y-4">
              {/* Agent greeting */}
              <div className={`p-4 rounded-lg ${colors.bg} ${colors.border} border`}>
                <p className={`text-sm ${colors.text} italic`}>
                  "{selectedAgent.greeting}"
                </p>
              </div>

              {/* Objective input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Target className={`w-4 h-4 ${colors.text}`} />
                  {selectedAgent.isChief ? t('input.contextLabel') : t('input.objectiveLabel')}
                </label>
                <textarea
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder={selectedAgent.placeholder}
                  rows={4}
                  autoFocus
                  className="w-full px-4 py-3 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              {/* Loading state */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader className={`w-8 h-8 ${colors.text} animate-spin mb-4`} />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedAgent.name} {t('input.analyzing')}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {t('input.mayTakeSomeSeconds')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Diagnostic Result View */}
          {view === 'diagnostic-result' && result?.parsed && (
            <div className="p-5 space-y-4">
              {/* Diagnóstico */}
              {result.parsed.diagnostico && (
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {result.parsed.diagnostico}
                  </p>
                </div>
              )}

              {/* Métricas em cards */}
              <div className="grid grid-cols-3 gap-3">
                {/* Estágio da Venda */}
                {result.parsed.estagio_venda && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                    <TrendingUp className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('diagnostic.stage')}</p>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300 capitalize">
                      {t(`stages.${result.parsed.estagio_venda}`, result.parsed.estagio_venda.replace('_', ' '))}
                    </p>
                  </div>
                )}

                {/* Temperatura */}
                {result.parsed.temperatura_lead && (
                  <div className={`p-3 rounded-lg text-center ${
                    result.parsed.temperatura_lead === 'muito_quente' ? 'bg-red-50 dark:bg-red-900/20' :
                    result.parsed.temperatura_lead === 'quente' ? 'bg-orange-50 dark:bg-orange-900/20' :
                    result.parsed.temperatura_lead === 'morno' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                    'bg-blue-50 dark:bg-blue-900/20'
                  }`}>
                    <Thermometer className={`w-5 h-5 mx-auto mb-1 ${
                      result.parsed.temperatura_lead === 'muito_quente' ? 'text-red-500' :
                      result.parsed.temperatura_lead === 'quente' ? 'text-orange-500' :
                      result.parsed.temperatura_lead === 'morno' ? 'text-yellow-500' :
                      'text-blue-500'
                    }`} />
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('diagnostic.temperature')}</p>
                    <p className={`text-sm font-medium capitalize ${
                      result.parsed.temperatura_lead === 'muito_quente' ? 'text-red-700 dark:text-red-300' :
                      result.parsed.temperatura_lead === 'quente' ? 'text-orange-700 dark:text-orange-300' :
                      result.parsed.temperatura_lead === 'morno' ? 'text-yellow-700 dark:text-yellow-300' :
                      'text-blue-700 dark:text-blue-300'
                    }`}>
                      {t(`temperatures.${result.parsed.temperatura_lead}`, result.parsed.temperatura_lead.replace('_', ' '))}
                    </p>
                  </div>
                )}

                {/* Potencial */}
                {result.parsed.potencial_fechamento && (
                  <div className={`p-3 rounded-lg text-center ${
                    result.parsed.potencial_fechamento === 'alto' ? 'bg-green-50 dark:bg-green-900/20' :
                    result.parsed.potencial_fechamento === 'medio' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                    'bg-gray-50 dark:bg-gray-900/20'
                  }`}>
                    <Target className={`w-5 h-5 mx-auto mb-1 ${
                      result.parsed.potencial_fechamento === 'alto' ? 'text-green-500' :
                      result.parsed.potencial_fechamento === 'medio' ? 'text-yellow-500' :
                      'text-gray-500'
                    }`} />
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('diagnostic.potential')}</p>
                    <p className={`text-sm font-medium capitalize ${
                      result.parsed.potencial_fechamento === 'alto' ? 'text-green-700 dark:text-green-300' :
                      result.parsed.potencial_fechamento === 'medio' ? 'text-yellow-700 dark:text-yellow-300' :
                      'text-gray-700 dark:text-gray-300'
                    }`}>
                      {t(`potentials.${result.parsed.potencial_fechamento}`, result.parsed.potencial_fechamento)}
                    </p>
                  </div>
                )}
              </div>

              {/* Principal Bloqueio */}
              {result.parsed.principal_bloqueio && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                        {t('diagnostic.mainBlock')}
                      </p>
                      <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                        {result.parsed.principal_bloqueio}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Especialista Recomendado */}
              {result.parsed.especialista_recomendado && (
                <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-xs font-medium text-purple-700 dark:text-purple-400 uppercase tracking-wide flex items-center gap-1 mb-3">
                    <Sparkles className="w-3.5 h-3.5" />
                    {t('diagnostic.recommendedSpecialist')}
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {result.parsed.especialista_recomendado.nome}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {result.parsed.especialista_recomendado.motivo}
                      </p>
                    </div>
                    <button
                      onClick={() => handleConsultSpecialist(result.parsed.especialista_recomendado.id)}
                      className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                    >
                      {t('diagnostic.consult')}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Ação Imediata */}
              {result.parsed.acao_imediata && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-green-700 dark:text-green-400 uppercase tracking-wide">
                        {t('diagnostic.immediateAction')}
                      </p>
                      <p className="text-sm text-green-800 dark:text-green-300 mt-1">
                        {result.parsed.acao_imediata}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Risco */}
              {result.parsed.risco_identificado && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-red-700 dark:text-red-400 uppercase tracking-wide">
                        {t('diagnostic.riskIfNoAction')}
                      </p>
                      <p className="text-sm text-red-800 dark:text-red-300 mt-1">
                        {result.parsed.risco_identificado}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Standard Result View */}
          {view === 'result' && result?.parsed && (
            <div className="p-5 space-y-4">
              {/* Técnica badge */}
              {result.parsed.tecnica && (
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 text-sm rounded-full font-medium ${colors.badge}`}>
                    {result.parsed.tecnica}
                  </span>
                </div>
              )}

              {/* Situação */}
              {result.parsed.situacao && (
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {result.parsed.situacao}
                  </p>
                </div>
              )}

              {/* Técnica motivo */}
              {result.parsed.tecnica_motivo && (
                <div className={`text-xs text-gray-500 dark:text-gray-400 italic border-l-2 ${colors.border} pl-3`}>
                  {result.parsed.tecnica_motivo}
                </div>
              )}

              {/* Pontos de Atenção */}
              {result.parsed.pontos_atencao?.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {t('result.attentionPoints')}
                  </p>
                  <div className="space-y-1.5">
                    {result.parsed.pontos_atencao.map((ponto, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 flex-shrink-0" />
                        <span className="text-sm text-amber-800 dark:text-amber-300">{ponto}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sugestão de Mensagem */}
              {result.parsed.sugestao_mensagem && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wide flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {t('result.messageSuggestion')}
                    </p>
                    <button
                      onClick={handleCopyMessage}
                      className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-green-500" />
                          <span className="text-green-600 dark:text-green-400">{t('result.copied')}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          {t('result.copy')}
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-blue-900 dark:text-blue-200 leading-relaxed">
                    {result.parsed.sugestao_mensagem}
                  </p>
                </div>
              )}

              {/* Próximos Passos */}
              {result.parsed.proximos_passos?.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                  <p className="text-xs font-medium text-green-700 dark:text-green-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                    <Lightbulb className="w-3.5 h-3.5" />
                    {t('result.nextSteps')}
                  </p>
                  <div className="space-y-1.5">
                    {result.parsed.proximos_passos.map((passo, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <ChevronRight className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-green-800 dark:text-green-300">{passo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex justify-between items-center">
            {/* Mensagens analisadas */}
            {result && (
              <span className="text-xs text-gray-400">
                {result.messagesAnalyzed} {t('footer.messagesAnalyzed')}
              </span>
            )}
            {!result && <span />}

            {/* Botões */}
            <div className="flex gap-3">
              {view === 'team' && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('actions.close')}
                </button>
              )}

              {view === 'input' && !loading && (
                <>
                  <button
                    onClick={handleBack}
                    className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    {t('actions.back')}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!selectedAgent.isChief && !objective.trim()}
                    className="px-5 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    {selectedAgent.isChief ? t('actions.makeDiagnosis') : t('actions.generateGuidance')}
                  </button>
                </>
              )}

              {(view === 'result' || view === 'diagnostic-result') && (
                <>
                  <button
                    onClick={handleBack}
                    className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {t('actions.otherAgent')}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    {t('actions.save')}
                  </button>
                  <button
                    onClick={onClose}
                    className="px-5 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    {t('actions.close')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecretAgentModal;
