import React from 'react';
import { UserPlus, Filter, Calendar, ShoppingCart, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OBJECTIVES } from './salesRepTemplates';

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
  maxMessages,
  onChangeMaxMessages,
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
            {getChannelText('question')}
          </p>
        </div>
      </div>

      {/* Objective Options */}
      <div className="space-y-3 pl-14">
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
                        {getChannelText('name', objective.id) || objective.name}
                      </h4>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {getChannelText('description', objective.id) || objective.description}
                    </p>

                    {objective.idealFor && (
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {t('objective.objectives.' + objective.id + '.idealFor', { defaultValue: '' }) || `Ideal para: ${objective.idealFor}`}
                      </p>
                    )}
                  </div>

                  {isSelected && (
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              </button>

              {/* Extra options for qualify_transfer */}
              {isSelected && objective.id === 'qualify_transfer' && (
                <div className="mt-3 ml-14 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('objective.transferWhen')}
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t('objective.keywords')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('objective.orAfter')}
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          value={maxMessages || 3}
                          onChange={(e) => onChangeMaxMessages(parseInt(e.target.value))}
                          className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                        >
                          {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                            <option key={num} value={num}>{num}</option>
                          ))}
                        </select>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {t('objective.messageExchanges')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Scheduling link for schedule_meeting */}
              {isSelected && objective.id === 'schedule_meeting' && (
                <div className="mt-3 ml-14 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
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
                <div className="mt-3 ml-14 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
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
    </div>
  );
};

export default ObjectiveStep;
