import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const PerformanceChart = ({ data, type = 'line' }) => {
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600 dark:text-gray-400 dark:text-gray-500">{entry.name}:</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (type === 'area') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#7229f7" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#7229f7" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorQualified" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#894cf8" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#894cf8" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#6b7280', fontSize: 12 }}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 12 }}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="leads"
            stroke="#7229f7"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorLeads)"
            name="Leads"
          />
          <Area
            type="monotone"
            dataKey="qualified"
            stroke="#894cf8"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorQualified)"
            name="Qualificados"
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#6b7280', fontSize: 12 }}
          axisLine={{ stroke: '#e5e7eb' }}
        />
        <YAxis
          tick={{ fill: '#6b7280', fontSize: 12 }}
          axisLine={{ stroke: '#e5e7eb' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '12px' }}
          iconType="circle"
        />
        <Line
          type="monotone"
          dataKey="leads"
          stroke="#7229f7"
          strokeWidth={2}
          dot={{ fill: '#7229f7', r: 4 }}
          activeDot={{ r: 6 }}
          name="Leads"
        />
        <Line
          type="monotone"
          dataKey="qualified"
          stroke="#894cf8"
          strokeWidth={2}
          dot={{ fill: '#894cf8', r: 4 }}
          activeDot={{ r: 6 }}
          name="Qualificados"
        />
        <Line
          type="monotone"
          dataKey="conversations"
          stroke="#a06ff9"
          strokeWidth={2}
          dot={{ fill: '#a06ff9', r: 4 }}
          activeDot={{ r: 6 }}
          name="Conversas"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default PerformanceChart;
