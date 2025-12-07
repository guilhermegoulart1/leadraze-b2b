import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, MessageSquare } from 'lucide-react';

const AIAgentInteractions = ({ agents = [] }) => {
  const { t, i18n } = useTranslation('dashboard');

  if (agents.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('aiAgents.title')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('aiAgents.subtitle')}</p>
          </div>
          <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-900/30">
            <Bot className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
          {t('aiAgents.noAgents')}
        </div>
      </div>
    );
  }

  const totalMessages = agents.reduce((sum, a) => sum + a.messages_sent, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('aiAgents.title')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('aiAgents.subtitle')}</p>
        </div>
        <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-900/30">
          <Bot className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        </div>
      </div>

      <div className="flex-1 space-y-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <Bot className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block">{agent.name}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{agent.conversations} {t('aiAgents.conversations')}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {agent.messages_sent.toLocaleString(i18n.language)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400">{t('aiAgents.totalMessages')}</span>
        <span className="text-lg font-bold text-violet-600 dark:text-violet-400">
          {totalMessages.toLocaleString(i18n.language)}
        </span>
      </div>
    </div>
  );
};

export default AIAgentInteractions;
