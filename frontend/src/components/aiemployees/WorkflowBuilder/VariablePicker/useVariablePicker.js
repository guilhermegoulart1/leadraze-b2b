// frontend/src/components/aiemployees/WorkflowBuilder/VariablePicker/useVariablePicker.js
// Hook para gerenciar estado e comportamento do VariablePicker

import { useState, useCallback, useRef, useEffect } from 'react';
import { formatVariableTemplate } from '../../../../constants/workflowVariables';

export const useVariablePicker = (options = {}) => {
  const {
    onInsert,
    context = {},
    customVariables = [],
    workflowVariables = {}
  } = options;

  // Estado do picker
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [triggerType, setTriggerType] = useState(null); // 'keyboard' ou 'button'

  // Refs
  const activeInputRef = useRef(null);
  const cursorPositionRef = useRef(0);
  const pickerRef = useRef(null);

  // Abrir picker
  const openPicker = useCallback((inputElement, type = 'keyboard') => {
    if (!inputElement) return;

    activeInputRef.current = inputElement;
    cursorPositionRef.current = inputElement.selectionStart || 0;
    setTriggerType(type);

    // Calcular posicao
    const rect = inputElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const pickerHeight = 400; // altura maxima do picker
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top, left;

    // Decidir se abre acima ou abaixo
    if (spaceBelow >= pickerHeight || spaceBelow >= spaceAbove) {
      // Abre abaixo
      top = rect.bottom + 4;
    } else {
      // Abre acima
      top = rect.top - pickerHeight - 4;
    }

    // Posicao horizontal - alinhar com o input
    left = rect.left;

    // Garantir que nao ultrapasse a borda direita
    const pickerWidth = 320;
    if (left + pickerWidth > window.innerWidth) {
      left = window.innerWidth - pickerWidth - 16;
    }

    // Garantir que nao ultrapasse a borda esquerda
    if (left < 16) {
      left = 16;
    }

    setPosition({ top, left });
    setIsOpen(true);
    setSearchQuery('');
    setSelectedIndex(0);
  }, []);

  // Fechar picker
  const closePicker = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
    setSelectedIndex(0);
    setTriggerType(null);
  }, []);

  // Inserir variavel no input
  const insertVariable = useCallback((variableKey) => {
    const input = activeInputRef.current;
    if (!input) return;

    const template = formatVariableTemplate(variableKey);
    const cursorPos = cursorPositionRef.current;
    const currentValue = input.value || '';

    // Se foi aberto por {{ no teclado, remover os {{ ja digitados
    let insertPos = cursorPos;
    let prefixToRemove = 0;

    if (triggerType === 'keyboard') {
      // Verificar se tem {{ antes do cursor
      const beforeCursor = currentValue.substring(0, cursorPos);
      if (beforeCursor.endsWith('{{')) {
        prefixToRemove = 2;
        insertPos = cursorPos - 2;
      } else if (beforeCursor.endsWith('{')) {
        prefixToRemove = 1;
        insertPos = cursorPos - 1;
      }
    }

    // Construir novo valor
    const before = currentValue.substring(0, insertPos);
    const after = currentValue.substring(cursorPos);
    const newValue = before + template + after;
    const newCursorPos = insertPos + template.length;

    // Atualizar input
    // Usar nativeInputValueSetter para garantir que React detecte a mudanca
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set || Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, newValue);
    } else {
      input.value = newValue;
    }

    // Disparar evento de input para React
    const event = new Event('input', { bubbles: true });
    input.dispatchEvent(event);

    // Restaurar foco e posicao do cursor
    input.focus();
    input.setSelectionRange(newCursorPos, newCursorPos);

    // Callback opcional
    if (onInsert) {
      onInsert(variableKey, template, newValue);
    }

    // Fechar picker
    closePicker();
  }, [triggerType, onInsert, closePicker]);

  // Handler de keydown para o input
  const handleInputKeyDown = useCallback((e, inputElement) => {
    // Detectar {{ para abrir picker
    if (e.key === '{') {
      const input = inputElement || e.target;
      const cursorPos = input.selectionStart || 0;
      const value = input.value || '';
      const charBefore = value[cursorPos - 1];

      if (charBefore === '{') {
        // Usuario digitou {{ - abrir picker
        e.preventDefault(); // Prevenir o segundo {
        openPicker(input, 'keyboard');
        return;
      }
    }

    // Se picker esta aberto, gerenciar navegacao
    if (isOpen) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => prev + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(0, prev - 1));
          break;
        case 'Enter':
          e.preventDefault();
          // O componente VariablePicker vai lidar com a insercao
          break;
        case 'Escape':
          e.preventDefault();
          closePicker();
          break;
        case 'Tab':
          closePicker();
          break;
        default:
          break;
      }
    }
  }, [isOpen, openPicker, closePicker]);

  // Handler para clique fora do picker
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target) &&
        activeInputRef.current &&
        !activeInputRef.current.contains(e.target)
      ) {
        closePicker();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closePicker]);

  // Resetar selectedIndex quando search muda
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  return {
    // Estado
    isOpen,
    searchQuery,
    selectedIndex,
    position,
    triggerType,

    // Setters
    setSearchQuery,
    setSelectedIndex,

    // Refs
    pickerRef,
    activeInputRef,

    // Acoes
    openPicker,
    closePicker,
    insertVariable,
    handleInputKeyDown,

    // Contexto passado
    context,
    customVariables,
    workflowVariables
  };
};

export default useVariablePicker;
