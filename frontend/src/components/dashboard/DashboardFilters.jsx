import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Calendar } from 'lucide-react';

const DashboardFilters = ({
  period,
  onPeriodChange,
  campaigns = [],
  selectedCampaign,
  onCampaignChange,
  onRefresh,
  loading = false
}) => {
  const { t } = useTranslation('dashboard');
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const periods = [
    { value: 7, labelKey: 'filters.days7' },
    { value: 30, labelKey: 'filters.days30' },
    { value: 90, labelKey: 'filters.days90' },
    { value: 'custom', labelKey: 'filters.custom' }
  ];

  const handlePeriodClick = (value) => {
    if (value === 'custom') {
      setShowCustomDates(!showCustomDates);
    } else {
      setShowCustomDates(false);
      onPeriodChange(value);
    }
  };

  const handleApplyCustomDates = () => {
    if (customStartDate && customEndDate) {
      // Calculate days between dates
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // You can extend this to pass custom dates to parent
      onPeriodChange(diffDays || 30);
      setShowCustomDates(false);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Period selector */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePeriodClick(p.value)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  period === p.value || (p.value === 'custom' && showCustomDates)
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {p.value === 'custom' && <Calendar className="w-3.5 h-3.5 inline mr-1.5" />}
                {t(p.labelKey)}
              </button>
            ))}
          </div>

          {/* Campaign filter */}
          {campaigns.length > 0 && (
            <select
              value={selectedCampaign || ''}
              onChange={(e) => onCampaignChange(e.target.value || null)}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">{t('filters.allCampaigns')}</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t('filters.refresh')}
        </button>
      </div>

      {/* Custom date range picker */}
      {showCustomDates && (
        <div className="mt-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('filters.startDate')}
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('filters.endDate')}
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleApplyCustomDates}
              disabled={!customStartDate || !customEndDate}
              className="mt-5 px-4 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('filters.apply')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardFilters;
