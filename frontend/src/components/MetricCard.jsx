import React from 'react';

const MetricCard = ({ title, value, subtitle, icon: Icon, trend, trendValue, suffix = '' }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {value}
              {suffix && <span className="text-lg text-gray-600 dark:text-gray-400 ml-1">{suffix}</span>}
            </h3>
            {trendValue && (
              <span className={`text-xs font-semibold ${
                trend === 'up' ? 'text-green-600 dark:text-green-400' : trend === 'down' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
              }`}>
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : ''} {trendValue}
              </span>
            )}
          </div>
        </div>
        {Icon && (
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <Icon className="w-5 h-5 text-[#7229f7]" />
          </div>
        )}
      </div>
      {subtitle && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
      )}
    </div>
  );
};

export default MetricCard;
