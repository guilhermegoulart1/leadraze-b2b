import React from 'react';
import { Target, HelpCircle, GraduationCap, Smile, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CONVERSATION_STYLES } from './salesRepTemplates';
import ChatMessage from './ChatMessage';

const iconMap = {
  Target,
  HelpCircle,
  GraduationCap,
  Smile
};

const ConversationStyleStep = ({ candidate, selectedStyle, onSelect }) => {
  const { t } = useTranslation('hire');

  return (
    <div className="space-y-4">
      {/* Agent question */}
      <ChatMessage
        type="agent"
        avatar={candidate?.avatar}
        name={candidate?.name}
        color={candidate?.color}
      >
        <p className="font-medium">{t('style.question')}</p>
      </ChatMessage>

      {/* Style Options */}
      <ChatMessage type="options">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CONVERSATION_STYLES.map((style) => {
          const Icon = iconMap[style.icon] || Target;
          const isSelected = selectedStyle === style.id;

          return (
            <button
              key={style.id}
              onClick={() => onSelect(style.id)}
              className={`
                relative text-left p-4 rounded-xl border-2 transition-all h-full
                ${isSelected
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
                }
              `}
            >
              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}

              <div className="flex items-center gap-2 mb-2">
                <div className={`
                  w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                  ${isSelected ? 'bg-purple-100 dark:bg-purple-800' : 'bg-gray-100 dark:bg-gray-700'}
                `}>
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-purple-600' : 'text-gray-500'}`} />
                </div>
                <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
                  {t(`style.styles.${style.id}.name`, { defaultValue: style.name })}
                </h4>
              </div>

              {/* Example message */}
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-2.5 py-2 mb-1.5">
                <p className="text-xs text-gray-700 dark:text-gray-300 italic line-clamp-2">
                  "{t(`style.styles.${style.id}.example`, { defaultValue: style.example })}"
                </p>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                {t(`style.styles.${style.id}.description`, { defaultValue: style.description })}
              </p>
            </button>
          );
        })}
        </div>
      </ChatMessage>
    </div>
  );
};

export default ConversationStyleStep;
