// frontend/src/components/QuickCreateOpportunityModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Briefcase, Loader2, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

export default function QuickCreateOpportunityModal({
  isOpen,
  onClose,
  conversation,
  onSuccess
}) {
  const { t } = useTranslation(['pipelines', 'common']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Data
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [stages, setStages] = useState([]);
  const [selectedStageId, setSelectedStageId] = useState('');

  // Load pipelines on mount
  useEffect(() => {
    if (isOpen) {
      loadPipelines();
    }
  }, [isOpen]);

  // Load stages when pipeline changes
  useEffect(() => {
    if (selectedPipelineId) {
      loadPipelineStages(selectedPipelineId);
    } else {
      setStages([]);
      setSelectedStageId('');
    }
  }, [selectedPipelineId]);

  const loadPipelines = async () => {
    try {
      setLoading(true);
      const response = await api.getPipelines();
      const pipelinesData = response.data?.pipelines || response.data || [];

      // Ordenar alfabeticamente por nome (considerando project_name se existir)
      const sortedPipelines = [...pipelinesData].sort((a, b) => {
        const nameA = (a.project_name ? `${a.project_name} > ${a.name}` : a.name).toLowerCase();
        const nameB = (b.project_name ? `${b.project_name} > ${b.name}` : b.name).toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setPipelines(sortedPipelines);

      // Auto-select first pipeline
      if (sortedPipelines.length > 0) {
        setSelectedPipelineId(sortedPipelines[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar pipelines:', err);
      setError(t('common:errors.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const loadPipelineStages = async (pipelineId) => {
    try {
      const response = await api.getPipeline(pipelineId);
      const pipelineData = response.data?.pipeline || response.data;
      const allStages = pipelineData?.stages || [];

      // Filtrar etapas de win/loss (não devem aparecer para seleção inicial)
      const activeStages = allStages.filter(stage => !stage.is_win_stage && !stage.is_loss_stage);
      setStages(activeStages);

      // Auto-select first stage
      if (activeStages.length > 0) {
        setSelectedStageId(activeStages[0].id);
      } else {
        setSelectedStageId('');
      }
    } catch (err) {
      console.error('Erro ao carregar etapas:', err);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPipelineId || !selectedStageId) {
      setError(t('pipelines:opportunity.selectStageError', 'Selecione uma pipeline e etapa'));
      return;
    }

    if (!conversation?.contact_id) {
      setError(t('pipelines:opportunity.noContactError', 'Conversa não tem contato associado'));
      return;
    }

    try {
      setSaving(true);
      setError('');

      // Create opportunity with contact from conversation
      const payload = {
        contact_id: conversation.contact_id,
        stage_id: selectedStageId,
        title: `${conversation.lead_name || conversation.contact_name || 'Novo'}`,
        source: 'conversation'
      };

      const response = await api.createOpportunity(selectedPipelineId, payload);

      if (response.success) {
        onSuccess?.(response.data);
        onClose();
      } else {
        setError(response.error || t('common:errors.saveError'));
      }
    } catch (err) {
      console.error('Erro ao criar oportunidade:', err);
      setError(err.message || t('common:errors.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-[#7229f7]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('pipelines:opportunity.quickCreate', 'Criar Oportunidade')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {conversation?.lead_name || conversation?.contact_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-[#7229f7] animate-spin" />
            </div>
          ) : pipelines.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>{t('pipelines:noPipelines', 'Nenhuma pipeline encontrada')}</p>
              <p className="text-sm mt-1">{t('pipelines:createPipelineFirst', 'Crie uma pipeline primeiro')}</p>
            </div>
          ) : (
            <>
              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Pipeline Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('pipelines:pipeline', 'Pipeline')}
                </label>
                <select
                  value={selectedPipelineId}
                  onChange={(e) => setSelectedPipelineId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7229f7] focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {pipelines.map(pipeline => (
                    <option key={pipeline.id} value={pipeline.id}>
                      {pipeline.project_name ? `${pipeline.project_name} > ` : ''}{pipeline.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stage Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('pipelines:stage', 'Etapa')}
                </label>
                {stages.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                    {t('pipelines:noStages', 'Nenhuma etapa nesta pipeline')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {stages.map((stage, index) => (
                      <button
                        key={stage.id}
                        onClick={() => setSelectedStageId(stage.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                          selectedStageId === stage.id
                            ? 'border-[#7229f7] bg-purple-50 dark:bg-purple-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: stage.color || '#6b7280' }}
                        />
                        <span className={`text-sm flex-1 text-left ${
                          selectedStageId === stage.id
                            ? 'text-[#7229f7] font-medium'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {stage.name}
                        </span>
                        {selectedStageId === stage.id && (
                          <ChevronRight className="w-4 h-4 text-[#7229f7]" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && pipelines.length > 0 && (
          <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t('common:cancel', 'Cancelar')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !selectedPipelineId || !selectedStageId}
              className="px-4 py-2 text-sm font-medium text-white bg-[#7229f7] hover:bg-[#5a1fd4] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('pipelines:opportunity.create', 'Criar Oportunidade')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
