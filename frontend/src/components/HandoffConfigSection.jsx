import React from 'react';
import {
  UserCheck,
  MessageSquare,
  Bell,
  BellOff,
  VolumeX,
  Volume2,
  AlertCircle,
  Info
} from 'lucide-react';
import SectorSelector from './SectorSelector';
import RodizioUserSelector from './RodizioUserSelector';

/**
 * HandoffConfigSection
 * Seção de configuração de transferência automática para agentes
 */
const HandoffConfigSection = ({
  agentType,
  config,
  onChange,
  errors = {},
  disabled = false
}) => {
  const isFacilitador = agentType === 'facilitador';

  const updateConfig = (field, value) => {
    onChange({
      ...config,
      [field]: value
    });
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
        <div className="p-1.5 bg-purple-100 rounded-lg">
          <UserCheck className="w-4 h-4 text-purple-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Transferência Automática
          </h3>
          <p className="text-xs text-gray-500">
            Configure quando e como as conversas serão transferidas
          </p>
        </div>
      </div>

      {/* Sector Selection (Required) */}
      <div className="space-y-3">
        <SectorSelector
          value={config.sector_id}
          onChange={(value) => updateConfig('sector_id', value)}
          required={true}
          error={errors.sector_id}
          disabled={disabled}
        />
      </div>

      {/* Exchange Limit (for Facilitador or any agent that wants auto-handoff) */}
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
        <div className="flex items-start gap-2">
          <div className="p-1.5 bg-amber-100 rounded-lg">
            <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-medium text-gray-900">
              {isFacilitador ? 'Interações até Transferência' : 'Transferência Automática por Interações'}
            </h4>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {isFacilitador
                ? 'Quantas interações antes de transferir (obrigatório)'
                : 'Opcionalmente, transfira após um número específico de interações'
              }
            </p>
          </div>
        </div>

        <div className="ml-8">
          <div className="flex items-center gap-3">
            {!isFacilitador && (
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={config.handoff_after_exchanges !== null && config.handoff_after_exchanges !== undefined}
                  onChange={(e) => updateConfig('handoff_after_exchanges', e.target.checked ? 2 : null)}
                  disabled={disabled}
                  className="w-3.5 h-3.5 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                />
                <span className="text-xs text-gray-700">Ativar</span>
              </label>
            )}

            {(isFacilitador || config.handoff_after_exchanges !== null) && (
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-600">Após</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={config.handoff_after_exchanges || 2}
                  onChange={(e) => updateConfig('handoff_after_exchanges', parseInt(e.target.value) || 1)}
                  disabled={disabled}
                  className={`
                    w-14 px-2 py-1 text-xs border rounded-lg text-center
                    focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                    ${errors.handoff_after_exchanges ? 'border-red-300 bg-red-50' : 'border-gray-300'}
                  `}
                />
                <label className="text-xs text-gray-600">interação(ões)</label>
              </div>
            )}
          </div>

          {errors.handoff_after_exchanges && (
            <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.handoff_after_exchanges}
            </p>
          )}

          <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-1.5">
              <Info className="w-3 h-3 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-blue-700">
                Uma interação = mensagem do lead + resposta da IA.
                {isFacilitador
                  ? ' O agente Facilitador é ideal para aquecer leads rapidamente.'
                  : ' Deixe desativado para conversar indefinidamente.'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Transfer Mode (Silent vs Message) */}
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
        <div className="flex items-start gap-2">
          <div className="p-1.5 bg-gray-200 rounded-lg">
            {config.handoff_silent ? (
              <VolumeX className="w-3.5 h-3.5 text-gray-600" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-gray-600" />
            )}
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-medium text-gray-900">Modo de Transferência</h4>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Como o lead será notificado sobre a transferência
            </p>
          </div>
        </div>

        <div className="ml-8 space-y-2">
          {/* Silent option */}
          <label className={`
            flex items-start gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all
            ${config.handoff_silent
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-200 bg-white hover:bg-gray-50'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}>
            <input
              type="radio"
              name="handoff_mode"
              checked={config.handoff_silent === true}
              onChange={() => updateConfig('handoff_silent', true)}
              disabled={disabled}
              className="mt-0.5 w-3.5 h-3.5 text-purple-600 border-gray-300 focus:ring-purple-500"
            />
            <div>
              <div className="text-xs font-medium text-gray-900 flex items-center gap-1.5">
                <VolumeX className="w-3 h-3" />
                Transferência Silenciosa
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                O lead não recebe nenhuma mensagem. A conversa é transferida sem aviso.
              </p>
            </div>
          </label>

          {/* With message option */}
          <label className={`
            flex items-start gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all
            ${config.handoff_silent === false
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-200 bg-white hover:bg-gray-50'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}>
            <input
              type="radio"
              name="handoff_mode"
              checked={config.handoff_silent === false}
              onChange={() => updateConfig('handoff_silent', false)}
              disabled={disabled}
              className="mt-0.5 w-3.5 h-3.5 text-purple-600 border-gray-300 focus:ring-purple-500"
            />
            <div className="flex-1">
              <div className="text-xs font-medium text-gray-900 flex items-center gap-1.5">
                <Volume2 className="w-3 h-3" />
                Com Mensagem de Transição
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">
                O lead recebe uma mensagem informando que está sendo transferido.
              </p>
            </div>
          </label>

          {/* Custom message field */}
          {config.handoff_silent === false && (
            <div className="mt-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Mensagem de Transferência
              </label>
              <textarea
                value={config.handoff_message || ''}
                onChange={(e) => updateConfig('handoff_message', e.target.value)}
                placeholder="Ex: Obrigado pelo interesse! Vou transferir você para um de nossos especialistas."
                disabled={disabled}
                rows={2}
                className={`
                  w-full px-3 py-2 text-xs border rounded-lg resize-none
                  focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                  ${errors.handoff_message ? 'border-red-300 bg-red-50' : 'border-gray-300'}
                `}
              />
              {errors.handoff_message && (
                <p className="mt-1 text-xs text-red-600">{errors.handoff_message}</p>
              )}
              <p className="mt-1 text-[10px] text-gray-500">
                Se deixar em branco, usaremos uma mensagem padrão.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Notification Settings */}
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
        <div className="flex items-start gap-2">
          <div className="p-1.5 bg-blue-100 rounded-lg">
            <Bell className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-medium text-gray-900">Notificações</h4>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Como os atendentes serão notificados sobre novas transferências
            </p>
          </div>
        </div>

        <div className="ml-8">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.notify_on_handoff !== false}
              onChange={(e) => updateConfig('notify_on_handoff', e.target.checked)}
              disabled={disabled}
              className="w-3.5 h-3.5 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
            />
            <div>
              <span className="text-xs font-medium text-gray-900">
                Notificar atendente ao transferir
              </span>
              <p className="text-[10px] text-gray-500">
                O atendente receberá uma notificação quando receber uma conversa
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Rotation User Selection */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-green-100 rounded-lg">
            <UserCheck className="w-3.5 h-3.5 text-green-600" />
          </div>
          <div>
            <h4 className="text-xs font-medium text-gray-900">Rodízio de Atendentes</h4>
            <p className="text-[10px] text-gray-500">
              Selecione e ordene os usuários que participarão do rodízio
            </p>
          </div>
        </div>

        <RodizioUserSelector
          sectorId={config.sector_id}
          selectedUsers={config.assignee_users || []}
          onChange={(users) => updateConfig('assignee_users', users)}
          disabled={disabled}
          error={errors.assignee_users}
        />
      </div>
    </div>
  );
};

export default HandoffConfigSection;
