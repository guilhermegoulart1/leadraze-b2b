import React, { useState, useEffect } from 'react';
import { Zap, ShoppingCart, TrendingUp, Clock, Infinity, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';

export default function AiCreditsCard() {
  const { t } = useTranslation();
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCredits();
  }, []);

  const fetchCredits = async () => {
    try {
      setLoading(true);
      const response = await api.get('/billing/ai-credits');
      if (response.data.success) {
        setCredits(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching AI credits:', err);
      setError('Failed to load AI credits');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (packageKey) => {
    try {
      setPurchasing(true);
      const response = await api.post('/billing/ai-credits/purchase', { packageKey });
      if (response.data.success && response.data.data?.url) {
        window.location.href = response.data.data.url;
      }
    } catch (err) {
      console.error('Error purchasing credits:', err);
      setError('Failed to start purchase');
    } finally {
      setPurchasing(false);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('pt-BR').format(num);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-10 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-xl border border-red-200 p-6">
        <div className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const isLowCredits = credits?.total < 500;
  const hasCredits = credits?.total > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className={`px-6 py-4 ${isLowCredits ? 'bg-amber-50' : 'bg-gradient-to-r from-purple-50 to-white'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isLowCredits ? 'bg-amber-100' : 'bg-purple-100'}`}>
              <Zap className={`w-5 h-5 ${isLowCredits ? 'text-amber-600' : 'text-purple-600'}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Créditos de IA</h3>
              <p className="text-sm text-gray-500">Para mensagens automáticas dos agentes</p>
            </div>
          </div>
          {isLowCredits && (
            <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Créditos baixos
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="grid grid-cols-3 gap-4">
          {/* Total Available */}
          <div className="text-center">
            <div className={`text-3xl font-bold ${isLowCredits ? 'text-amber-600' : 'text-purple-600'}`}>
              {formatNumber(credits?.total || 0)}
            </div>
            <div className="text-sm text-gray-500 mt-1">Disponíveis</div>
          </div>

          {/* Monthly Credits */}
          <div className="text-center border-l border-gray-100">
            <div className="flex items-center justify-center gap-1">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-xl font-semibold text-gray-700">
                {formatNumber(credits?.monthly?.remaining || 0)}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Mensais
              {credits?.monthly?.expiresAt && (
                <span className="block text-gray-400">
                  até {formatDate(credits.monthly.expiresAt)}
                </span>
              )}
            </div>
          </div>

          {/* Permanent Credits */}
          <div className="text-center border-l border-gray-100">
            <div className="flex items-center justify-center gap-1">
              <Infinity className="w-4 h-4 text-green-500" />
              <span className="text-xl font-semibold text-gray-700">
                {formatNumber(credits?.permanent || 0)}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Permanentes
              <span className="block text-green-500">não expiram</span>
            </div>
          </div>
        </div>
      </div>

      {/* Purchase Options */}
      <div className="px-6 py-5">
        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Adicionar Créditos
        </h4>

        <div className="space-y-3">
          {credits?.purchaseOptions?.map((pkg) => (
            <button
              key={pkg.key}
              onClick={() => handlePurchase(pkg.key)}
              disabled={purchasing}
              className="w-full flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">
                    +{formatNumber(pkg.credits)} Créditos
                  </div>
                  <div className="text-xs text-green-600 flex items-center gap-1">
                    <Infinity className="w-3 h-3" />
                    Nunca expiram
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-purple-600">{pkg.priceFormatted}</span>
                <ShoppingCart className="w-4 h-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
              </div>
            </button>
          ))}
        </div>

        {/* Info */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">
            <strong>Como funciona:</strong> Cada mensagem enviada automaticamente pelos agentes de IA consome 1 crédito.
            Os créditos mensais do plano são usados primeiro, depois os permanentes.
          </p>
        </div>
      </div>
    </div>
  );
}
