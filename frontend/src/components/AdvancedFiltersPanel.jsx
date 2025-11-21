import React from 'react';

export default function AdvancedFiltersPanel({
  filters,
  onChange,
  campaigns = [],
  tags = [],
  onClear
}) {
  const statusOptions = [
    { value: 'open', label: 'Abertas' },
    { value: 'ai_active', label: 'IA Ativa' },
    { value: 'manual', label: 'Manual' },
    { value: 'closed', label: 'Fechadas' }
  ];

  const periodOptions = [
    { value: 'today', label: 'Hoje' },
    { value: 'last_7_days', label: 'Últimos 7 dias' },
    { value: 'last_30_days', label: 'Últimos 30 dias' },
    { value: 'this_month', label: 'Este mês' },
    { value: 'last_month', label: 'Mês passado' },
    { value: 'all', label: 'Todos os períodos' }
  ];

  const handleStatusChange = (statusValue) => {
    const newStatus = filters.status.includes(statusValue)
      ? filters.status.filter(s => s !== statusValue)
      : [...filters.status, statusValue];
    onChange({ ...filters, status: newStatus });
  };

  const handleCampaignChange = (e) => {
    const value = e.target.value;
    onChange({
      ...filters,
      campaigns: value ? [parseInt(value)] : []
    });
  };

  const handlePeriodChange = (e) => {
    onChange({ ...filters, period: e.target.value });
  };

  const handleModeChange = (mode) => {
    onChange({ ...filters, mode });
  };

  return (
    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
      {/* Status Checkboxes */}
      <div>
        <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
          Status
        </label>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map(option => (
            <label
              key={option.value}
              className="flex items-center gap-1.5 cursor-pointer"
            >
              <input
                type="checkbox"
                className="rounded border-gray-300 text-[#7229f7] focus:ring-[#7229f7]"
                checked={filters.status.includes(option.value)}
                onChange={() => handleStatusChange(option.value)}
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Modo (IA / Manual) */}
      <div>
        <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
          Modo de Atendimento
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => handleModeChange('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filters.mode === 'all'
                ? 'bg-purple-50 text-[#7229f7]'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => handleModeChange('ai')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filters.mode === 'ai'
                ? 'bg-purple-50 text-[#7229f7]'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            IA
          </button>
          <button
            onClick={() => handleModeChange('manual')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filters.mode === 'manual'
                ? 'bg-purple-50 text-[#7229f7]'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            Manual
          </button>
        </div>
      </div>

      {/* Campanha Dropdown */}
      {campaigns.length > 0 && (
        <div>
          <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
            Campanha
          </label>
          <select
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7229f7] focus:border-transparent bg-white"
            value={filters.campaigns[0] || ''}
            onChange={handleCampaignChange}
          >
            <option value="">Todas as campanhas</option>
            {campaigns.map(campaign => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tags Multi-select */}
      {tags.length > 0 && (
        <div>
          <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
            Etiquetas
          </label>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag.id}
                onClick={() => {
                  const newTags = filters.tags.includes(tag.id)
                    ? filters.tags.filter(t => t !== tag.id)
                    : [...filters.tags, tag.id];
                  onChange({ ...filters, tags: newTags });
                }}
                className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                  filters.tags.includes(tag.id)
                    ? 'bg-purple-50 text-[#7229f7] border border-purple-200'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Período */}
      <div>
        <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
          Período
        </label>
        <select
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7229f7] focus:border-transparent bg-white"
          value={filters.period}
          onChange={handlePeriodChange}
        >
          {periodOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Botão Limpar */}
      <div className="pt-2">
        <button
          onClick={onClear}
          className="text-sm text-[#7229f7] hover:text-[#5a1fd4] font-medium transition-colors"
        >
          Limpar filtros
        </button>
      </div>
    </div>
  );
}
