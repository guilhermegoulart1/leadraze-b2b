import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Activity, Clock, Target, Shield, AlertCircle, Info } from 'lucide-react';
import api from '../services/api';

const LimitConfigModal = ({ account, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingStrategy, setLoadingStrategy] = useState(false);

  // Dados do health
  const [healthData, setHealthData] = useState(null);
  const [recommendedData, setRecommendedData] = useState(null);
  const [history, setHistory] = useState([]);

  // Estado do formulário
  const [newLimit, setNewLimit] = useState(account.daily_limit || 50);
  const [reason, setReason] = useState('');
  const [strategy, setStrategy] = useState('moderate');
  const [showWarning, setShowWarning] = useState(false);

  // Carregar dados iniciais (apenas uma vez)
  useEffect(() => {
    loadInitialData();
  }, [account.id]);

  // Quando estratégia mudar, buscar apenas o limite recomendado
  useEffect(() => {
    if (!loading) {
      loadRecommendedLimit();
    }
  }, [strategy]);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      const [healthRes, recommendedRes, historyRes] = await Promise.all([
        api.getAccountHealth(account.id),
        api.getRecommendedLimit(account.id, strategy),
        api.getLimitHistory(account.id, 10)
      ]);

      if (healthRes.success) {
        setHealthData(healthRes.data);
      }

      if (recommendedRes.success) {
        setRecommendedData(recommendedRes.data);
      }

      if (historyRes.success) {
        setHistory(historyRes.data.history || []);
      }

    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendedLimit = async () => {
    try {
      setLoadingStrategy(true);

      const recommendedRes = await api.getRecommendedLimit(account.id, strategy);

      if (recommendedRes.success) {
        setRecommendedData(recommendedRes.data);
      }

    } catch (error) {
      console.error('❌ Erro ao carregar limite recomendado:', error);
    } finally {
      setLoadingStrategy(false);
    }
  };

  const handleSave = async () => {
    if (showWarning && !reason.trim()) {
      alert('Por favor, informe o motivo para definir um limite acima do recomendado.');
      return;
    }

    try {
      setSaving(true);

      const response = await api.overrideLimit(
        account.id,
        newLimit,
        reason || `Limite alterado manualmente para ${newLimit}/dia`
      );

      if (response.success) {
        onUpdate(response.data);
        onClose();
      }

    } catch (error) {
      console.error('❌ Erro ao salvar limite:', error);
      alert('Erro ao salvar limite. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  // Atualizar slider quando estratégia mudar
  useEffect(() => {
    if (recommendedData) {
      setNewLimit(recommendedData.recommended);
    }
  }, [recommendedData]);

  // Verificar se está acima do recomendado
  useEffect(() => {
    if (recommendedData && newLimit > recommendedData.recommended) {
      setShowWarning(true);
    } else {
      setShowWarning(false);
    }
  }, [newLimit, recommendedData]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        </div>
      </div>
    );
  }

  const getHealthColor = (score) => {
    if (score >= 80) return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' };
    if (score >= 50) return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' };
    return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' };
  };

  const getRiskColor = (level) => {
    if (level === 'low') return 'text-green-600';
    if (level === 'medium') return 'text-yellow-600';
    return 'text-red-600';
  };

  const healthScore = healthData?.health_score || 0;
  const healthColors = getHealthColor(healthScore);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-[#7229f7] text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Configuração de Limites</h2>
              <p className="text-purple-100 mt-1">{account.profile_name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">

          {/* Health Score Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

            {/* Health Score Gauge */}
            <div className={`${healthColors.bg} ${healthColors.border} border-2 rounded-xl p-6`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-bold ${healthColors.text}`}>Health Score</h3>
                <Activity className={`w-6 h-6 ${healthColors.text}`} />
              </div>

              <div className="relative w-32 h-32 mx-auto mb-4">
                <svg className="transform -rotate-90 w-32 h-32">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-gray-200"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - healthScore / 100)}`}
                    className={healthScore >= 70 ? 'text-green-600' : healthScore >= 50 ? 'text-yellow-600' : 'text-red-600'}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-3xl font-bold ${healthColors.text}`}>{healthScore}</span>
                </div>
              </div>

              <p className={`text-center text-sm font-semibold ${healthColors.text}`}>
                {healthData?.risk_level === 'low' && 'Conta Saudável ✅'}
                {healthData?.risk_level === 'medium' && 'Atenção Necessária ⚠️'}
                {healthData?.risk_level === 'high' && 'Risco Alto 🚨'}
              </p>
            </div>

            {/* Métricas Principais */}
            <div className="lg:col-span-2 grid grid-cols-2 gap-4">

              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <p className="text-sm text-blue-600 font-semibold">Taxa 7 dias</p>
                </div>
                <p className="text-2xl font-bold text-blue-900">
                  {healthData?.metrics?.acceptance_rate_7d?.toFixed(1) || 0}%
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {healthData?.metrics?.invites_accepted_7d || 0}/{healthData?.metrics?.invites_sent_7d || 0} aceitos
                </p>
              </div>

              <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  <p className="text-sm text-purple-600 font-semibold">Taxa 30 dias</p>
                </div>
                <p className="text-2xl font-bold text-purple-900">
                  {healthData?.metrics?.acceptance_rate_30d?.toFixed(1) || 0}%
                </p>
                <p className="text-xs text-purple-600 mt-1">
                  {healthData?.metrics?.invites_accepted_30d || 0}/{healthData?.metrics?.invites_sent_30d || 0} aceitos
                </p>
              </div>

              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <p className="text-sm text-amber-600 font-semibold">Tempo Médio</p>
                </div>
                <p className="text-2xl font-bold text-amber-900">
                  {healthData?.metrics?.avg_response_time_hours?.toFixed(0) || '--'}h
                </p>
                <p className="text-xs text-amber-600 mt-1">Resposta de convites</p>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <p className="text-sm text-blue-600 font-semibold">Tempo no Sistema</p>
                  <div className="group relative">
                    <Info className="w-4 h-4 text-blue-500 cursor-help" />
                    <div className="hidden group-hover:block absolute z-10 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg -left-24 top-6">
                      Refere-se a quantos dias a conta está conectada ao nosso sistema enviando convites.
                      O LinkedIn monitora mudanças de padrão de uso, então contas recém-conectadas precisam de
                      um período de aquecimento com limites mais baixos, independente da idade real da conta no LinkedIn.
                      <div className="absolute -top-1 left-24 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                    </div>
                  </div>
                </div>
                <p className="text-2xl font-bold text-blue-900">
                  {healthData?.account_age_days || 0}
                </p>
                <p className="text-xs text-blue-600 mt-1">dias de uso no sistema</p>
              </div>

            </div>
          </div>

          {/* Alertas de Risco */}
          {healthData?.risks && healthData.risks.length > 0 && (
            <div className="bg-red-50 border-l-4 border-red-600 p-4 mb-6 rounded-r-lg">
              <div className="flex items-start">
                <AlertTriangle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-red-900 font-bold mb-2">Alertas de Risco Detectados</h4>
                  <ul className="space-y-2">
                    {healthData.risks.map((risk, idx) => (
                      <li key={idx} className="text-sm">
                        <span className="font-semibold text-red-800">[{risk.level.toUpperCase()}]</span>
                        <span className="text-red-700 ml-2">{risk.message}</span>
                        <p className="text-red-600 text-xs mt-1 ml-6">{risk.recommendation}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Configuração de Limite */}
          <div className="bg-gray-50 rounded-xl p-6 mb-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Configurar Limite Diário</h3>

            {/* Estratégia */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Estratégia</label>
              <div className="grid grid-cols-3 gap-3">
                {['safe', 'moderate', 'aggressive'].map((strat) => (
                  <button
                    key={strat}
                    onClick={() => setStrategy(strat)}
                    disabled={loadingStrategy}
                    className={`py-2 px-4 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      strategy === strat
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {strat === 'safe' && '🛡️ Seguro'}
                    {strat === 'moderate' && '⚖️ Moderado'}
                    {strat === 'aggressive' && '⚡ Agressivo'}
                  </button>
                ))}
              </div>
            </div>

            {/* Comparação de Limites */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-4 bg-white rounded-lg border border-gray-200 relative">
                <p className="text-xs text-gray-500 mb-1">Recomendado pela IA</p>
                {loadingStrategy ? (
                  <div className="flex items-center justify-center h-8">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-purple-600">{recommendedData?.recommended || '--'}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">convites/dia</p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Limite Atual</p>
                <p className="text-2xl font-bold text-gray-900">{account.daily_limit || 0}</p>
                <p className="text-xs text-gray-500 mt-1">convites/dia</p>
              </div>
            </div>

            {/* Slider */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">Novo Limite</label>
                <span className="text-2xl font-bold text-purple-600">{newLimit}</span>
              </div>

              <input
                type="range"
                min="10"
                max="200"
                value={newLimit}
                onChange={(e) => setNewLimit(parseInt(e.target.value))}
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />

              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>10</span>
                <span>50</span>
                <span>100</span>
                <span>150</span>
                <span>200</span>
              </div>
            </div>

            {/* Aviso de Override */}
            {showWarning && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 rounded-r-lg">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-yellow-900 font-bold mb-2">⚠️ Limite Acima do Recomendado</h4>
                    <p className="text-sm text-yellow-800 mb-3">
                      Você está definindo um limite <strong>{newLimit - recommendedData?.recommended}</strong> convites acima do recomendado.
                      Isso pode aumentar o risco de restrição da sua conta LinkedIn.
                    </p>
                    <div>
                      <label className="block text-sm font-semibold text-yellow-900 mb-2">
                        Motivo (obrigatório para limites altos):
                      </label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ex: Campanha especial com alto budget..."
                        className="w-full p-3 border border-yellow-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                        rows="2"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Histórico */}
          {history.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Histórico de Alterações</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {history.map((item) => (
                  <div key={item.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      {item.is_manual_override ? (
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {item.old_limit} → {item.new_limit} convites/dia
                      </p>
                      {item.reason && (
                        <p className="text-xs text-gray-600 mt-1">{item.reason}</p>
                      )}
                      <div className="flex items-center space-x-3 mt-2 text-xs text-gray-500">
                        <span>{new Date(item.created_at).toLocaleString('pt-BR')}</span>
                        <span className={`font-semibold ${getRiskColor(item.risk_level)}`}>
                          Risco: {item.risk_level}
                        </span>
                        {item.account_health_score && (
                          <span>Health: {item.account_health_score}/100</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (showWarning && !reason.trim())}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {saving ? 'Salvando...' : 'Salvar Limite'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default LimitConfigModal;
