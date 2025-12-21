import React from 'react';
import { ArrowRightLeft, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TRANSFER_TRIGGERS } from './salesRepTemplates';
import ChatMessage from './ChatMessage';

const TransferTriggersStep = ({
  candidate,
  transferTriggers = [],
  onChangeTransferTriggers
}) => {
  const { t } = useTranslation('hire');

  const toggleTrigger = (triggerId) => {
    const current = transferTriggers || [];
    if (current.includes(triggerId)) {
      onChangeTransferTriggers(current.filter(t => t !== triggerId));
    } else {
      onChangeTransferTriggers([...current, triggerId]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Agent question */}
      <ChatMessage
        type="agent"
        avatar={candidate?.avatar}
        name={candidate?.name}
        color={candidate?.color}
      >
        <p className="font-medium">
          {t('transfer.question', { defaultValue: 'Em quais situações você quer que eu transfira a conversa para um humano?' })}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('transfer.hint', { defaultValue: 'Vou monitorar a conversa e transferir automaticamente quando detectar estas situações.' })}
        </p>
      </ChatMessage>

      {/* Transfer Trigger Options */}
      <ChatMessage type="options">
        <div className="space-y-2">
          {TRANSFER_TRIGGERS.map((trigger) => {
            const isSelected = transferTriggers?.includes(trigger.id) || false;

            return (
              <button
                key={trigger.id}
                onClick={() => toggleTrigger(trigger.id)}
                className={`
                  w-full text-left p-4 rounded-xl border-2 transition-all
                  ${isSelected
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div className={`
                    w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5
                    ${isSelected
                      ? 'bg-purple-500 border-purple-500'
                      : 'border-gray-300 dark:border-gray-600'
                    }
                  `}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
                      {trigger.label}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {trigger.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected count indicator */}
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4" />
            {transferTriggers.length === 0
              ? t('transfer.noneSelected', { defaultValue: 'Nenhum gatilho selecionado - o agente não transferirá automaticamente' })
              : t('transfer.selectedCount', {
                  count: transferTriggers.length,
                  defaultValue: `${transferTriggers.length} gatilho(s) de transferência selecionado(s)`
                })
            }
          </p>
        </div>
      </ChatMessage>
    </div>
  );
};

export default TransferTriggersStep;
