// frontend/src/components/aiemployees/WorkflowBuilder/VariablePicker/VariableCategory.jsx
// Secao colapsavel de categoria de variaveis

import React, { useState, useEffect } from 'react';
import {
  Settings, User, DollarSign, MessageCircle, MessageSquare,
  GitBranch, Sparkles, ChevronDown, ChevronRight
} from 'lucide-react';
import VariableItem from './VariableItem';

// Mapeamento de icones
const ICONS = {
  Settings,
  User,
  DollarSign,
  MessageCircle,
  MessageSquare,
  GitBranch,
  Sparkles
};

const VariableCategory = ({
  category,
  variables,
  searchQuery,
  realValues,
  selectedIndex,
  startIndex,
  onSelectIndex,
  onInsert,
  onManage,
  defaultExpanded = true
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Auto-expandir quando busca encontra itens nesta categoria
  useEffect(() => {
    if (searchQuery && variables.length > 0) {
      setIsExpanded(true);
    }
  }, [searchQuery, variables.length]);

  // Icone da categoria
  const IconComponent = ICONS[category.icon] || Settings;

  // Verificar se algum item desta categoria esta selecionado
  const hasSelectedItem = selectedIndex >= startIndex &&
    selectedIndex < startIndex + variables.length;

  if (variables.length === 0 && !category.manageable) {
    return null;
  }

  return (
    <div className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      {/* Header da categoria */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          w-full px-3 py-2 flex items-center justify-between
          hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
          ${hasSelectedItem ? 'bg-blue-50 dark:bg-blue-900/30' : ''}
        `}
      >
        <div className="flex items-center gap-2">
          <IconComponent
            size={14}
            style={{ color: category.color }}
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {category.label}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
            {variables.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Botao Gerenciar (para categoria custom) */}
          {category.manageable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onManage) onManage();
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
            >
              Gerenciar
            </button>
          )}

          {isExpanded ? (
            <ChevronDown size={14} className="text-gray-400 dark:text-gray-500" />
          ) : (
            <ChevronRight size={14} className="text-gray-400 dark:text-gray-500" />
          )}
        </div>
      </button>

      {/* Lista de variaveis */}
      {isExpanded && (
        <div className="bg-white dark:bg-gray-800">
          {variables.length > 0 ? (
            variables.map((variable, index) => {
              const globalIndex = startIndex + index;
              const realValue = realValues?.[variable.key];

              return (
                <VariableItem
                  key={variable.key}
                  variable={variable}
                  categoryId={category.id}
                  isSelected={selectedIndex === globalIndex}
                  searchQuery={searchQuery}
                  realValue={realValue}
                  onSelect={() => onSelectIndex(globalIndex)}
                  onInsert={onInsert}
                />
              );
            })
          ) : (
            <div className="px-3 py-4 text-sm text-gray-400 dark:text-gray-500 text-center">
              Nenhuma variavel definida.
              {category.manageable && (
                <button
                  onClick={onManage}
                  className="block mx-auto mt-2 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  + Adicionar variavel
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VariableCategory;
