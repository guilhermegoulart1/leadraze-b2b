import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Bot, Mail, MessageCircle, Linkedin, Edit2, Trash2, PlayCircle } from 'lucide-react';
import api from '../services/api';
import ActivationAgentWizard from '../components/ActivationAgentWizard';

const ActivationAgentsPage = () => {
  const { t } = useTranslation(['activationagents', 'common']);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const response = await api.getActivationAgents();
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
      const response = await api.createActivationAgent(formData);
      if (response.success) {
        await loadAgents();
        setShowWizard(false);
      }
    } catch (error) {
      console.error(t('errors.createFailed'), error);
      throw error;
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (!confirm(t('confirmDelete'))) {
      return;
    }

    try {
      const response = await api.deleteActivationAgent(agentId);
      if (response.success) {
        await loadAgents();
      }
    } catch (error) {
      console.error(t('errors.deleteFailed'), error);
      alert(error.message || t('errors.deleteFailed'));
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'whatsapp': return <MessageCircle className="w-4 h-4" />;
      case 'linkedin': return <Linkedin className="w-4 h-4" />;
      default: return <Bot className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'email': return 'bg-blue-100 text-blue-700';
      case 'whatsapp': return 'bg-green-100 text-green-700';
      case 'linkedin': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'email': return 'Email';
      case 'whatsapp': return 'WhatsApp';
      case 'linkedin': return 'LinkedIn';
      default: return type;
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-gray-600 mt-1">
              {t('subtitle')}
            </p>
          </div>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('newAgent')}
          </button>
        </div>
      </div>

      {/* Agents List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">{t('loading')}</p>
          </div>
        </div>
      ) : agents.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('empty.title')}
          </h3>
          <p className="text-gray-600 mb-6">
            {t('empty.subtitle')}
          </p>
          <button
            onClick={() => setShowWizard(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            {t('empty.button')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${getTypeColor(agent.activation_type)}`}>
                    {getTypeIcon(agent.activation_type)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                    <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${getTypeColor(agent.activation_type)}`}>
                      {getTypeLabel(agent.activation_type)}
                    </span>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  agent.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {agent.is_active ? t('status.active') : t('status.inactive')}
                </div>
              </div>

              {agent.description && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {agent.description}
                </p>
              )}

              <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                <span className="font-medium">{t('card.tone')}:</span>
                <span className="capitalize">{agent.tone || 'Professional'}</span>
              </div>

              {agent.campaigns_count !== undefined && (
                <div className="text-sm text-gray-600 mb-4">
                  <span className="font-medium">{agent.campaigns_count || 0}</span> {t('card.campaigns')}
                  {agent.active_campaigns_count > 0 && (
                    <span className="text-green-600 ml-2">
                      ({agent.active_campaigns_count} {t('card.active')})
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleDeleteAgent(agent.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('card.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Wizard */}
      <ActivationAgentWizard
        isOpen={showWizard}
        onClose={() => {
          setShowWizard(false);
          setSelectedAgent(null);
        }}
        onSubmit={handleCreateAgent}
        agent={selectedAgent}
      />
    </div>
  );
};

export default ActivationAgentsPage;
