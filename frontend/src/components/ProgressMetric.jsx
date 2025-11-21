import React from 'react';

const ProgressMetric = ({ label, current, target, color = '#7229f7', showPercentage = true }) => {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const isComplete = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">
            {current.toLocaleString()} / {target.toLocaleString()}
          </span>
          {showPercentage && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              isComplete ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {percentage.toFixed(0)}%
            </span>
          )}
        </div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 relative"
          style={{
            width: `${percentage}%`,
            background: isComplete
              ? 'linear-gradient(to right, #10b981, #059669)'
              : `linear-gradient(to right, ${color}, ${color}dd)`
          }}
        >
          {percentage > 10 && (
            <div className="absolute inset-0 bg-white/20" />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressMetric;
