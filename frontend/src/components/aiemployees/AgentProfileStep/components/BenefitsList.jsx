// frontend/src/components/aiemployees/AgentProfileStep/components/BenefitsList.jsx
// Lista de beneficios/diferenciais editavel

import React from 'react';
import { Plus, X, Check, Sparkles } from 'lucide-react';

const colorClasses = {
  green: {
    bullet: 'text-green-500 dark:text-green-400',
    button: 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
  },
  blue: {
    bullet: 'text-blue-500 dark:text-blue-400',
    button: 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
  },
  purple: {
    bullet: 'text-purple-500 dark:text-purple-400',
    button: 'text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'
  }
};

const BenefitsList = ({ items, onChange, placeholder = 'Novo item...', color = 'green' }) => {
  const colors = colorClasses[color] || colorClasses.green;
  const Icon = color === 'green' ? Check : Sparkles;

  const addItem = () => {
    onChange([...items, '']);
  };

  const updateItem = (index, value) => {
    const updated = [...items];
    updated[index] = value;
    onChange(updated);
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2 group">
          <Icon className={`w-4 h-4 flex-shrink-0 ${colors.bullet}`} />
          <input
            type="text"
            value={item}
            onChange={(e) => updateItem(index, e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:text-white transition-all"
          />
          <button
            onClick={() => removeItem(index)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors w-full ${colors.button}`}
      >
        <Plus className="w-4 h-4" />
        Adicionar
      </button>
    </div>
  );
};

export default BenefitsList;
