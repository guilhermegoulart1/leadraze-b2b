// frontend/src/pages/GoogleMapsAgentsPage.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Plus, Loader2, AlertCircle } from 'lucide-react';
import apiService from '../services/api';
import GoogleMapsAgentCard from '../components/GoogleMapsAgentCard';
import GoogleMapsAgentForm from '../components/GoogleMapsAgentForm';

const GoogleMapsAgentsPage = () => {
  const { t } = useTranslation(['googlemaps', 'common']);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [executingAgents, setExecutingAgents] = useState(new Set()); // Track agents that are executing

  // Load agents on mount
  useEffect(() => {
    loadAgents();
  }, []);

  // Polling effect - reload agents while some are executing
  useEffect(() => {
    if (executingAgents.size === 0) return;

    const interval = setInterval(() => {
      console.log('🔄 Polling agents status...');
      loadAgents();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [executingAgents]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getGoogleMapsAgents();

      if (response.success) {
        const loadedAgents = response.agents || [];

        // Check if any executing agents have finished
        setExecutingAgents(prev => {
          const newExecuting = new Set(prev);
          prev.forEach(agentId => {
            const agent = loadedAgents.find(a => a.id === agentId);
            // If agent status is not active, it finished executing
            if (agent && agent.status !== 'active') {
              newExecuting.delete(agentId);
            }
          });
          return newExecuting;
        });

        // Merge with executing status
        const agentsWithStatus = loadedAgents.map(agent => ({
          ...agent,
          // Override status to 'collecting' if in executingAgents
          status: executingAgents.has(agent.id) ? 'collecting' : agent.status
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

        // Add new agent to executing list (it starts executing automatically)
        if (newAgentId) {
          setExecutingAgents(prev => new Set([...prev, newAgentId]));
        }

        // Immediately reload to show the new agent
        await loadAgents();

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
      loadAgents();
    } catch (error) {
      console.error('❌ Erro ao pausar campanha:', error);
      alert(t('agents.errorPause'));
    }
  };

  const handleResumeAgent = async (agentId) => {
    try {
      await apiService.resumeGoogleMapsAgent(agentId);
      loadAgents();
    } catch (error) {
      console.error('❌ Erro ao retomar campanha:', error);
      alert(t('agents.errorResume'));
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (!confirm(t('agents.confirmDelete'))) {
      return;
    }

    try {
      await apiService.deleteGoogleMapsAgent(agentId);
      loadAgents();
    } catch (error) {
      console.error('❌ Erro ao deletar campanha:', error);
      alert(t('agents.errorDelete'));
    }
  };

  const handleExecuteAgent = async (agentId) => {
    try {
      // Add to executing list immediately
      setExecutingAgents(prev => new Set([...prev, agentId]));

      // Trigger execution
      await apiService.executeGoogleMapsAgent(agentId);

      // Reload to get latest status
      loadAgents();
    } catch (error) {
      console.error('❌ Erro ao executar campanha:', error);
      alert(t('agents.errorExecute'));

      // Remove from executing list if failed
      setExecutingAgents(prev => {
        const newSet = new Set(prev);
        newSet.delete(agentId);
        return newSet;
      });
    }
  };

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
              onClick={() => setShowCreateForm(true)}
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

        {/* Agents grid */}
        {!loading && agents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map(agent => (
              <GoogleMapsAgentCard
                key={agent.id}
                agent={agent}
                onPause={handlePauseAgent}
                onResume={handleResumeAgent}
                onDelete={handleDeleteAgent}
                onExecute={handleExecuteAgent}
              />
            ))}
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
                onClick={() => setShowCreateForm(true)}
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
    </div>
  );
};

export default GoogleMapsAgentsPage;
