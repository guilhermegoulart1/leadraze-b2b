import React from 'react';

const StatCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  iconColor = 'purple',
  trend,
  trendValue 
}) => {
  const colorClasses = {
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-100 text-yellow-600',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg dark:shadow-gray-900/50 transition-shadow duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[iconColor]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {trendValue && (
          <span className={`text-sm font-semibold flex items-center ${
            trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {trend === 'up' ? '↑' : '↓'} {trendValue}
          </span>
        )}
      </div>
      <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">{value}</h3>
      <p className="text-gray-500 dark:text-gray-400 text-sm">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-2">{subtitle}</p>}
    </div>
  );
};

export default StatCard;