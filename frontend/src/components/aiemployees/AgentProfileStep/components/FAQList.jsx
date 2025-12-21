// frontend/src/components/aiemployees/AgentProfileStep/components/FAQList.jsx
// Lista de FAQ editavel

import React from 'react';
import { Plus, X, HelpCircle, MessageSquare } from 'lucide-react';

const FAQList = ({ items, onChange }) => {
  const addItem = () => {
    onChange([...items, { question: '', answer: '' }]);
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
            <HelpCircle className="w-4 h-4 text-amber-500 mt-2.5 flex-shrink-0" />
            <input
              type="text"
              value={item.question}
              onChange={(e) => updateItem(index, 'question', e.target.value)}
              placeholder="Pergunta frequente..."
              className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-600 border-0 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 dark:text-white"
            />
            <button
              onClick={() => removeItem(index)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-start gap-2 ml-6">
            <MessageSquare className="w-4 h-4 text-green-500 mt-2.5 flex-shrink-0" />
            <textarea
              value={item.answer}
              onChange={(e) => updateItem(index, 'answer', e.target.value)}
              placeholder="Resposta..."
              rows={2}
              className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-600 border-0 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 dark:text-white resize-none"
            />
          </div>
        </div>
      ))}
      <button
        onClick={addItem}
        className="flex items-center gap-2 px-3 py-2.5 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors w-full border border-dashed border-amber-300 dark:border-amber-700"
      >
        <Plus className="w-4 h-4" />
        Adicionar pergunta
      </button>
    </div>
  );
};

export default FAQList;
