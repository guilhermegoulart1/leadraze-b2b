import React, { useState, useEffect } from 'react';
import { Plus, Bot, Edit, Trash2, Copy, TestTube, BarChart3 } from 'lucide-react';
import api from '../services/api';

const AIAgentsPage = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const response = await api.getAIAgents();
      if (response.success) {
        setAgents(response.data.agents);
      }
    } catch (error) {
      console.error('Erro ao carregar agentes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloneAgent = async (id, name) => {
    try {
      const newName = prompt('Nome do novo agente:', `${name} (Cópia)`);
      if (newName) {
        await api.cloneAIAgent(id, newName);
        loadAgents();
      }
    } catch (error) {
      alert('Erro ao clonar agente');
    }
  };

  const handleDeleteAgent = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este agente?')) {
      try {
        await api.deleteAIAgent(id);
        loadAgents();
      } catch (error) {
        alert('Erro ao excluir agente');
      }
    }
  };

  const toneColors = {
    professional: { bg: 'bg-blue-100', text: 'text-blue-700', icon: '💼' },
    friendly: { bg: 'bg-green-100', text: 'text-green-700', icon: '😊' },
    casual: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '👋' },
    formal: { bg: 'bg-purple-100', text: 'text-purple-700', icon: '🎩' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando agentes de IA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Agentes de IA</h2>
          <p className="text-gray-500 mt-1">Configure agentes inteligentes para suas conversas</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-lg hover:opacity-90 font-semibold"
        >
          <Plus className="w-5 h-5" />
          <span>Novo Agente</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Total de Agentes</p>
          <p className="text-3xl font-bold text-gray-900">{agents.length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Agentes Ativos</p>
          <p className="text-3xl font-bold text-green-600">
            {agents.filter(a => a.is_active).length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Em Uso</p>
          <p className="text-3xl font-bold text-purple-600">
            {agents.filter(a => a.campaigns_count > 0).length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Total de Conversas</p>
          <p className="text-3xl font-bold text-blue-600">
            {agents.reduce((sum, a) => sum + (a.usage_count || 0), 0)}
          </p>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent) => {
          const toneConfig = toneColors[agent.personality_tone] || toneColors.professional;
          
          return (
            <div key={agent.id} className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
              
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl flex items-center justify-center">
                    <Bot className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{agent.name}</h3>
                    <p className="text-xs text-gray-500">{agent.ai_model}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  {agent.is_active ? (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                      Ativo
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                      Inativo
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                {agent.description || 'Sem descrição'}
              </p>

              {/* Personality Badge */}
              <div className="mb-4">
                <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold ${toneConfig.bg} ${toneConfig.text}`}>
                  <span>{toneConfig.icon}</span>
                  <span className="capitalize">{agent.personality_tone}</span>
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-200">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Campanhas</p>
                  <p className="text-lg font-bold text-gray-900">{agent.campaigns_count || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Conversas</p>
                  <p className="text-lg font-bold text-purple-600">{agent.usage_count || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Temp.</p>
                  <p className="text-lg font-bold text-blue-600">{agent.temperature}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between space-x-2">
                <div className="flex items-center space-x-2">
                  <button 
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleCloneAgent(agent.id, agent.name)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Clonar"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button 
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Testar"
                  >
                    <TestTube className="w-4 h-4" />
                  </button>
                  <button 
                    className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title="Estatísticas"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </button>
                </div>
                <button 
                  onClick={() => handleDeleteAgent(agent.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {agents.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Nenhum agente de IA criado ainda</p>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="text-purple-600 hover:text-purple-700 font-semibold"
          >
            Criar primeiro agente
          </button>
        </div>
      )}

    </div>
  );
};

export default AIAgentsPage;