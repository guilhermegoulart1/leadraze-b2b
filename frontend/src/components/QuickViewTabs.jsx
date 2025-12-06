import React, { useRef } from 'react';
import { User, MessageSquare, UserPlus, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';

export default function QuickViewTabs({
  activeView,
  onChange,
  stats
}) {
  const scrollContainerRef = useRef(null);

  const views = [
    { id: 'mine', label: 'Minhas', count: stats.mine || 0, showCount: true },
    { id: 'unassigned', label: 'Não atribuídas', count: stats.unassigned || 0, showCount: true },
    { id: 'all', label: 'Todas', count: stats.all || 0, showCount: true },
    { id: 'closed', label: 'Fechadas', showCount: false }
  ];

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="relative flex items-center gap-1">
      {/* Botão Esquerda */}
      <button
        onClick={() => scroll('left')}
        className="flex-shrink-0 p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        aria-label="Rolar para esquerda"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Container de Pills */}
      <div
        ref={scrollContainerRef}
        className="flex gap-1 overflow-x-auto flex-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {views.map(view => {
          return (
            <button
              key={view.id}
              onClick={() => onChange(view.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                activeView === view.id
                  ? 'bg-[#7229f7] text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {view.label}
              {view.showCount && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  activeView === view.id
                    ? 'bg-white bg-opacity-30 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}>
                  {view.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Botão Direita */}
      <button
        onClick={() => scroll('right')}
        className="flex-shrink-0 p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        aria-label="Rolar para direita"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
