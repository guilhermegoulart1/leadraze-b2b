// frontend/src/components/RoadmapSelector.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, Map, Clock, User, Calendar, AlertCircle, Loader,
  CheckCircle, ChevronDown, ChevronUp, Phone, Video, Mail,
  MessageSquare, FileText, MoreHorizontal
} from 'lucide-react';
import api from '../services/api';

const RoadmapSelector = ({
  isOpen,
  onClose,
  roadmap,
  contactId,
  conversationId,
  onSuccess
}) => {
  const { t, i18n } = useTranslation('settings');
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState(null);
  const [roadmapDetails, setRoadmapDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showTaskDetails, setShowTaskDetails] = useState(true);

  // State for opportunity creation flow
  const [contact, setContact] = useState(null);
  const [loadingContact, setLoadingContact] = useState(false);
  const [showCreateOpportunity, setShowCreateOpportunity] = useState(false);
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [loadingPipelines, setLoadingPipelines] = useState(false);

  // Helper to get locale for date formatting
  const getLocale = () => i18n.language === 'en' ? 'en-US' : i18n.language === 'es' ? 'es-ES' : 'pt-BR';

  // Load roadmap details when modal opens
  useEffect(() => {
    if (isOpen && roadmap?.id) {
      loadRoadmapDetails();
    }
  }, [isOpen, roadmap?.id]);

  // Load contact details to check for opportunity
  useEffect(() => {
    if (isOpen && contactId) {
      loadContactDetails();
    }
  }, [isOpen, contactId]);

  // Load pipelines when needed
  useEffect(() => {
    if (showCreateOpportunity && pipelines.length === 0) {
      loadPipelines();
    }
  }, [showCreateOpportunity]);

  const loadRoadmapDetails = async () => {
    setLoadingDetails(true);
    try {
      const response = await api.getRoadmap(roadmap.id);
      if (response.success) {
        setRoadmapDetails(response.data);
      }
    } catch (err) {
      console.error('Error loading roadmap details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const loadContactDetails = async () => {
    setLoadingContact(true);
    try {
      const response = await api.getContactFull(contactId);
      if (response.success) {
        setContact(response.data);
      }
    } catch (err) {
      console.error('Error loading contact details:', err);
    } finally {
      setLoadingContact(false);
    }
  };

  const loadPipelines = async () => {
    setLoadingPipelines(true);
    try {
      const response = await api.getPipelines();
      if (response.success) {
        setPipelines(response.data || []);
        // Select first pipeline by default
        if (response.data?.length > 0) {
          setSelectedPipeline(response.data[0]);
          if (response.data[0].stages?.length > 0) {
            setSelectedStage(response.data[0].stages[0]);
          }
        }
      }
    } catch (err) {
      console.error('Error loading pipelines:', err);
    } finally {
      setLoadingPipelines(false);
    }
  };

  // Calculate due dates for preview
  const calculatePreviewDates = (tasks) => {
    if (!tasks?.length) return [];

    const now = new Date();
    let previousDueDate = now;

    return tasks
      .sort((a, b) => a.position - b.position)
      .map(task => {
        let dueDate;

        if (task.relative_due_from === 'roadmap_start') {
          dueDate = new Date(now.getTime() + (task.relative_due_hours || 0) * 60 * 60 * 1000);
        } else {
          // previous_task
          dueDate = new Date(previousDueDate.getTime() + (task.relative_due_hours || 0) * 60 * 60 * 1000);
        }

        previousDueDate = dueDate;

        return {
          ...task,
          calculated_due_date: dueDate
        };
      });
  };

  // Get task type icon
  const getTaskTypeIcon = (type) => {
    switch (type) {
      case 'call': return Phone;
      case 'meeting': return Video;
      case 'email': return Mail;
      case 'follow_up': return MessageSquare;
      case 'proposal': return FileText;
      default: return MoreHorizontal;
    }
  };

  // Format date for display
  const formatDueDate = (date) => {
    const now = new Date();
    const diff = date - now;
    const hours = Math.round(diff / (1000 * 60 * 60));
    const days = Math.round(diff / (1000 * 60 * 60 * 24));

    if (hours < 24) {
      return t('roadmaps.execution.inHours', 'Em {{count}}h').replace('{{count}}', hours);
    } else if (days === 1) {
      return t('roadmaps.execution.tomorrow', 'Amanhã');
    } else if (days <= 7) {
      return t('roadmaps.execution.inDays', 'Em {{count}} dias').replace('{{count}}', days);
    } else {
      return date.toLocaleDateString(getLocale(), { day: '2-digit', month: 'short' });
    }
  };

  // Execute roadmap
  const handleExecute = async (createOpportunity = false) => {
    if (!roadmap?.id || !contactId) {
      setError(t('roadmaps.execution.missingData', 'Dados incompletos para executar o roadmap'));
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      let opportunityId = contact?.opportunity_id;

      // Create opportunity if requested
      if (createOpportunity && selectedPipeline && selectedStage) {
        const opportunityResponse = await api.createOpportunity({
          contact_id: contactId,
          pipeline_id: selectedPipeline.id,
          stage_id: selectedStage.id,
          title: contact?.name || 'Nova Oportunidade'
        });

        if (opportunityResponse.success) {
          opportunityId = opportunityResponse.data.id;
        } else {
          throw new Error(opportunityResponse.error || 'Erro ao criar oportunidade');
        }
      }

      // Execute roadmap
      const response = await api.executeRoadmap(roadmap.id, {
        contact_id: contactId,
        opportunity_id: opportunityId,
        conversation_id: conversationId
      });

      if (response.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(response.error || t('roadmaps.execution.error', 'Erro ao executar roadmap'));
      }
    } catch (err) {
      console.error('Error executing roadmap:', err);
      setError(err.message || t('roadmaps.execution.error', 'Erro ao executar roadmap'));
    } finally {
      setIsExecuting(false);
    }
  };

  if (!isOpen) return null;

  const tasks = roadmapDetails?.tasks || [];
  const previewTasks = calculatePreviewDates(tasks);
  const hasOpportunity = !!contact?.opportunity_id;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Map className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('roadmaps.execution.title', 'Executar Roadmap')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {roadmap?.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Loading state */}
          {(loadingDetails || loadingContact) && (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          )}

          {/* Roadmap info */}
          {!loadingDetails && roadmapDetails && (
            <>
              {roadmapDetails.description && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {roadmapDetails.description}
                </p>
              )}

              {/* Summary */}
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  {tasks.length} {t('roadmaps.tasks', 'tarefas')}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {roadmapDetails.total_duration_hours || 0}h {t('roadmaps.durationTotal', 'duração total')}
                </span>
              </div>

              {/* No opportunity warning / Create opportunity flow */}
              {!loadingContact && !hasOpportunity && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        {t('roadmaps.execution.noOpportunity', 'Este contato não possui uma oportunidade.')}
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        {t('roadmaps.execution.createOpportunity', 'Deseja criar uma oportunidade?')}
                      </p>

                      {!showCreateOpportunity ? (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => setShowCreateOpportunity(true)}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg transition-colors"
                          >
                            {t('roadmaps.execution.yesCreate', 'Sim, criar oportunidade')}
                          </button>
                          <button
                            onClick={() => handleExecute(false)}
                            disabled={isExecuting}
                            className="px-3 py-1.5 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg border border-gray-300 dark:border-gray-600 transition-colors"
                          >
                            {t('roadmaps.execution.noContinue', 'Não, continuar sem')}
                          </button>
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {loadingPipelines ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Loader className="w-4 h-4 animate-spin" />
                              {t('common.loading', 'Carregando...')}
                            </div>
                          ) : (
                            <>
                              {/* Pipeline select */}
                              <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  {t('roadmaps.execution.selectPipeline', 'Selecionar pipeline')}
                                </label>
                                <select
                                  value={selectedPipeline?.id || ''}
                                  onChange={(e) => {
                                    const pipeline = pipelines.find(p => p.id === e.target.value);
                                    setSelectedPipeline(pipeline);
                                    setSelectedStage(pipeline?.stages?.[0] || null);
                                  }}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                >
                                  {pipelines.map(pipeline => (
                                    <option key={pipeline.id} value={pipeline.id}>
                                      {pipeline.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Stage select */}
                              {selectedPipeline?.stages?.length > 0 && (
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('roadmaps.execution.selectStage', 'Selecionar etapa')}
                                  </label>
                                  <select
                                    value={selectedStage?.id || ''}
                                    onChange={(e) => {
                                      const stage = selectedPipeline.stages.find(s => s.id === e.target.value);
                                      setSelectedStage(stage);
                                    }}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                  >
                                    {selectedPipeline.stages.map(stage => (
                                      <option key={stage.id} value={stage.id}>
                                        {stage.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleExecute(true)}
                                  disabled={isExecuting || !selectedPipeline || !selectedStage}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                                >
                                  {isExecuting ? (
                                    <span className="flex items-center gap-2">
                                      <Loader className="w-4 h-4 animate-spin" />
                                      {t('roadmaps.execution.executing', 'Executando...')}
                                    </span>
                                  ) : (
                                    t('roadmaps.execution.createAndExecute', 'Criar e Executar')
                                  )}
                                </button>
                                <button
                                  onClick={() => setShowCreateOpportunity(false)}
                                  className="px-3 py-1.5 text-gray-600 dark:text-gray-400 text-sm hover:underline"
                                >
                                  {t('common.cancel', 'Cancelar')}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Task preview */}
              <div>
                <button
                  onClick={() => setShowTaskDetails(!showTaskDetails)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  {showTaskDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {t('roadmaps.execution.preview', 'Preview das tarefas')}
                </button>

                {showTaskDetails && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {previewTasks.map((task, index) => {
                      const TaskIcon = getTaskTypeIcon(task.task_type);
                      return (
                        <div
                          key={task.id}
                          className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                        >
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs font-medium">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <TaskIcon className="w-4 h-4 text-gray-400" />
                              <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                                {task.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDueDate(task.calculated_due_date)}
                              </span>
                              {task.default_assignee_name && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {task.default_assignee_name}
                                </span>
                              )}
                              {task.priority && task.priority !== 'medium' && (
                                <span className={`px-1.5 py-0.5 rounded text-xs ${
                                  task.priority === 'urgent' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                                  task.priority === 'high' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                                  'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                }`}>
                                  {t(`roadmaps.priorities.${task.priority}`, task.priority)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {hasOpportunity && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t('common.cancel', 'Cancelar')}
            </button>
            <button
              onClick={() => handleExecute(false)}
              disabled={isExecuting || loadingDetails}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isExecuting ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  {t('roadmaps.execution.executing', 'Executando...')}
                </>
              ) : (
                <>
                  <Map className="w-4 h-4" />
                  {t('roadmaps.execution.execute', 'Executar')}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoadmapSelector;
