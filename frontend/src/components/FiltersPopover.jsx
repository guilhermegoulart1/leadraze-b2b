import React, { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function FiltersPopover({
  filters,
  onChange,
  users = [],
  tags = [],
  onClear,
  onClose
}) {
  const { t } = useTranslation('conversations');
  const popoverRef = useRef(null);

  // Fechar ao clicar fora (usando click em vez de mousedown para não interferir com selects)
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Ignorar cliques em elementos de select (dropdown options são renderizados fora do DOM normal)
      if (event.target.tagName === 'OPTION' || event.target.tagName === 'SELECT') {
        return;
      }
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        onClose();
      }
    };

    // Usar timeout para evitar que o click que abriu o popover também o feche
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  const periodOptions = [
    { value: 'all', label: t('filters.periods.all', 'Todos os períodos') },
    { value: 'today', label: t('filters.periods.today', 'Hoje') },
    { value: 'last_7_days', label: t('filters.periods.last_7_days', 'Últimos 7 dias') },
    { value: 'last_30_days', label: t('filters.periods.last_30_days', 'Últimos 30 dias') },
    { value: 'this_month', label: t('filters.periods.this_month', 'Este mês') },
    { value: 'last_month', label: t('filters.periods.last_month', 'Mês passado') }
  ];

  const handleModeChange = (mode) => {
    onChange({ ...filters, mode });
  };

  const handleUserChange = (e) => {
    const value = e.target.value;
    onChange({ ...filters, assignedUserId: value ? parseInt(value) : null });
  };

  const handlePeriodChange = (e) => {
    onChange({ ...filters, period: e.target.value });
  };

  const handleTagToggle = (tagId) => {
    const newTags = filters.tags.includes(tagId)
      ? filters.tags.filter(t => t !== tagId)
      : [...filters.tags, tagId];
    onChange({ ...filters, tags: newTags });
  };

  const getTagColorClasses = (color, isSelected) => {
    if (isSelected) {
      return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-600';
    }

    const colors = {
      purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-700',
      blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700',
      green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-700',
      yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-700',
      red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-700',
      pink: 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-700',
      orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-700',
      gray: 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
    };

    return colors[color] || colors.gray;
  };

  return (
    <div
      ref={popoverRef}
      className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
    >
      {/* Header */}
      <div className="flex justify-between items-center p-3 border-b border-gray-200 dark:border-gray-700">
        <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
          {t('filters.title', 'Filtros')}
        </span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      <div className="p-3 space-y-4">
        {/* Modo */}
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">
            {t('filters.mode', 'Modo')}
          </label>
          <div className="flex gap-1">
            {['all', 'ai', 'manual'].map((mode) => (
              <button
                key={mode}
                onClick={() => handleModeChange(mode)}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filters.mode === mode
                    ? 'bg-[#7229f7] text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {mode === 'all' ? t('filters.modeAll', 'Todos') : mode === 'ai' ? 'IA' : 'Manual'}
              </button>
            ))}
          </div>
        </div>

        {/* Responsável */}
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">
            {t('filters.assignedUser', 'Responsável')}
          </label>
          <select
            value={filters.assignedUserId || ''}
            onChange={(e) => {
              const value = e.target.value;
              onChange({ ...filters, assignedUserId: value || null });
            }}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7229f7] focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="">{t('filters.allUsers', 'Todos os usuários')}</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>

        {/* Período */}
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">
            {t('filters.period', 'Período')}
          </label>
          <select
            value={filters.period}
            onChange={handlePeriodChange}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7229f7] focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            {periodOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Etiquetas */}
        {tags.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">
              {t('filters.tags', 'Etiquetas')}
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => handleTagToggle(tag.id)}
                  className={`px-2 py-1 rounded-full text-xs font-medium border transition-colors ${
                    getTagColorClasses(tag.color, filters.tags.includes(tag.id))
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Limpar */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              onClear();
              onClose();
            }}
            className="w-full text-sm text-[#7229f7] hover:text-[#5a1fd4] font-medium transition-colors text-center py-1"
          >
            {t('filters.clear', 'Limpar filtros')}
          </button>
        </div>
      </div>
    </div>
  );
}
