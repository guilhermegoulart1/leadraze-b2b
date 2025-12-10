import React from 'react';
import {
  Target, Lightbulb, Shield, ClipboardList, TrendingUp,
  Zap, Magnet, Heart, SkipForward, Check
} from 'lucide-react';
import { SALES_METHODOLOGIES } from './salesRepTemplates';

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
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
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
            Quer que eu siga alguma técnica de vendas específica?
          </p>
        </div>
      </div>

      {/* Methodology Grid */}
      <div className="pl-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 bg-white dark:bg-gray-800'
                  }
                `}
              >
                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
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
                  {method.name}
                </h4>

                {/* Short description */}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {method.shortDescription}
                </p>
              </button>
            );
          })}
        </div>

        {/* Skip option */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onSkip}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <SkipForward className="w-4 h-4" />
            <span className="text-sm">Pular essa etapa - deixar o vendedor livre</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesMethodologyStep;
