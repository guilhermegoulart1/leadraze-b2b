import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const DonutChart = ({ data, colors }) => {
  const COLORS = colors || ['#7229f7', '#894cf8', '#a06ff9', '#b793fa', '#d4c5fc'];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{payload[0].name}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500">
            Valor: <span className="font-semibold">{payload[0].value.toLocaleString()}</span>
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500">
            Percentual: <span className="font-semibold">{payload[0].payload.percent?.toFixed(1) || (payload[0].percent * 100).toFixed(1)}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null; // Hide labels for small slices

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs font-semibold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={CustomLabel}
          outerRadius={100}
          innerRadius={60}
          fill="#8884d8"
          dataKey="value"
          paddingAngle={2}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          verticalAlign="bottom"
          height={36}
          iconType="circle"
          wrapperStyle={{ fontSize: '12px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default DonutChart;
