import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Users, Bot, Bell, Clock, Save, Loader2, ChevronDown } from 'lucide-react';
import api from '../services/api';

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

  // Estado para agentes de IA
  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Carregar configurações existentes
  useEffect(() => {
    if (channel?.channel_settings) {
      const existingSettings = typeof channel.channel_settings === 'string'
        ? JSON.parse(channel.channel_settings)
        : channel.channel_settings;

      setSettings(prev => ({
        ...prev,
        ...existingSettings
      }));
    }
  }, [channel]);

  // Carregar agentes disponíveis
  useEffect(() => {
    const loadAgents = async () => {
      try {
        setLoadingAgents(true);
        const response = await api.getAIAgents();
        if (response.success && response.data) {
          // Filtrar apenas agentes ativos
          const activeAgents = response.data.filter(agent => agent.is_active !== false);
          setAgents(activeAgents);
        }
      } catch (error) {
        console.error('Erro ao carregar agentes:', error);
      } finally {
        setLoadingAgents(false);
      }
    };

    loadAgents();
  }, []);

  const handleToggle = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    setSaved(false);
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const response = await api.updateChannelSettings(channel.id, settings);

      if (response.success) {
        setSaved(true);
        if (onUpdate) {
          onUpdate(channel.id, settings);
        }
        // Fechar após 1 segundo mostrando sucesso
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      alert('Erro ao salvar configurações. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const ChannelIcon = channelConfig?.icon || MessageCircle;

  // Verificar se o canal suporta grupos
  const supportsGroups = ['WHATSAPP', 'INSTAGRAM', 'MESSENGER', 'TELEGRAM', 'GOOGLE'].includes(
    channel?.provider_type?.toUpperCase()
  );

  // Encontrar agente selecionado
  const selectedAgent = agents.find(a => a.id === settings.ai_agent_id);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`bg-gradient-to-r ${channelConfig?.gradient || 'from-purple-600 to-purple-700'} px-6 py-4 rounded-t-xl`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-white">
              <ChannelIcon className="w-6 h-6" />
              <div>
                <h2 className="text-lg font-semibold">Configurações do Canal</h2>
                <p className="text-sm opacity-90">{channel?.profile_name || channel?.channel_name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">

          {/* Seção: Mensagens de Grupo */}
          {supportsGroups && (
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">Ignorar Grupos</h3>
                    <button
                      onClick={() => handleToggle('ignore_groups')}
                      className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${
                        settings.ignore_groups ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          settings.ignore_groups ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {settings.ignore_groups
                      ? 'Mensagens de grupos serão ignoradas'
                      : 'Mensagens de grupos serão processadas normalmente'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Seção: IA */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">IA Habilitada</h3>
                  <button
                    onClick={() => handleToggle('ai_enabled')}
                    className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${
                      settings.ai_enabled ? 'bg-purple-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings.ai_enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {settings.ai_enabled
                    ? 'A IA pode responder automaticamente neste canal'
                    : 'Todas as mensagens serão manuais neste canal'}
                </p>

                {/* Seletor de Agente - só aparece se IA habilitada */}
                {settings.ai_enabled && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <label className="text-sm font-medium text-gray-700 block mb-2">
                      Agente de IA para este canal
                    </label>
                    {loadingAgents ? (
                      <div className="flex items-center gap-2 text-gray-500 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Carregando agentes...
                      </div>
                    ) : agents.length === 0 ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-sm text-amber-800">
                          Nenhum agente de IA configurado. Crie um agente primeiro para habilitar respostas automáticas.
                        </p>
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          value={settings.ai_agent_id || ''}
                          onChange={(e) => handleChange('ai_agent_id', e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm appearance-none bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 pr-10"
                        >
                          <option value="">Selecione um agente...</option>
                          {agents.map(agent => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name} {agent.type ? `(${agent.type})` : ''}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                      </div>
                    )}

                    {selectedAgent && (
                      <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <p className="text-sm font-medium text-purple-800">{selectedAgent.name}</p>
                        {selectedAgent.description && (
                          <p className="text-xs text-purple-600 mt-1">{selectedAgent.description}</p>
                        )}
                      </div>
                    )}

                    {settings.ai_enabled && !settings.ai_agent_id && agents.length > 0 && (
                      <p className="text-xs text-amber-600 mt-2">
                        Selecione um agente para habilitar respostas automáticas
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Seção: Notificações */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Bell className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">Notificações</h3>
                  <button
                    onClick={() => handleToggle('notify_on_message')}
                    className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${
                      settings.notify_on_message ? 'bg-green-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings.notify_on_message ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {settings.notify_on_message
                    ? 'Você receberá notificações de novas mensagens'
                    : 'Notificações desativadas para este canal'}
                </p>
              </div>
            </div>
          </div>

          {/* Seção: Horário Comercial */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">Apenas Horário Comercial</h3>
                  <button
                    onClick={() => handleToggle('business_hours_only')}
                    className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${
                      settings.business_hours_only ? 'bg-amber-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings.business_hours_only ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-sm text-gray-500 mb-3">
                  {settings.business_hours_only
                    ? 'A IA só responderá durante o horário comercial'
                    : 'A IA responde 24 horas por dia'}
                </p>

                {settings.business_hours_only && (
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 block mb-1">Início</label>
                      <input
                        type="time"
                        value={settings.business_hours_start}
                        onChange={(e) => handleChange('business_hours_start', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 block mb-1">Fim</label>
                      <input
                        type="time"
                        value={settings.business_hours_end}
                        onChange={(e) => handleChange('business_hours_end', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Seção: Leitura Automática */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">Marcar como Lido</h3>
                  <button
                    onClick={() => handleToggle('auto_read')}
                    className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${
                      settings.auto_read ? 'bg-gray-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings.auto_read ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {settings.auto_read
                    ? 'Mensagens serão marcadas como lidas automaticamente'
                    : 'Você precisará marcar manualmente como lido'}
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading || saved}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              saved
                ? 'bg-green-600 text-white'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            } disabled:opacity-50`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : saved ? (
              <>
                <Save className="w-4 h-4" />
                Salvo!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Configurações
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChannelSettingsModal;
