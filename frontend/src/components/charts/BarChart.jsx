import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';

const BarChart = ({ data, dataKey = 'value', nameKey = 'name', color = '#7229f7', showValues = true }) => {
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{label}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500">
            {payload[0].name}: <span className="font-semibold">{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLabel = (props) => {
    const { x, y, width, value } = props;
    if (!showValues) return null;

    return (
      <text
        x={x + width / 2}
        y={y - 5}
        fill="#6b7280"
        textAnchor="middle"
        fontSize={12}
        fontWeight="600"
      >
        {value}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsBarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey={nameKey}
          tick={{ fill: '#6b7280', fontSize: 11 }}
          axisLine={{ stroke: '#e5e7eb' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#6b7280', fontSize: 12 }}
          axisLine={{ stroke: '#e5e7eb' }}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(114, 41, 247, 0.1)' }} />
        <Bar
          dataKey={dataKey}
          fill={color}
          radius={[6, 6, 0, 0]}
          label={CustomLabel}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color || color} />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
};

export default BarChart;
