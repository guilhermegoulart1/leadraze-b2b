import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, ChevronDown, ChevronRight, CheckCircle2, Circle,
  Rocket, Settings, FlaskConical, Users, Wrench, Zap
} from 'lucide-react';

const STAGE_ICONS = {
  kickoff: Rocket,
  configuracao: Settings,
  testes: FlaskConical,
  revisao: Users,
  ajustes: Wrench,
  golive: Zap
};

const OnboardingProgress = ({ data, onClose, inline = false }) => {
  const { t, i18n } = useTranslation('onboarding');
  const [expandedStages, setExpandedStages] = useState({});

  const lang = i18n.language?.startsWith('pt') ? 'pt' : i18n.language?.startsWith('es') ? 'es' : 'en';

  const toggleStage = (stageKey) => {
    setExpandedStages(prev => ({ ...prev, [stageKey]: !prev[stageKey] }));
  };

  if (!data) return null;

  const { percentage, stages } = data;

  const content = (
    <div className={inline
      ? 'bg-white dark:bg-gray-800 rounded-2xl shadow-lg w-full overflow-hidden flex flex-col'
      : 'bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col'
    }>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('checklist.clientTitle')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('checklist.clientSubtitle')}
          </p>
        </div>
        {!inline && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('checklist.overallProgress')}
          </span>
          <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
            {percentage}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-purple-600 to-indigo-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Stages */}
      <div className={`flex-1 ${inline ? '' : 'overflow-y-auto'} p-6 space-y-3`}>
        {stages.map(stage => {
          const StageIcon = STAGE_ICONS[stage.key] || Circle;
          const isExpanded = expandedStages[stage.key];
          const isComplete = stage.completedTasks === stage.totalTasks;
          const hasProgress = stage.completedTasks > 0;

          return (
            <div key={stage.key} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              {/* Stage Header */}
              <button
                onClick={() => toggleStage(stage.key)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isComplete
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : hasProgress
                      ? 'bg-purple-100 dark:bg-purple-900/30'
                      : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  <StageIcon className={`w-4 h-4 ${
                    isComplete
                      ? 'text-green-600 dark:text-green-400'
                      : hasProgress
                        ? 'text-purple-600 dark:text-purple-400'
                        : 'text-gray-400 dark:text-gray-500'
                  }`} />
                </div>

                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                      {t('checklist.stage')} {stage.stage}
                    </span>
                    {isComplete && (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {stage[`title_${lang}`]}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {stage.completedTasks}/{stage.totalTasks}
                  </span>
                  <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        isComplete ? 'bg-green-500' : 'bg-purple-500'
                      }`}
                      style={{ width: `${stage.percentage}%` }}
                    />
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Tasks */}
              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2 space-y-1">
                  {stage.tasks.map(task => (
                    <div
                      key={task.key}
                      className="flex items-center gap-3 py-1.5 px-2"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                      )}
                      <span className={`text-sm ${
                        task.completed
                          ? 'text-gray-500 dark:text-gray-400 line-through'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {task[`title_${lang}`]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer - only show in modal mode */}
      {!inline && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {t('checklist.close')}
          </button>
        </div>
      )}
    </div>
  );

  // Inline mode: render directly
  if (inline) return content;

  // Modal mode: wrap in overlay
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      {content}
    </div>
  );
};

export default OnboardingProgress;
