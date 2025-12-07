import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Users, Bot, Bell, Clock, Save, Loader2, ChevronDown, Settings } from 'lucide-react';
import api from '../services/api';

// Mapear provider_type do canal para activation_type do agente
const getAgentTypeForChannel = (providerType) => {
  const mapping = {
    'LINKEDIN': 'linkedin',
    'WHATSAPP': 'whatsapp',
    'INSTAGRAM': 'whatsapp', // Instagram usa agentes do tipo WhatsApp (mensageria)
    'MESSENGER': 'whatsapp', // Messenger usa agentes do tipo WhatsApp (mensageria)
    'TELEGRAM': 'whatsapp',  // Telegram usa agentes do tipo WhatsApp (mensageria)
    'GOOGLE': 'email',       // Google Chat pode usar email
    'OUTLOOK': 'email',
    'MAIL': 'email',
    'EMAIL': 'email'
  };
  return mapping[providerType?.toUpperCase()] || 'linkedin';
};

const ChannelSettingsModal = ({ channel, channelConfig, onClose, onUpdate }) => {
  const [settings, setSettings] = useState({
    ignore_groups: true,
    auto_read: false,
    ai_enabled: false,
    ai_agent_id: null,
    notify_on_message: true,
    business_hours_only: false,
    business_hours_start: '09:00',
    business_hours_end: '18:00'
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Inicializar settings apenas uma vez quando o modal abre
  useEffect(() => {
    if (!initialized && channel?.channel_settings) {
      const existingSettings = typeof channel.channel_settings === 'string'
        ? JSON.parse(channel.channel_settings)
        : channel.channel_settings;
      setSettings(prev => ({ ...prev, ...existingSettings }));
      setInitialized(true);
    }
  }, [channel, initialized]);

  // Carregar agentes filtrados pelo tipo de canal
  useEffect(() => {
    const loadAgents = async () => {
      if (!channel?.provider_type) return;

      try {
        setLoadingAgents(true);
        const agentType = getAgentTypeForChannel(channel.provider_type);
        let allAgents = [];

        // 1. Buscar agentes de ativação do tipo correspondente
        try {
          const activationResponse = await api.getActivationAgents({ type: agentType });
          if (activationResponse.success && activationResponse.data?.agents) {
            allAgents = [...activationResponse.data.agents];
          } else if (activationResponse.success && Array.isArray(activationResponse.data)) {
            allAgents = [...activationResponse.data];
          }
        } catch (e) {
          console.log('Activation agents não disponível:', e);
        }

        // 2. Para LinkedIn, também buscar da tabela ai_agents (agentes originais)
        if (agentType === 'linkedin') {
          try {
            const aiResponse = await api.getAIAgents();
            if (aiResponse.success && Array.isArray(aiResponse.data)) {
              // Adicionar agentes de IA que não estão já na lista
              const aiAgents = aiResponse.data.filter(
                agent => !allAgents.some(a => a.id === agent.id)
              );
              allAgents = [...allAgents, ...aiAgents];
            }
          } catch (e) {
            console.log('AI agents não disponível:', e);
          }
        }

        // Filtrar apenas agentes ativos
        const activeAgents = allAgents.filter(agent => agent.is_active !== false);
        setAgents(activeAgents);
      } catch (error) {
        console.error('Erro ao carregar agentes:', error);
        setAgents([]);
      } finally {
        setLoadingAgents(false);
      }
    };
    loadAgents();
  }, [channel?.provider_type]);

  const handleToggle = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const response = await api.updateChannelSettings(channel.id, settings);
      if (response.success) {
        setSaved(true);
        if (onUpdate) onUpdate(channel.id, settings);
        setTimeout(() => onClose(), 1000);
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      alert('Erro ao salvar configurações. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const ChannelIcon = channelConfig?.icon || MessageCircle;
  const supportsGroups = ['WHATSAPP', 'INSTAGRAM', 'MESSENGER', 'TELEGRAM', 'GOOGLE'].includes(
    channel?.provider_type?.toUpperCase()
  );
  const selectedAgent = agents.find(a => a.id === settings.ai_agent_id);

  // Compact toggle component
  const Toggle = ({ enabled, onClick, color = 'purple' }) => (
    <button
      onClick={onClick}
      className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none ${
        enabled ? `bg-${color}-600` : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          enabled ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header - Consistent Purple */}
        <div className="bg-purple-600 text-white px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Settings className="w-5 h-5" />
              <div>
                <h2 className="text-sm font-semibold">Configurações do Canal</h2>
                <p className="text-purple-200 text-xs">{channel?.profile_name || channel?.channel_name}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content - Compact spacing */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">

          {/* Grupos */}
          {supportsGroups && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium text-gray-900 dark:text-gray-100">Ignorar Grupos</h3>
                    <Toggle enabled={settings.ignore_groups} onClick={() => handleToggle('ignore_groups')} color="blue" />
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {settings.ignore_groups ? 'Grupos ignorados' : 'Grupos processados'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* IA */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-gray-900 dark:text-gray-100">IA Habilitada</h3>
                  <Toggle enabled={settings.ai_enabled} onClick={() => handleToggle('ai_enabled')} />
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {settings.ai_enabled ? 'Respostas automáticas ativas' : 'Apenas manual'}
                </p>
              </div>
            </div>

            {settings.ai_enabled && (
              <div className="mt-2.5 pt-2.5 border-t border-gray-200 dark:border-gray-600">
                <label className="text-[10px] font-medium text-gray-600 dark:text-gray-400 block mb-1.5">
                  Agente de IA
                </label>
                {loadingAgents ? (
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-[10px]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Carregando...
                  </div>
                ) : agents.length === 0 ? (
                  <div className="bg-amber-50 dark:bg-amber-900/30 rounded p-2">
                    <p className="text-[10px] text-amber-700 dark:text-amber-300">
                      Nenhum agente de {getAgentTypeForChannel(channel?.provider_type)} configurado
                    </p>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      name="ai_agent_id"
                      value={settings.ai_agent_id || ''}
                      onChange={(e) => handleChange('ai_agent_id', e.target.value || null)}
                      className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-purple-500 pr-7 cursor-pointer"
                      style={{ WebkitAppearance: 'menulist', appearance: 'menulist' }}
                    >
                      <option value="">Selecione...</option>
                      {agents.map(agent => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedAgent && (
                  <div className="mt-2 bg-purple-50 dark:bg-purple-900/30 rounded p-2">
                    <p className="text-[10px] font-medium text-purple-700 dark:text-purple-300">{selectedAgent.name}</p>
                    {selectedAgent.description && (
                      <p className="text-[9px] text-purple-600 dark:text-purple-400 mt-0.5 line-clamp-1">{selectedAgent.description}</p>
                    )}
                  </div>
                )}

                {settings.ai_enabled && !settings.ai_agent_id && agents.length > 0 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5">
                    Selecione um agente
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Notificações */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-gray-900 dark:text-gray-100">Notificações</h3>
                  <Toggle enabled={settings.notify_on_message} onClick={() => handleToggle('notify_on_message')} color="green" />
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {settings.notify_on_message ? 'Ativadas' : 'Desativadas'}
                </p>
              </div>
            </div>
          </div>

          {/* Horário Comercial */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-gray-900 dark:text-gray-100">Horário Comercial</h3>
                  <Toggle enabled={settings.business_hours_only} onClick={() => handleToggle('business_hours_only')} color="amber" />
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {settings.business_hours_only ? 'Apenas expediente' : '24 horas'}
                </p>
              </div>
            </div>

            {settings.business_hours_only && (
              <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-gray-200 dark:border-gray-600">
                <div className="flex-1">
                  <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">Início</label>
                  <input
                    type="time"
                    value={settings.business_hours_start}
                    onChange={(e) => handleChange('business_hours_start', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-xs focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">Fim</label>
                  <input
                    type="time"
                    value={settings.business_hours_end}
                    onChange={(e) => handleChange('business_hours_end', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-xs focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Leitura Automática */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-gray-900 dark:text-gray-100">Marcar como Lido</h3>
                  <Toggle enabled={settings.auto_read} onClick={() => handleToggle('auto_read')} color="gray" />
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {settings.auto_read ? 'Automático' : 'Manual'}
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer - Compact */}
        <div className="px-3 py-2.5 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-end gap-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading || saved}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              saved
                ? 'bg-green-600 text-white'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            } disabled:opacity-50`}
          >
            {loading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Salvando...
              </>
            ) : saved ? (
              <>
                <Save className="w-3 h-3" />
                Salvo!
              </>
            ) : (
              <>
                <Save className="w-3 h-3" />
                Salvar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChannelSettingsModal;
