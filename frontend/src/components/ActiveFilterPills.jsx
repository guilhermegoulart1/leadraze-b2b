import React from 'react';
import { X } from 'lucide-react';

export default function ActiveFilterPills({
  filters,
  onRemove,
  onClearAll
}) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {filters.map(filter => (
        <span
          key={filter.key}
          className="flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-[#7229f7] dark:text-purple-300 text-xs font-medium rounded-full"
        >
          {filter.label}
          <button
            onClick={() => onRemove(filter.key)}
            className="hover:bg-purple-200 dark:hover:bg-purple-800/50 rounded-full p-0.5 transition-colors"
            aria-label={`Remover filtro ${filter.label}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <button
        onClick={onClearAll}
        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium transition-colors"
      >
        Limpar tudo
      </button>
    </div>
  );
}
