// frontend/src/components/GoogleMapsAgentRow.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Map,
  MapPin,
  Play,
  Pause,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Download,
  Settings,
  RotateCw,
  FileText,
  X,
  Search,
  Eye,
  Sparkles,
  Database,
  Target
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { getCategoryTranslation } from '../data/businessCategories';

const GoogleMapsAgentRow = ({ agent, onPause, onResume, onDelete, onExport, onEdit, onExecute, progress }) => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Helper to extract city/state from full location string
  const extractCityState = (location) => {
    if (!location) return '';
    const parts = location.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      return `${parts[parts.length - 3]}, ${parts[parts.length - 2]}`;
    }
    return location;
  };

  // Get gamified step info
  const getStepInfo = () => {
    if (!progress || agent.status !== 'collecting') return null;

    const stepIcons = {
      searching: Search,
      filtering: Target,
      analyzing: Eye,
      enriching: Sparkles,
      saving: Database,
      saved: CheckCircle
    };

    const step = progress.step || 'searching';
    const StepIcon = stepIcons[step] || Search;

    return {
      icon: StepIcon,
      label: progress.stepLabel || 'Processando...',
      step,
      currentPlace: progress.currentPlace
    };
  };

  // Check if agent might be running (recently created or recently executed)
  const mightBeRunning = () => {
    if (agent.status !== 'active') return false;

    // If never executed, check if recently created (might be running initial job)
    if (!agent.last_execution_at) {
      const created = new Date(agent.created_at);
      const now = new Date();
      const diffMinutes = (now - created) / 1000 / 60;
      return diffMinutes < 5; // Created less than 5 minutes ago
    }

    // If executed within the last 5 minutes, might still be running
    const lastExec = new Date(agent.last_execution_at);
    const now = new Date();
    const diffMinutes = (now - lastExec) / 1000 / 60;
    return diffMinutes < 5;
  };

  const getStatusConfig = (status) => {
    // If status is 'active' but might be running, show loading state
    if (status === 'active' && mightBeRunning()) {
      return {
        label: 'Verificando...',
        color: 'text-gray-500 dark:text-gray-400',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        icon: Loader2,
        animate: true
      };
    }

    switch (status) {
      case 'active':
        return {
          label: 'Ativo',
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-100 dark:bg-green-900/30',
          icon: CheckCircle
        };
      case 'in_progress':
        return {
          label: 'Em andamento',
          color: 'text-orange-600 dark:text-orange-400',
          bgColor: 'bg-orange-100 dark:bg-orange-900/30',
          icon: Clock
        };
      case 'collecting':
      case 'processing':
        return {
          label: 'Coletando',
          color: 'text-purple-600 dark:text-purple-400',
          bgColor: 'bg-purple-100 dark:bg-purple-900/30',
          icon: Loader2,
          animate: true
        };
      case 'paused':
        return {
          label: 'Pausado',
          color: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
          icon: AlertCircle
        };
      case 'completed':
        return {
          label: 'Concluido',
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-100 dark:bg-blue-900/30',
          icon: CheckCircle
        };
      case 'failed':
        return {
          label: 'Erro',
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-100 dark:bg-red-900/30',
          icon: XCircle
        };
      default:
        return {
          label: status,
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-100 dark:bg-gray-900/30',
          icon: AlertCircle
        };
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Nunca';
    try {
      let date;
      if (dateString.includes('Z') || dateString.includes('+') || dateString.match(/\d{2}:\d{2}:\d{2}-\d{2}/)) {
        date = new Date(dateString);
      } else {
        date = new Date(dateString + 'Z');
      }
      if (isNaN(date.getTime())) return 'Data invalida';
      return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
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
  const stepInfo = getStepInfo();

  // Use progress data if available
  const displayLeadsFound = progress?.leadsFound ?? agent.total_leads_found ?? 0;
  const displayLeadsInserted = progress?.leadsInserted ?? agent.leads_inserted ?? 0;

  return (
    <>
      <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        {/* Campaign Name & Query */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {agent.avatar_url ? (
              <img
                src={agent.avatar_url}
                alt={agent.name}
                className="w-8 h-8 rounded-full object-cover border border-purple-200 dark:border-purple-700"
              />
            ) : (
              <div className="p-1.5 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                <Map className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                {agent.name}
              </p>
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-[150px]">{getCategoryTranslation(agent.search_query, i18n.language)}</span>
                <span className="text-gray-400">•</span>
                <span className="truncate max-w-[100px]">{extractCityState(agent.search_location)}</span>
              </div>
            </div>
          </div>
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <div className="flex flex-col gap-1">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color} w-fit`}>
              <StatusIcon className={`w-3 h-3 ${statusConfig.animate ? 'animate-spin' : ''}`} />
              {statusConfig.label}
            </span>
            {/* Gamified step label */}
            {stepInfo && (
              <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 max-w-[180px]">
                <stepInfo.icon className="w-3 h-3 flex-shrink-0 animate-pulse" />
                <span className="truncate">{stepInfo.label}</span>
              </div>
            )}
          </div>
        </td>

        {/* Progress - Found/Inserted */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{displayLeadsFound}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Encontrados</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-green-600 dark:text-green-400">{displayLeadsInserted}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">No CRM</p>
            </div>
          </div>
        </td>

        {/* Config */}
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {agent.daily_limit && (
              <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded">
                <Target className="w-2.5 h-2.5" />
                {agent.daily_limit}/dia
              </span>
            )}
            {agent.min_rating && (
              <span className="text-xs px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded">
                ⭐{agent.min_rating}+
              </span>
            )}
            {agent.sector_name && (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: agent.sector_color ? `${agent.sector_color}20` : '#6366f120',
                  color: agent.sector_color || '#6366f1'
                }}
              >
                {agent.sector_name}
              </span>
            )}
          </div>
        </td>

        {/* Last Execution */}
        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          {formatDate(agent.last_execution_at)}
        </td>

        {/* Actions */}
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={handleShowLogs}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Ver logs"
            >
              <FileText className="w-4 h-4" />
            </button>

            {agent.status === 'active' && (
              <button
                onClick={() => onPause(agent.id)}
                className="p-1.5 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                title="Pausar"
              >
                <Pause className="w-4 h-4" />
              </button>
            )}

            {agent.status === 'paused' && (
              <button
                onClick={() => onResume(agent.id)}
                className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                title="Retomar"
              >
                <Play className="w-4 h-4" />
              </button>
            )}

            {onEdit && (
              <button
                onClick={() => onEdit(agent)}
                className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                title="Editar"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {onExecute && agent.status !== 'collecting' && agent.status !== 'processing' && (
              <button
                onClick={() => onExecute(agent.id)}
                className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                title="Executar agora"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => navigate(`/google-maps-agents/${agent.id}`)}
              disabled={!agent.leads_inserted || agent.leads_inserted === 0}
              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Ver leads"
            >
              <Eye className="w-4 h-4" />
            </button>

            <button
              onClick={() => onExport(agent.id, agent.name)}
              disabled={!agent.leads_inserted || agent.leads_inserted === 0}
              className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exportar CSV"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={() => onDelete(agent.id)}
              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              title="Deletar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>

      {/* Logs Modal */}
      {showLogs && (
        <tr>
          <td colSpan="6">
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
                        Logs - {agent.name}
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
                        <p>Nenhum log disponivel</p>
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
                            </div>
                            {/* Places with website info */}
                            {log.places && log.places.length > 0 && (
                              <div className="mt-2 border-t border-gray-200 dark:border-gray-700 pt-2">
                                <p className="text-xs text-gray-500 mb-1">Places encontrados:</p>
                                <div className="max-h-40 overflow-y-auto space-y-1">
                                  {log.places.map((place, pIdx) => (
                                    <div key={pIdx} className="text-xs flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                      <span className="truncate flex-1">{place.title}</span>
                                      {place.website && (
                                        <span className="text-green-600 dark:text-green-400">🌐</span>
                                      )}
                                      {place.phone && (
                                        <span className="text-blue-600 dark:text-blue-400">📞</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <details className="text-xs mt-2">
                              <summary className="cursor-pointer text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                Ver JSON completo
                              </summary>
                              <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto text-gray-700 dark:text-gray-300 max-h-60">
                                {JSON.stringify(log, null, 2)}
                              </pre>
                            </details>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

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
          </td>
        </tr>
      )}
    </>
  );
};

export default GoogleMapsAgentRow;
