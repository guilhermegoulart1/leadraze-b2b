import React, { useState, useEffect } from 'react';
import { Plus, Bot, Mail, MessageCircle, Linkedin, Edit2, Trash2, Filter, BookOpen, Zap } from 'lucide-react';
import api from '../services/api';
import UnifiedAgentWizard from '../components/UnifiedAgentWizard';
import KnowledgeBaseModal from '../components/KnowledgeBaseModal';
import AIAgentTestModal from '../components/AIAgentTestModal';

const AgentsPage = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [knowledgeBaseAgent, setKnowledgeBaseAgent] = useState(null);
  const [testingAgent, setTestingAgent] = useState(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const response = await api.getAgents();
      if (response.success) {
        setAgents(response.data.agents || []);
      }
    } catch (error) {
      console.error('Erro ao carregar agentes:', error);
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
      console.error(`Erro ao ${selectedAgent ? 'atualizar' : 'criar'} agente:`, error);
      throw error;
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (!confirm('Tem certeza que deseja excluir este agente?')) {
      return;
    }

    try {
      const response = await api.deleteAgent(agentId);
      if (response.success) {
        await loadAgents();
      }
    } catch (error) {
      console.error('Erro ao deletar agente:', error);
      alert(error.message || 'Erro ao deletar agente');
    }
  };

  const handleTestAgent = (agent) => {
    setTestingAgent(agent);
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

  // Calculate stats
  const stats = {
    total: agents.length,
    linkedin: agents.filter(a => a.agent_type === 'linkedin').length,
    email: agents.filter(a => a.agent_type === 'email').length,
    whatsapp: agents.filter(a => a.agent_type === 'whatsapp').length,
    active: agents.filter(a => a.is_active).length
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agentes de IA</h1>
            <p className="text-gray-600 mt-1">
              Gerencie todos os seus agentes inteligentes em um único lugar
            </p>
          </div>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Agente
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterType('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              filterType === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Todos ({stats.total})
          </button>

          {[
            { type: 'linkedin', label: 'LinkedIn', icon: Linkedin, count: stats.linkedin },
            { type: 'email', label: 'Email', icon: Mail, count: stats.email },
            { type: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, count: stats.whatsapp }
          ].map(({ type, label, icon: Icon, count }) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                filterType === type
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Agents Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando agentes...</p>
          </div>
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {filterType === 'all' ? 'Nenhum agente criado' : `Nenhum agente ${getTypeLabel(filterType)}`}
          </h3>
          <p className="text-gray-600 mb-6">
            {filterType === 'all'
              ? 'Crie seu primeiro agente de IA para começar a automatizar seus processos'
              : `Crie um agente ${getTypeLabel(filterType)} para começar`
            }
          </p>
          <button
            onClick={() => setShowWizard(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            Criar Agente
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Interações
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAgents.map((agent) => {
                const TypeIcon = getTypeIcon(agent.agent_type);
                const color = getTypeColor(agent.agent_type);

                return (
                  <tr key={agent.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {agent.avatar_url ? (
                          <img
                            src={agent.avatar_url}
                            alt={agent.name}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{agent.name}</div>
                          {agent.description && (
                            <div className="text-sm text-gray-500 line-clamp-1 max-w-xs">
                              {agent.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-${color}-100 text-${color}-700`}>
                        <TypeIcon className="w-3 h-3" />
                        {getTypeLabel(agent.agent_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        agent.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {agent.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{agent.total_interactions || 0}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setKnowledgeBaseAgent(agent)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Base de Conhecimento"
                        >
                          <BookOpen className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleTestAgent(agent)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Testar Agente"
                        >
                          <Zap className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAgent(agent);
                            setShowWizard(true);
                          }}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Editar Agente"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAgent(agent.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir Agente"
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
      )}

      {/* Wizard */}
      <UnifiedAgentWizard
        isOpen={showWizard}
        onClose={() => {
          setShowWizard(false);
          setSelectedAgent(null);
        }}
        onSubmit={handleCreateAgent}
        agent={selectedAgent}
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
    </div>
  );
};

export default AgentsPage;
