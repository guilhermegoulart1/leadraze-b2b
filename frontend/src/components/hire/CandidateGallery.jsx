import React from 'react';
import { Plus, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SALES_REP_TEMPLATES } from './salesRepTemplates';

const CandidateGallery = ({ selectedCandidate, onSelect, onCreateFromScratch }) => {
  const { t } = useTranslation('hire');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('candidates.title')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {t('candidates.subtitle')}
        </p>
      </div>

      {/* Candidates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SALES_REP_TEMPLATES.map((candidate) => {
          const isSelected = selectedCandidate?.id === candidate.id;
          const templateKey = candidate.id;

          return (
            <button
              key={candidate.id}
              onClick={() => onSelect(candidate)}
              className={`
                relative text-left p-5 rounded-xl border-2 transition-all
                ${isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-gray-800'
                }
              `}
            >
              {/* Selected Indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}

              {/* Avatar */}
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-offset-2 dark:ring-offset-gray-800"
                  style={{ ringColor: candidate.color }}
                >
                  <img
                    src={candidate.avatar}
                    alt={candidate.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center text-2xl font-bold text-white" style="background-color: ${candidate.color}">${candidate.name[0]}</div>`;
                    }}
                  />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                    {t(`candidates.templates.${templateKey}.name`, { defaultValue: candidate.name })}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t(`candidates.templates.${templateKey}.role`, { defaultValue: candidate.title })}
                  </p>
                </div>
              </div>

              {/* Quote */}
              <p className="text-sm text-gray-700 dark:text-gray-300 italic mb-3">
                "{t(`candidates.templates.${templateKey}.quote`, { defaultValue: candidate.quote })}"
              </p>

              {/* Ideal For */}
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium">{t('candidates.idealFor')}</span>{' '}
                {t(`candidates.templates.${templateKey}.idealFor`, { defaultValue: candidate.idealFor })}
              </div>

              {/* Traits */}
              <div className="flex flex-wrap gap-1 mt-3">
                {candidate.traits.map((trait) => (
                  <span
                    key={trait}
                    className="px-2 py-0.5 text-xs rounded-full"
                    style={{
                      backgroundColor: `${candidate.color}20`,
                      color: candidate.color
                    }}
                  >
                    {trait}
                  </span>
                ))}
              </div>

              {/* CTA */}
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <span
                  className={`
                    text-sm font-medium
                    ${isSelected ? 'text-blue-600' : 'text-gray-600 dark:text-gray-400'}
                  `}
                >
                  {isSelected ? '✓' : ''} {isSelected ? t('candidates.hire') : t('candidates.hire')}
                </span>
              </div>
            </button>
          );
        })}

        {/* Create from Scratch */}
        <button
          onClick={onCreateFromScratch}
          className="
            relative text-left p-5 rounded-xl border-2 border-dashed
            border-gray-300 dark:border-gray-600
            hover:border-blue-400 dark:hover:border-blue-500
            bg-gray-50 dark:bg-gray-800/50
            transition-all group
          "
        >
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-4 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
              <Plus className="w-8 h-8 text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div>
            <h3 className="font-bold text-lg text-gray-700 dark:text-gray-300 mb-2">
              {t('candidates.createFromScratch')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('candidates.createDescription')}
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default CandidateGallery;
