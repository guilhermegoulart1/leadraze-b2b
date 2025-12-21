// frontend/src/components/aiemployees/AgentProfileStep/components/ObjectionsList.jsx
// Lista de objecoes editavel

import React from 'react';
import { Plus, X, AlertCircle, ArrowRight } from 'lucide-react';

const ObjectionsList = ({ items, onChange }) => {
  const addItem = () => {
    onChange([...items, { objection: '', response: '' }]);
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={index}
          className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 group"
        >
          <div className="flex items-start gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-500 mt-2.5 flex-shrink-0" />
            <input
              type="text"
              value={item.objection}
              onChange={(e) => updateItem(index, 'objection', e.target.value)}
              placeholder='"E caro demais", "Ja uso outra ferramenta"...'
              className="flex-1 px-3 py-2 bg-red-50 dark:bg-red-900/20 border-0 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 dark:text-white placeholder:text-red-400 dark:placeholder:text-red-500"
            />
            <button
              onClick={() => removeItem(index)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-start gap-2 ml-6">
            <ArrowRight className="w-4 h-4 text-green-500 mt-2.5 flex-shrink-0" />
            <textarea
              value={item.response}
              onChange={(e) => updateItem(index, 'response', e.target.value)}
              placeholder="Como responder a essa objecao..."
              rows={2}
              className="flex-1 px-3 py-2 bg-green-50 dark:bg-green-900/20 border-0 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 dark:text-white resize-none placeholder:text-green-600 dark:placeholder:text-green-500"
            />
          </div>
        </div>
      ))}
      <button
        onClick={addItem}
        className="flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors w-full border border-dashed border-red-300 dark:border-red-700"
      >
        <Plus className="w-4 h-4" />
        Adicionar objecao
      </button>
    </div>
  );
};

export default ObjectionsList;
