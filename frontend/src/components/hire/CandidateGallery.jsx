import React from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SALES_REP_TEMPLATES } from './salesRepTemplates';

const CandidateGallery = ({ selectedCandidate, onSelect }) => {
  const { t } = useTranslation('hire');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
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
                relative text-left p-4 rounded-xl border-2 transition-all
                ${isSelected
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 ring-2 ring-purple-500/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 bg-white dark:bg-gray-800'
                }
              `}
            >
              {/* Selected Indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
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

            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CandidateGallery;
