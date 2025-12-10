import React, { useState } from 'react';
import { UserPlus, MessageSquarePlus, Hand, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { CONNECTION_STRATEGIES } from './salesRepTemplates';

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
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Chat from candidate */}
      <div className="flex items-start gap-3 mb-6">
        <div
          className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-offset-2 dark:ring-offset-gray-900"
          style={{ ringColor: candidate?.color || '#3B82F6' }}
        >
          {candidate?.avatar ? (
            <img
              src={candidate.avatar}
              alt={candidate?.name || ''}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center text-sm font-bold text-white" style="background-color: ${candidate?.color || '#3B82F6'}">${candidate?.name?.[0] || '?'}</div>`;
              }}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: candidate?.color || '#3B82F6' }}
            >
              {candidate?.name?.[0] || '?'}
            </div>
          )}
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl rounded-tl-none p-4 border border-blue-100 dark:border-blue-800 max-w-lg">
          <p className="text-gray-800 dark:text-gray-200 font-medium">
            Agora preciso saber: como você quer que eu faça o primeiro contato?
          </p>
        </div>
      </div>

      {/* Strategy Options */}
      <div className="space-y-3 pl-14">
        {CONNECTION_STRATEGIES.map((strategy) => {
          const Icon = iconMap[strategy.icon] || UserPlus;
          const isSelected = selectedStrategy === strategy.id;

          return (
            <button
              key={strategy.id}
              onClick={() => handleStrategySelect(strategy.id)}
              className={`
                w-full text-left p-4 rounded-xl border-2 transition-all
                ${isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 bg-white dark:bg-gray-800'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <div className={`
                  w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                  ${isSelected ? 'bg-blue-100 dark:bg-blue-800' : 'bg-gray-100 dark:bg-gray-700'}
                `}>
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`
                      w-4 h-4 rounded-full border-2 flex items-center justify-center
                      ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-500'}
                    `}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {strategy.name}
                    </h4>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {strategy.description}
                  </p>

                  <div className="flex flex-col gap-1">
                    {strategy.pros.map((pro, idx) => (
                      <span key={idx} className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        {pro}
                      </span>
                    ))}
                  </div>
                </div>

                {isSelected && (
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Message Editor (expandable) */}
      {(selectedStrategy === 'with-intro' || selectedStrategy === 'icebreaker') && (
        <div className="pl-14 mt-4">
          <button
            type="button"
            onClick={() => setShowMessageEditor(!showMessageEditor)}
            className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium mb-3"
          >
            {showMessageEditor ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showMessageEditor ? 'Ocultar mensagem' : 'Editar mensagem do convite'}
          </button>

          {showMessageEditor && (
            <div className="space-y-3 animate-fadeIn">
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-offset-1"
                  style={{ ringColor: candidate?.color || '#3B82F6' }}
                >
                  {candidate?.avatar ? (
                    <img
                      src={candidate.avatar}
                      alt={candidate?.name || ''}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center text-xs font-bold text-white" style="background-color: ${candidate?.color || '#3B82F6'}">${candidate?.name?.[0] || '?'}</div>`;
                      }}
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: candidate?.color || '#3B82F6' }}
                    >
                      {candidate?.name?.[0] || '?'}
                    </div>
                  )}
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 rounded-xl rounded-tl-none p-3 text-sm text-gray-700 dark:text-gray-300">
                  O que você quer que eu diga no convite de conexão?
                </div>
              </div>

              <textarea
                value={inviteMessage || defaultMessages[selectedStrategy] || ''}
                onChange={(e) => onChangeInviteMessage(e.target.value)}
                rows={5}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                placeholder="Escreva a mensagem do convite..."
              />

              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">Variáveis:</span>
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
                ⚠️ Limite: 300 caracteres (LinkedIn)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConnectionStrategyStep;
