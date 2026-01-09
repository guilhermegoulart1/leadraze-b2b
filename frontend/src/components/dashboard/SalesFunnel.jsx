import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingDown, ChevronDown } from 'lucide-react';
import api from '../../services/api';

const SalesFunnel = ({ pipelines = [], initialPipelineId = null }) => {
  const { t, i18n } = useTranslation('dashboard');
  const [selectedPipelineId, setSelectedPipelineId] = useState(initialPipelineId);
  const [stagesData, setStagesData] = useState([]);
  const [lostCount, setLostCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Set initial pipeline when pipelines load
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      const defaultPipeline = pipelines.find(p => p.is_default) || pipelines[0];
      setSelectedPipelineId(defaultPipeline.id);
    }
  }, [pipelines, selectedPipelineId]);

  // Fetch funnel data when pipeline changes
  useEffect(() => {
    if (selectedPipelineId) {
      loadFunnelData(selectedPipelineId);
    }
  }, [selectedPipelineId]);

  const loadFunnelData = async (pipelineId) => {
    try {
      setLoading(true);
      const response = await api.getPipelineFunnel(pipelineId);
      if (response.success) {
        setStagesData(response.data.stages || []);
        setLostCount(response.data.lost_count || 0);
      }
    } catch (error) {
      console.error('Error loading funnel data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (!value) return '';
    const locale = i18n.language === 'en' ? 'en-US' : i18n.language === 'es' ? 'es-ES' : 'pt-BR';
    const currency = i18n.language === 'en' ? 'USD' : i18n.language === 'es' ? 'EUR' : 'BRL';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const maxCount = Math.max(...stagesData.map(s => s.count || 0), 1);

  const calculateBarWidth = (count, max) => {
    if (count === 0) return 5;
    if (count === max) return 100;
    const ratio = count / max;
    if (ratio < 0.1) {
      const sqrtRatio = Math.sqrt(ratio);
      return Math.max(8, sqrtRatio * 100);
    }
    return ratio * 100;
  };

  const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('funnel.title')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('funnel.subtitle')}</p>
        </div>

        {/* Pipeline Selector */}
        <div className="flex items-center gap-3">
          {pipelines.length > 0 && (
            <div className="relative">
              <select
                value={selectedPipelineId || ''}
                onChange={(e) => setSelectedPipelineId(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent cursor-pointer"
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          )}
          <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-900/30">
            <TrendingDown className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
        </div>
      ) : stagesData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">
          {t('noData')}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {stagesData.map((stage, index) => {
              const barWidth = calculateBarWidth(stage.count || 0, maxCount);
              const isWonStage = stage.is_won_stage;

              return (
                <div key={stage.id || index}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="h-8 bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden relative">
                        <div
                          className="h-full rounded-lg transition-all duration-700 flex items-center"
                          style={{
                            width: `${barWidth}%`,
                            backgroundColor: stage.color || '#9ca3af'
                          }}
                        >
                          <span className="text-white text-xs font-medium px-3 truncate">
                            {stage.name}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="w-20 text-right shrink-0">
                      <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {(stage.count || 0).toLocaleString(i18n.language)}
                      </span>
                      {isWonStage && stage.value > 0 && (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block">
                          {formatCurrency(stage.value)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {lostCount > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">{t('funnel.lost')}</span>
              <span className="text-red-500 dark:text-red-400 font-medium">
                {lostCount.toLocaleString(i18n.language)}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SalesFunnel;
