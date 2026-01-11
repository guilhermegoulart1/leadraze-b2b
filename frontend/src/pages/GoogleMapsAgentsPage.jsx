// frontend/src/pages/GoogleMapsAgentsPage.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Plus, Loader2, AlertCircle, X, Target, MapPin, Sparkles, Gift, Zap, Trash2 } from 'lucide-react';
import apiService from '../services/api';
import GoogleMapsAgentRow from '../components/GoogleMapsAgentRow';
import GoogleMapsAgentForm from '../components/GoogleMapsAgentForm';
import { useBilling } from '../contexts/BillingContext';
import { onGmapsAgentProgress } from '../services/ably';

const GoogleMapsAgentsPage = () => {
  const { t } = useTranslation(['googlemaps', 'common']);
  const { credits, purchaseCredits } = useBilling();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [executingAgents, setExecutingAgents] = useState(new Set()); // Track agents that are executing

  // Edit modal state
  const [editingAgent, setEditingAgent] = useState(null);
  const [editDailyLimit, setEditDailyLimit] = useState(20);
  const [savingEdit, setSavingEdit] = useState(false);

  // Progress tracking for gamified status
  const [agentProgress, setAgentProgress] = useState({});

  // Credits modal state
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [purchasingPackage, setPurchasingPackage] = useState(null);

  // Delete confirmation modal state
  const [deleteModal, setDeleteModal] = useState({ show: false, agent: null, deleting: false });

  // Load agents on mount
  useEffect(() => {
    loadAgents();
  }, []);

  // Polling effect - reload agents while some are executing (fallback)
  useEffect(() => {
    if (executingAgents.size === 0) return;

    const interval = setInterval(() => {
      console.log('🔄 Polling agents status (fallback)...');
      loadAgents(true); // Silent refresh - don't show loading spinner
    }, 10000); // Poll every 10 seconds as fallback

    return () => clearInterval(interval);
  }, [executingAgents]);

  // Realtime listener for real-time updates via Ably
  useEffect(() => {
    const handleGmapsProgress = (data, source) => {
      console.log(`📡 ${source}: gmaps_agent_progress`, data);

      // Check if this is a "collecting" status (still working) or final status
      const isCollecting = data.status === 'collecting';
      const isFinalStatus = data.status === 'completed' || data.status === 'in_progress';

      // Update the specific agent in state
      setAgents(prev => prev.map(agent => {
        if (agent.id === data.agentId) {
          return {
            ...agent,
            // Only update status if it's the final status, keep 'collecting' during execution
            status: isCollecting ? 'collecting' : data.status,
            total_leads_found: data.leadsFound,
            leads_inserted: data.leadsInserted
          };
        }
        return agent;
      }));

      // Update progress for gamified status (only during collection)
      if (isCollecting && data.step) {
        setAgentProgress(prev => ({
          ...prev,
          [data.agentId]: {
            step: data.step,
            stepLabel: data.stepLabel,
            currentPlace: data.currentPlace,
            leadsFound: data.leadsFound,
            leadsInserted: data.leadsInserted,
            page: data.page,
            progress: data.progress // { current, total }
          }
        }));
      }

      // If final status (completed or in_progress), remove from executing set and clear progress
      if (isFinalStatus) {
        console.log(`📡 Agent ${data.agentId} finished with status: ${data.status}`);
        setExecutingAgents(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.agentId);
          return newSet;
        });
        // Clear progress for finished agent
        setAgentProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[data.agentId];
          return newProgress;
        });
      }
    };

    // Ably listener (realtime)
    const unsubscribe = onGmapsAgentProgress((data) => handleGmapsProgress(data, 'Ably'));

    return () => {
      unsubscribe();
    };
  }, []);

  const loadAgents = async (silentRefresh = false) => {
    try {
      // Only show loading spinner on initial load, not on refresh/polling
      if (!silentRefresh) {
        setLoading(true);
      }
      setError(null);

      const response = await apiService.getGoogleMapsAgents();

      if (response.success) {
        const loadedAgents = response.agents || [];

        // Check if any executing agents have finished and build updated set
        let updatedExecuting = new Set(executingAgents);
        executingAgents.forEach(agentId => {
          const agent = loadedAgents.find(a => a.id === agentId);
          // If agent status is completed, in_progress, paused, or failed - it finished executing
          // 'in_progress' means more results available but current batch is done
          if (agent && ['completed', 'in_progress', 'paused', 'failed'].includes(agent.status)) {
            updatedExecuting.delete(agentId);
          }
        });

        // Update state if changed
        if (updatedExecuting.size !== executingAgents.size) {
          setExecutingAgents(updatedExecuting);
        }

        // Merge with executing status using the UPDATED set
        // Only override to 'collecting' if we're sure it's still executing
        const agentsWithStatus = loadedAgents.map(agent => ({
          ...agent,
          // Override status to 'collecting' only if:
          // 1. It's in executingAgents AND
          // 2. Database status is still 'active' (not yet updated to final status)
          status: updatedExecuting.has(agent.id) && agent.status === 'active'
            ? 'collecting'
            : agent.status
        }));

        setAgents(agentsWithStatus);
      } else {
        setError(response.message || t('agents.errorLoading'));
      }
    } catch (error) {
      console.error('❌ Erro ao carregar campanhas:', error);
      setError(t('agents.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgent = async (agentData) => {
    try {
      const response = await apiService.createGoogleMapsAgent(agentData);

      if (response.success) {
        setShowCreateForm(false);

        const newAgentId = response.agent?.id;

        // Set assignees for rotation if provided
        if (newAgentId && agentData.assignees && agentData.assignees.length > 0) {
          try {
            await apiService.setGoogleMapsAgentAssignees(newAgentId, agentData.assignees);
            console.log('✅ Rodízio configurado com sucesso!');
          } catch (assigneeError) {
            console.error('⚠️ Erro ao configurar rodízio:', assigneeError);
          }
        }

        // Add new agent to executing list (it starts executing automatically)
        if (newAgentId) {
          setExecutingAgents(prev => new Set([...prev, newAgentId]));
        }

        // Immediately reload to show the new agent (silent refresh)
        await loadAgents(true);

        // Show success message (the agent will show "Coletando..." status automatically)
        console.log('✅ Campanha criada com sucesso! Coletando primeiros leads...');

        return true;
      } else {
        throw new Error(response.message || 'Erro ao criar campanha');
      }
    } catch (error) {
      console.error('❌ Erro ao criar campanha:', error);
      throw error;
    }
  };

  const handlePauseAgent = async (agentId) => {
    try {
      await apiService.pauseGoogleMapsAgent(agentId);
      loadAgents(true); // Silent refresh
    } catch (error) {
      console.error('❌ Erro ao pausar campanha:', error);
      alert(t('agents.errorPause'));
    }
  };

  const handleResumeAgent = async (agentId) => {
    try {
      await apiService.resumeGoogleMapsAgent(agentId);
      loadAgents(true); // Silent refresh
    } catch (error) {
      console.error('❌ Erro ao retomar campanha:', error);
      alert(t('agents.errorResume'));
    }
  };

  const handleDeleteAgent = (agentId) => {
    // Find the agent to show its info in the modal
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
      setDeleteModal({ show: true, agent, deleting: false });
    }
  };

  const confirmDelete = async (deleteLeads = false) => {
    if (!deleteModal.agent) return;

    setDeleteModal(prev => ({ ...prev, deleting: true }));

    try {
      const result = await apiService.deleteGoogleMapsAgent(deleteModal.agent.id, { deleteLeads });
      setDeleteModal({ show: false, agent: null, deleting: false });
      loadAgents(true); // Silent refresh

      // Show success message if leads were deleted
      if (deleteLeads && result.leadsDeleted > 0) {
        console.log(`✅ Campanha e ${result.leadsDeleted} leads deletados`);
      }
    } catch (error) {
      console.error('❌ Erro ao deletar campanha:', error);
      setDeleteModal(prev => ({ ...prev, deleting: false }));
      alert(t('agents.errorDelete'));
    }
  };

  const handleExecuteAgent = async (agentId) => {
    try {
      console.log('🚀 Executando agente manualmente:', agentId);

      // Add to executing set immediately
      setExecutingAgents(prev => new Set([...prev, agentId]));

      // Update UI immediately to show "collecting" status
      setAgents(prev => prev.map(agent =>
        agent.id === agentId ? { ...agent, status: 'collecting' } : agent
      ));

      // Trigger execution
      await apiService.executeGoogleMapsAgent(agentId);

      console.log('✅ Agente executado, aguardando resultados...');

      // Start polling (will be handled by useEffect)
    } catch (error) {
      console.error('❌ Erro ao executar agente:', error);
      alert('Erro ao executar agente. Tente novamente.');

      // Remove from executing set on error
      setExecutingAgents(prev => {
        const newSet = new Set(prev);
        newSet.delete(agentId);
        return newSet;
      });

      // Reload agents to restore correct status
      loadAgents(true);
    }
  };

  const handleExportAgent = async (agentId, agentName) => {
    try {
      console.log('📥 Exportando contatos do agente:', agentId);
      const csv = await apiService.exportGoogleMapsAgentContacts(agentId);

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `google-maps-${agentName.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      console.log('✅ CSV exportado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao exportar CSV:', error);
      alert(t('agents.exportError', 'Erro ao exportar CSV. Tente novamente.'));
    }
  };

  const handleEditAgent = (agent) => {
    setEditingAgent(agent);
    setEditDailyLimit(agent.daily_limit || 20);
  };

  const handleSaveEdit = async () => {
    if (!editingAgent) return;

    try {
      setSavingEdit(true);
      await apiService.updateGoogleMapsAgent(editingAgent.id, {
        dailyLimit: editDailyLimit
      });

      // Close modal and refresh agents
      setEditingAgent(null);
      loadAgents(true);
      console.log('✅ Campanha atualizada com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao atualizar campanha:', error);
      alert('Erro ao atualizar campanha. Tente novamente.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Check credits before opening create form
  const handleCreateClick = () => {
    const availableCredits = credits?.gmaps?.available || 0;

    if (availableCredits < 1) {
      setShowCreditsModal(true);
    } else {
      setShowCreateForm(true);
    }
  };

  // Handle credit package purchase
  const handlePurchaseCredits = async (packageId) => {
    try {
      setPurchasingPackage(packageId);
      await purchaseCredits(packageId);
    } catch (error) {
      console.error('❌ Erro ao comprar créditos:', error);
      alert('Erro ao processar compra. Tente novamente.');
    } finally {
      setPurchasingPackage(null);
    }
  };

  // Credit packages for the modal
  const creditPackages = [
    { id: 'gmaps_500', credits: 500, price: 9, popular: false },
    { id: 'gmaps_1000', credits: 1000, price: 17, popular: true },
    { id: 'gmaps_2500', credits: 2500, price: 39, popular: false },
    { id: 'gmaps_5000', credits: 5000, price: 55, popular: false }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Bot className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {t('agents.title')}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('agents.subtitle')}
                </p>
              </div>
            </div>

            <button
              onClick={handleCreateClick}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>{t('agents.createCampaign')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error message */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                  {t('agents.errorTitle')}
                </h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
              <p className="text-gray-600 dark:text-gray-400">{t('agents.loading')}</p>
            </div>
          </div>
        )}

        {/* Agents table */}
        {!loading && agents.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Campanha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Leads
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Config
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Ultima
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Acoes
                  </th>
                </tr>
              </thead>
              <tbody>
                {agents.map(agent => (
                  <GoogleMapsAgentRow
                    key={agent.id}
                    agent={agent}
                    onPause={handlePauseAgent}
                    onResume={handleResumeAgent}
                    onDelete={handleDeleteAgent}
                    onExport={handleExportAgent}
                    onEdit={handleEditAgent}
                    onExecute={handleExecuteAgent}
                    progress={agentProgress[agent.id]}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {!loading && agents.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12">
            <div className="text-center">
              <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {t('agents.noCampaignsTitle')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {t('agents.noCampaignsSubtitle')}
              </p>
              <button
                onClick={handleCreateClick}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>{t('agents.createFirstCampaign')}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create agent modal */}
      {showCreateForm && (
        <GoogleMapsAgentForm
          onClose={() => setShowCreateForm(false)}
          onSubmit={handleCreateAgent}
        />
      )}

      {/* Edit agent modal */}
      {editingAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('agents.editCampaign')}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {editingAgent.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingAgent(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('agents.dailyLimit')}
                </label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {editDailyLimit}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {Math.ceil(editDailyLimit / 20)} {Math.ceil(editDailyLimit / 20) > 1 ? t('creditsModal.creditsGmapsDay') : t('creditsModal.creditGmapsDay')}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="200"
                    step="20"
                    value={editDailyLimit}
                    onChange={(e) => setEditDailyLimit(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>20</span>
                    <span>60</span>
                    <span>100</span>
                    <span>140</span>
                    <span>200</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('agents.dailyLimitInfo')}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setEditingAgent(null)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {t('agents.cancel')}
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('agents.saving')}</span>
                  </>
                ) : (
                  <span>{t('agents.save')}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credits Purchase Modal - Compact design */}
      {showCreditsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5" />
                  <h2 className="text-lg font-bold">{t('creditsModal.title')}</h2>
                </div>
                <button
                  onClick={() => setShowCreditsModal(false)}
                  className="text-white/80 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              {/* Current credits info */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2 mb-3 flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">{t('creditsModal.currentCredits')}</span>
                <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  {credits?.gmaps?.available || 0}
                </span>
              </div>

              {/* Benefits - inline */}
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-yellow-500" />
                  {t('creditsModal.benefit1')}
                </span>
                <span className="flex items-center gap-1">
                  <Gift className="w-3 h-3 text-green-500" />
                  {t('creditsModal.benefit2')}
                </span>
              </div>

              {/* Package options */}
              <div className="space-y-2">
                {creditPackages.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => handlePurchaseCredits(pkg.id)}
                    disabled={purchasingPackage !== null}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border-2 transition-all ${
                      pkg.popular
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-center gap-2">
                      {pkg.popular && (
                        <span className="bg-purple-600 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                          {t('creditsModal.popular')}
                        </span>
                      )}
                      <div className="text-left">
                        <span className="font-bold text-gray-900 dark:text-white">
                          {pkg.credits.toLocaleString()} {t('creditsModal.credits')}
                        </span>
                        <span className="text-xs text-green-600 dark:text-green-400 ml-2">
                          ${(pkg.price / pkg.credits * 100).toFixed(1)} {t('creditsModal.centsPerLead')}
                        </span>
                      </div>
                    </div>
                    {purchasingPackage === pkg.id ? (
                      <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                    ) : (
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        ${pkg.price}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Footer */}
              <p className="text-center text-gray-400 text-xs mt-3">
                {t('creditsModal.paymentSecure')}
              </p>
              <button
                onClick={() => setShowCreditsModal(false)}
                className="w-full py-2 mt-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                {t('creditsModal.maybeLater')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.show && deleteModal.agent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-4 py-3 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Trash2 className="w-5 h-5" />
                  <h2 className="text-lg font-bold">{t('agents.deleteConfirmTitle', 'Deletar Campanha')}</h2>
                </div>
                <button
                  onClick={() => setDeleteModal({ show: false, agent: null, deleting: false })}
                  disabled={deleteModal.deleting}
                  className="text-white/80 hover:text-white p-1 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5">
              <div className="text-center mb-5">
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  {t('agents.deleteConfirmMessage', 'Você está prestes a deletar a campanha:')}
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {deleteModal.agent.name}
                </p>
                {deleteModal.agent.leads_inserted > 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t('agents.leadsCollected', { count: deleteModal.agent.leads_inserted || 0 }, `${deleteModal.agent.leads_inserted || 0} leads coletados`)}
                  </p>
                )}
              </div>

              {/* Options */}
              <div className="space-y-3">
                {/* Delete only campaign */}
                <button
                  onClick={() => confirmDelete(false)}
                  disabled={deleteModal.deleting}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="text-left">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {t('agents.deleteOnlyCampaign', 'Deletar apenas campanha')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('agents.deleteOnlyCampaignDesc', 'Os leads coletados serão mantidos')}
                    </p>
                  </div>
                  {deleteModal.deleting ? (
                    <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                  ) : (
                    <span className="text-orange-500 font-bold">→</span>
                  )}
                </button>

                {/* Delete campaign and leads */}
                <button
                  onClick={() => confirmDelete(true)}
                  disabled={deleteModal.deleting}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 border-red-200 dark:border-red-800 hover:border-red-500 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="text-left">
                    <p className="font-semibold text-red-600 dark:text-red-400">
                      {t('agents.deleteCampaignAndLeads', 'Deletar campanha e leads')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('agents.deleteCampaignAndLeadsDesc', { count: deleteModal.agent.leads_inserted || 0 }, `Deletar ${deleteModal.agent.leads_inserted || 0} leads permanentemente`)}
                    </p>
                  </div>
                  {deleteModal.deleting ? (
                    <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
                  ) : (
                    <Trash2 className="w-5 h-5 text-red-500" />
                  )}
                </button>
              </div>

              {/* Cancel button */}
              <button
                onClick={() => setDeleteModal({ show: false, agent: null, deleting: false })}
                disabled={deleteModal.deleting}
                className="w-full py-2 mt-4 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
              >
                {t('agents.cancel', 'Cancelar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleMapsAgentsPage;
