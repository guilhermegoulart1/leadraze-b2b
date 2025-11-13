import React, { useState, useEffect } from 'react';
import { Search, Filter, Download } from 'lucide-react';
import api from '../services/api';

const LeadsPage = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const statusConfig = {
    leads: { label: 'Leads', color: 'gray', bgColor: 'bg-gray-100', textColor: 'text-gray-700' },
    invite_sent: { label: 'Convite Enviado', color: 'blue', bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
    accepted: { label: 'Aceito', color: 'green', bgColor: 'bg-green-100', textColor: 'text-green-700' },
    qualifying: { label: 'Qualificando', color: 'yellow', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' },
    qualified: { label: 'Qualificado', color: 'purple', bgColor: 'bg-purple-100', textColor: 'text-purple-700' },
    discarded: { label: 'Descartado', color: 'red', bgColor: 'bg-red-100', textColor: 'text-red-700' },
  };

  useEffect(() => {
    loadLeads();
  }, [statusFilter]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const response = await api.getLeads(params);
      
      if (response.success) {
        setLeads(response.data.leads);
      }
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter(lead => 
    lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (lead.company && lead.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusCount = (status) => {
    return leads.filter(lead => lead.status === status).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pipeline de Leads</h2>
          <p className="text-gray-500 mt-1">Gerencie seus leads e acompanhe o progresso</p>
        </div>
        <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold text-gray-700">
          <Download className="w-5 h-5" />
          <span>Exportar</span>
        </button>
      </div>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {Object.entries(statusConfig).map(([status, config]) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status === statusFilter ? 'all' : status)}
            className={`
              bg-white rounded-xl p-4 border-2 transition-all
              ${statusFilter === status 
                ? `border-${config.color}-500 shadow-lg` 
                : 'border-gray-200 hover:border-gray-300'
              }
            `}
          >
            <p className="text-sm text-gray-500 mb-1">{config.label}</p>
            <p className="text-2xl font-bold text-gray-900">{getStatusCount(status)}</p>
          </button>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou empresa..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Filter className="w-5 h-5" />
            <span className="font-medium">Filtros</span>
          </button>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Lead
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Empresa
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Campanha
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Data
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLeads.map((lead) => {
                const config = statusConfig[lead.status] || statusConfig.leads;
                
                return (
                  <tr key={lead.id} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center text-white font-bold">
                          {lead.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{lead.name}</p>
                          <p className="text-xs text-gray-500">{lead.title || 'Sem cargo'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-900">{lead.company || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.bgColor} ${config.textColor}`}>
                        {config.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className={`bg-${config.color}-600 h-2 rounded-full`}
                            style={{ width: `${(lead.score || 0) * 10}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-700">{lead.score || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{lead.campaign_name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredLeads.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Nenhum lead encontrado</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default LeadsPage;