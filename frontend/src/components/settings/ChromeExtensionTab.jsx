import React from 'react';
import { useTranslation } from 'react-i18next';
import { Chrome, Download, Key, ExternalLink, Linkedin, Instagram, Users } from 'lucide-react';

const CHROME_WEB_STORE_URL = 'https://chromewebstore.google.com/detail/getraze/EXTENSION_ID_HERE';

const ChromeExtensionTab = () => {
  const { t } = useTranslation('settings');

  const steps = [
    {
      icon: Download,
      title: t('chromeExtension.step1Title'),
      description: t('chromeExtension.step1Description'),
    },
    {
      icon: Key,
      title: t('chromeExtension.step2Title'),
      description: t('chromeExtension.step2Description'),
    },
    {
      icon: Users,
      title: t('chromeExtension.step3Title'),
      description: t('chromeExtension.step3Description'),
    },
  ];

  const features = [
    { icon: Linkedin, text: t('chromeExtension.features.linkedin') },
    { icon: Instagram, text: t('chromeExtension.features.instagram') },
    { icon: Users, text: t('chromeExtension.features.campaigns') },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center">
          <Chrome className="w-7 h-7 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('chromeExtension.title')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('chromeExtension.description')}
          </p>
        </div>
      </div>

      {/* Install button */}
      <a
        href={CHROME_WEB_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity mb-8"
      >
        <Chrome className="w-5 h-5" />
        {t('chromeExtension.installButton')}
        <ExternalLink className="w-4 h-4" />
      </a>

      {/* Setup steps */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
          {t('chromeExtension.howToUse')}
        </h3>
        <div className="space-y-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{index + 1}</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{step.title}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Features */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
          {t('chromeExtension.featuresTitle')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <Icon className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{feature.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ChromeExtensionTab;
