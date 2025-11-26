import React from 'react';
import { TrendingDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const FunnelChart = ({ data }) => {
  const { t } = useTranslation('dashboard');

  const stages = [
    { key: 'leads', labelKey: 'funnel.prospecting', color: '#d4c5fc', bgColor: 'bg-[#d4c5fc]' },
    { key: 'invite_sent', labelKey: 'funnel.invite', color: '#b793fa', bgColor: 'bg-[#b793fa]' },
    { key: 'qualifying', labelKey: 'funnel.qualifying', color: '#a06ff9', bgColor: 'bg-[#a06ff9]' },
    { key: 'accepted', labelKey: 'funnel.inProgress', color: '#894cf8', bgColor: 'bg-[#894cf8]' },
    { key: 'qualified', labelKey: 'funnel.won', color: '#7229f7', bgColor: 'bg-[#7229f7]' },
    { key: 'discarded', labelKey: 'funnel.discarded', color: '#ef4444', bgColor: 'bg-[#ef4444]' }
  ];

  const maxValue = data.leads || 1;

  const calculateConversionRate = (current, previous) => {
    if (!previous || previous === 0) return 0;
    return ((current / previous) * 100).toFixed(1);
  };

  return (
    <div className="space-y-4">
      {stages.map((stage, index) => {
        const value = data[stage.key] || 0;
        const percentage = (value / maxValue) * 100;
        const prevValue = index > 0 ? data[stages[index - 1].key] : null;
        const conversionRate = index > 0 ? calculateConversionRate(value, prevValue) : null;

        return (
          <div key={stage.key} className="relative">
            {/* Stage Bar */}
            <div className="mb-1">
              <div
                className="rounded-lg transition-all duration-500 relative overflow-hidden"
                style={{
                  width: `${Math.max(percentage, 15)}%`,
                  backgroundColor: stage.color,
                  minWidth: '200px'
                }}
              >
                <div className="flex items-center justify-between px-4 py-3.5">
                  <span className="text-white font-semibold text-sm whitespace-nowrap">
                    {t(stage.labelKey)}
                  </span>
                  <span className="text-white font-bold text-base ml-4">
                    {value.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Conversion Rate */}
            {conversionRate !== null && (
              <div className="flex items-center gap-1 text-xs text-gray-500 mb-2 ml-1">
                <TrendingDown className="w-3 h-3" />
                <span>{t('funnel.conversionFromPrevious', { rate: conversionRate })}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FunnelChart;
