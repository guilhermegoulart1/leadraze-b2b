import React from 'react';
import { RefreshCw } from 'lucide-react';

const DashboardFilters = ({
  period,
  onPeriodChange,
  campaigns = [],
  selectedCampaign,
  onCampaignChange,
  onRefresh,
  loading = false
}) => {
  const periods = [
    { value: 7, label: '7 dias' },
    { value: 30, label: '30 dias' },
    { value: 90, label: '90 dias' }
  ];

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        {/* Period selector */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => onPeriodChange(p.value)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === p.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Campaign filter */}
        {campaigns.length > 0 && (
          <select
            value={selectedCampaign || ''}
            onChange={(e) => onCampaignChange(e.target.value || null)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">Todas as campanhas</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Refresh button */}
      <button
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        Atualizar
      </button>
    </div>
  );
};

export default DashboardFilters;
