import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Settings, ArrowRight, PartyPopper } from 'lucide-react';

const PostHireDialog = ({
  isOpen,
  onClose,
  onAddRules,
  onSkip,
  agentName = 'Vendedor',
  agentColor = '#3B82F6',
  agentAvatar = null
}) => {
  const { t } = useTranslation('hire');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Success Header */}
        <div
          className="p-8 text-center"
          style={{
            background: `linear-gradient(135deg, ${agentColor}20, ${agentColor}10)`
          }}
        >
          <div className="relative inline-block mb-4">
            {/* Agent Avatar */}
            <div
              className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-white dark:ring-gray-900 shadow-lg mx-auto"
              style={{ backgroundColor: agentColor }}
            >
              {agentAvatar ? (
                <img
                  src={agentAvatar}
                  alt={agentName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center text-3xl font-bold text-white">${agentName[0]}</div>`;
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-white">
                  {agentName[0]}
                </div>
              )}
            </div>
            {/* Success Badge */}
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mb-2">
            <PartyPopper className="w-5 h-5 text-yellow-500" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('postHire.title')}
            </h2>
            <PartyPopper className="w-5 h-5 text-yellow-500 transform scale-x-[-1]" />
          </div>

          <p className="text-gray-600 dark:text-gray-400">
            {t('postHire.subtitle', { name: agentName })}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Settings className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {t('postHire.rulesQuestion')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {t('postHire.rulesDescription')}
                </p>
              </div>
            </div>
          </div>

          {/* Examples preview */}
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">{t('postHire.examples')}</span>
            <ul className="mt-1 space-y-1 ml-4">
              <li className="flex items-center gap-1">
                <span className="text-red-500 font-bold">NUNCA</span>
                <span>{t('postHire.exampleNever')}</span>
              </li>
              <li className="flex items-center gap-1">
                <span className="text-green-500 font-bold">SEMPRE</span>
                <span>{t('postHire.exampleAlways')}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 space-y-3">
          <button
            onClick={onAddRules}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
          >
            <Settings className="w-4 h-4" />
            {t('postHire.addRules')}
          </button>

          <button
            onClick={onSkip}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium rounded-xl transition-colors"
          >
            {t('postHire.skip')}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostHireDialog;
