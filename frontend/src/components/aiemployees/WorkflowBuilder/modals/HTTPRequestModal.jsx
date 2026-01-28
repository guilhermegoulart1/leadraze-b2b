import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Globe,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Copy,
  Code,
  MousePointer,
  Braces
} from 'lucide-react';
import api from '../../../../services/api';
import VariablePicker from '../VariablePicker';
import { formatVariableTemplate } from '../../../../constants/workflowVariables';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const METHOD_COLORS = {
  GET: 'bg-green-500',
  POST: 'bg-blue-500',
  PUT: 'bg-yellow-500',
  PATCH: 'bg-purple-500',
  DELETE: 'bg-red-500'
};

// Droppable Input - accepts dragged JSON paths and {{ trigger for variable picker
function DroppableInput({ value, onChange, placeholder, className, type = 'input', rows, showVariableButton = true, ...props }) {
  const [isOver, setIsOver] = React.useState(false);
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [pickerPosition, setPickerPosition] = React.useState({ top: 0, left: 0 });
  const [cursorPosition, setCursorPosition] = React.useState(0);
  const [triggerType, setTriggerType] = React.useState(null);
  const inputRef = React.useRef(null);
  const pickerRef = React.useRef(null);

  // Calcular posicao do picker
  const calculatePickerPosition = React.useCallback(() => {
    if (!inputRef.current) return { top: 0, left: 0 };
    const rect = inputRef.current.getBoundingClientRect();
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
  const openPicker = React.useCallback((typeArg = 'button') => {
    if (!inputRef.current) return;
    setCursorPosition(inputRef.current.selectionStart || 0);
    setTriggerType(typeArg);
    setPickerPosition(calculatePickerPosition());
    setIsPickerOpen(true);
    setSearchQuery('');
    setSelectedIndex(0);
  }, [calculatePickerPosition]);

  // Fechar picker
  const closePicker = React.useCallback(() => {
    setIsPickerOpen(false);
    setSearchQuery('');
    setSelectedIndex(0);
    setTriggerType(null);
    inputRef.current?.focus();
  }, []);

  // Inserir variavel
  const insertVariable = React.useCallback((variableKey) => {
    if (!inputRef.current) return;

    const template = formatVariableTemplate(variableKey);
    const currentValue = value || '';

    let insertPos = cursorPosition;

    // Se aberto por {{ remover os caracteres ja digitados
    if (triggerType === 'keyboard') {
      const beforeCursor = currentValue.substring(0, cursorPosition);
      if (beforeCursor.endsWith('{{')) {
        insertPos = cursorPosition - 2;
      } else if (beforeCursor.endsWith('{')) {
        insertPos = cursorPosition - 1;
      }
    }

    const before = currentValue.substring(0, insertPos);
    const after = currentValue.substring(cursorPosition);
    const newValue = before + template + after;

    onChange({ target: { value: newValue } });
    closePicker();

    setTimeout(() => {
      if (inputRef.current) {
        const newPos = insertPos + template.length;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }, [value, cursorPosition, triggerType, onChange, closePicker]);

  // Handler de keydown para detectar {{
  const handleKeyDown = React.useCallback((e) => {
    if (e.key === '{' && !isPickerOpen) {
      const input = inputRef.current;
      if (!input) return;

      const cursorPos = input.selectionStart || 0;
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
  React.useEffect(() => {
    if (!isPickerOpen) return;

    const handleClickOutside = (e) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target) &&
        !e.target.closest('[data-variable-button]')
      ) {
        closePicker();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPickerOpen, closePicker]);

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);

    const path = e.dataTransfer.getData('text/plain');
    if (!path) return;

    const insertText = `{{${path}}}`;
    const input = inputRef.current;

    if (input) {
      const start = input.selectionStart || (value || '').length;
      const end = input.selectionEnd || (value || '').length;
      const newValue = (value || '').slice(0, start) + insertText + (value || '').slice(end);
      onChange({ target: { value: newValue } });

      // Set cursor after inserted text
      setTimeout(() => {
        input.focus();
        const newCursorPos = start + insertText.length;
        input.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else {
      onChange({ target: { value: (value || '') + insertText } });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsOver(true);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const baseClass = `${className} ${isOver ? 'ring-2 ring-purple-500 border-purple-500 bg-purple-50 dark:bg-purple-900/20' : ''}`;

  const inputElement = type === 'textarea' ? (
    <textarea
      ref={inputRef}
      value={value || ''}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      rows={rows}
      className={baseClass}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      {...props}
    />
  ) : (
    <input
      ref={inputRef}
      type="text"
      value={value || ''}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={`${baseClass} ${showVariableButton ? 'pr-8' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      {...props}
    />
  );

  return (
    <div className="relative">
      <div className="relative">
        {inputElement}
        {showVariableButton && type !== 'textarea' && (
          <button
            type="button"
            data-variable-button
            onClick={() => openPicker('button')}
            className={`
              absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded
              text-gray-400 hover:text-purple-500 hover:bg-purple-500/10
              transition-colors
              ${isPickerOpen ? 'text-purple-500 bg-purple-500/10' : ''}
            `}
            title="Inserir variavel (digite {{ )"
          >
            <Braces size={14} />
          </button>
        )}
      </div>

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
      />
    </div>
  );
}

// Interactive JSON Viewer Component - drag to extract paths (like n8n)
// All nodes expanded by default, vertical layout
function InteractiveJsonViewer({ data, onDragStart: onDragStartProp }) {

  const handleDragStart = (e, path, value) => {
    e.dataTransfer.setData('text/plain', path);
    e.dataTransfer.setData('application/json', JSON.stringify({ path, value }));
    e.dataTransfer.effectAllowed = 'copy';
    // Visual feedback
    e.target.style.opacity = '0.5';
    if (onDragStartProp) onDragStartProp(path);
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
  };

  const renderValue = (value, currentPath) => {
    const dragProps = {
      draggable: true,
      onDragStart: (e) => handleDragStart(e, currentPath, value),
      onDragEnd: handleDragEnd,
    };

    if (value === null) {
      return (
        <span
          {...dragProps}
          className="text-gray-500 cursor-grab hover:bg-purple-500/30 px-1 rounded active:cursor-grabbing"
          title={`Arraste: ${currentPath}`}
        >
          null
        </span>
      );
    }

    if (typeof value === 'boolean') {
      return (
        <span
          {...dragProps}
          className="text-orange-400 cursor-grab hover:bg-purple-500/30 px-1 rounded active:cursor-grabbing"
          title={`Arraste: ${currentPath}`}
        >
          {value.toString()}
        </span>
      );
    }

    if (typeof value === 'number') {
      return (
        <span
          {...dragProps}
          className="text-cyan-400 cursor-grab hover:bg-purple-500/30 px-1 rounded active:cursor-grabbing"
          title={`Arraste: ${currentPath}`}
        >
          {value}
        </span>
      );
    }

    if (typeof value === 'string') {
      const displayValue = value.length > 60 ? value.substring(0, 60) + '...' : value;
      return (
        <span
          {...dragProps}
          className="text-green-400 cursor-grab hover:bg-purple-500/30 px-1 rounded active:cursor-grabbing"
          title={`Arraste: ${currentPath}`}
        >
          "{displayValue}"
        </span>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div className="ml-3 border-l border-gray-700 pl-2 mt-1">
          {value.map((item, idx) => {
            const itemPath = `${currentPath}.${idx}`;
            return (
              <div key={idx} className="py-0.5">
                <span
                  draggable
                  onDragStart={(e) => handleDragStart(e, itemPath, item)}
                  onDragEnd={handleDragEnd}
                  className="text-gray-500 cursor-grab hover:bg-purple-500/30 px-1 rounded active:cursor-grabbing"
                  title={`Arraste: ${itemPath}`}
                >
                  [{idx}]
                </span>
                <span className="text-gray-600 mx-1">:</span>
                {renderValue(item, itemPath)}
              </div>
            );
          })}
        </div>
      );
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value);
      return (
        <div className="ml-3 border-l border-gray-700 pl-2 mt-1">
          {entries.map(([k, v]) => {
            const keyPath = currentPath ? `${currentPath}.${k}` : k;
            return (
              <div key={k} className="py-0.5">
                <span
                  draggable
                  onDragStart={(e) => handleDragStart(e, keyPath, v)}
                  onDragEnd={handleDragEnd}
                  className="text-purple-300 cursor-grab hover:bg-purple-500/30 px-1 rounded active:cursor-grabbing"
                  title={`Arraste: ${keyPath}`}
                >
                  {k}
                </span>
                <span className="text-gray-600 mx-1">:</span>
                {renderValue(v, keyPath)}
              </div>
            );
          })}
        </div>
      );
    }

    return <span className="text-gray-400">{String(value)}</span>;
  };

  if (!data || typeof data !== 'object') {
    return <span className="text-gray-400">{JSON.stringify(data)}</span>;
  }

  return (
    <div className="font-mono text-xs">
      {Object.entries(data).map(([key, value]) => {
        const keyPath = key;
        return (
          <div key={key} className="py-0.5">
            <span
              draggable
              onDragStart={(e) => handleDragStart(e, keyPath, value)}
              onDragEnd={handleDragEnd}
              className="text-purple-300 cursor-grab hover:bg-purple-500/30 px-1 rounded font-semibold active:cursor-grabbing"
              title={`Arraste: ${keyPath}`}
            >
              {key}
            </span>
            <span className="text-gray-600 mx-1">:</span>
            {typeof value === 'object' && value !== null ? (
              renderValue(value, keyPath)
            ) : (
              renderValue(value, keyPath)
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function HTTPRequestModal({ isOpen, onClose, nodeData, onSave }) {
  const [localData, setLocalData] = useState({
    label: 'HTTP Request',
    method: 'GET',
    url: '',
    headers: [],
    queryParams: [],
    bodyType: 'json',
    body: '',
    timeout: 30000,
    extractVariables: [],
    ...nodeData
  });

  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    headers: true,
    queryParams: false,
    body: true,
    variables: true
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  useEffect(() => {
    if (nodeData) {
      setLocalData({
        label: 'HTTP Request',
        method: 'GET',
        url: '',
        headers: [],
        queryParams: [],
        bodyType: 'json',
        body: '',
        timeout: 30000,
        extractVariables: [],
        ...nodeData
      });
    }
  }, [nodeData]);

  const handleChange = (field, value) => {
    setLocalData(prev => ({ ...prev, [field]: value }));
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Headers management
  const addHeader = () => {
    handleChange('headers', [...(localData.headers || []), { key: '', value: '' }]);
  };

  const updateHeader = (index, field, value) => {
    const headers = [...(localData.headers || [])];
    headers[index] = { ...headers[index], [field]: value };
    handleChange('headers', headers);
  };

  const removeHeader = (index) => {
    const headers = [...(localData.headers || [])];
    headers.splice(index, 1);
    handleChange('headers', headers);
  };

  // Query Params management
  const addQueryParam = () => {
    handleChange('queryParams', [...(localData.queryParams || []), { key: '', value: '' }]);
  };

  const updateQueryParam = (index, field, value) => {
    const queryParams = [...(localData.queryParams || [])];
    queryParams[index] = { ...queryParams[index], [field]: value };
    handleChange('queryParams', queryParams);
  };

  const removeQueryParam = (index) => {
    const queryParams = [...(localData.queryParams || [])];
    queryParams.splice(index, 1);
    handleChange('queryParams', queryParams);
  };

  // Variables management
  const addVariable = (path = '', variableName = '') => {
    handleChange('extractVariables', [
      ...(localData.extractVariables || []),
      { path, variableName }
    ]);
  };

  const updateVariable = (index, field, value) => {
    const variables = [...(localData.extractVariables || [])];
    variables[index] = { ...variables[index], [field]: value };
    handleChange('extractVariables', variables);
  };

  // Update multiple fields at once to avoid state race conditions
  const updateVariableFields = (index, fields) => {
    const variables = [...(localData.extractVariables || [])];
    variables[index] = { ...variables[index], ...fields };
    handleChange('extractVariables', variables);
  };

  const removeVariable = (index) => {
    const variables = [...(localData.extractVariables || [])];
    variables.splice(index, 1);
    handleChange('extractVariables', variables);
  };

  // Handle drag start from JSON viewer
  const handleJsonDragStart = (path) => {
    setIsDragging(true);
    setExpandedSections(prev => ({ ...prev, variables: true }));
  };

  // Handle drop on variable input or drop zone
  const handleDrop = (e, index = null) => {
    e.preventDefault();
    setIsDragging(false);
    setDragOverIndex(null);

    const path = e.dataTransfer.getData('text/plain');
    if (!path) return;

    // Generate a variable name from the path
    const pathParts = path.split('.');
    const suggestedName = pathParts[pathParts.length - 1].replace(/[^a-zA-Z0-9]/g, '') || 'value';

    if (index !== null) {
      // Update existing variable - both fields at once to avoid state race condition
      const currentVar = localData.extractVariables[index] || {};
      updateVariableFields(index, {
        path: path,
        variableName: currentVar.variableName || suggestedName
      });
    } else {
      // Add new variable
      addVariable(path, suggestedName);
    }
  };

  const handleDragOver = (e, index = null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleGlobalDragEnd = () => {
    setIsDragging(false);
    setDragOverIndex(null);
  };

  // Test HTTP Request
  const handleTest = async () => {
    if (!localData.url) {
      setTestResult({ success: false, error: 'URL is required' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await api.testHTTPRequest({
        method: localData.method || 'GET',
        url: localData.url,
        headers: localData.headers || [],
        queryParams: localData.queryParams || [],
        bodyType: localData.bodyType || 'json',
        body: localData.body || '',
        timeout: localData.timeout || 30000
      });

      setTestResult(response);
    } catch (error) {
      setTestResult({
        success: false,
        error: error.message || 'Request failed'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    onSave(localData);
    onClose();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  if (!isOpen) return null;

  // Get response data from the nested structure
  const responseData = testResult?.data;
  const responseBody = responseData?.body;
  const responseStatus = responseData?.status;
  const responseDuration = responseData?.duration;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onDragEnd={handleGlobalDragEnd}
      onDrop={(e) => { e.preventDefault(); handleGlobalDragEnd(); }}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-[900px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <input
                type="text"
                value={localData.label || 'HTTP Request'}
                onChange={(e) => handleChange('label', e.target.value)}
                className="text-lg font-semibold bg-transparent border-none outline-none text-gray-900 dark:text-white focus:ring-0 p-0"
                placeholder="Nome do no"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Faca requisicoes HTTP para APIs externas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Configuration */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 border-r border-gray-200 dark:border-gray-700">
            {/* Method & URL */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Requisicao
              </label>
              <div className="flex gap-2">
                <select
                  value={localData.method || 'GET'}
                  onChange={(e) => handleChange('method', e.target.value)}
                  className={`px-3 py-2.5 rounded-lg font-medium text-white text-sm ${METHOD_COLORS[localData.method || 'GET']} border-0 focus:ring-2 focus:ring-purple-500`}
                >
                  {HTTP_METHODS.map(method => (
                    <option key={method} value={method} className="bg-gray-800">{method}</option>
                  ))}
                </select>
                <DroppableInput
                  value={localData.url || ''}
                  onChange={(e) => handleChange('url', e.target.value)}
                  placeholder="https://api.exemplo.com/endpoint"
                  className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>
              <p className="text-xs text-purple-400 dark:text-purple-400">
                Arraste valores do JSON para inserir {'{{variavel}}'} ou digite manualmente
              </p>
            </div>

            {/* Headers Section */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('headers')}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Headers {localData.headers?.length > 0 && `(${localData.headers.length})`}
                </span>
                {expandedSections.headers ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </button>
              {expandedSections.headers && (
                <div className="p-4 space-y-3">
                  {(localData.headers || []).map((header, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={header.key}
                        onChange={(e) => updateHeader(idx, 'key', e.target.value)}
                        placeholder="Header name"
                        className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                      />
                      <DroppableInput
                        value={header.value}
                        onChange={(e) => updateHeader(idx, 'value', e.target.value)}
                        placeholder="Value (arraste variaveis aqui)"
                        className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:text-white transition-all"
                      />
                      <button
                        onClick={() => removeHeader(idx)}
                        className="flex-shrink-0 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addHeader}
                    className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar header
                  </button>
                </div>
              )}
            </div>

            {/* Query Params Section */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('queryParams')}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Query Params {localData.queryParams?.length > 0 && `(${localData.queryParams.length})`}
                </span>
                {expandedSections.queryParams ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </button>
              {expandedSections.queryParams && (
                <div className="p-4 space-y-3">
                  {(localData.queryParams || []).map((param, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={param.key}
                        onChange={(e) => updateQueryParam(idx, 'key', e.target.value)}
                        placeholder="Parameter name"
                        className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                      />
                      <DroppableInput
                        value={param.value}
                        onChange={(e) => updateQueryParam(idx, 'value', e.target.value)}
                        placeholder="Value (arraste variaveis aqui)"
                        className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:text-white transition-all"
                      />
                      <button
                        onClick={() => removeQueryParam(idx)}
                        className="flex-shrink-0 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addQueryParam}
                    className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar parametro
                  </button>
                </div>
              )}
            </div>

            {/* Body Section */}
            {['POST', 'PUT', 'PATCH'].includes(localData.method) && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('body')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Body
                  </span>
                  {expandedSections.body ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                {expandedSections.body && (
                  <div className="p-4 space-y-3">
                    <select
                      value={localData.bodyType || 'json'}
                      onChange={(e) => handleChange('bodyType', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                    >
                      <option value="json">JSON</option>
                      <option value="form">Form URL Encoded</option>
                      <option value="text">Text</option>
                    </select>
                    <div className="relative">
                      <DroppableInput
                        type="textarea"
                        value={localData.body || ''}
                        onChange={(e) => handleChange('body', e.target.value)}
                        placeholder={localData.bodyType === 'json' ? '{\n  "key": "value"\n}' : 'key=value&key2=value2'}
                        rows={8}
                        className="w-full px-4 py-3 bg-gray-900 text-green-400 font-mono text-sm border border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-all"
                      />
                      <div className="absolute top-2 right-2">
                        <Code className="w-4 h-4 text-gray-500" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Extract Variables Section */}
            <div className={`border rounded-lg overflow-hidden transition-all ${
              isDragging
                ? 'border-purple-500 border-2 shadow-lg shadow-purple-500/20'
                : 'border-gray-200 dark:border-gray-700'
            }`}>
              <button
                onClick={() => toggleSection('variables')}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Extrair Variaveis {localData.extractVariables?.length > 0 && `(${localData.extractVariables.length})`}
                </span>
                {expandedSections.variables ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </button>
              {expandedSections.variables && (
                <div className="p-4 space-y-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Arraste valores do JSON da resposta para ca, ou adicione manualmente
                  </p>
                  {(localData.extractVariables || []).map((variable, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
                        dragOverIndex === idx
                          ? 'bg-purple-100 dark:bg-purple-900/30 ring-2 ring-purple-500'
                          : ''
                      }`}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, idx)}
                    >
                      <input
                        type="text"
                        value={variable.path}
                        onChange={(e) => updateVariable(idx, 'path', e.target.value)}
                        placeholder="body.data.user.id"
                        className="flex-1 min-w-0 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:text-white font-mono"
                      />
                      <span className="flex-shrink-0 text-gray-400">→</span>
                      <input
                        type="text"
                        value={variable.variableName}
                        onChange={(e) => updateVariable(idx, 'variableName', e.target.value)}
                        placeholder="userId"
                        className="flex-1 min-w-0 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:text-white font-mono"
                      />
                      <button
                        onClick={() => removeVariable(idx)}
                        className="flex-shrink-0 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Remover variavel"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {/* Drop zone for new variable */}
                  <div
                    onDragOver={(e) => handleDragOver(e, 'new')}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, null)}
                    className={`border-2 border-dashed rounded-lg p-4 text-center transition-all ${
                      dragOverIndex === 'new'
                        ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/30'
                        : isDragging
                          ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/10'
                          : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {isDragging ? (
                      <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                        Solte aqui para criar nova variavel
                      </p>
                    ) : (
                      <button
                        onClick={() => addVariable()}
                        className="flex items-center justify-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 w-full"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar variavel
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Timeout */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Timeout (ms)
              </label>
              <input
                type="number"
                value={localData.timeout || 30000}
                onChange={(e) => handleChange('timeout', parseInt(e.target.value))}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:text-white"
              />
            </div>
          </div>

          {/* Right Panel - Test & Response */}
          <div className="w-[380px] flex flex-col bg-gray-50 dark:bg-gray-800/50">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={handleTest}
                disabled={isTesting || !localData.url}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Testando...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Testar Requisicao
                  </>
                )}
              </button>
            </div>

            {/* Response Area */}
            <div className="flex-1 overflow-y-auto p-4">
              {testResult ? (
                <div className="space-y-4">
                  {/* Status */}
                  <div className={`flex items-center justify-between p-3 rounded-lg ${
                    testResult.success && responseStatus >= 200 && responseStatus < 400
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}>
                    <div className="flex items-center gap-2">
                      {testResult.success && responseStatus >= 200 && responseStatus < 400 ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <XCircle className="w-5 h-5" />
                      )}
                      <span className="font-medium">
                        {testResult.success ? `Status: ${responseStatus}` : 'Erro'}
                      </span>
                    </div>
                    {responseDuration && (
                      <span className="text-xs opacity-75">{responseDuration}ms</span>
                    )}
                  </div>

                  {/* Error Message */}
                  {testResult.error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-600 dark:text-red-400">
                      {testResult.error}
                    </div>
                  )}

                  {/* Full Response - Interactive JSON */}
                  {responseData && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Resposta Completa
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(responseData, null, 2))}
                          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500"
                          title="Copiar"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-purple-400 flex items-center gap-1">
                        <MousePointer className="w-3 h-3" />
                        Arraste valores para qualquer campo de texto ou para "Extrair Variaveis"
                      </p>
                      <div className="p-3 bg-gray-900 rounded-lg overflow-auto max-h-[350px]">
                        <InteractiveJsonViewer
                          data={responseData}
                          onDragStart={handleJsonDragStart}
                        />
                      </div>
                    </div>
                  )}

                  {/* Extracted Variables Preview */}
                  {testResult.success && localData.extractVariables?.length > 0 && responseData && (
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Variaveis Extraidas
                      </span>
                      <div className="space-y-1">
                        {localData.extractVariables.map((v, idx) => {
                          const extractedValue = getValueByPath(responseData, v.path);
                          return (
                            <div key={idx} className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                              <span className="font-mono text-purple-600 dark:text-purple-400">
                                {`{{${v.variableName || '?'}}}`}
                              </span>
                              <span className="font-mono text-gray-600 dark:text-gray-400 truncate max-w-[180px]" title={String(extractedValue)}>
                                {extractedValue !== undefined ? String(extractedValue) : 'undefined'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <Globe className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">Clique em "Testar Requisicao"</p>
                  <p className="text-xs">para ver a resposta</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper function to extract value from nested object
function getValueByPath(obj, path) {
  if (!path) return undefined;
  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    value = value[key];
  }
  return value;
}
