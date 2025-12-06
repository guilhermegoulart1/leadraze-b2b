import React, { useState, useEffect } from 'react';
import { Zap, MapPin, ChevronDown, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const CreditsIndicator = () => {
  const navigate = useNavigate();
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetchCredits();
    // Refresh every 5 minutes
    const interval = setInterval(fetchCredits, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchCredits = async () => {
    try {
      const response = await api.get('/billing/credits-summary');
      if (response.success) {
        setCredits(response.data);
      }
    } catch (err) {
      console.error('Error fetching credits summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace('.0', '') + 'k';
    }
    return num?.toString() || '0';
  };

  // Mini circular progress component - shows remaining credits (green to red)
  const MiniGauge = ({ percentUsed: rawPercentUsed, icon: Icon, label, total }) => {
    // Cap percentUsed between 0-100 to avoid visual bugs
    const percentUsed = Math.max(0, Math.min(rawPercentUsed || 0, 100));
    const radius = 14;
    const circumference = 2 * Math.PI * radius;
    const percentRemaining = 100 - percentUsed;
    const strokeDashoffset = circumference - (percentRemaining / 100) * circumference;

    // Color based on remaining credits: green -> yellow -> red
    const getColor = () => {
      if (percentUsed >= 90) return '#ef4444'; // red
      if (percentUsed >= 70) return '#f59e0b'; // amber
      if (percentUsed >= 50) return '#eab308'; // yellow
      return '#22c55e'; // green
    };

    const color = getColor();
    const isLow = percentUsed >= 70;
    const isCritical = percentUsed >= 90;

    return (
      <div className="flex items-center gap-1.5">
        <div className="relative w-9 h-9">
          <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
            {/* Background circle (empty/used portion) */}
            <circle
              cx="18"
              cy="18"
              r={radius}
              fill="none"
              stroke={isCritical ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.2)'}
              strokeWidth="3"
            />
            {/* Progress circle (remaining credits) */}
            <circle
              cx="18"
              cy="18"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className={`w-3.5 h-3.5 ${isCritical ? 'text-red-300' : isLow ? 'text-amber-300' : 'text-white'}`} />
          </div>
        </div>
        <div className="hidden sm:block">
          <div className={`text-[10px] font-medium ${isCritical ? 'text-red-300' : isLow ? 'text-amber-300' : 'text-white/70'}`}>
            {label}
          </div>
          <div className={`text-xs font-semibold ${isCritical ? 'text-red-300' : 'text-white'}`}>
            {formatNumber(total)}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 px-3 py-1.5 bg-purple-600/50 rounded-lg animate-pulse">
        <div className="w-9 h-9 bg-purple-500/50 rounded-full" />
        <div className="w-9 h-9 bg-purple-500/50 rounded-full" />
      </div>
    );
  }

  if (!credits) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-1.5 bg-purple-600/50 hover:bg-purple-600/70 rounded-lg transition-colors"
      >
        <MiniGauge
          percentUsed={credits.ai?.percentUsed || 0}
          icon={Zap}
          label="IA"
          total={credits.ai?.total || 0}
        />
        <div className="w-px h-6 bg-white/20" />
        <MiniGauge
          percentUsed={credits.gmaps?.percentUsed || 0}
          icon={MapPin}
          label="Maps"
          total={credits.gmaps?.total || 0}
        />
        <ChevronDown className={`w-3.5 h-3.5 text-white/60 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-white border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Uso de Créditos</h3>
            </div>

            {/* AI Credits */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    (credits.ai?.percentUsed || 0) >= 90 ? 'bg-red-100 dark:bg-red-900/30' :
                    (credits.ai?.percentUsed || 0) >= 70 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-green-100 dark:bg-green-900/30'
                  }`}>
                    <Zap className={`w-4 h-4 ${
                      (credits.ai?.percentUsed || 0) >= 90 ? 'text-red-600 dark:text-red-400' :
                      (credits.ai?.percentUsed || 0) >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'
                    }`} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Créditos de IA</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Agentes automáticos</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${
                    (credits.ai?.percentUsed || 0) >= 90 ? 'text-red-600 dark:text-red-400' :
                    (credits.ai?.percentUsed || 0) >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'
                  }`}>
                    {formatNumber(credits.ai?.total || 0)}
                  </div>
                  <div className="text-xs text-gray-400">disponíveis</div>
                </div>
              </div>
              {/* Progress bar - shows remaining */}
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${
                    (credits.ai?.percentUsed || 0) >= 90 ? 'bg-red-500' :
                    (credits.ai?.percentUsed || 0) >= 70 ? 'bg-amber-500' :
                    (credits.ai?.percentUsed || 0) >= 50 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100 - (credits.ai?.percentUsed || 0), 100))}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                {Math.max(0, Math.min(100 - (credits.ai?.percentUsed || 0), 100))}% restante
              </div>
            </div>

            {/* GMaps Credits */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    (credits.gmaps?.percentUsed || 0) >= 90 ? 'bg-red-100 dark:bg-red-900/30' :
                    (credits.gmaps?.percentUsed || 0) >= 70 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-green-100 dark:bg-green-900/30'
                  }`}>
                    <MapPin className={`w-4 h-4 ${
                      (credits.gmaps?.percentUsed || 0) >= 90 ? 'text-red-600 dark:text-red-400' :
                      (credits.gmaps?.percentUsed || 0) >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'
                    }`} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Google Maps</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Busca de leads</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${
                    (credits.gmaps?.percentUsed || 0) >= 90 ? 'text-red-600 dark:text-red-400' :
                    (credits.gmaps?.percentUsed || 0) >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'
                  }`}>
                    {formatNumber(credits.gmaps?.total || 0)}
                  </div>
                  <div className="text-xs text-gray-400">disponíveis</div>
                </div>
              </div>
              {/* Progress bar - shows remaining */}
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${
                    Math.max(0, Math.min(credits.gmaps?.percentUsed || 0, 100)) >= 90 ? 'bg-red-500' :
                    Math.max(0, Math.min(credits.gmaps?.percentUsed || 0, 100)) >= 70 ? 'bg-amber-500' :
                    Math.max(0, Math.min(credits.gmaps?.percentUsed || 0, 100)) >= 50 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100 - (credits.gmaps?.percentUsed || 0), 100))}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                {Math.max(0, Math.min(100 - (credits.gmaps?.percentUsed || 0), 100))}% restante
              </div>
            </div>

            {/* Actions */}
            <div className="p-3 bg-gray-50 dark:bg-gray-900/50">
              <button
                onClick={() => {
                  setShowDropdown(false);
                  navigate('/billing');
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                Comprar Créditos
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CreditsIndicator;
