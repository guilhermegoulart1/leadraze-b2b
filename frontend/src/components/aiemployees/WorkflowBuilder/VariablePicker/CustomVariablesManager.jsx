// frontend/src/components/aiemployees/WorkflowBuilder/VariablePicker/CustomVariablesManager.jsx
// Modal para gerenciar variaveis customizadas do workflow

import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Edit2, Check, AlertCircle } from 'lucide-react';

const CustomVariablesManager = ({
  isOpen,
  onClose,
  customVariables = [],
  onSave
}) => {
  const [variables, setVariables] = useState(customVariables);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [newVariable, setNewVariable] = useState({ key: '', label: '', defaultValue: '', description: '' });
  const [error, setError] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Validar key de variavel
  const validateKey = useCallback((key, excludeIndex = -1) => {
    if (!key) return 'Nome da variavel e obrigatorio';
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      return 'Use apenas letras, numeros e underscore. Comece com letra ou _';
    }
    // Verificar duplicata
    const duplicate = variables.findIndex((v, i) =>
      i !== excludeIndex && v.key.toLowerCase() === key.toLowerCase()
    );
    if (duplicate !== -1) {
      return 'Ja existe uma variavel com este nome';
    }
    return '';
  }, [variables]);

  // Adicionar nova variavel
  const handleAdd = useCallback(() => {
    const keyError = validateKey(newVariable.key);
    if (keyError) {
      setError(keyError);
      return;
    }

    setVariables(prev => [...prev, { ...newVariable }]);
    setNewVariable({ key: '', label: '', defaultValue: '', description: '' });
    setIsAddingNew(false);
    setError('');
  }, [newVariable, validateKey]);

  // Atualizar variavel existente
  const handleUpdate = useCallback((index, field, value) => {
    setVariables(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  // Remover variavel
  const handleRemove = useCallback((index) => {
    setVariables(prev => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(-1);
    }
  }, [editingIndex]);

  // Salvar e fechar
  const handleSave = useCallback(() => {
    // Validar todas as variaveis
    for (let i = 0; i < variables.length; i++) {
      const keyError = validateKey(variables[i].key, i);
      if (keyError) {
        setError(`Variavel ${i + 1}: ${keyError}`);
        setEditingIndex(i);
        return;
      }
    }

    onSave(variables);
    onClose();
  }, [variables, validateKey, onSave, onClose]);

  // Cancelar
  const handleCancel = useCallback(() => {
    setVariables(customVariables);
    setNewVariable({ key: '', label: '', defaultValue: '', description: '' });
    setIsAddingNew(false);
    setEditingIndex(-1);
    setError('');
    onClose();
  }, [customVariables, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Variaveis Personalizadas
          </h2>
          <button
            onClick={handleCancel}
            className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Variables list */}
          <div className="space-y-3">
            {variables.map((variable, index) => (
              <div
                key={index}
                className={`
                  p-4 border rounded-lg
                  ${editingIndex === index ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'}
                `}
              >
                {editingIndex === index ? (
                  // Edit mode
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Nome da Variavel *
                        </label>
                        <input
                          type="text"
                          value={variable.key}
                          onChange={(e) => handleUpdate(index, 'key', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="minha_variavel"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Label (exibicao)
                        </label>
                        <input
                          type="text"
                          value={variable.label || ''}
                          onChange={(e) => handleUpdate(index, 'label', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Minha Variavel"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Valor Padrao
                        </label>
                        <input
                          type="text"
                          value={variable.defaultValue || ''}
                          onChange={(e) => handleUpdate(index, 'defaultValue', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Valor padrao"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Descricao
                        </label>
                        <input
                          type="text"
                          value={variable.description || ''}
                          onChange={(e) => handleUpdate(index, 'description', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Descricao opcional"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingIndex(-1)}
                        className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          const err = validateKey(variable.key, index);
                          if (err) {
                            setError(err);
                          } else {
                            setError('');
                            setEditingIndex(-1);
                          }
                        }}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
                      >
                        <Check size={14} />
                        OK
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-900/30 px-2 py-0.5 rounded">
                          {`{{${variable.key}}}`}
                        </code>
                        {variable.label && (
                          <span className="text-sm text-gray-700 dark:text-gray-300">{variable.label}</span>
                        )}
                      </div>
                      {(variable.description || variable.defaultValue) && (
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {variable.description}
                          {variable.defaultValue && (
                            <span className="ml-2 text-gray-400 dark:text-gray-500">
                              Padrao: {variable.defaultValue}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingIndex(index)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                        title="Editar"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleRemove(index)}
                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                        title="Remover"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add new variable form */}
            {isAddingNew ? (
              <div className="p-4 border border-dashed border-blue-300 dark:border-blue-600 rounded-lg bg-blue-50/50 dark:bg-blue-900/20">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Nome da Variavel *
                      </label>
                      <input
                        type="text"
                        value={newVariable.key}
                        onChange={(e) => setNewVariable(prev => ({ ...prev, key: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="minha_variavel"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Label (exibicao)
                      </label>
                      <input
                        type="text"
                        value={newVariable.label}
                        onChange={(e) => setNewVariable(prev => ({ ...prev, label: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Minha Variavel"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Valor Padrao
                      </label>
                      <input
                        type="text"
                        value={newVariable.defaultValue}
                        onChange={(e) => setNewVariable(prev => ({ ...prev, defaultValue: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Valor padrao"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Descricao
                      </label>
                      <input
                        type="text"
                        value={newVariable.description}
                        onChange={(e) => setNewVariable(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Descricao opcional"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setIsAddingNew(false);
                        setNewVariable({ key: '', label: '', defaultValue: '', description: '' });
                        setError('');
                      }}
                      className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleAdd}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
                    >
                      <Plus size={14} />
                      Adicionar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingNew(true)}
                className="w-full p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Adicionar Variavel
              </button>
            )}
          </div>

          {/* Empty state */}
          {variables.length === 0 && !isAddingNew && (
            <div className="text-center py-8 text-gray-400 dark:text-gray-500">
              <p className="mb-2">Nenhuma variavel personalizada definida.</p>
              <p className="text-sm">
                Variaveis personalizadas permitem armazenar dados durante o workflow.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default CustomVariablesManager;
