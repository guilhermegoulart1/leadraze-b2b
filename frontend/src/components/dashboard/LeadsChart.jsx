import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users } from 'lucide-react';

const LeadsChart = ({ data = [], total = 0 }) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  const chartData = data.map(item => ({
    ...item,
    dateFormatted: formatDate(item.date)
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{label}</p>
          <p className="text-sm text-violet-600 dark:text-purple-400 font-medium">
            {payload[0].value} {payload[0].value === 1 ? 'lead' : 'leads'}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Novos Leads por Dia</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Leads adicionados no período</p>
        </div>
        <div className="p-2 rounded-lg bg-violet-50 dark:bg-purple-900/20">
          <Users className="w-5 h-5 text-violet-600 dark:text-purple-400" />
        </div>
      </div>

      <div className="h-48">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="dateFormatted"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124, 58, 237, 0.1)' }} />
              <Bar
                dataKey="count"
                fill="#7c3aed"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
            Sem dados no período
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Total no período</span>
          <span className="text-lg font-bold text-violet-600 dark:text-purple-400">{total.toLocaleString('pt-BR')} leads</span>
        </div>
      </div>
    </div>
  );
};

export default LeadsChart;
