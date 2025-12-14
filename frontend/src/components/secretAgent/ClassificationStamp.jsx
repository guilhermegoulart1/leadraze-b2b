import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Classification Stamp Component - FBI-style stamp effect
 * Shows CONFIDENTIAL, CLASSIFIED, or TOP SECRET stamp
 */
const ClassificationStamp = ({ classification = 'CONFIDENTIAL', size = 'md', animated = false }) => {
  const { t } = useTranslation('secretAgent');

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-3 py-1',
    lg: 'text-sm px-4 py-1.5'
  };

  const colorClasses = {
    CONFIDENTIAL: 'border-red-700 text-red-500 bg-red-950/50',
    CLASSIFIED: 'border-red-700 text-red-500 bg-red-950/50',
    TOP_SECRET: 'border-red-800 text-red-400 bg-red-950/50'
  };

  return (
    <div className="relative inline-block">
      <div
        className={`
          ${sizeClasses[size]}
          ${colorClasses[classification] || colorClasses.CONFIDENTIAL}
          font-bold tracking-widest uppercase
          border-2 rounded
          transform -rotate-3
          ${animated ? 'animate-pulse' : ''}
        `}
        style={{
          fontFamily: '"Courier New", monospace',
          textShadow: '0 0 10px currentColor'
        }}
      >
        {t(`classification.${classification}`) || classification}
      </div>
    </div>
  );
};

export default ClassificationStamp;
