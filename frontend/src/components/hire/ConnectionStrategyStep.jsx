import React, { useState } from 'react';
import { UserPlus, MessageSquarePlus, Hand, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CONNECTION_STRATEGIES } from './salesRepTemplates';
import ChatMessage from './ChatMessage';

const iconMap = {
  UserPlus,
  MessageSquarePlus,
  HandWaving: Hand
};

const ConnectionStrategyStep = ({
  candidate,
  selectedStrategy,
  onSelectStrategy,
  inviteMessage,
  onChangeInviteMessage
}) => {
  const { t } = useTranslation('hire');
  const [showMessageEditor, setShowMessageEditor] = useState(
    selectedStrategy === 'with-intro' || selectedStrategy === 'icebreaker'
  );

  const handleStrategySelect = (strategyId) => {
    onSelectStrategy(strategyId);
    // Show message editor for strategies that use messages
    setShowMessageEditor(strategyId === 'with-intro' || strategyId === 'icebreaker');
  };

  const defaultMessages = {
    'with-intro': `Oi {{first_name}}, tudo bem?

Vi que você trabalha com {{title}} na {{company}}.
Tenho ajudado empresas como a sua a [benefício].

Aceita conectar?`,
    'icebreaker': 'Oi {{first_name}}, tudo bem?'
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
        <p className="font-medium">{t('connection.question')}</p>
      </ChatMessage>

      {/* Strategy Options */}
      <ChatMessage type="options">
        <div className="space-y-2">
        {CONNECTION_STRATEGIES.map((strategy) => {
          const Icon = iconMap[strategy.icon] || UserPlus;
          const isSelected = selectedStrategy === strategy.id;
          const strategyKey = strategy.id === 'icebreaker' ? 'ice-breaker' : strategy.id;

          return (
            <button
              key={strategy.id}
              onClick={() => handleStrategySelect(strategy.id)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left
                ${isSelected
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
                }
              `}
            >
              {/* Icon */}
              <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                ${isSelected ? 'bg-purple-500' : 'bg-gray-100 dark:bg-gray-700'}
              `}>
                <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-500'}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
                  {t(`connection.strategies.${strategyKey}.name`, { defaultValue: strategy.name })}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                  {t(`connection.strategies.${strategyKey}.description`, { defaultValue: strategy.description })}
                </p>
              </div>
            </button>
          );
        })}
        </div>

        {/* Message Editor (expandable) */}
        {(selectedStrategy === 'with-intro' || selectedStrategy === 'icebreaker') && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setShowMessageEditor(!showMessageEditor)}
              className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 font-medium mb-3"
            >
              {showMessageEditor ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showMessageEditor ? t('connection.hideMessage', { defaultValue: 'Ocultar mensagem' }) : t('connection.editMessage', { defaultValue: 'Editar mensagem do convite' })}
            </button>

            {showMessageEditor && (
              <div className="space-y-3 animate-fadeIn">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {t('connection.messageQuestion')}
                </p>

                <textarea
                  value={inviteMessage || defaultMessages[selectedStrategy] || ''}
                  onChange={(e) => onChangeInviteMessage(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                  placeholder={t('connection.messagePlaceholder', { defaultValue: 'Escreva a mensagem do convite...' })}
                />

                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">{t('connection.variables')}</span>
                  {['{{first_name}}', '{{company}}', '{{title}}', '{{location}}'].map((variable) => (
                    <button
                      key={variable}
                      type="button"
                      onClick={() => onChangeInviteMessage((inviteMessage || '') + ` ${variable}`)}
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      {variable}
                    </button>
                  ))}
                </div>

                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {t('connection.charLimit')}
                </p>
              </div>
            )}
          </div>
        )}
      </ChatMessage>
    </div>
  );
};

export default ConnectionStrategyStep;
