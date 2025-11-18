// frontend/src/components/InviteLimitBadge.jsx
import React, { useState, useEffect } from 'react';
import { Send, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import api from '../services/api';

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
    campaigns = []
  } = stats;

  // Determinar cor baseado na porcentagem
  const getColorClass = () => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getTextColorClass = () => {
    if (percentage >= 90) return 'text-red-700';
    if (percentage >= 70) return 'text-orange-700';
    if (percentage >= 50) return 'text-yellow-700';
    return 'text-green-700';
  };

  const getBgColorClass = () => {
    if (percentage >= 90) return 'bg-red-50 border-red-200';
    if (percentage >= 70) return 'bg-orange-50 border-orange-200';
    if (percentage >= 50) return 'bg-yellow-50 border-yellow-200';
    return 'bg-green-50 border-green-200';
  };

  return (
    <div className={`rounded-lg border px-3 py-2 ${getBgColorClass()}`}>
      {/* Header Compacto */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Send className={`w-4 h-4 ${getTextColorClass()} flex-shrink-0`} />
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

      {/* Stats em linha única */}
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-2xl font-bold ${getTextColorClass()}`}>
            {sent_today}
          </span>
          <span className="text-sm text-gray-600">/ {daily_limit}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <div className={`text-sm font-medium ${getTextColorClass()}`}>
            {remaining} restantes
          </div>
          <span className="text-xs text-gray-500">({percentage}%)</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColorClass()} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Warning if limit reached - compacto */}
      {!can_send && (
        <div className="mt-2 pt-2 border-t border-red-300">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-red-600 flex-shrink-0" />
            <p className="text-xs text-red-700 font-medium">Limite atingido - Reset à meia-noite</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default InviteLimitBadge;
