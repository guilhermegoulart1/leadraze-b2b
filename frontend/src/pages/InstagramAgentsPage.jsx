// frontend/src/pages/InstagramAgentsPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus, Loader2, X, Camera, Search, Download, Trash2,
  Play, Pause, RefreshCw, AlertCircle, CheckCircle, Clock, Eye
} from 'lucide-react';
import apiService from '../services/api';

const InstagramAgentsPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(['instagram', 'common', 'navigation']);

  // Agents state
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    searchNiche: '',
    searchLocation: '',
    profilesPerExecution: 50,
    totalLimit: 500
  });
  const [creating, setCreating] = useState(false);

  // Executing state
  const [executingAgents, setExecutingAgents] = useState(new Set());

  // Profiles (unused - navigates to detail page now)

  // Delete confirmation
  const [deleteModal, setDeleteModal] = useState({ show: false, agent: null, deleting: false });

  // Toast notification
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadAgents();
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const loadAgents = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const result = await apiService.getInstagramAgents();
      if (result.success) {
        setAgents(result.agents || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.name || !createForm.searchNiche || !createForm.searchLocation) return;

    try {
      setCreating(true);
      const result = await apiService.createInstagramAgent(createForm);
      if (result.success) {
        setAgents(prev => [result.agent, ...prev]);
        setShowCreateModal(false);
        setCreateForm({ name: '', searchNiche: '', searchLocation: '', profilesPerExecution: 50, totalLimit: 500 });
        showToast(t('agents.createSuccess'));
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleExecute = async (agentId) => {
    try {
      setExecutingAgents(prev => new Set(prev).add(agentId));
      const result = await apiService.executeInstagramAgent(agentId);
      if (result.success) {
        showToast(`${t('agents.executeSuccess')} ${result.new_profiles} ${t('agents.newProfilesFound')}`);
        // Update agent in list
        setAgents(prev => prev.map(a => {
          if (a.id === agentId) {
            return {
              ...a,
              total_profiles_found: result.total_profiles,
              status: result.status,
              has_more_results: result.has_more_results,
              last_execution_at: new Date().toISOString(),
              execution_count: (a.execution_count || 0) + 1
            };
          }
          return a;
        }));
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setExecutingAgents(prev => {
        const newSet = new Set(prev);
        newSet.delete(agentId);
        return newSet;
      });
    }
  };

  const handlePause = async (agentId) => {
    try {
      const result = await apiService.pauseInstagramAgent(agentId);
      if (result.success) {
        setAgents(prev => prev.map(a => a.id === agentId ? { ...a, status: 'paused' } : a));
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleResume = async (agentId) => {
    try {
      const result = await apiService.resumeInstagramAgent(agentId);
      if (result.success) {
        setAgents(prev => prev.map(a => a.id === agentId ? { ...a, status: 'active' } : a));
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.agent) return;
    try {
      setDeleteModal(prev => ({ ...prev, deleting: true }));
      await apiService.deleteInstagramAgent(deleteModal.agent.id);
      setAgents(prev => prev.filter(a => a.id !== deleteModal.agent.id));
      setDeleteModal({ show: false, agent: null, deleting: false });
      showToast(t('agents.deleteSuccess'));
    } catch (err) {
      showToast(err.message, 'error');
      setDeleteModal(prev => ({ ...prev, deleting: false }));
    }
  };

  const handleViewProfiles = (agent) => {
    navigate(`/instagram-agents/${agent.id}`);
  };


  const handleExportCSV = async (agentId) => {
    try {
      await apiService.exportInstagramAgentCSV(agentId);
      showToast('CSV exportado com sucesso');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      active: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: t('agents.active') },
      paused: { color: 'bg-yellow-100 text-yellow-700', icon: Pause, label: t('agents.paused') },
      completed: { color: 'bg-blue-100 text-blue-700', icon: CheckCircle, label: t('agents.completed') },
      error: { color: 'bg-red-100 text-red-700', icon: AlertCircle, label: t('agents.error') }
    };
    const c = config[status] || config.active;
    const Icon = c.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>
        <Icon className="w-3 h-3" />
        {c.label}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  // ===============================
  // RENDER
  // ===============================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        <span className="ml-2 text-gray-500">{t('agents.loading')}</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Camera className="w-7 h-7 text-purple-500" />
            {t('agents.title')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('agents.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('agents.createAgent')}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Empty State */}
      {agents.length === 0 && !error && (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Camera className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('agents.noAgentsTitle')}</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{t('agents.noAgentsSubtitle')}</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            {t('agents.createFirstAgent')}
          </button>
        </div>
      )}

      {/* Agents Table */}
      {agents.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Campanha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Perfis
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Ultima Execucao
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Acoes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {agents.map(agent => {
                  const isExecuting = executingAgents.has(agent.id);
                  const progress = agent.total_limit > 0
                    ? Math.round((agent.total_profiles_found / agent.total_limit) * 100)
                    : 0;

                  return (
                    <tr key={agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      {/* Campanha */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-lg flex-shrink-0">
                            <Camera className="w-5 h-5 text-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{agent.name}</p>
                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                              <Search className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate max-w-[150px]">{agent.search_niche}</span>
                              <span className="text-gray-400 mx-0.5">·</span>
                              <span className="truncate max-w-[100px]">{agent.search_location}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        {getStatusBadge(agent.status)}
                      </td>
                      {/* Perfis */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{agent.total_profiles_found || 0}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">de {agent.total_limit}</p>
                          </div>
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 max-w-[80px]">
                            <div
                              className={`h-1.5 rounded-full ${agent.status === 'completed' ? 'bg-blue-500' : 'bg-purple-500'}`}
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      {/* Ultima Execucao */}
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(agent.last_execution_at)}
                      </td>
                      {/* Acoes */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* View profiles */}
                          <button
                            onClick={() => handleViewProfiles(agent)}
                            disabled={!agent.total_profiles_found}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={t('agents.viewProfiles')}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {/* Execute */}
                          {agent.status === 'active' && agent.has_more_results !== false && (
                            <button
                              onClick={() => handleExecute(agent.id)}
                              disabled={isExecuting}
                              className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors disabled:opacity-50"
                              title={t('agents.execute')}
                            >
                              {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            </button>
                          )}
                          {/* Pause */}
                          {agent.status === 'active' && !isExecuting && (
                            <button
                              onClick={() => handlePause(agent.id)}
                              className="p-1.5 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                              title={t('agents.pause')}
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          )}
                          {/* Resume */}
                          {agent.status === 'paused' && (
                            <button
                              onClick={() => handleResume(agent.id)}
                              className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                              title={t('agents.resume')}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          {/* Export CSV */}
                          {agent.total_profiles_found > 0 && (
                            <button
                              onClick={() => handleExportCSV(agent.id)}
                              className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                              title={t('agents.exportCSV')}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                          {/* Delete */}
                          <button
                            onClick={() => setDeleteModal({ show: true, agent, deleting: false })}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title={t('agents.delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================= */}
      {/* CREATE MODAL */}
      {/* ============================= */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-purple-500" />
                {t('agents.createAgent')}
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('agents.name')} *
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('agents.namePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Niche */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('agents.niche')} *
                </label>
                <input
                  type="text"
                  value={createForm.searchNiche}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, searchNiche: e.target.value }))}
                  placeholder={t('agents.nichePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('agents.location')} *
                </label>
                <input
                  type="text"
                  value={createForm.searchLocation}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, searchLocation: e.target.value }))}
                  placeholder={t('agents.locationPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Profiles per execution */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('agents.profilesPerExecution')}: <span className="text-purple-600 font-bold">{createForm.profilesPerExecution}</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="10"
                  value={createForm.profilesPerExecution}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, profilesPerExecution: parseInt(e.target.value) }))}
                  className="w-full accent-purple-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>10</span>
                  <span>50</span>
                  <span>100</span>
                </div>
              </div>

              {/* Total limit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('agents.totalLimit')}
                </label>
                <select
                  value={createForm.totalLimit}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, totalLimit: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                  <option value={1000}>1.000</option>
                  <option value={2000}>2.000</option>
                </select>
              </div>

              {/* Info */}
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                A busca usa Google para encontrar perfis do Instagram com o nicho e localidade informados.
                Cada execução consome créditos Instagram (1 crédito = ~10 perfis).
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {t('agents.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creating || !createForm.name || !createForm.searchNiche || !createForm.searchLocation}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {t('agents.createAgent')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ============================= */}
      {deleteModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('agents.delete')}</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-6">{t('agents.confirmDelete')}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModal({ show: false, agent: null, deleting: false })}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {t('agents.cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteModal.deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteModal.deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('agents.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================= */}
      {/* TOAST */}
      {/* ============================= */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm transition-all ${
          toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default InstagramAgentsPage;
