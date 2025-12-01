import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Users,
  GripVertical,
  Check,
  X,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  UserPlus,
  UserMinus
} from 'lucide-react';
import api from '../services/api';

/**
 * RodizioUserSelector
 * Componente para selecionar e ordenar usuários no rodízio de atendimento
 */
const RodizioUserSelector = ({
  sectorId,
  selectedUsers = [],
  onChange,
  disabled = false,
  error = null
}) => {
  const [sectorUsers, setSectorUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Load users when sector changes
  useEffect(() => {
    const loadSectorUsers = async () => {
      if (!sectorId) {
        setSectorUsers([]);
        return;
      }

      try {
        setLoading(true);
        setLoadError(null);
        const response = await api.getSectorUsers(sectorId);
        if (response.success) {
          setSectorUsers(response.data || []);
        } else {
          setLoadError('Erro ao carregar usuários do setor');
        }
      } catch (err) {
        console.error('Error loading sector users:', err);
        setLoadError('Erro ao carregar usuários do setor');
      } finally {
        setLoading(false);
      }
    };

    loadSectorUsers();
  }, [sectorId]);

  // Toggle user selection
  const toggleUser = useCallback((userId) => {
    if (disabled) return;

    const isSelected = selectedUsers.some(u => u.id === userId);

    if (isSelected) {
      // Remove user
      onChange(selectedUsers.filter(u => u.id !== userId));
    } else {
      // Add user at the end
      const user = sectorUsers.find(u => u.id === userId);
      if (user) {
        onChange([...selectedUsers, { id: user.id, name: user.name, email: user.email }]);
      }
    }
  }, [selectedUsers, sectorUsers, onChange, disabled]);

  // Move user up in the order
  const moveUp = useCallback((index) => {
    if (disabled || index === 0) return;

    const newOrder = [...selectedUsers];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    onChange(newOrder);
  }, [selectedUsers, onChange, disabled]);

  // Move user down in the order
  const moveDown = useCallback((index) => {
    if (disabled || index === selectedUsers.length - 1) return;

    const newOrder = [...selectedUsers];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    onChange(newOrder);
  }, [selectedUsers, onChange, disabled]);

  // Select all users
  const selectAll = useCallback(() => {
    if (disabled) return;
    onChange(sectorUsers.map(u => ({ id: u.id, name: u.name, email: u.email })));
  }, [sectorUsers, onChange, disabled]);

  // Clear selection
  const clearAll = useCallback(() => {
    if (disabled) return;
    onChange([]);
  }, [onChange, disabled]);

  // No sector selected
  if (!sectorId) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
        <Users className="w-6 h-6 text-gray-400 mx-auto mb-1.5" />
        <p className="text-xs text-gray-600">
          Selecione um setor primeiro para configurar o rodízio
        </p>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
        <Loader2 className="w-5 h-5 text-purple-600 animate-spin mx-auto mb-1.5" />
        <p className="text-xs text-gray-600">Carregando usuários do setor...</p>
      </div>
    );
  }

  // Error state
  if (loadError) {
    return (
      <div className="p-4 bg-red-50 rounded-lg border border-red-200 text-center">
        <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-1.5" />
        <p className="text-xs text-red-600">{loadError}</p>
      </div>
    );
  }

  // No users in sector
  if (sectorUsers.length === 0) {
    return (
      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-center">
        <Users className="w-6 h-6 text-amber-500 mx-auto mb-1.5" />
        <p className="text-xs text-amber-700">
          Nenhum usuário encontrado neste setor
        </p>
        <p className="text-[10px] text-amber-600 mt-0.5">
          Adicione usuários ao setor para configurar o rodízio
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-600">
          <span className="font-medium">{selectedUsers.length}</span> de{' '}
          <span className="font-medium">{sectorUsers.length}</span> selecionados
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={selectAll}
            disabled={disabled || selectedUsers.length === sectorUsers.length}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-purple-600 bg-purple-50 rounded hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UserPlus className="w-3 h-3" />
            Todos
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={disabled || selectedUsers.length === 0}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UserMinus className="w-3 h-3" />
            Limpar
          </button>
        </div>
      </div>

      {/* Two columns: Available users | Selected users (rotation order) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Available users */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200">
            <h4 className="text-xs font-medium text-gray-700">Usuários do Setor</h4>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {sectorUsers.map(user => {
              const isSelected = selectedUsers.some(u => u.id === user.id);
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleUser(user.id)}
                  disabled={disabled}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-left border-b border-gray-100 last:border-0
                    transition-colors
                    ${isSelected
                      ? 'bg-purple-50 text-purple-900'
                      : 'bg-white hover:bg-gray-50 text-gray-900'
                    }
                    ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                  `}
                >
                  <div className={`
                    w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                    ${isSelected
                      ? 'border-purple-600 bg-purple-600'
                      : 'border-gray-300 bg-white'
                    }
                  `}>
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{user.name}</div>
                    <div className="text-[10px] text-gray-500 truncate">{user.email}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected users (rotation order) */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-3 py-1.5 bg-purple-50 border-b border-purple-200">
            <h4 className="text-xs font-medium text-purple-700">Ordem do Rodízio</h4>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {selectedUsers.length === 0 ? (
              <div className="p-3 text-center text-xs text-gray-500">
                Selecione usuários para o rodízio
              </div>
            ) : (
              selectedUsers.map((user, index) => (
                <div
                  key={user.id}
                  className="flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-100 last:border-0 bg-white"
                >
                  {/* Order number */}
                  <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </div>

                  {/* User info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 truncate">
                      {user.name}
                    </div>
                  </div>

                  {/* Reorder buttons */}
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveUp(index)}
                      disabled={disabled || index === 0}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Mover para cima"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(index)}
                      disabled={disabled || index === selectedUsers.length - 1}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Mover para baixo"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleUser(user.id)}
                      disabled={disabled}
                      className="p-0.5 text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Remover"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Helper text */}
      <p className="text-[10px] text-gray-500">
        Leads serão distribuídos na ordem definida. Após o último, volta ao primeiro.
      </p>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
};

export default RodizioUserSelector;
