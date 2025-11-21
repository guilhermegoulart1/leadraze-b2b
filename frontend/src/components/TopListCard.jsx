import React from 'react';

const TopListCard = ({ title, items, valueFormatter = (v) => v, showTrend = false }) => {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-[#7229f7] to-[#894cf8] flex items-center justify-center">
                <span className="text-xs font-bold text-white">{index + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {item.name}
                </p>
                {item.subtitle && (
                  <p className="text-xs text-gray-500 truncate">{item.subtitle}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              <span className="text-sm font-bold text-gray-900">
                {valueFormatter(item.value)}
              </span>
              {showTrend && item.trend && (
                <span className={`text-xs font-semibold ${
                  item.trend > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {item.trend > 0 ? '↑' : '↓'}{Math.abs(item.trend)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopListCard;
