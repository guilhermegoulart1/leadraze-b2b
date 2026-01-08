import React from 'react';
import { useTranslation } from 'react-i18next';
import { Lightbulb, TrendingUp, Users, Target, BarChart3 } from 'lucide-react';

const InsightsPage = () => {
  const { t } = useTranslation('insights');

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center">
            <Lightbulb className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-sm text-gray-500">{t('subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Coming Soon Message */}
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lightbulb className="w-10 h-10 text-purple-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('comingSoon.title')}</h2>
          <p className="text-gray-600 mb-6">
            {t('comingSoon.description')}
          </p>

          {/* Preview Features */}
          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="p-4 bg-gray-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600 mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-700">{t('features.marketTrends')}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <Users className="w-6 h-6 text-purple-600 mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-700">{t('features.leadProfile')}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <Target className="w-6 h-6 text-purple-600 mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-700">{t('features.aiRecommendations')}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <BarChart3 className="w-6 h-6 text-purple-600 mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-700">{t('features.performance')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsightsPage;
