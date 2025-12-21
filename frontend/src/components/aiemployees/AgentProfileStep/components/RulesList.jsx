// frontend/src/components/aiemployees/AgentProfileStep/components/RulesList.jsx
// Lista de regras editavel

import React from 'react';
import { Plus, X } from 'lucide-react';

const RulesList = ({ rules, onChange, placeholder = 'Nova regra...' }) => {
  const addRule = () => {
    onChange([...rules, '']);
  };

  const updateRule = (index, value) => {
    const updated = [...rules];
    updated[index] = value;
    onChange(updated);
  };

  const removeRule = (index) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {rules.map((rule, index) => (
        <div key={index} className="flex items-center gap-2 group">
          <span className="text-purple-500 dark:text-purple-400 text-lg">•</span>
          <input
            type="text"
            value={rule}
            onChange={(e) => updateRule(index, e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:text-white transition-all"
          />
          <button
            onClick={() => removeRule(index)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        onClick={addRule}
        className="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors w-full"
      >
        <Plus className="w-4 h-4" />
        Adicionar regra
      </button>
    </div>
  );
};

export default RulesList;
