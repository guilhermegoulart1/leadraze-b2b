// frontend/src/components/GoogleMapsAgentCard.jsx
import React from 'react';
import {
  Map,
  MapPin,
  Play,
  Pause,
  Trash2,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Building2,
  Users,
  Download,
  Settings,
  Target
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const GoogleMapsAgentCard = ({ agent, onPause, onResume, onDelete, onExport, onEdit }) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'active':
        return {
          label: 'Ativo',
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          icon: CheckCircle
        };
      case 'collecting':
      case 'processing':
        return {
          label: 'Coletando...',
          color: 'text-purple-600 dark:text-purple-400',
          bgColor: 'bg-purple-50 dark:bg-purple-900/20',
          icon: Loader2,
          animate: true
        };
      case 'paused':
        return {
          label: 'Pausado',
          color: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          icon: AlertCircle
        };
      case 'completed':
        return {
          label: 'Concluído',
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          icon: CheckCircle
        };
      case 'failed':
        return {
          label: 'Erro',
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          icon: XCircle
        };
      default:
        return {
          label: status,
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-900/20',
          icon: AlertCircle
        };
    }
  };

  const getActionTypeLabel = (actionType) => {
    switch (actionType) {
      case 'crm_only':
        return 'Apenas CRM';
      case 'crm_email':
        return 'CRM + Email';
      case 'crm_email_whatsapp':
        return 'CRM + Email + WhatsApp';
      default:
        return actionType;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Nunca';
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: ptBR
      });
    } catch {
      return 'Data inválida';
    }
  };

  const statusConfig = getStatusConfig(agent.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-3 flex-1">
          {/* Avatar */}
          {agent.avatar_url ? (
            <img
              src={agent.avatar_url}
              alt={agent.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-purple-200 dark:border-purple-700"
            />
          ) : (
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Map className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {agent.name}
            </h3>
            {agent.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                {agent.description}
              </p>
            )}
          </div>
        </div>

        {/* Status badge */}
        <div className={`flex items-center space-x-1 px-2 py-1 rounded-full ${statusConfig.bgColor}`}>
          <StatusIcon className={`w-4 h-4 ${statusConfig.color} ${statusConfig.animate ? 'animate-spin' : ''}`} />
          <span className={`text-xs font-medium ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Search info */}
      <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
          <MapPin className="w-4 h-4" />
          <span className="font-medium">{agent.search_query}</span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-500">
          {agent.search_location}, {agent.search_country}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
            {getActionTypeLabel(agent.action_type)}
          </span>
          {agent.min_rating && (
            <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
              ⭐ {agent.min_rating}+
            </span>
          )}
          {agent.require_phone && (
            <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
              📞 Obrigatório
            </span>
          )}
          {agent.daily_limit && (
            <span className="flex items-center gap-1 text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded">
              <Target className="w-3 h-3" />
              {agent.daily_limit}/dia
            </span>
          )}
        </div>

        {/* Sector and rotation info */}
        {(agent.sector_name || agent.assignee_count > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {agent.sector_name && (
              <span
                className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                style={{
                  backgroundColor: agent.sector_color ? `${agent.sector_color}20` : '#6366f120',
                  color: agent.sector_color || '#6366f1'
                }}
              >
                <Building2 className="w-3 h-3" />
                {agent.sector_name}
              </span>
            )}
            {agent.assignee_count > 0 && (
              <span className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded">
                <Users className="w-3 h-3" />
                {agent.assignee_count} no rodízio
              </span>
            )}
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
            <TrendingUp className="w-3 h-3" />
            <span>Encontrados</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {agent.total_leads_found || 0}
          </div>
        </div>

        <div>
          <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
            <CheckCircle className="w-3 h-3" />
            <span>No CRM</span>
          </div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {agent.leads_inserted || 0}
          </div>
        </div>

        <div>
          <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
            <Clock className="w-3 h-3" />
            <span>Última exec.</span>
          </div>
          <div className="text-xs text-gray-700 dark:text-gray-300">
            {formatDate(agent.last_execution_at)}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 pt-4 border-t border-gray-200 dark:border-gray-700">
        {agent.status === 'active' && (
          <button
            onClick={() => onPause(agent.id)}
            className="p-2 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-colors"
            title="Pausar"
          >
            <Pause className="w-4 h-4" />
          </button>
        )}

        {agent.status === 'paused' && (
          <button
            onClick={() => onResume(agent.id)}
            className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
            title="Retomar"
          >
            <Play className="w-4 h-4" />
          </button>
        )}

        {agent.status === 'completed' && (
          <span className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400 pr-2">
            <CheckCircle className="w-4 h-4" />
            <span>Concluído</span>
          </span>
        )}

        {/* Edit button */}
        {onEdit && (
          <button
            onClick={() => onEdit(agent)}
            className="p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
            title="Editar limite diário"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}

        {/* Export CSV button */}
        <button
          onClick={() => onExport(agent.id, agent.name)}
          disabled={!agent.leads_inserted || agent.leads_inserted === 0}
          className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Exportar CSV"
        >
          <Download className="w-4 h-4" />
        </button>

        <button
          onClick={() => onDelete(agent.id)}
          className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          title="Deletar"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default GoogleMapsAgentCard;
