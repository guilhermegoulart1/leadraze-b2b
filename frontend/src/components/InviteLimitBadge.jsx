// frontend/src/components/InviteLimitBadge.jsx
import React, { useState, useEffect } from 'react';
import { Send, AlertTriangle, CheckCircle, Clock, Calendar, MessageSquare } from 'lucide-react';
import api from '../services/api';

const ProgressBar = ({ percentage, colorClass, height = 'h-1.5' }) => (
  <div className={`${height} bg-gray-200 rounded-full overflow-hidden`}>
    <div
      className={`h-full ${colorClass} transition-all duration-500`}
      style={{ width: `${Math.min(percentage, 100)}%` }}
    />
  </div>
);

const getBarColor = (pct) => {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 70) return 'bg-orange-500';
  if (pct >= 50) return 'bg-yellow-500';
  return 'bg-green-500';
};

const getTextColor = (pct) => {
  if (pct >= 90) return 'text-red-700';
  if (pct >= 70) return 'text-orange-700';
  if (pct >= 50) return 'text-yellow-700';
  return 'text-green-700';
};

const InviteLimitBadge = ({ linkedinAccountId, refreshInterval = 30000 }) => {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStats = async () => {
    try {
      if (!linkedinAccountId) return;

      const response = await api.getInviteStats(linkedinAccountId);
      setStats(response.data);
      setError(null);
    } catch (err) {
      console.error('Error loading invite stats:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();

    // Refresh stats periodically
    const interval = setInterval(loadStats, refreshInterval);
    return () => clearInterval(interval);
  }, [linkedinAccountId, refreshInterval]);

  if (!linkedinAccountId) return null;

  if (isLoading && !stats) {
    return (
      <div className="bg-gray-100 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
        <div className="h-8 bg-gray-300 rounded w-1/2"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm">Erro ao carregar estatísticas</span>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const {
    account,
    daily_limit,
    sent_today,
    remaining,
    percentage,
    can_send,
    weekly = {},
    monthly_messages = {},
  } = stats;

  const weeklyPct = weekly.limit ? Math.round((weekly.sent / weekly.limit) * 100) : 0;
  const monthlyMsgPct = monthly_messages.is_limited
    ? Math.round((monthly_messages.sent / monthly_messages.limit) * 100)
    : 0;
  const monthlyExhausted = monthly_messages.is_limited && monthly_messages.remaining <= 0;

  // Cor geral baseada no pior cenário
  const worstPct = Math.max(percentage, weeklyPct);

  const getBgColorClass = () => {
    if (worstPct >= 90) return 'bg-red-50 border-red-200';
    if (worstPct >= 70) return 'bg-orange-50 border-orange-200';
    if (worstPct >= 50) return 'bg-yellow-50 border-yellow-200';
    return 'bg-green-50 border-green-200';
  };

  return (
    <div className={`rounded-lg border px-3 py-2 ${getBgColorClass()}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Send className={`w-4 h-4 ${getTextColor(worstPct)} flex-shrink-0`} />
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-gray-900 truncate">
              {account.name || 'Conta LinkedIn'}
            </h3>
          </div>
        </div>
        {can_send ? (
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
        )}
      </div>

      {/* Limite Diário */}
      <div className="mb-2">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-gray-400" />
            <span className="text-[10px] text-gray-500 uppercase font-medium">Diário</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-sm font-bold ${getTextColor(percentage)}`}>{sent_today}</span>
            <span className="text-xs text-gray-500">/ {daily_limit}</span>
            <span className="text-[10px] text-gray-400">({remaining} rest.)</span>
          </div>
        </div>
        <ProgressBar percentage={percentage} colorClass={getBarColor(percentage)} />
      </div>

      {/* Limite Semanal */}
      {weekly.limit > 0 && (
        <div className="mb-2">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-gray-400" />
              <span className="text-[10px] text-gray-500 uppercase font-medium">Semanal</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-sm font-bold ${getTextColor(weeklyPct)}`}>{weekly.sent}</span>
              <span className="text-xs text-gray-500">/ {weekly.limit}</span>
              <span className="text-[10px] text-gray-400">({weekly.remaining} rest.)</span>
            </div>
          </div>
          <ProgressBar percentage={weeklyPct} colorClass={getBarColor(weeklyPct)} />
        </div>
      )}

      {/* Limite Mensal de Mensagens (apenas para contas free/limitadas) */}
      {monthly_messages.is_limited && (
        <div className="mb-1">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-gray-400" />
              <span className="text-[10px] text-gray-500 uppercase font-medium">Notas/mês</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-sm font-bold ${getTextColor(monthlyMsgPct)}`}>{monthly_messages.sent}</span>
              <span className="text-xs text-gray-500">/ {monthly_messages.limit}</span>
              <span className="text-[10px] text-gray-400">({monthly_messages.remaining} rest.)</span>
            </div>
          </div>
          <ProgressBar percentage={monthlyMsgPct} colorClass={getBarColor(monthlyMsgPct)} />
        </div>
      )}

      {/* Warning: limite atingido */}
      {!can_send && (
        <div className="mt-2 pt-2 border-t border-red-300">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-red-600 flex-shrink-0" />
            <p className="text-xs text-red-700 font-medium">Limite atingido - Reset à meia-noite</p>
          </div>
        </div>
      )}

      {/* Warning: notas mensais esgotadas (mas ainda pode enviar sem nota) */}
      {monthlyExhausted && can_send && (
        <div className="mt-2 pt-2 border-t border-orange-300">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-3 h-3 text-orange-600 flex-shrink-0" />
            <p className="text-[10px] text-orange-700 font-medium">Notas esgotadas - convites serão enviados sem mensagem</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default InviteLimitBadge;
