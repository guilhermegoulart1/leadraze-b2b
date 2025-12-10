import React from 'react';
import { Package, Target, MessageSquare, BookOpen, Check, Edit2, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SALES_METHODOLOGIES, CONVERSATION_STYLES, OBJECTIVES, CONNECTION_STRATEGIES } from './salesRepTemplates';

const ContractSummary = ({
  candidate,
  formData,
  onEdit,
  onEditProduct,
  onEditTarget,
  onEditStyle,
  onEditMethodology,
  onEditObjective,
  onEditConnection,
  onConfirm,
  isLoading
}) => {
  const { t } = useTranslation('hire');

  // Get display names
  const methodology = SALES_METHODOLOGIES.find(m => m.id === formData.methodology);
  const style = CONVERSATION_STYLES.find(s => s.id === formData.conversationStyle);
  const objective = OBJECTIVES.find(o => o.id === formData.objective);
  const connectionStrategy = CONNECTION_STRATEGIES.find(c => c.id === formData.connectionStrategy);

  // Build product display value
  const getProductDisplay = () => {
    const product = formData.productService;
    if (!product) return '-';

    // Support both old string format and new object format
    if (typeof product === 'string') {
      return product.slice(0, 100) + (product.length > 100 ? '...' : '');
    }

    const parts = [];
    if (product.categories?.length > 0) {
      const categoryLabels = product.categories.map(key =>
        t(`product.categories.${key}`, { defaultValue: key })
      );
      parts.push(categoryLabels.join(', '));
    }
    if (product.description) {
      const desc = product.description.slice(0, 80) + (product.description.length > 80 ? '...' : '');
      parts.push(desc);
    }
    return parts.join(' - ') || '-';
  };

  const summaryItems = [
    {
      icon: Package,
      label: t('summary.product'),
      value: getProductDisplay(),
      onEdit: onEditProduct
    },
    {
      icon: Target,
      label: t('summary.audience'),
      value: [
        formData.targetAudience?.roles?.length > 0
          ? formData.targetAudience.roles.map(r => {
              return t(`target.roles.${r}`, { defaultValue: r });
            }).join(', ')
          : null,
        formData.targetAudience?.companySizes?.length > 0
          ? `${formData.targetAudience.companySizes.join(', ')} ${t('summary.employees')}`
          : null,
        formData.targetAudience?.industry
      ].filter(Boolean).join(' | ') || '-',
      onEdit: onEditTarget
    },
    {
      icon: MessageSquare,
      label: t('summary.style'),
      value: t(`style.styles.${formData.conversationStyle}.name`, { defaultValue: style?.name || '-' }),
      extra: style?.description,
      onEdit: onEditStyle
    },
    {
      icon: BookOpen,
      label: t('summary.methodology'),
      value: methodology ? t(`methodology.methods.${formData.methodology}.name`, { defaultValue: methodology?.name }) : t('summary.noMethodology'),
      extra: methodology?.shortDescription,
      onEdit: onEditMethodology
    }
  ];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {t('summary.title')}
        </h2>
      </div>

      {/* Summary Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Candidate Header */}
        <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-offset-2"
              style={{ ringColor: candidate?.color || '#3B82F6' }}
            >
              {candidate?.avatar ? (
                <img
                  src={candidate.avatar}
                  alt={candidate?.name || ''}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center text-2xl font-bold text-white" style="background-color: ${candidate?.color || '#3B82F6'}">${candidate?.name?.[0] || '?'}</div>`;
                  }}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-2xl font-bold text-white"
                  style={{ backgroundColor: candidate?.color || '#3B82F6' }}
                >
                  {candidate?.name?.[0] || '?'}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {formData.agentName || candidate?.name || t('summary.salesRep')}
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {candidate?.title || t('summary.salesRep')}
              </p>
            </div>
          </div>
        </div>

        {/* Summary Items */}
        <div className="p-6 space-y-4">
          {summaryItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className={`flex items-start gap-3 group ${item.onEdit ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-3 px-3 py-2 rounded-lg transition-colors' : ''}`}
                onClick={item.onEdit}
              >
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    {item.label}
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white font-medium">
                    {item.value}
                  </p>
                  {item.extra && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {item.extra}
                    </p>
                  )}
                </div>
                {item.onEdit && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Edit2 className="w-4 h-4 text-gray-400" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Connection Strategy (if LinkedIn) */}
          {formData.channel === 'linkedin' && connectionStrategy && (
            <div
              className={`flex items-start gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 group ${onEditConnection ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-3 px-3 py-2 rounded-lg transition-colors' : ''}`}
              onClick={onEditConnection}
            >
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {t('summary.channel')}
                </p>
                <p className="text-sm text-gray-900 dark:text-white font-medium">
                  {t(`connection.strategies.${formData.connectionStrategy}.name`, { defaultValue: connectionStrategy.name })}
                </p>
              </div>
              {onEditConnection && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Edit2 className="w-4 h-4 text-gray-400" />
                </div>
              )}
            </div>
          )}

          {/* Objective */}
          {objective && (
            <div
              className={`flex items-start gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 group ${onEditObjective ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-3 px-3 py-2 rounded-lg transition-colors' : ''}`}
              onClick={onEditObjective}
            >
              <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {t('summary.objective')}
                </p>
                <p className="text-sm text-gray-900 dark:text-white font-medium">
                  {t(`objective.objectives.${formData.objective}.name`, { defaultValue: objective.name })}
                </p>
              </div>
              {onEditObjective && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Edit2 className="w-4 h-4 text-gray-400" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4">
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            <span>{t('summary.edit')}</span>
          </button>

          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('wizard.hiring')}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{t('summary.hire', { name: candidate?.name || t('summary.salesRep') })}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Candidate message */}
      <div className="flex items-start gap-3">
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
          <p className="text-gray-800 dark:text-gray-200">
            "{t('summary.readyMessage')}"
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContractSummary;
