// frontend/src/pages/CampaignReportPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, Clock, CheckCircle, XCircle, Send, UserCheck,
  Pause, Ban, RefreshCw, Loader, Calendar, AlertCircle, Filter,
  ChevronLeft, ChevronRight, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

// Status baseado em campaign_contacts.status (fonte de verdade)
const STATUS_COLORS = {
  collected: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', label: 'Coletado' },
  approved: { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-700 dark:text-blue-300', label: 'Aprovado' },
  rejected: { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-700 dark:text-red-300', label: 'Rejeitado' },
  invite_queued: { bg: 'bg-indigo-100 dark:bg-indigo-900/50', text: 'text-indigo-700 dark:text-indigo-300', label: 'Na Fila' },
  invite_sent: { bg: 'bg-yellow-100 dark:bg-yellow-900/50', text: 'text-yellow-700 dark:text-yellow-300', label: 'Enviado' },
  invite_accepted: { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-700 dark:text-green-300', label: 'Aceito' },
  invite_expired: { bg: 'bg-orange-100 dark:bg-orange-900/50', text: 'text-orange-700 dark:text-orange-300', label: 'Expirado' },
  conversation_started: { bg: 'bg-purple-100 dark:bg-purple-900/50', text: 'text-purple-700 dark:text-purple-300', label: 'Conversando' },
  conversation_ended: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-700 dark:text-slate-300', label: 'Finalizado' },
};

const PIPELINE_STATUS_COLORS = {
  leads: { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-700 dark:text-blue-300', label: 'Lead' },
  invite_queued: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', label: 'Convite na Fila' },
  invite_sent: { bg: 'bg-yellow-100 dark:bg-yellow-900/50', text: 'text-yellow-700 dark:text-yellow-300', label: 'Convite Enviado' },
  invite_expired: { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-700 dark:text-red-300', label: 'Convite Expirado' },
  accepted: { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-700 dark:text-green-300', label: 'Aceito' },
  qualifying: { bg: 'bg-purple-100 dark:bg-purple-900/50', text: 'text-purple-700 dark:text-purple-300', label: 'Qualificando' },
  qualified: { bg: 'bg-indigo-100 dark:bg-indigo-900/50', text: 'text-indigo-700 dark:text-indigo-300', label: 'Qualificado' },
  scheduled: { bg: 'bg-cyan-100 dark:bg-cyan-900/50', text: 'text-cyan-700 dark:text-cyan-300', label: 'Agendado' },
  won: { bg: 'bg-emerald-100 dark:bg-emerald-900/50', text: 'text-emerald-700 dark:text-emerald-300', label: 'Ganho' },
  lost: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-700 dark:text-slate-300', label: 'Perdido' },
  discarded: { bg: 'bg-orange-100 dark:bg-orange-900/50', text: 'text-orange-700 dark:text-orange-300', label: 'Descartado' },
};

const CampaignReportPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['campaigns', 'common']);

  const [campaign, setCampaign] = useState(null);
  const [leads, setLeads] = useState([]);
  const [summary, setSummary] = useState(null);
  const [queueStatus, setQueueStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 100,
    total: 0,
    totalPages: 0,
  });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshCooldown, setRefreshCooldown] = useState(0);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [id, statusFilter, pagination.page]);

  const loadData = async () => {
    try {
      // Load campaign details
      const campaignRes = await api.getCampaign(id);
      if (campaignRes.success) {
        setCampaign(campaignRes.data);
      }

      // Load campaign report (leads with invite status)
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const reportRes = await api.getCampaignReport(id, params);
      if (reportRes.success) {
        setLeads(reportRes.data.leads || []);
        setSummary(reportRes.data.summary || null);
        setPagination(prev => ({
          ...prev,
          total: reportRes.data.pagination?.total || 0,
          totalPages: reportRes.data.pagination?.totalPages || 0,
        }));
      }

      // Load queue status
      const queueRes = await api.getQueueStatus(id);
      if (queueRes.success) {
        setQueueStatus(queueRes.data);
      }
    } catch (error) {
      console.error('Error loading campaign report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    if (!confirm(t('messages.confirmPause', 'Deseja pausar esta campanha?'))) return;
    try {
      setIsActioning(true);
      await api.pauseCampaign(id);
      loadData();
    } catch (error) {
      alert(error.message || 'Erro ao pausar campanha');
    } finally {
      setIsActioning(false);
    }
  };

  const handleResume = async () => {
    try {
      setIsActioning(true);
      await api.resumeCampaign(id);
      loadData();
    } catch (error) {
      alert(error.message || 'Erro ao retomar campanha');
    } finally {
      setIsActioning(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm(t('messages.confirmCancel', 'Deseja CANCELAR esta campanha? Esta ação irá retirar todos os convites pendentes.'))) return;
    try {
      setIsActioning(true);
      await api.cancelCampaign(id);
      navigate('/campaigns');
    } catch (error) {
      alert(error.message || 'Erro ao cancelar campanha');
    } finally {
      setIsActioning(false);
    }
  };

  const handleRefreshInvites = async () => {
    try {
      setIsRefreshing(true);
      const res = await api.refreshInviteStatuses(id);
      if (res.success && res.data.cooldown) {
        setRefreshCooldown(res.data.retry_after_seconds);
        const timer = setInterval(() => {
          setRefreshCooldown(prev => {
            if (prev <= 1) { clearInterval(timer); return 0; }
            return prev - 1;
          });
        }, 1000);
      } else {
        await loadData();
      }
    } catch (error) {
      console.error('Error refreshing invite statuses:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getDaysWaiting = (sentAt) => {
    if (!sentAt) return '-';
    const sent = new Date(sentAt);
    const now = new Date();
    const diffTime = Math.abs(now - sent);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Sorting logic
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    }
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3" />
      : <ArrowDown className="w-3 h-3" />;
  };

  const sortedLeads = useMemo(() => {
    if (!sortConfig.key) return leads;

    return [...leads].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.key) {
        case 'name':
          aValue = a.name || '';
          bValue = b.name || '';
          break;
        case 'company':
          aValue = a.company || '';
          bValue = b.company || '';
          break;
        case 'invite_status':
          aValue = a.status || 'collected';
          bValue = b.status || 'collected';
          break;
        case 'scheduled_for':
          aValue = a.scheduled_for ? new Date(a.scheduled_for).getTime() : 0;
          bValue = b.scheduled_for ? new Date(b.scheduled_for).getTime() : 0;
          break;
        case 'days_waiting':
          aValue = a.invite_sent_at ? new Date(a.invite_sent_at).getTime() : 0;
          bValue = b.invite_sent_at ? new Date(b.invite_sent_at).getTime() : 0;
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [leads, sortConfig]);

  const getInviteStatusBadge = (lead) => {
    const status = lead.status || 'collected';
    const colors = STATUS_COLORS[status] || STATUS_COLORS.collected;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
        {colors.label}
      </span>
    );
  };

  const getPipelineStatusBadge = (status) => {
    const colors = PIPELINE_STATUS_COLORS[status] || PIPELINE_STATUS_COLORS.leads;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
        {colors.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Campanha não encontrada</p>
          <button
            onClick={() => navigate('/campaigns')}
            className="mt-4 text-blue-600 dark:text-blue-400 hover:underline"
          >
            Voltar para Campanhas
          </button>
        </div>
      </div>
    );
  }

  const stats = summary || {};

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/campaigns')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{campaign.name}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Relatório da Campanha - Status:
              <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                campaign.status === 'active' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
                campaign.status === 'paused' ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' :
                'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}>
                {campaign.status === 'active' ? 'Ativa' :
                 campaign.status === 'paused' ? 'Pausada' : campaign.status}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>

          <button
            onClick={handleRefreshInvites}
            disabled={isRefreshing || refreshCooldown > 0}
            className="flex items-center gap-2 px-3 py-2 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRefreshing ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <UserCheck className="w-4 h-4" />
            )}
            {refreshCooldown > 0 ? `Aguarde ${refreshCooldown}s` : isRefreshing ? 'Verificando...' : 'Verificar aceites'}
          </button>

          {campaign.status === 'active' && (
            <button
              onClick={handlePause}
              disabled={isActioning}
              className="flex items-center gap-2 px-4 py-2 text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/70 transition-colors disabled:opacity-50"
            >
              <Pause className="w-4 h-4" />
              Pausar
            </button>
          )}

          {campaign.status === 'paused' && (
            <button
              onClick={handleResume}
              disabled={isActioning}
              className="flex items-center gap-2 px-4 py-2 text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/70 transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Retomar
            </button>
          )}

          <button
            onClick={handleCancel}
            disabled={isActioning}
            className="flex items-center gap-2 px-4 py-2 text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/50 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/70 transition-colors disabled:opacity-50"
          >
            <Ban className="w-4 h-4" />
            Cancelar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Total Leads</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{pagination.total}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Pendentes</span>
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{(parseInt(stats.approved) || 0) + (parseInt(stats.queued) || 0)}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Send className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Enviados</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{parseInt(stats.sent) || 0}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Aceitos</span>
          </div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{parseInt(stats.accepted) || 0}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Expirados</span>
          </div>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{parseInt(stats.expired) || 0}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Ban className="w-5 h-5 text-red-400 dark:text-red-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Rejeitados</span>
          </div>
          <p className="text-2xl font-bold text-red-400 dark:text-red-500">{parseInt(stats.rejected) || 0}</p>
        </div>
      </div>

      {/* Next Scheduled */}
      {queueStatus?.nextScheduled && queueStatus.nextScheduled.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Próximos Convites Agendados</h3>
          <div className="flex flex-wrap gap-2">
            {queueStatus.nextScheduled.slice(0, 5).map((item, index) => (
              <span key={index} className="px-3 py-1 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-full text-sm text-blue-700 dark:text-blue-300">
                {new Date(item.scheduled_for).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            ))}
            {queueStatus.nextScheduled.length > 5 && (
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 rounded-full text-sm text-blue-700 dark:text-blue-300">
                +{queueStatus.nextScheduled.length - 5} mais
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filter & Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {/* Filter Bar */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            {[
              { value: 'all', label: 'Todos', count: stats.total, bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', activeBg: 'bg-gray-600 dark:bg-gray-300', activeText: 'text-white dark:text-gray-900' },
              { value: 'invite_accepted', label: 'Aceitos', count: stats.accepted, bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400', activeBg: 'bg-green-600 dark:bg-green-500', activeText: 'text-white' },
              { value: 'invite_sent', label: 'Enviados', count: stats.sent, bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-400', activeBg: 'bg-yellow-500 dark:bg-yellow-500', activeText: 'text-white' },
              { value: 'invite_queued', label: 'Na Fila', count: stats.queued, bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-700 dark:text-indigo-400', activeBg: 'bg-indigo-600 dark:bg-indigo-500', activeText: 'text-white' },
              { value: 'invite_expired', label: 'Expirados', count: stats.expired, bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400', activeBg: 'bg-orange-500 dark:bg-orange-500', activeText: 'text-white' },
              { value: 'rejected', label: 'Rejeitados', count: stats.rejected, bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400', activeBg: 'bg-red-600 dark:bg-red-500', activeText: 'text-white' },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => {
                  setStatusFilter(filter.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === filter.value
                    ? `${filter.activeBg} ${filter.activeText}`
                    : `${filter.bg} ${filter.text} hover:opacity-80`
                }`}
              >
                {filter.label} ({parseInt(filter.count) || 0})
              </button>
            ))}
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap ml-4">
            {pagination.total} leads encontrados
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Lead {getSortIcon('name')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort('company')}
                >
                  <div className="flex items-center gap-1">
                    Empresa {getSortIcon('company')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort('invite_status')}
                >
                  <div className="flex items-center gap-1">
                    Status Convite {getSortIcon('invite_status')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort('scheduled_for')}
                >
                  <div className="flex items-center gap-1">
                    Agendado Para {getSortIcon('scheduled_for')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort('days_waiting')}
                >
                  <div className="flex items-center gap-1">
                    Dias Esperando {getSortIcon('days_waiting')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Pipeline {getSortIcon('status')}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Responsável
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sortedLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    Nenhum lead encontrado com este filtro
                  </td>
                </tr>
              ) : (
                sortedLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex items-center gap-3">
                        {lead.profile_picture ? (
                          <img
                            src={lead.profile_picture}
                            alt={lead.name}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-semibold">
                              {lead.name?.charAt(0) || '?'}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{lead.name}</span>
                            {lead.profile_url && (
                              <a
                                href={lead.profile_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex-shrink-0"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <span className="text-sm text-gray-500 dark:text-gray-400 block truncate max-w-[250px]" title={lead.title}>{lead.title}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {lead.company || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {getInviteStatusBadge(lead)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {lead.scheduled_for ? (
                        <span className="text-blue-600 dark:text-blue-400">
                          {new Date(lead.scheduled_for).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      ) : lead.status === 'invite_sent' ? (
                        <span className="text-green-600 dark:text-green-400 text-xs">Enviado</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {lead.status === 'invite_sent' ? (
                        <span className="font-medium text-yellow-600 dark:text-yellow-400">
                          {getDaysWaiting(lead.invite_sent_at)} dias
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getPipelineStatusBadge(lead.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {lead.responsible_user_name || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Página {pagination.page} de {pagination.totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page <= 1}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignReportPage;
