import React from 'react';

const MetricCard = ({ title, value, subtitle, icon: Icon, trend, trendValue, suffix = '' }) => {
  return (
    <div className="bg-white rounded-lg p-5 border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-gray-900">
              {value}
              {suffix && <span className="text-lg text-gray-600 ml-1">{suffix}</span>}
            </h3>
            {trendValue && (
              <span className={`text-xs font-semibold ${
                trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'
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
        <p className="text-xs text-gray-500">{subtitle}</p>
      )}
    </div>
  );
};

export default MetricCard;
