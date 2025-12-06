import React from 'react';
import { TrendingDown } from 'lucide-react';

const SalesFunnel = ({ pipeline = {} }) => {
  const formatCurrency = (value) => {
    if (!value) return '';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const stages = [
    { key: 'leads', label: 'Prospecção', color: '#9ca3af' },
    { key: 'invite_sent', label: 'Convites Enviados', color: '#a78bfa' },
    { key: 'accepted', label: 'Aceitos', color: '#8b5cf6' },
    { key: 'qualifying', label: 'Qualificando', color: '#7c3aed' },
    { key: 'scheduled', label: 'Agendados', color: '#6d28d9' },
    { key: 'won', label: 'Ganhos', color: '#10b981' }
  ];

  const stageData = stages.map((stage, index) => {
    const data = pipeline[stage.key] || { count: 0, value: 0 };
    const prevStage = index > 0 ? stages[index - 1] : null;
    const prevCount = prevStage ? (pipeline[prevStage.key]?.count || 0) : data.count;
    const conversionRate = prevCount > 0 ? ((data.count / prevCount) * 100).toFixed(0) : null;

    return {
      ...stage,
      count: data.count,
      value: data.value,
      conversionRate: index > 0 ? conversionRate : null
    };
  });

  const maxCount = Math.max(...stageData.map(s => s.count), 1);

  // Calculate bar widths with better visual differentiation
  const calculateBarWidth = (count, max) => {
    if (count === 0) return 5; // Minimum width for zero values
    if (count === max) return 100;

    const ratio = count / max;
    if (ratio < 0.1) {
      // Use square root for smoother scaling of small values
      const sqrtRatio = Math.sqrt(ratio);
      return Math.max(8, sqrtRatio * 100);
    }
    return ratio * 100;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Funil de Vendas</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Pipeline completo com conversões</p>
        </div>
        <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-900/30">
          <TrendingDown className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        </div>
      </div>

      <div className="space-y-3">
        {stageData.map((stage, index) => {
          const barWidth = calculateBarWidth(stage.count, maxCount);
          const isWon = stage.key === 'won';

          return (
            <div key={stage.key}>
              <div className="flex items-center gap-2">
                {/* Bar */}
                <div className="flex-1">
                  <div className="h-8 bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full rounded-lg transition-all duration-700 flex items-center"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: stage.color
                      }}
                    >
                      <span className="text-white text-xs font-medium px-3 truncate">
                        {stage.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Count and value */}
                <div className="w-16 text-right shrink-0">
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {stage.count.toLocaleString('pt-BR')}
                  </span>
                  {isWon && stage.value > 0 && (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block">
                      {formatCurrency(stage.value)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lost leads indicator */}
      {pipeline.lost?.count > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Leads perdidos</span>
          <span className="text-red-500 dark:text-red-400 font-medium">{pipeline.lost.count.toLocaleString('pt-BR')}</span>
        </div>
      )}
    </div>
  );
};

export default SalesFunnel;
