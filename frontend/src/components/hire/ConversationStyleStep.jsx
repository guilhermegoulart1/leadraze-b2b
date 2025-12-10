import React from 'react';
import { Target, HelpCircle, GraduationCap, Smile, Check } from 'lucide-react';
import { CONVERSATION_STYLES } from './salesRepTemplates';

const iconMap = {
  Target,
  HelpCircle,
  GraduationCap,
  Smile
};

const ConversationStyleStep = ({ candidate, selectedStyle, onSelect }) => {
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
            Qual estilo de conversa você quer que eu use?
          </p>
        </div>
      </div>

      {/* Style Options */}
      <div className="space-y-3 pl-14">
        {CONVERSATION_STYLES.map((style) => {
          const Icon = iconMap[style.icon] || Target;
          const isSelected = selectedStyle === style.id;

          return (
            <button
              key={style.id}
              onClick={() => onSelect(style.id)}
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
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`
                      w-4 h-4 rounded-full border-2 flex items-center justify-center
                      ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-500'}
                    `}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {style.name}
                    </h4>
                  </div>

                  {/* Example message */}
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 mb-2">
                    <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                      "{style.example}"
                    </p>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {style.description}
                  </p>
                </div>

                {isSelected && (
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ConversationStyleStep;
