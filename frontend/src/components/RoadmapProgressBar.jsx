// frontend/src/components/RoadmapProgressBar.jsx
import React from 'react';

const RoadmapProgressBar = ({
  completed,
  total,
  showLabel = true,
  size = 'md', // sm, md, lg
  className = ''
}) => {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3'
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`flex-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${heightClasses[size]}`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            percentage === 100
              ? 'bg-green-500'
              : percentage > 50
                ? 'bg-blue-500'
                : 'bg-blue-400'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {completed}/{total}
        </span>
      )}
    </div>
  );
};

export default RoadmapProgressBar;
