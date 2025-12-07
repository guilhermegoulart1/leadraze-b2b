import React from 'react';
import { useTranslation } from 'react-i18next';
import { Share2 } from 'lucide-react';

const LeadsBySourceChart = ({ data = [] }) => {
  const { t, i18n } = useTranslation('dashboard');

  const sourceColors = {
    'linkedin': '#0077b5',
    'google_maps': '#34a853',
    'list': '#7c3aed',
    'paid_traffic': '#f59e0b',
    'other': '#6b7280'
  };

  const sourceIcons = {
    'linkedin': 'in',
    'google_maps': 'G',
    'list': 'L',
    'paid_traffic': '$',
    'other': '?'
  };

  const maxCount = Math.max(...data.map(d => d.count), 1);

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('leadsBySource.title')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('leadsBySource.subtitle')}</p>
          </div>
          <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <Share2 className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>
        </div>
        <div className="h-48 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
          {t('noData')}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('leadsBySource.title')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('leadsBySource.subtitle')}</p>
        </div>
        <div className="p-2 rounded-lg bg-blue-50">
          <Share2 className="w-5 h-5 text-blue-600" />
        </div>
      </div>

      <div className="space-y-4">
        {data.map((item, index) => {
          const color = sourceColors[item.source] || sourceColors.other;
          const barWidth = (item.count / maxCount) * 100;

          return (
            <div key={item.source || index}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: color }}
                  >
                    {sourceIcons[item.source] || '?'}
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.count}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{item.percentage}%</span>
                </div>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: color
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">{t('leadsBySource.totalLeads')}</span>
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {data.reduce((sum, d) => sum + d.count, 0).toLocaleString(i18n.language)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default LeadsBySourceChart;
