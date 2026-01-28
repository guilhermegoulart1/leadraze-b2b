// frontend/src/components/aiemployees/WorkflowBuilder/VariablePicker/VariableItem.jsx
// Item individual de variavel (clicavel + arrastavel)

import React, { useCallback } from 'react';
import { CATEGORY_COLORS } from '../../../../constants/workflowVariables';

const VariableItem = ({
  variable,
  categoryId,
  isSelected,
  searchQuery,
  realValue,
  onSelect,
  onInsert
}) => {
  const colors = CATEGORY_COLORS[categoryId] || CATEGORY_COLORS.custom;

  // Handler de clique
  const handleClick = useCallback(() => {
    if (onInsert) {
      onInsert(variable.key);
    }
  }, [variable.key, onInsert]);

  // Handler de drag start
  const handleDragStart = useCallback((e) => {
    e.dataTransfer.setData('text/plain', `{{${variable.key}}}`);
    e.dataTransfer.setData('application/x-variable', variable.key);
    e.dataTransfer.effectAllowed = 'copy';
  }, [variable.key]);

  // Handler de mouse enter para selecao
  const handleMouseEnter = useCallback(() => {
    if (onSelect) {
      onSelect();
    }
  }, [onSelect]);

  // Highlight texto que corresponde a busca
  const highlightMatch = (text) => {
    if (!searchQuery || !text) return text;

    const lowerText = text.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) return text;

    const before = text.slice(0, index);
    const match = text.slice(index, index + searchQuery.length);
    const after = text.slice(index + searchQuery.length);

    return (
      <>
        {before}
        <span className="bg-yellow-200 dark:bg-yellow-600 text-yellow-900 dark:text-yellow-100 rounded px-0.5">{match}</span>
        {after}
      </>
    );
  };

  // Valor a exibir (real ou exemplo)
  const displayValue = realValue !== undefined ? realValue : variable.example;
  const isRealValue = realValue !== undefined;

  return (
    <div
      className={`
        px-3 py-2 cursor-pointer transition-colors duration-100
        hover:bg-gray-50 dark:hover:bg-gray-700 group
        ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : ''}
      `}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      draggable
      onDragStart={handleDragStart}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Nome da variavel */}
          <div className="flex items-center gap-2">
            <code className={`
              text-xs font-mono px-1.5 py-0.5 rounded
              ${colors.bg} ${colors.text}
            `}>
              {highlightMatch(variable.key)}
            </code>
          </div>

          {/* Label */}
          <div className="text-sm text-gray-700 dark:text-gray-200 mt-1">
            {highlightMatch(variable.label)}
          </div>

          {/* Descricao (visivel no hover ou quando selecionado) */}
          <div className={`
            text-xs text-gray-500 dark:text-gray-400 mt-0.5
            ${isSelected ? 'block' : 'hidden group-hover:block'}
          `}>
            {variable.description}
          </div>
        </div>

        {/* Valor (exemplo ou real) */}
        <div className="flex-shrink-0 text-right">
          <div className={`
            text-xs font-mono max-w-[120px] truncate
            ${isRealValue ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}
          `}
            title={displayValue || '(vazio)'}
          >
            {displayValue || <span className="italic">(vazio)</span>}
          </div>
          {isRealValue && (
            <div className="text-[10px] text-green-500 dark:text-green-400 mt-0.5">
              valor real
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VariableItem;
