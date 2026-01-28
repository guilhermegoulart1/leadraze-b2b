// frontend/src/components/aiemployees/WorkflowBuilder/inputs/VariableTextarea.jsx
// Textarea wrapper com suporte a variaveis (trigger {{ e botao)

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Braces } from 'lucide-react';
import VariablePicker from '../VariablePicker';
import { formatVariableTemplate } from '../../../../constants/workflowVariables';

const VariableTextarea = ({
  value,
  onChange,
  placeholder,
  className = '',
  disabled = false,
  maxLength,
  rows = 4,
  context = {},
  customVariables = [],
  workflowVariables = {},
  realValues = {},
  isLoadingValues = false,
  showVariableButton = true,
  showCharCount = false,
  ...props
}) => {
  const textareaRef = useRef(null);
  const pickerRef = useRef(null);

  // Estado do picker
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
  const [cursorPosition, setCursorPosition] = useState(0);
  const [triggerType, setTriggerType] = useState(null);

  // Calcular posicao do picker
  const calculatePickerPosition = useCallback(() => {
    if (!textareaRef.current) return { top: 0, left: 0 };

    const rect = textareaRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const pickerHeight = 400;
    const spaceBelow = viewportHeight - rect.bottom;

    let top = spaceBelow >= pickerHeight || spaceBelow >= rect.top
      ? rect.bottom + 4
      : rect.top - pickerHeight - 4;

    let left = rect.left;
    const pickerWidth = 320;

    if (left + pickerWidth > window.innerWidth) {
      left = window.innerWidth - pickerWidth - 16;
    }
    if (left < 16) left = 16;

    return { top, left };
  }, []);

  // Abrir picker
  const openPicker = useCallback((type = 'button') => {
    if (!textareaRef.current) return;

    setCursorPosition(textareaRef.current.selectionStart || 0);
    setTriggerType(type);
    setPickerPosition(calculatePickerPosition());
    setIsPickerOpen(true);
    setSearchQuery('');
    setSelectedIndex(0);
  }, [calculatePickerPosition]);

  // Fechar picker
  const closePicker = useCallback(() => {
    setIsPickerOpen(false);
    setSearchQuery('');
    setSelectedIndex(0);
    setTriggerType(null);
    textareaRef.current?.focus();
  }, []);

  // Inserir variavel
  const insertVariable = useCallback((variableKey) => {
    if (!textareaRef.current) return;

    const template = formatVariableTemplate(variableKey);
    const currentValue = value || '';

    let insertPos = cursorPosition;
    let prefixToRemove = 0;

    // Se aberto por {{ remover os caracteres ja digitados
    if (triggerType === 'keyboard') {
      const beforeCursor = currentValue.substring(0, cursorPosition);
      if (beforeCursor.endsWith('{{')) {
        prefixToRemove = 2;
        insertPos = cursorPosition - 2;
      } else if (beforeCursor.endsWith('{')) {
        prefixToRemove = 1;
        insertPos = cursorPosition - 1;
      }
    }

    const before = currentValue.substring(0, insertPos);
    const after = currentValue.substring(cursorPosition);
    const newValue = before + template + after;

    // Verificar maxLength
    if (maxLength && newValue.length > maxLength) {
      closePicker();
      return;
    }

    onChange(newValue);

    // Fechar e restaurar foco
    closePicker();

    // Posicionar cursor apos a variavel inserida
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = insertPos + template.length;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }, [value, cursorPosition, triggerType, maxLength, onChange, closePicker]);

  // Handler de keydown
  const handleKeyDown = useCallback((e) => {
    // Detectar {{ para abrir picker
    if (e.key === '{' && !isPickerOpen) {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart || 0;
      const currentValue = value || '';
      const charBefore = currentValue[cursorPos - 1];

      if (charBefore === '{') {
        e.preventDefault();
        setCursorPosition(cursorPos);
        openPicker('keyboard');
        return;
      }
    }
  }, [isPickerOpen, value, openPicker]);

  // Click outside para fechar
  useEffect(() => {
    if (!isPickerOpen) return;

    const handleClickOutside = (e) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target) &&
        !e.target.closest('[data-variable-button]')
      ) {
        closePicker();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPickerOpen, closePicker]);

  const charCount = (value || '').length;

  return (
    <div className="relative">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          rows={rows}
          className={`
            w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
            text-sm text-gray-700 dark:text-gray-200 resize-none
            bg-white dark:bg-gray-800
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        />

        {/* Botao de variaveis */}
        {showVariableButton && !disabled && (
          <button
            type="button"
            data-variable-button
            onClick={() => openPicker('button')}
            className={`
              absolute top-2 right-2 p-1.5 rounded
              text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30
              transition-colors
              ${isPickerOpen ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' : ''}
            `}
            title="Inserir variavel (digite {{ )"
          >
            <Braces size={16} />
          </button>
        )}
      </div>

      {/* Contador de caracteres */}
      {(showCharCount || maxLength) && (
        <div className="flex justify-end mt-1">
          <span className={`text-xs ${
            maxLength && charCount > maxLength * 0.9
              ? 'text-red-500 dark:text-red-400'
              : 'text-gray-400 dark:text-gray-500'
          }`}>
            {charCount}{maxLength ? ` / ${maxLength}` : ''}
          </span>
        </div>
      )}

      {/* Picker */}
      <VariablePicker
        ref={pickerRef}
        isOpen={isPickerOpen}
        position={pickerPosition}
        searchQuery={searchQuery}
        selectedIndex={selectedIndex}
        onSearchChange={setSearchQuery}
        onSelectIndex={setSelectedIndex}
        onInsert={insertVariable}
        onClose={closePicker}
        context={context}
        customVariables={customVariables}
        workflowVariables={workflowVariables}
        realValues={realValues}
        isLoadingValues={isLoadingValues}
      />
    </div>
  );
};

export default VariableTextarea;
