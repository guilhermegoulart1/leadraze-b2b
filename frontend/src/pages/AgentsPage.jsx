import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Bot, Mail, MessageCircle, Linkedin, Edit2, Trash2, Filter, BookOpen, Zap, Users, Loader, Shield } from 'lucide-react';
import api from '../services/api';
import { HireSalesRepWizard, AgentEditModal, RulesEditor } from '../components/hire';
import KnowledgeBaseModal from '../components/KnowledgeBaseModal';
import AIAgentTestModal from '../components/AIAgentTestModal';
import AgentAssignmentsModal from '../components/AgentAssignmentsModal';
import { useOnboarding } from '../contexts/OnboardingContext';

const AgentsPage = () => {
  const { t } = useTranslation(['agents', 'common']);
  const { completeStep } = useOnboarding();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [knowledgeBaseAgent, setKnowledgeBaseAgent] = useState(null);
  const [testingAgent, setTestingAgent] = useState(null);
  const [assignmentsAgent, setAssignmentsAgent] = useState(null);
  const [rulesAgent, setRulesAgent] = useState(null);
  const [isSavingRules, setIsSavingRules] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    loadAgents();
  }, []);

  // Completar step do onboarding quando houver agente configurado
  useEffect(() => {
    if (agents.length > 0) {
      completeStep('configure_agent');
    }
  }, [agents, completeStep]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const response = await api.getAgents();
      if (response.success) {
        setAgents(response.data.agents || []);
      }
    } catch (error) {
      console.error(t('errors.loadFailed'), error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgent = async (formData) => {
    try {
      let response;
      if (selectedAgent) {
        // Editing existing agent
        response = await api.updateAgent(selectedAgent.id, formData);
      } else {
        // Creating new agent
        response = await api.createAgent(formData);
      }

      if (response.success) {
        await loadAgents();
        setShowWizard(false);
        setSelectedAgent(null);
      }
    } catch (error) {
      const errorKey = selectedAgent ? 'errors.updateFailed' : 'errors.createFailed';
      console.error(t(errorKey), error);
      throw error;
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (!confirm(t('confirmDelete'))) {
      return;
    }

    try {
      const response = await api.deleteAgent(agentId);
      if (response.success) {
        await loadAgents();
      }
    } catch (error) {
      console.error(t('errors.deleteFailed'), error);
      alert(error.message || t('errors.deleteFailed'));
    }
  };

  const handleTestAgent = (agent) => {
    setTestingAgent(agent);
  };

  const handleSaveRules = async (rules) => {
    if (!rulesAgent) return;

    setIsSavingRules(true);
    try {
      await api.updateAgent(rulesAgent.id, {
        priority_rules: rules
      });
      setRulesAgent(null);
      loadAgents();
    } catch (error) {
      console.error('Error saving rules:', error);
      alert(error.message || t('errors.savingRulesFailed'));
    } finally {
      setIsSavingRules(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'linkedin': return Linkedin;
      case 'email': return Mail;
      case 'whatsapp': return MessageCircle;
      default: return Bot;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'linkedin': return 'blue';
      case 'email': return 'purple';
      case 'whatsapp': return 'green';
      default: return 'gray';
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'linkedin': return 'LinkedIn';
      case 'email': return 'Email';
      case 'whatsapp': return 'WhatsApp';
      default: return type;
    }
  };

  // Filter agents by type
  const filteredAgents = filterType === 'all'
    ? agents
    : agents.filter(agent => agent.agent_type === filterType);

  // Paginate filtered agents
  const paginatedAgents = filteredAgents.slice(
    (pagination.page - 1) * pagination.limit,
    pagination.page * pagination.limit
  );

  // Update pagination totals when filter changes
  useEffect(() => {
    setPagination(prev => ({
      ...prev,
      total: filteredAgents.length,
      totalPages: Math.ceil(filteredAgents.length / prev.limit),
      page: 1,
    }));
  }, [filterType, filteredAgents.length]);

  // Calculate stats
  const stats = {
    total: agents.length,
    linkedin: agents.filter(a => a.agent_type === 'linkedin').length,
    email: agents.filter(a => a.agent_type === 'email').length,
    whatsapp: agents.filter(a => a.agent_type === 'whatsapp').length,
    active: agents.filter(a => a.is_active).length
  };

  return (
    <div className="p-6">
      {/* Filters + New Agent Button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('filterBy')}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Filter className="w-4 h-4" />
              {t('filters.all')} ({stats.total})
            </button>

            {[
              { type: 'linkedin', label: t('filters.linkedin'), icon: Linkedin, count: stats.linkedin, comingSoon: false },
              { type: 'email', label: t('filters.email'), icon: Mail, count: stats.email, comingSoon: true },
              { type: 'whatsapp', label: t('filters.whatsapp'), icon: MessageCircle, count: stats.whatsapp, comingSoon: false }
            ].map(({ type, label, icon: Icon, count, comingSoon }) => (
              <button
                key={type}
                onClick={() => !comingSoon && setFilterType(type)}
                disabled={comingSoon}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  comingSoon
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 cursor-not-allowed'
                    : filterType === type
                      ? 'bg-purple-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {comingSoon ? (
                  <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                    Em breve
                  </span>
                ) : (
                  ` (${count})`
                )}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          {t('newAgent')}
        </button>
      </div>

      {/* Agents Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader className="w-12 h-12 text-purple-600 dark:text-purple-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">{t('loading')}</p>
            </div>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {filterType === 'all' ? t('empty.title') : t('empty.titleFiltered', { type: getTypeLabel(filterType) })}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {filterType === 'all'
                ? t('empty.subtitle')
                : t('empty.subtitleFiltered', { type: getTypeLabel(filterType) })
              }
            </p>
            <button
              onClick={() => setShowWizard(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('createAgent')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('table.agent')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('table.type')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('table.status')}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('table.interactions')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedAgents.map((agent) => {
                  const TypeIcon = getTypeIcon(agent.agent_type);
                  const color = getTypeColor(agent.agent_type);

                  return (
                    <tr key={agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {agent.avatar_url ? (
                            <img
                              src={agent.avatar_url}
                              alt={agent.name}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                              <Bot className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">{agent.name}</div>
                            {agent.description && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 max-w-xs">
                                {agent.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-${color}-100 dark:bg-${color}-900/20 text-${color}-700 dark:text-${color}-400`}>
                          <TypeIcon className="w-3 h-3" />
                          {getTypeLabel(agent.agent_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          agent.is_active
                            ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          {agent.is_active ? t('status.active') : t('status.inactive')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{agent.total_interactions || 0}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setAssignmentsAgent(agent)}
                            className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                            title="Atribuições"
                          >
                            <Users className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setKnowledgeBaseAgent(agent)}
                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title={t('actions.knowledgeBase')}
                          >
                            <BookOpen className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setRulesAgent(agent)}
                            className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                            title={t('actions.rules')}
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleTestAgent(agent)}
                            className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                            title={t('actions.testAgent')}
                          >
                            <Zap className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedAgent(agent);
                              setShowWizard(true);
                            }}
                            className="p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                            title={t('actions.editAgent')}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAgent(agent.id)}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title={t('actions.deleteAgent')}
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

            {/* Paginação */}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Mostrando {paginatedAgents.length} de {pagination.total} agentes
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    ← Anterior
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Página {pagination.page} de {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Próxima →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hire Wizard (for new agents) */}
      <HireSalesRepWizard
        isOpen={showWizard && !selectedAgent}
        onClose={() => {
          setShowWizard(false);
          setSelectedAgent(null);
        }}
        onAgentCreated={() => {
          loadAgents();
          setShowWizard(false);
        }}
      />

      {/* Edit Modal (for existing agents) - Usando novo modal com sidebar */}
      <AgentEditModal
        isOpen={selectedAgent && showWizard}
        onClose={() => {
          setShowWizard(false);
          setSelectedAgent(null);
        }}
        agent={selectedAgent}
        onSaved={() => {
          loadAgents();
          setShowWizard(false);
          setSelectedAgent(null);
        }}
      />

      {/* Test Modal */}
      <AIAgentTestModal
        isOpen={!!testingAgent}
        onClose={() => setTestingAgent(null)}
        agent={testingAgent}
      />

      {/* Knowledge Base Modal */}
      <KnowledgeBaseModal
        isOpen={!!knowledgeBaseAgent}
        onClose={() => setKnowledgeBaseAgent(null)}
        agent={knowledgeBaseAgent}
      />

      {/* Assignments Modal */}
      <AgentAssignmentsModal
        isOpen={!!assignmentsAgent}
        onClose={() => setAssignmentsAgent(null)}
        agent={assignmentsAgent}
      />

      {/* Rules Editor Modal */}
      <RulesEditor
        isOpen={!!rulesAgent}
        onClose={() => setRulesAgent(null)}
        rules={rulesAgent?.priority_rules || []}
        onSave={handleSaveRules}
        agentName={rulesAgent?.name || 'Vendedor'}
        isLoading={isSavingRules}
      />
    </div>
  );
};

export default AgentsPage;
