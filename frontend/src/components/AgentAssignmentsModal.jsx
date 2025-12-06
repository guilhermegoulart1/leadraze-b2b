import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, Users, Clock, ChevronLeft, ChevronRight,
  Download, User, Calendar, Filter, RefreshCw
} from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';
import { ptBR, enUS, es } from 'date-fns/locale';

const AgentAssignmentsModal = ({ isOpen, onClose, agent }) => {
  const { t, i18n } = useTranslation(['agents', 'common']);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [stats, setStats] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    user_id: '',
    start_date: '',
    end_date: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // Get date locale
  const getDateLocale = () => {
    switch (i18n.language) {
      case 'pt': return ptBR;
      case 'es': return es;
      default: return enUS;
    }
  };

  const loadAssignments = useCallback(async (page = 1) => {
    if (!agent?.id) return;

    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v)
        )
      };

      const response = await api.getAgentAssignments(agent.id, params);
      if (response.success) {
        setAssignments(response.data.assignments || []);
        setPagination(response.data.pagination || { page: 1, pages: 1, total: 0 });
      }
    } catch (error) {
      console.error('Error loading assignments:', error);
    } finally {
      setLoading(false);
    }
  }, [agent?.id, filters]);

  const loadStats = useCallback(async () => {
    if (!agent?.id) return;

    try {
      const response = await api.getAgentAssignmentStats(agent.id);
      if (response.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [agent?.id]);

  useEffect(() => {
    if (isOpen && agent?.id) {
      loadAssignments();
      loadStats();
    }
  }, [isOpen, agent?.id, loadAssignments, loadStats]);

  const formatDate = (date) => {
    return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: getDateLocale() });
  };

  const handleExportCSV = () => {
    if (!assignments.length) return;

    const headers = ['Data/Hora', 'Lead', 'Empresa', 'Atribuído Para', 'Posição', 'Total Rodízio'];
    const rows = assignments.map(a => [
      formatDate(a.created_at),
      a.lead_name || '-',
      a.lead_company || '-',
      a.assigned_to_user_name || '-',
      a.rotation_position,
      a.total_assignees
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `atribuicoes-${agent.name}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Atribuições
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {agent?.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.total_assignments || 0}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Atribuições</div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.unique_users || 0}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Usuários</div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats.unique_leads || 0}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Leads Únicos</div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  {stats.last_assignment ? formatDate(stats.last_assignment) : '-'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Última Atribuição</div>
              </div>
            </div>

            {/* Per User Stats */}
            {stats.per_user && stats.per_user.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Por Usuário:</div>
                <div className="flex flex-wrap gap-2">
                  {stats.per_user.map((user, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full text-xs text-gray-700 dark:text-gray-300"
                    >
                      <User className="w-3 h-3 text-gray-400" />
                      <span className="font-medium">{user.user_name}</span>
                      <span className="text-purple-600 dark:text-purple-400">{user.assignment_count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filters & Actions */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  showFilters
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filtros
              </button>
              <button
                onClick={() => loadAssignments(pagination.page)}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                title="Atualizar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleExportCSV}
              disabled={!assignments.length}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          </div>

          {/* Filter Fields */}
          {showFilters && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-end gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Data Inicial</label>
                <input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => setFilters(f => ({ ...f, start_date: e.target.value }))}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Data Final</label>
                <input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => setFilters(f => ({ ...f, end_date: e.target.value }))}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <button
                onClick={() => loadAssignments(1)}
                className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
              >
                Filtrar
              </button>
              <button
                onClick={() => {
                  setFilters({ user_id: '', start_date: '', end_date: '' });
                  loadAssignments(1);
                }}
                className="px-3 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
              >
                Limpar
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 dark:border-purple-400"></div>
            </div>
          ) : assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
              <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="font-medium">Nenhuma atribuição encontrada</p>
              <p className="text-sm">As atribuições automáticas aparecerão aqui</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                    Data/Hora
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                    Lead
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                    Atribuído Para
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                    Posição
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {assignments.map((assignment) => (
                  <tr key={assignment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {formatDate(assignment.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {assignment.lead_profile_picture ? (
                          <img
                            src={assignment.lead_profile_picture}
                            alt={assignment.lead_name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                            {assignment.lead_name?.charAt(0) || '?'}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                            {assignment.lead_name || '-'}
                          </div>
                          {assignment.lead_company && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {assignment.lead_company}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {assignment.assigned_to_user_avatar ? (
                          <img
                            src={assignment.assigned_to_user_avatar}
                            alt={assignment.assigned_to_user_name}
                            className="w-6 h-6 rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                            <User className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                          </div>
                        )}
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          {assignment.assigned_to_user_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-xs font-medium">
                        {assignment.rotation_position}/{assignment.total_assignees}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {((pagination.page - 1) * 20) + 1} - {Math.min(pagination.page * 20, pagination.total)} de {pagination.total}
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => loadAssignments(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <span className="text-sm text-gray-600 dark:text-gray-400">
                {pagination.page} / {pagination.pages}
              </span>

              <button
                onClick={() => loadAssignments(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentAssignmentsModal;
