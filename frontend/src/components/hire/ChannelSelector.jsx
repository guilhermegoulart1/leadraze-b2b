import React from 'react';
import { Linkedin, MessageCircle, Mail, Check, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CHANNELS } from './salesRepTemplates';
import ChatMessage from './ChatMessage';

const iconMap = {
  Linkedin,
  MessageCircle,
  Mail
};

const ChannelSelector = ({ selectedCandidate, selectedChannel, onSelect }) => {
  const { t } = useTranslation('hire');

  return (
    <div className="space-y-4">
      {/* Agent question */}
      <ChatMessage
        type="agent"
        avatar={selectedCandidate?.avatar}
        name={selectedCandidate?.name}
        color={selectedCandidate?.color}
      >
        <p className="font-medium">{t('channel.question')}</p>
      </ChatMessage>

      {/* Channel options */}
      <ChatMessage type="options">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CHANNELS.map((channel) => {
            const Icon = iconMap[channel.icon];
            const isSelected = selectedChannel === channel.id;
            const isDisabled = channel.id === 'email';

            return (
              <button
                key={channel.id}
                disabled={isDisabled}
                onClick={() => !isDisabled && onSelect(channel.id)}
                className={`
                  relative p-4 rounded-xl border-2 text-center transition-all
                  ${isDisabled
                    ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                    : isSelected
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
                  }
                `}
              >
                {/* Coming soon badge */}
                {isDisabled && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-medium rounded-full">
                    {t('channel.comingSoon')}
                  </div>
                )}

                {/* Selected indicator */}
                {isSelected && !isDisabled && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}

                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2"
                  style={{ backgroundColor: `${channel.color}15` }}
                >
                  <Icon
                    className="w-6 h-6"
                    style={{ color: channel.color }}
                  />
                </div>

                {/* Name */}
                <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-0.5">
                  {t(`channel.channels.${channel.id}.name`, { defaultValue: channel.name })}
                </h3>

                {/* Description */}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t(`channel.channels.${channel.id}.description`, { defaultValue: channel.description })}
                </p>
              </button>
            );
          })}
        </div>

        {/* Info message */}
        <div className="flex items-start gap-2 p-3 mt-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
          <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-purple-700 dark:text-purple-300">
            {t('channel.info')}
          </p>
        </div>
      </ChatMessage>
    </div>
  );
};

export default ChannelSelector;
