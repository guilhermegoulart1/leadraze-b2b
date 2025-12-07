import React, { useState, useEffect } from 'react';
import {
  Mail, Search, RefreshCw, Download, Users, PlayCircle,
  CheckCircle, TrendingUp, Clock, AlertTriangle, UserPlus
} from 'lucide-react';
import api from '../services/api';

const WebsiteLeadsPage = () => {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0 });

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [search, setSearch] = useState('');

  const TRIAL_DAYS = 7;

  useEffect(() => {
    fetchData();
  }, [statusFilter, sourceFilter, pagination.offset]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchLeads(), fetchStats()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    try {
      const params = {
        limit: pagination.limit,
        offset: pagination.offset
      };
      if (statusFilter) params.status = statusFilter;
      if (sourceFilter) params.source = sourceFilter;
      if (search) params.search = search;

      const response = await api.getWebsiteLeads(params);
      if (response.success) {
        setLeads(response.data);
        if (response.pagination) {
          setPagination(prev => ({ ...prev, total: response.pagination.total }));
        }
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.getWebsiteLeadStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, offset: 0 }));
    fetchLeads();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (sourceFilter) params.source = sourceFilter;

      // Abrir em nova aba para download do CSV
      const query = new URLSearchParams(params).toString();
      window.open(`${import.meta.env.VITE_API_URL || ''}/api/website-agents/leads/export${query ? '?' + query : ''}`, '_blank');
    } catch (error) {
      console.error('Error exporting leads:', error);
    } finally {
      setExporting(false);
    }
  };

  const isTrialExpired = (lead) => {
    if (lead.status !== 'trial_started' || !lead.trial_started_at) return false;
    const trialEnd = new Date(lead.trial_started_at);
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
    return new Date() > trialEnd;
  };

  const getTrialDaysRemaining = (lead) => {
    if (lead.status !== 'trial_started' || !lead.trial_started_at) return null;
    const trialEnd = new Date(lead.trial_started_at);
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
    const now = new Date();
    const diff = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getStatusBadge = (status) => {
    const styles = {
      captured: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
      trial_started: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
      subscribed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
      churned: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
    };
    const labels = {
      captured: 'Captured',
      trial_started: 'Trial',
      subscribed: 'Subscribed',
      churned: 'Churned'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  const overview = stats?.overview || {};

  return (
    <div className="p-6 space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-6 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Leads</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overview.total_leads || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Captured</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overview.captured || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <PlayCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Trial Started</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overview.trial_started || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Subscribed</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overview.subscribed || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Churned</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overview.churned || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Conversion</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {overview.conversion_rates?.overall_conversion || 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Website Leads</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold text-sm"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por email..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </form>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPagination(prev => ({ ...prev, offset: 0 }));
            }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">Todos os Status</option>
            <option value="captured">Captured</option>
            <option value="trial_started">Trial Started</option>
            <option value="subscribed">Subscribed</option>
            <option value="churned">Churned</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPagination(prev => ({ ...prev, offset: 0 }));
            }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">Todas as Fontes</option>
            <option value="hero">Hero</option>
            <option value="pricing">Pricing</option>
            <option value="footer">Footer</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Email</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Status</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Trial</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Source</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Cadastro</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Trial Started</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Subscribed</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">UTM Source</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Affiliate</th>
              </tr>
            </thead>
            <tbody>
              {loading && leads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-purple-600" />
                    <p>Carregando...</p>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum lead encontrado</p>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const trialExpired = isTrialExpired(lead);
                  const daysRemaining = getTrialDaysRemaining(lead);

                  return (
                    <tr key={lead.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{lead.email}</span>
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(lead.status)}
                      </td>
                      <td className="py-3 px-4">
                        {lead.status === 'trial_started' && (
                          trialExpired ? (
                            <span className="flex items-center gap-1 text-xs text-red-600">
                              <AlertTriangle className="w-3 h-3" />
                              Expirado
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <Clock className="w-3 h-3" />
                              {daysRemaining}d restantes
                            </span>
                          )
                        )}
                        {lead.status === 'subscribed' && (
                          <span className="text-xs text-green-600">Converteu</span>
                        )}
                        {lead.status === 'captured' && (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                        {lead.status === 'churned' && (
                          <span className="text-xs text-red-600">Cancelou</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{lead.source || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{formatDate(lead.created_at)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{formatDate(lead.trial_started_at)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{formatDate(lead.subscribed_at)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{lead.utm_source || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{lead.affiliate_code || '-'}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Mostrando {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} de {pagination.total} leads
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebsiteLeadsPage;
