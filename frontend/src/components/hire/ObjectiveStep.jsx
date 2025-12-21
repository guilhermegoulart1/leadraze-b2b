import React from 'react';
import { UserPlus, Filter, Calendar, ShoppingCart, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OBJECTIVES } from './salesRepTemplates';
import ChatMessage from './ChatMessage';

const iconMap = {
  UserPlus,
  Filter,
  Calendar,
  ShoppingCart
};

const ObjectiveStep = ({
  candidate,
  channel,
  selectedObjective,
  onSelect,
  schedulingLink,
  onChangeSchedulingLink,
  conversionLink,
  onChangeConversionLink
}) => {
  const { t } = useTranslation('hire');
  const selectedObj = OBJECTIVES.find(o => o.id === selectedObjective);

  // Helper to get channel-contextualized text
  const getChannelText = (baseKey, objectiveId = null) => {
    const fullKey = objectiveId
      ? `objective.objectives.${objectiveId}.${baseKey}`
      : `objective.${baseKey}`;

    // Try channel-specific first
    const channelKey = `${fullKey}.${channel}`;
    const channelText = t(channelKey, { defaultValue: '' });

    if (channelText && channelText !== channelKey) {
      return channelText;
    }

    // Fallback to linkedin (default) or generic
    const linkedinKey = `${fullKey}.linkedin`;
    const linkedinText = t(linkedinKey, { defaultValue: '' });

    if (linkedinText && linkedinText !== linkedinKey) {
      return linkedinText;
    }

    // Final fallback to generic key
    return t(fullKey, { defaultValue: '' });
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
        <p className="font-medium">{getChannelText('question')}</p>
      </ChatMessage>

      {/* Objective Options */}
      <ChatMessage type="options">
        <div className="space-y-2">
        {OBJECTIVES.map((objective) => {
          const Icon = iconMap[objective.icon] || UserPlus;
          const isSelected = selectedObjective === objective.id;

          return (
            <div key={objective.id}>
              <button
                onClick={() => onSelect(objective.id)}
                className={`
                  w-full text-left p-4 rounded-xl border-2 transition-all
                  ${isSelected
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
                  }
                `}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`
                    w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                    ${isSelected ? 'bg-purple-100 dark:bg-purple-800' : 'bg-gray-100 dark:bg-gray-700'}
                  `}>
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-purple-600' : 'text-gray-500'}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-0.5">
                      {getChannelText('name', objective.id) || objective.name}
                    </h4>

                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      {getChannelText('description', objective.id) || objective.description}
                    </p>

                    {objective.idealFor && (
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {t('objective.objectives.' + objective.id + '.idealFor', { defaultValue: '' }) || `Ideal para: ${objective.idealFor}`}
                      </p>
                    )}
                  </div>

                  {isSelected && (
                    <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              </button>

              {/* Scheduling link for schedule_meeting */}
              {isSelected && objective.id === 'schedule_meeting' && (
                <div className="mt-2 ml-10 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('objective.schedulingLink')}
                  </label>
                  <input
                    type="url"
                    value={schedulingLink || ''}
                    onChange={(e) => onChangeSchedulingLink(e.target.value)}
                    placeholder={t('objective.objectives.schedule_meeting.linkPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              )}

              {/* Conversion link for sell_direct */}
              {isSelected && objective.id === 'sell_direct' && (
                <div className="mt-2 ml-10 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('objective.conversionLink')}
                  </label>
                  <input
                    type="url"
                    value={conversionLink || ''}
                    onChange={(e) => onChangeConversionLink(e.target.value)}
                    placeholder={t('objective.objectives.sell_direct.linkPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              )}
            </div>
          );
        })}
        </div>
      </ChatMessage>
    </div>
  );
};

export default ObjectiveStep;
