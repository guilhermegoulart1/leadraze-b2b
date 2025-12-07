import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Activity, Calendar, Target, Loader2 } from 'lucide-react';
import api from '../services/api';

const LimitConfigModal = ({ account, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [newLimit, setNewLimit] = useState(account.daily_limit || 50);
  const [strategy, setStrategy] = useState('moderate');
  const [reason, setReason] = useState('');

  // Carrega apenas health data (mais rápido)
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await api.getAccountHealth(account.id);
        if (response.success) {
          setHealthData(response.data);
          // Usa o limite recomendado do health se disponível
          if (response.data?.recommended_limit) {
            setNewLimit(response.data.recommended_limit);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [account.id]);

  // Atualiza limite quando muda estratégia
  useEffect(() => {
    if (!healthData) return;
    const base = healthData.recommended_limit || account.daily_limit || 50;
    const multipliers = { safe: 0.7, moderate: 1, aggressive: 1.4 };
    setNewLimit(Math.round(base * multipliers[strategy]));
  }, [strategy, healthData]);

  const handleSave = async () => {
    const recommended = healthData?.recommended_limit || account.daily_limit;
    const isOverride = newLimit > recommended;

    if (isOverride && !reason.trim()) {
      alert('Informe o motivo para limite acima do recomendado.');
      return;
    }

    try {
      setSaving(true);
      const response = await api.overrideLimit(
        account.id,
        newLimit,
        reason || `Limite: ${newLimit}/dia (${strategy})`
      );
      if (response.success) {
        onUpdate(response.data);
        onClose();
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const healthScore = healthData?.health_score || 0;
  const accountAgeDays = healthData?.account_age_days || 0;
  const recommended = healthData?.recommended_limit || account.daily_limit;
  const isOverride = newLimit > recommended;
  const risks = healthData?.risks || [];

  // Cor do health score
  const getScoreColor = (score) => {
    if (score >= 70) return 'text-green-500 border-green-500';
    if (score >= 50) return 'text-yellow-500 border-yellow-500';
    return 'text-red-500 border-red-500';
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
          <span className="text-sm text-gray-600 dark:text-gray-300">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Header Compacto com Info Inline */}
        <div className="bg-purple-600 text-white px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold">{account.profile_name}</span>
            <div className="flex items-center gap-3 text-xs">
              <span className={`px-2 py-0.5 rounded-full font-medium ${
                healthScore >= 70 ? 'bg-green-500/20 text-green-200' :
                healthScore >= 50 ? 'bg-yellow-500/20 text-yellow-200' :
                'bg-red-500/20 text-red-200'
              }`}>
                Health {healthScore}
              </span>
              <span className="text-purple-200">
                <Calendar className="w-3 h-3 inline mr-1" />{accountAgeDays}d
              </span>
              <span className="text-purple-200">
                <Target className="w-3 h-3 inline mr-1" />{account.daily_limit}/dia
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">

          {/* Alertas */}
          {risks.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-200 space-y-0.5">
                  {risks.slice(0, 2).map((risk, idx) => (
                    <p key={idx}>{risk.message}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Estratégia */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">Estratégia</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'safe', label: 'Seguro', icon: '🛡️', desc: 'Conservador' },
                { key: 'moderate', label: 'Moderado', icon: '⚖️', desc: 'Equilibrado' },
                { key: 'aggressive', label: 'Agressivo', icon: '⚡', desc: 'Máximo' }
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStrategy(s.key)}
                  className={`p-2 rounded-lg text-xs font-medium transition-all border ${
                    strategy === s.key
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-purple-400'
                  }`}
                >
                  <span className="block text-base mb-0.5">{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Novo Limite */}
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
            <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Novo Limite</p>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{newLimit}</p>
            <p className="text-[10px] text-purple-500 dark:text-purple-400">convites/dia</p>
          </div>

          {/* Slider */}
          <div>
            <input
              type="range"
              min="10"
              max="150"
              value={newLimit}
              onChange={(e) => setNewLimit(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <div className="flex justify-between text-[9px] text-gray-400 mt-1">
              <span>10</span>
              <span>50</span>
              <span>100</span>
              <span>150</span>
            </div>
          </div>

          {/* Motivo (se override) */}
          {isOverride && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-2.5">
              <p className="text-xs text-yellow-800 dark:text-yellow-200 mb-2">
                ⚠️ Acima do recomendado ({recommended}). Informe o motivo:
              </p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo..."
                className="w-full p-2 border border-yellow-300 dark:border-yellow-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded text-xs focus:ring-1 focus:ring-yellow-500"
                rows="2"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (isOverride && !reason.trim())}
            className="px-4 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LimitConfigModal;
