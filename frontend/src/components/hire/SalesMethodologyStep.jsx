import React from 'react';
import {
  Target, Lightbulb, Shield, ClipboardList, TrendingUp,
  Zap, Magnet, Heart, SkipForward, Check
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SALES_METHODOLOGIES } from './salesRepTemplates';
import ChatMessage from './ChatMessage';

const iconMap = {
  Target,
  Lightbulb,
  Shield,
  ClipboardList,
  TrendingUp,
  Zap,
  Magnet,
  Heart
};

const SalesMethodologyStep = ({ candidate, selectedMethodology, onSelect, onSkip }) => {
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
        <p className="font-medium">{t('methodology.question')}</p>
      </ChatMessage>

      {/* Methodology Options */}
      <ChatMessage type="options">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SALES_METHODOLOGIES.map((method) => {
            const Icon = iconMap[method.icon] || Target;
            const isSelected = selectedMethodology === method.id;

            return (
              <button
                key={method.id}
                onClick={() => onSelect(method.id)}
                className={`
                  relative p-4 rounded-xl border-2 text-center transition-all
                  ${isSelected
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 ring-2 ring-purple-500/20'
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

                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2"
                  style={{ backgroundColor: `${method.color}15` }}
                >
                  <Icon
                    className="w-6 h-6"
                    style={{ color: method.color }}
                  />
                </div>

                {/* Name */}
                <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
                  {t(`methodology.methods.${method.id}.name`, { defaultValue: method.name })}
                </h4>

                {/* Short description */}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t(`methodology.methods.${method.id}.description`, { defaultValue: method.shortDescription })}
                </p>
              </button>
            );
          })}
        </div>

        {/* Skip option */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onSkip}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <SkipForward className="w-4 h-4" />
            <span className="text-sm">{t('methodology.skip')}</span>
          </button>
        </div>
      </ChatMessage>
    </div>
  );
};

export default SalesMethodologyStep;
