import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, X,
  Linkedin, Award, Search, Bot, MessageCircle, Rocket
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOnboarding } from '../contexts/OnboardingContext';

const iconMap = {
  Linkedin: Linkedin,
  Award: Award,
  Search: Search,
  Bot: Bot,
  MessageCircle: MessageCircle,
};

const OnboardingChecklist = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('onboarding');
  const {
    steps,
    isStepCompleted,
    completeStep,
    isMinimized,
    toggleMinimize,
    isDismissed,
    dismissOnboarding,
    isOnboardingComplete,
    progress,
    completedSteps,
  } = useOnboarding();

  // Nao mostrar se foi dispensado ou se ja completou tudo
  if (isDismissed) return null;

  // Versao minimizada
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={toggleMinimize}
          className="flex items-center gap-3 bg-white border border-gray-200 rounded-full py-3 px-5 shadow-lg hover:shadow-xl transition-all group"
        >
          <div className="relative w-8 h-8">
            <svg className="w-8 h-8 -rotate-90">
              <circle
                cx="16"
                cy="16"
                r="14"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="3"
              />
              <circle
                cx="16"
                cy="16"
                r="14"
                fill="none"
                stroke="#7c3aed"
                strokeWidth="3"
                strokeDasharray={`${progress * 0.88} 88`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-purple-600">
              {completedSteps.length}/{steps.length}
            </span>
          </div>
          <span className="text-sm font-medium text-gray-700 group-hover:text-purple-600 transition-colors">
            {t('title')}
          </span>
          <ChevronUp className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80">
      <div className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-white" />
              <h3 className="text-sm font-semibold text-white">{t('title')}</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleMinimize}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                title={t('minimize')}
              >
                <ChevronDown className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={dismissOnboarding}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                title={t('dismiss')}
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-purple-200 mb-1">
              <span>{t('progress')}</span>
              <span>{completedSteps.length}/{steps.length}</span>
            </div>
            <div className="h-1.5 bg-purple-800/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Steps List */}
        <div className="p-3 max-h-80 overflow-y-auto">
          {isOnboardingComplete ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                {t('complete.title')}
              </h4>
              <p className="text-xs text-gray-500">
                {t('complete.description')}
              </p>
              <button
                onClick={dismissOnboarding}
                className="mt-3 text-xs text-purple-600 hover:text-purple-700 font-medium"
              >
                {t('complete.closeButton')}
              </button>
            </div>
          ) : (
            <ul className="space-y-1">
              {steps.map((step, index) => {
                const completed = isStepCompleted(step.id);
                const Icon = iconMap[step.icon] || Circle;

                return (
                  <li key={step.id}>
                    <button
                      onClick={() => {
                        navigate(step.path);
                        // Auto-complete quando o usuario navega para a pagina
                        // (pode ser refinado para verificar acoes especificas)
                      }}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
                        transition-all group
                        ${completed
                          ? 'bg-gray-50'
                          : 'hover:bg-purple-50 hover:border-purple-200 border border-transparent'
                        }
                      `}
                    >
                      {/* Checkbox/Icon */}
                      <div className={`
                        flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
                        transition-colors
                        ${completed
                          ? 'bg-green-100'
                          : 'bg-purple-100 group-hover:bg-purple-200'
                        }
                      `}>
                        {completed ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <Icon className="w-4 h-4 text-purple-600" />
                        )}
                      </div>

                      {/* Step Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`
                          text-sm font-medium transition-all
                          ${completed
                            ? 'text-gray-400 line-through'
                            : 'text-gray-700 group-hover:text-purple-600'
                          }
                        `}>
                          {t(`steps.${step.id}.title`)}
                        </p>
                        {!completed && (
                          <p className="text-xs text-gray-400 truncate">
                            {t(`steps.${step.id}.description`)}
                          </p>
                        )}
                      </div>

                      {/* Step Number */}
                      <span className={`
                        text-xs font-medium
                        ${completed ? 'text-gray-300' : 'text-gray-400'}
                      `}>
                        {index + 1}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        {!isOnboardingComplete && (
          <div className="px-4 py-2.5 bg-purple-50 border-t border-purple-100">
            <div className="flex items-center justify-between">
              <p className="text-xs text-purple-600">
                <span className="font-medium">{t('tip.label')}</span>{' '}
                {t('tip.text')}
              </p>
              <button
                onClick={dismissOnboarding}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap ml-2"
              >
                {t('dismissAll')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingChecklist;
