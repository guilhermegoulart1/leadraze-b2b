// frontend/src/components/GoogleMapsAgentCard.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Target,
  Eye,
  RotateCw,
  FileText,
  X,
  Search,
  Globe,
  Sparkles,
  Database
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../services/api';

const GoogleMapsAgentCard = ({ agent, onPause, onResume, onDelete, onExport, onEdit, onExecute, progress }) => {
  const navigate = useNavigate();
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Get gamified step label based on progress
  const getStepLabel = () => {
    if (!progress || agent.status !== 'collecting') return null;

    const stepIcons = {
      searching: Search,
      filtering: Target,
      analyzing: Eye,
      enriching: Sparkles,
      saving: Database,
      saved: CheckCircle
    };

    const stepLabels = {
      searching: 'Buscando resultados no Google Maps...',
      filtering: 'Filtrando resultados...',
      analyzing: 'Analisando...',
      enriching: 'Enriquecendo com IA...',
      saving: 'Salvando no CRM...',
      saved: 'Salvo!'
    };

    const step = progress.step || 'searching';
    const StepIcon = stepIcons[step] || Search;
    // Use stepLabel from backend if available (contains place name), otherwise fallback
    const label = progress.stepLabel || stepLabels[step] || 'Processando...';

    return {
      icon: StepIcon,
      label,
      step,
      currentPlace: progress.currentPlace,
      progressInfo: progress.progress // { current, total }
    };
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'active':
        return {
          label: 'Ativo',
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          icon: CheckCircle
        };
      case 'in_progress':
        return {
          label: 'Em andamento',
          color: 'text-orange-600 dark:text-orange-400',
          bgColor: 'bg-orange-50 dark:bg-orange-900/20',
          icon: Clock
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
          label: 'Concluido',
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
        return 'CRM';
      case 'crm_email':
        return 'CRM+Email';
      case 'crm_email_whatsapp':
        return 'CRM+Email+WA';
      default:
        return actionType;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Nunca';
    try {
      // PostgreSQL returns dates in UTC, so we need to treat them as UTC
      // If the date string doesn't have timezone info, it's UTC from the database
      let date;
      if (dateString.includes('Z') || dateString.includes('+') || dateString.match(/\d{2}:\d{2}:\d{2}-\d{2}/)) {
        // Already has timezone info
        date = new Date(dateString);
      } else {
        // No timezone - treat as UTC from PostgreSQL
        date = new Date(dateString + 'Z');
      }

      // Validate the date
      if (isNaN(date.getTime())) {
        return 'Data invalida';
      }

      return formatDistanceToNow(date, {
        addSuffix: true,
        locale: ptBR
      });
    } catch {
      return 'Data invalida';
    }
  };

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const response = await api.getGoogleMapsAgentLogs(agent.id);
      if (response.success) {
        setLogs(response.logs || []);
      }
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleShowLogs = () => {
    setShowLogs(true);
    loadLogs();
  };

  const statusConfig = getStatusConfig(agent.status);
  const StatusIcon = statusConfig.icon;
  const stepInfo = getStepLabel();

  // Use progress data if available
  const displayLeadsFound = progress?.leadsFound ?? agent.total_leads_found ?? 0;
  const displayLeadsInserted = progress?.leadsInserted ?? agent.leads_inserted ?? 0;

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex items-start space-x-3 flex-1 min-w-0">
            {/* Avatar */}
            {agent.avatar_url ? (
              <img
                src={agent.avatar_url}
                alt={agent.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-purple-200 dark:border-purple-700 flex-shrink-0"
              />
            ) : (
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg flex-shrink-0">
                <Map className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                {agent.name}
              </h3>
              {agent.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                  {agent.description}
                </p>
              )}
            </div>
          </div>

          {/* Status badge */}
          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full flex-shrink-0 ${statusConfig.bgColor}`}>
            <StatusIcon className={`w-3.5 h-3.5 ${statusConfig.color} ${statusConfig.animate ? 'animate-spin' : ''}`} />
            <span className={`text-xs font-medium whitespace-nowrap ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>
        </div>

        {/* Gamified Status (when collecting) */}
        {stepInfo && (
          <div className="mb-3 p-2 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
            <div className="flex items-center gap-2">
              <stepInfo.icon className={`w-4 h-4 text-purple-600 dark:text-purple-400 ${stepInfo.step !== 'saved' ? 'animate-pulse' : ''}`} />
              <span className="text-xs text-purple-700 dark:text-purple-300 font-medium truncate flex-1">
                {stepInfo.label}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 ml-6 text-xs text-gray-500 dark:text-gray-400">
              {progress?.page && (
                <span>Pag. {progress.page}</span>
              )}
              {stepInfo.progressInfo && (
                <span>• {stepInfo.progressInfo.current}/{stepInfo.progressInfo.total}</span>
              )}
            </div>
          </div>
        )}

        {/* Search info - COMPACT */}
        <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="font-medium truncate">{agent.search_query}</span>
            <span className="text-gray-400">•</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {agent.search_location}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
              {getActionTypeLabel(agent.action_type)}
            </span>
            {agent.min_rating && (
              <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                ⭐{agent.min_rating}+
              </span>
            )}
            {agent.daily_limit && (
              <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded">
                <Target className="w-2.5 h-2.5" />
                {agent.daily_limit}/dia
              </span>
            )}
            {agent.sector_name && (
              <span
                className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: agent.sector_color ? `${agent.sector_color}20` : '#6366f120',
                  color: agent.sector_color || '#6366f1'
                }}
              >
                <Building2 className="w-2.5 h-2.5" />
                {agent.sector_name}
              </span>
            )}
            {agent.assignee_count > 0 && (
              <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded">
                <Users className="w-2.5 h-2.5" />
                {agent.assignee_count}
              </span>
            )}
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 mb-0.5">
              <TrendingUp className="w-3 h-3" />
              <span>Encontrados</span>
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {displayLeadsFound}
            </div>
          </div>

          <div>
            <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 mb-0.5">
              <CheckCircle className="w-3 h-3" />
              <span>No CRM</span>
            </div>
            <div className="text-xl font-bold text-green-600 dark:text-green-400">
              {displayLeadsInserted}
            </div>
          </div>

          <div>
            <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 mb-0.5">
              <Clock className="w-3 h-3" />
              <span>Ultima</span>
            </div>
            <div className="text-xs text-gray-700 dark:text-gray-300">
              {formatDate(agent.last_execution_at)}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
          {/* Logs button on left */}
          <button
            onClick={handleShowLogs}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Ver logs de execucao"
          >
            <FileText className="w-3.5 h-3.5" />
            Logs
          </button>

          {/* Action buttons on right */}
          <div className="flex items-center gap-1">
            {agent.status === 'active' && (
              <button
                onClick={() => onPause(agent.id)}
                className="p-1.5 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-colors"
                title="Pausar"
              >
                <Pause className="w-4 h-4" />
              </button>
            )}

            {agent.status === 'paused' && (
              <button
                onClick={() => onResume(agent.id)}
                className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                title="Retomar"
              >
                <Play className="w-4 h-4" />
              </button>
            )}

            {onEdit && (
              <button
                onClick={() => onEdit(agent)}
                className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                title="Editar"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {onExecute && agent.status !== 'collecting' && agent.status !== 'processing' && (
              <button
                onClick={() => onExecute(agent.id)}
                className="p-1.5 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                title="Executar agora"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => navigate(`/google-maps-agents/${agent.id}`)}
              disabled={!agent.leads_inserted || agent.leads_inserted === 0}
              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Ver leads"
            >
              <Eye className="w-4 h-4" />
            </button>

            <button
              onClick={() => onExport(agent.id, agent.name)}
              disabled={!agent.leads_inserted || agent.leads_inserted === 0}
              className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exportar CSV"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={() => onDelete(agent.id)}
              className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Deletar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div
              className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-80"
              onClick={() => setShowLogs(false)}
            />

            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Logs de Execucao - {agent.name}
                  </h2>
                </div>
                <button
                  onClick={() => setShowLogs(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {loadingLogs ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum log de execucao disponivel</p>
                    <p className="text-sm mt-1">Os logs aparecerao apos a primeira execucao</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                            Pagina {log.page}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(log.timestamp).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                          <div>
                            <span className="text-gray-500">Query:</span>{' '}
                            <span className="text-gray-700 dark:text-gray-300">{log.query}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Resultados:</span>{' '}
                            <span className="text-gray-700 dark:text-gray-300">{log.places_returned || 0}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-gray-500">Location:</span>{' '}
                            <span className="text-gray-700 dark:text-gray-300 truncate">{log.location}</span>
                          </div>
                        </div>
                        <details className="text-xs">
                          <summary className="cursor-pointer text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                            Ver JSON completo
                          </summary>
                          <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto text-gray-700 dark:text-gray-300">
                            {JSON.stringify(log, null, 2)}
                          </pre>
                        </details>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                <button
                  onClick={() => setShowLogs(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GoogleMapsAgentCard;
