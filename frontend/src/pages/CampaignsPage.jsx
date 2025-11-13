import React, { useState, useEffect } from 'react';
import { Plus, Play, Pause, Trash2, BarChart3 } from 'lucide-react';
import api from '../services/api';

const CampaignsPage = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const response = await api.getCampaigns();
      if (response.success) {
        setCampaigns(response.data.campaigns);
      }
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartCampaign = async (id) => {
    try {
      await api.startCampaign(id);
      loadCampaigns();
    } catch (error) {
      alert('Erro ao iniciar campanha');
    }
  };

  const handlePauseCampaign = async (id) => {
    try {
      await api.pauseCampaign(id);
      loadCampaigns();
    } catch (error) {
      alert('Erro ao pausar campanha');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando campanhas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Campanhas</h2>
          <p className="text-gray-500 mt-1">Gerencie suas campanhas de prospecção</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-lg hover:opacity-90 font-semibold"
        >
          <Plus className="w-5 h-5" />
          <span>Nova Campanha</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Total de Campanhas</p>
          <p className="text-3xl font-bold text-gray-900">{campaigns.length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Campanhas Ativas</p>
          <p className="text-3xl font-bold text-green-600">
            {campaigns.filter(c => c.status === 'active').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Leads Totais</p>
          <p className="text-3xl font-bold text-purple-600">
            {campaigns.reduce((sum, c) => sum + (c.total_leads || 0), 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Leads Qualificados</p>
          <p className="text-3xl font-bold text-blue-600">
            {campaigns.reduce((sum, c) => sum + (c.leads_qualified || 0), 0)}
          </p>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Campanha
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Leads
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Aceitos
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Qualificados
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Taxa Conversão
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {campaigns.map((campaign) => {
                const conversionRate = campaign.leads_sent > 0
                  ? ((campaign.leads_accepted / campaign.leads_sent) * 100).toFixed(1)
                  : 0;

                return (
                  <tr key={campaign.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">{campaign.name}</p>
                        <p className="text-xs text-gray-500">{campaign.linkedin_username}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        campaign.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : campaign.status === 'paused'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {campaign.status === 'active' ? 'Ativa' : 
                         campaign.status === 'paused' ? 'Pausada' : 'Rascunho'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-900">
                        {campaign.total_leads || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-green-600">
                        {campaign.leads_accepted || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-purple-600">
                        {campaign.leads_qualified || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-blue-600">
                        {conversionRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Ver estatísticas"
                        >
                          <BarChart3 className="w-5 h-5" />
                        </button>
                        
                        {campaign.automation_active ? (
                          <button 
                            onClick={() => handlePauseCampaign(campaign.id)}
                            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                            title="Pausar campanha"
                          >
                            <Pause className="w-5 h-5" />
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleStartCampaign(campaign.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Iniciar campanha"
                          >
                            <Play className="w-5 h-5" />
                          </button>
                        )}

                        <button 
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir campanha"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {campaigns.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Nenhuma campanha criada ainda</p>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-purple-600 hover:text-purple-700 font-semibold"
            >
              Criar primeira campanha
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

export default CampaignsPage;