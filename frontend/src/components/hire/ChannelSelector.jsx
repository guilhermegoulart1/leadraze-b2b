import React from 'react';
import { Linkedin, MessageCircle, Mail, Check, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CHANNELS } from './salesRepTemplates';

const iconMap = {
  Linkedin,
  MessageCircle,
  Mail
};

const ChannelSelector = ({ selectedCandidate, selectedChannel, onSelect, customAvatar, agentName }) => {
  const { t } = useTranslation('hire');

  // Use custom values if provided, fallback to candidate values
  const displayName = agentName || selectedCandidate?.name || '';
  const displayAvatar = customAvatar || selectedCandidate?.avatar;

  return (
    <div className="space-y-6">
      {/* Chat bubble from candidate */}
      <div className="max-w-md mx-auto">
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl rounded-tl-none p-4 border border-purple-100 dark:border-purple-800">
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-offset-1"
              style={{ ringColor: selectedCandidate?.color || '#6366F1' }}
            >
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center text-sm font-bold text-white" style="background-color: ${selectedCandidate?.color || '#6366F1'}">${displayName?.[0] || '?'}</div>`;
                  }}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: selectedCandidate?.color || '#6366F1' }}
                >
                  {displayName?.[0] || '?'}
                </div>
              )}
            </div>
            <div>
              <p className="text-gray-800 dark:text-gray-200 font-medium">
                {t('channel.question')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Channel options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
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
                relative p-5 rounded-xl border-2 text-center transition-all
                ${isDisabled
                  ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                  : isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 bg-white dark:bg-gray-800'
                }
              `}
            >
              {/* Coming soon badge */}
              {isDisabled && (
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-full">
                  {t('channel.comingSoon')}
                </div>
              )}

              {/* Selected indicator */}
              {isSelected && !isDisabled && (
                <div className="absolute top-3 right-3 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}

              {/* Icon */}
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: `${channel.color}15` }}
              >
                <Icon
                  className="w-7 h-7"
                  style={{ color: channel.color }}
                />
              </div>

              {/* Name */}
              <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                {t(`channel.channels.${channel.id}.name`, { defaultValue: channel.name })}
              </h3>

              {/* Description */}
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t(`channel.channels.${channel.id}.description`, { defaultValue: channel.description })}
              </p>
            </button>
          );
        })}
      </div>

      {/* Info message */}
      <div className="max-w-xl mx-auto">
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            {t('channel.info')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChannelSelector;
