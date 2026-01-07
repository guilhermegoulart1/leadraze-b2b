// frontend/src/components/pipelines/PipelineListView.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  User,
  Calendar,
  DollarSign,
  Building2,
  ChevronDown,
  ChevronUp,
  Search
} from 'lucide-react';
import api from '../../services/api';

const PipelineListView = ({ pipeline, onOpportunityClick, onRefresh }) => {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    total_pages: 0
  });

  const loadOpportunities = useCallback(async () => {
    if (!pipeline?.id) return;

    try {
      setLoading(true);
      const response = await api.getOpportunities(pipeline.id, {
        page: pagination.page,
        limit: pagination.limit,
        sort_field: sortField,
        sort_direction: sortDirection,
        search: searchQuery || undefined
      });

      if (response.success) {
        setOpportunities(response.data.opportunities || []);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Erro ao carregar oportunidades:', error);
    } finally {
      setLoading(false);
    }
  }, [pipeline?.id, pagination.page, sortField, sortDirection, searchQuery]);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const SortHeader = ({ field, children }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
        )}
      </div>
    </th>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar oportunidades..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : opportunities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <p>Nenhuma oportunidade encontrada</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
              <tr>
                <SortHeader field="title">Oportunidade</SortHeader>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contato
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Etapa
                </th>
                <SortHeader field="value">Valor</SortHeader>
                <SortHeader field="probability">Probabilidade</SortHeader>
                <SortHeader field="expected_close_date">Previsão</SortHeader>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Responsável
                </th>
                <SortHeader field="created_at">Criado em</SortHeader>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {opportunities.map(opp => (
                <tr
                  key={opp.id}
                  onClick={() => onOpportunityClick(opp)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  {/* Title */}
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {opp.title}
                    </span>
                  </td>

                  {/* Contact */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {opp.contact_picture ? (
                        <img
                          src={opp.contact_picture}
                          alt={opp.contact_name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-500" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {opp.contact_name}
                        </p>
                        {opp.contact_company && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {opp.contact_company}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Stage */}
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${opp.stage_color}20`,
                        color: opp.stage_color
                      }}
                    >
                      {opp.stage_name}
                    </span>
                  </td>

                  {/* Value */}
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(opp.value)}
                    </span>
                  </td>

                  {/* Probability */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500"
                          style={{ width: `${opp.probability}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {opp.probability}%
                      </span>
                    </div>
                  </td>

                  {/* Expected Close */}
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(opp.expected_close_date)}
                  </td>

                  {/* Owner */}
                  <td className="px-4 py-3">
                    {opp.owner_name ? (
                      <div className="flex items-center gap-2">
                        {opp.owner_avatar ? (
                          <img
                            src={opp.owner_avatar}
                            alt={opp.owner_name}
                            className="w-6 h-6 rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <User className="w-3 h-3 text-gray-500" />
                          </div>
                        )}
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {opp.owner_name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>

                  {/* Created At */}
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(opp.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <div className="px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Mostrando {opportunities.length} de {pagination.total} oportunidades
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page <= 1}
              className="px-3 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {pagination.page} / {pagination.total_pages}
            </span>
            <button
              onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page >= pagination.total_pages}
              className="px-3 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PipelineListView;
