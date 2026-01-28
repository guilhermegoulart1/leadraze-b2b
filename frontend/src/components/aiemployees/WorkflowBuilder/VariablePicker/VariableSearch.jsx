// frontend/src/components/aiemployees/WorkflowBuilder/VariablePicker/VariableSearch.jsx
// Campo de busca para filtrar variaveis

import React, { useRef, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';

const VariableSearch = ({
  value,
  onChange,
  placeholder = 'Buscar variaveis...',
  autoFocus = true
}) => {
  const inputRef = useRef(null);

  // Auto-focus quando componente monta
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      // Pequeno delay para garantir que o picker esta visivel
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  // Handler de mudanca
  const handleChange = useCallback((e) => {
    onChange(e.target.value);
  }, [onChange]);

  // Handler de limpar
  const handleClear = useCallback(() => {
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  // Prevenir propagacao de teclas especiais
  const handleKeyDown = useCallback((e) => {
    // Permitir que ArrowUp/Down/Enter/Escape propaguem para navegacao
    if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
      return;
    }
    // Parar propagacao de outras teclas para evitar interferencia
    e.stopPropagation();
  }, []);

  return (
    <div className="relative px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      {/* Icone de busca */}
      <Search
        size={14}
        className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
      />

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="
          w-full pl-7 pr-7 py-1.5
          text-sm text-gray-700 dark:text-gray-200
          bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md
          placeholder:text-gray-400 dark:placeholder:text-gray-500
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
        "
      />

      {/* Botao limpar */}
      {value && (
        <button
          onClick={handleClear}
          className="
            absolute right-5 top-1/2 -translate-y-1/2
            text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300
            p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700
          "
          title="Limpar busca"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export default VariableSearch;
