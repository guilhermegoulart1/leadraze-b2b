// frontend/src/components/aiemployees/WorkflowBuilder/VariablePicker/index.jsx
// Componente principal do seletor de variaveis

import React, { useMemo, useEffect, useCallback, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import VariableSearch from './VariableSearch';
import VariableCategory from './VariableCategory';
import {
  VARIABLE_CATEGORIES,
  searchVariables,
  getFilteredCategories
} from '../../../../constants/workflowVariables';

const VariablePicker = forwardRef(({
  isOpen,
  position,
  searchQuery,
  selectedIndex,
  onSearchChange,
  onSelectIndex,
  onInsert,
  onClose,
  onManageCustomVariables,
  context = {},
  customVariables = [],
  workflowVariables = {},
  realValues = {},
  isLoadingValues = false
}, ref) => {

  // Filtrar categorias baseado no contexto
  const filteredCategories = useMemo(() => {
    return getFilteredCategories(context);
  }, [context]);

  // Construir lista de variaveis com busca aplicada
  const { categoriesWithVariables, flatVariables } = useMemo(() => {
    const result = [];
    const flat = [];

    for (const [categoryId, category] of Object.entries(filteredCategories)) {
      let variables = [...category.variables];

      // Adicionar variaveis customizadas na categoria custom
      if (categoryId === 'custom' && customVariables.length > 0) {
        variables = [
          ...variables,
          ...customVariables.map(cv => ({
            key: cv.key,
            label: cv.label || cv.key,
            description: cv.description || 'Variavel personalizada',
            example: cv.defaultValue || ''
          }))
        ];
      }

      // Adicionar variaveis de workflow (HTTP responses)
      if (categoryId === 'workflow' && Object.keys(workflowVariables).length > 0) {
        const httpVars = Object.entries(workflowVariables).map(([key, value]) => ({
          key: `workflow.${key}`,
          label: key,
          description: 'Variavel extraida de HTTP Request',
          example: typeof value === 'string' ? value : JSON.stringify(value)
        }));
        variables = [...variables, ...httpVars];
      }

      // Filtrar por busca
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        variables = variables.filter(v =>
          v.key.toLowerCase().includes(lowerQuery) ||
          v.label.toLowerCase().includes(lowerQuery) ||
          v.description.toLowerCase().includes(lowerQuery)
        );
      }

      if (variables.length > 0 || category.manageable) {
        result.push({
          ...category,
          variables,
          startIndex: flat.length
        });

        flat.push(...variables);
      }
    }

    return { categoriesWithVariables: result, flatVariables: flat };
  }, [filteredCategories, customVariables, workflowVariables, searchQuery]);

  // Lidar com navegacao por teclado
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          onSelectIndex(Math.min(selectedIndex + 1, flatVariables.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          onSelectIndex(Math.max(selectedIndex - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatVariables[selectedIndex]) {
            onInsert(flatVariables[selectedIndex].key);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, flatVariables, onSelectIndex, onInsert, onClose]);

  // Scroll para item selecionado
  useEffect(() => {
    if (!isOpen || selectedIndex < 0) return;

    const selectedElement = document.querySelector(`[data-variable-index="${selectedIndex}"]`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isOpen, selectedIndex]);

  if (!isOpen) return null;

  const pickerContent = (
    <div
      ref={ref}
      className="
        fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700
        w-[320px] max-h-[400px] flex flex-col overflow-hidden
        animate-in fade-in-0 zoom-in-95 duration-150
      "
      style={{
        top: position.top,
        left: position.left
      }}
    >
      {/* Header com busca */}
      <VariableSearch
        value={searchQuery}
        onChange={onSearchChange}
        autoFocus
      />

      {/* Loading indicator */}
      {isLoadingValues && (
        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/30 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-blue-600 dark:text-blue-400" />
          <span className="text-xs text-blue-600 dark:text-blue-400">Carregando valores...</span>
        </div>
      )}

      {/* Lista de categorias */}
      <div className="flex-1 overflow-y-auto">
        {categoriesWithVariables.length > 0 ? (
          categoriesWithVariables.map((category) => (
            <VariableCategory
              key={category.id}
              category={category}
              variables={category.variables}
              searchQuery={searchQuery}
              realValues={realValues}
              selectedIndex={selectedIndex}
              startIndex={category.startIndex}
              onSelectIndex={onSelectIndex}
              onInsert={onInsert}
              onManage={category.manageable ? onManageCustomVariables : undefined}
              defaultExpanded={!searchQuery}
            />
          ))
        ) : (
          <div className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
            <p className="text-sm">Nenhuma variavel encontrada</p>
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Limpar busca
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer com dica */}
      <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
          <span>
            <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded text-[9px]">↑↓</kbd> navegar
            <span className="mx-2">|</span>
            <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded text-[9px]">Enter</kbd> inserir
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded text-[9px]">Esc</kbd> fechar
          </span>
        </div>
      </div>
    </div>
  );

  // Renderizar via Portal para evitar problemas de z-index
  return createPortal(pickerContent, document.body);
});

VariablePicker.displayName = 'VariablePicker';

export default VariablePicker;
