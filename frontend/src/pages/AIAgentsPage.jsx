// frontend/src/pages/AIAgentsPage.jsx
import React, { useState, useEffect } from 'react';
import { Plus, Bot, Edit, Trash2, Sparkles, Target, Zap, BookOpen, Smile, Calendar, MessageSquare, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import AIAgentModal from '../components/AIAgentModal';
import AIAgentTestModal from '../components/AIAgentTestModal';
import KnowledgeBaseModal from '../components/KnowledgeBaseModal';

const AIAgentsPage = () => {
  const { t } = useTranslation(['aiagents', 'common']);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const response = await api.getAIAgents();
      setAgents(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar agentes:', error);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAgentCreated = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    loadAgents();
  };

  const handleDeleteAgent = async (id) => {
    if (window.confirm(t('messages.confirmDelete'))) {
      try {
        await api.deleteAIAgent(id);
        loadAgents();
      } catch (error) {
        alert(error.message || t('messages.errorDeleting'));
      }
    }
  };

  const handleEditAgent = (agent) => {
    setSelectedAgent(agent);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedAgent(null);
  };

  const handleTestAgent = (agent) => {
    setSelectedAgent(agent);
    setShowTestModal(true);
  };

  const handleCloseTestModal = () => {
    setShowTestModal(false);
    setSelectedAgent(null);
  };

  const handleManageKnowledge = (agent) => {
    setSelectedAgent(agent);
    setShowKnowledgeModal(true);
  };

  const handleCloseKnowledgeModal = () => {
    setShowKnowledgeModal(false);
    setSelectedAgent(null);
  };

  const profileIcons = {
    consultivo: { Icon: Target, color: 'text-blue-600', bg: 'bg-blue-100', emoji: '🎯' },
    direto: { Icon: Zap, color: 'text-orange-600', bg: 'bg-orange-100', emoji: '⚡' },
    educativo: { Icon: BookOpen, color: 'text-purple-600', bg: 'bg-purple-100', emoji: '📚' },
    amigavel: { Icon: Smile, color: 'text-green-600', bg: 'bg-green-100', emoji: '😊' }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {t('subtitle')}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            {t('newAgent')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {agents.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t('messages.noAgents')}</h3>
              <p className="text-gray-600 mb-4">
                {t('messages.noAgentsDescription')}
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-5 h-5" />
                {t('messages.createFirst')}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => {
              const profileConfig = profileIcons[agent.behavioral_profile] || profileIcons.consultivo;
              const Icon = profileConfig.Icon;

              return (
                <div
                  key={agent.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 ${profileConfig.bg} rounded-xl flex items-center justify-center`}>
                          <Icon className={`w-6 h-6 ${profileConfig.color}`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-lg">{profileConfig.emoji}</span>
                            <span className="text-xs text-gray-500 capitalize">
                              {agent.behavioral_profile}
                            </span>
                          </div>
                        </div>
                      </div>
                      {agent.is_active ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          {t('status.active')}
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                          {t('status.inactive')}
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    {agent.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {agent.description}
                      </p>
                    )}

                    {/* Products/Services */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-medium text-gray-500 mb-1">{t('features.productsServices')}</p>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {agent.products_services}
                      </p>
                    </div>

                    {/* Features */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {agent.auto_schedule && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-full text-xs">
                          <Calendar className="w-3 h-3" />
                          {t('features.autoSchedule')}
                        </span>
                      )}
                      {agent.intent_detection_enabled && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
                          <Sparkles className="w-3 h-3" />
                          {t('features.intentDetection')}
                        </span>
                      )}
                    </div>

                    {/* LinkedIn Variables */}
                    {agent.linkedin_variables?.used?.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-gray-500 mb-2">{t('features.variablesUsed')}</p>
                        <div className="flex flex-wrap gap-1">
                          {agent.linkedin_variables.used.slice(0, 3).map((variable) => (
                            <span
                              key={variable}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-mono"
                            >
                              {variable}
                            </span>
                          ))}
                          {agent.linkedin_variables.used.length > 3 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs">
                              +{agent.linkedin_variables.used.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col gap-2 pt-4 border-t">
                      <button
                        onClick={() => handleTestAgent(agent)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                        {t('actions.testAgent')}
                      </button>
                      <button
                        onClick={() => handleManageKnowledge(agent)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200"
                      >
                        <Database className="w-4 h-4" />
                        {t('actions.knowledgeBase')}
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditAgent(agent)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                          {t('actions.edit')}
                        </button>
                        <button
                          onClick={() => handleDeleteAgent(agent.id)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t('actions.delete')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Agent Modal */}
      <AIAgentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onAgentCreated={handleAgentCreated}
      />

      {/* Edit Agent Modal */}
      {selectedAgent && (
        <AIAgentModal
          isOpen={showEditModal}
          onClose={handleCloseEditModal}
          onAgentCreated={handleAgentCreated}
          agent={selectedAgent}
        />
      )}

      {/* Test Agent Modal */}
      {selectedAgent && (
        <AIAgentTestModal
          isOpen={showTestModal}
          onClose={handleCloseTestModal}
          agent={selectedAgent}
        />
      )}

      {/* Knowledge Base Modal */}
      {selectedAgent && (
        <KnowledgeBaseModal
          isOpen={showKnowledgeModal}
          onClose={handleCloseKnowledgeModal}
          agent={selectedAgent}
        />
      )}
    </div>
  );
};

export default AIAgentsPage;
