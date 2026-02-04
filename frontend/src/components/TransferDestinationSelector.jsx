import React, { useState, useEffect } from 'react';
import { User, Building2, RefreshCw, Users } from 'lucide-react';
import api from '../services/api';

/**
 * TransferDestinationSelector
 * Reusable component for selecting a transfer destination.
 * Supports: default, sector (round robin), sector (specific user), direct user
 */
const TransferDestinationSelector = ({
  destinationType = 'default',
  destinationConfig = {},
  onChangeType,
  onChangeConfig,
  disabled = false,
  showDefaultOption = true,
  compact = false
}) => {
  const [sectors, setSectors] = useState([]);
  const [users, setUsers] = useState([]);
  const [sectorUsers, setSectorUsers] = useState([]);
  const [loadingSectors, setLoadingSectors] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingSectorUsers, setLoadingSectorUsers] = useState(false);

  useEffect(() => {
    loadSectors();
    loadUsers();
  }, []);

  useEffect(() => {
    if (destinationConfig.sector_id) {
      loadSectorUsers(destinationConfig.sector_id);
    }
  }, [destinationConfig.sector_id]);

  const loadSectors = async () => {
    try {
      setLoadingSectors(true);
      const response = await api.getSectors();
      if (response.success) {
        setSectors(response.data || []);
      }
    } catch (err) {
      console.error('Error loading sectors:', err);
    } finally {
      setLoadingSectors(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await api.getUsers();
      if (response.success) {
        setUsers(response.data?.users || response.data || []);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadSectorUsers = async (sectorId) => {
    try {
      setLoadingSectorUsers(true);
      const response = await api.getSectorUsers(sectorId);
      if (response.success) {
        setSectorUsers(response.data || []);
      }
    } catch (err) {
      console.error('Error loading sector users:', err);
      setSectorUsers([]);
    } finally {
      setLoadingSectorUsers(false);
    }
  };

  const handleTypeChange = (type) => {
    onChangeType(type);
    if (type === 'default') {
      onChangeConfig({});
    } else if (type === 'user') {
      onChangeConfig({ user_id: null });
    } else if (type === 'sector_round_robin') {
      onChangeConfig({ sector_id: null });
    } else if (type === 'sector_specific') {
      onChangeConfig({ sector_id: null, user_id: null });
    }
  };

  const textSize = compact ? 'text-xs' : 'text-sm';
  const labelSize = compact ? 'text-xs' : 'text-sm';
  const selectSize = compact ? 'text-sm px-3 py-2' : 'text-sm px-3 py-2.5';

  return (
    <div className="space-y-2">
      <label className={`block ${labelSize} font-medium text-gray-600 dark:text-gray-400`}>
        Transferir para
      </label>

      {/* Destination type buttons */}
      <div className={`grid ${showDefaultOption ? 'grid-cols-3' : 'grid-cols-2'} gap-1.5`}>
        {showDefaultOption && (
          <button
            type="button"
            onClick={() => handleTypeChange('default')}
            disabled={disabled}
            className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border transition-all ${
              destinationType === 'default'
                ? 'border-purple-500 bg-purple-600 text-white'
                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className={`${textSize} font-medium`}>Padrao</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => handleTypeChange('sector_round_robin')}
          disabled={disabled}
          className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border transition-all ${
            destinationType === 'sector_round_robin'
              ? 'border-purple-500 bg-purple-600 text-white'
              : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span className={`${textSize} font-medium`}>Setor</span>
        </button>
        <button
          type="button"
          onClick={() => handleTypeChange('user')}
          disabled={disabled}
          className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border transition-all ${
            destinationType === 'user'
              ? 'border-purple-500 bg-purple-600 text-white'
              : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <User className="w-3.5 h-3.5" />
          <span className={`${textSize} font-medium`}>Usuario</span>
        </button>
      </div>

      {/* Sector selector */}
      {(destinationType === 'sector_round_robin' || destinationType === 'sector_specific') && (
        <div className="space-y-2">
          <div>
            <label className={`block ${labelSize} font-medium text-gray-600 dark:text-gray-400 mb-1.5`}>
              <Building2 className="w-3 h-3 inline mr-1" />
              Setor
            </label>
            {loadingSectors ? (
              <div className="flex items-center justify-center py-2 text-gray-400">
                <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                <span className={textSize}>Carregando...</span>
              </div>
            ) : (
              <select
                value={destinationConfig.sector_id || ''}
                onChange={(e) => onChangeConfig({
                  ...destinationConfig,
                  sector_id: e.target.value || null,
                  user_id: null
                })}
                disabled={disabled}
                className={`w-full ${selectSize} bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 dark:focus:ring-gray-500 dark:focus:border-gray-500 dark:text-white`}
              >
                <option value="">Selecione...</option>
                {sectors.map((sector) => (
                  <option key={sector.id} value={sector.id}>
                    {sector.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Sector mode */}
          {destinationConfig.sector_id && (
            <div className="space-y-1.5">
              <label className={`block ${labelSize} font-medium text-gray-600 dark:text-gray-400`}>
                Modo de Distribuicao
              </label>
              <div className="space-y-1">
                <label className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name={`sectorMode-${destinationConfig.sector_id}`}
                    checked={destinationType === 'sector_round_robin'}
                    onChange={() => {
                      handleTypeChange('sector_round_robin');
                      onChangeConfig({ sector_id: destinationConfig.sector_id });
                    }}
                    disabled={disabled}
                    className="w-3.5 h-3.5 text-purple-600 focus:ring-purple-500"
                  />
                  <RefreshCw className="w-3.5 h-3.5 text-green-600 dark:text-green-500" />
                  <span className={`${textSize} font-medium text-gray-700 dark:text-gray-300`}>Round Robin</span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name={`sectorMode-${destinationConfig.sector_id}`}
                    checked={destinationType === 'sector_specific'}
                    onChange={() => {
                      handleTypeChange('sector_specific');
                      onChangeConfig({ sector_id: destinationConfig.sector_id, user_id: null });
                    }}
                    disabled={disabled}
                    className="w-3.5 h-3.5 text-purple-600 focus:ring-purple-500"
                  />
                  <User className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span className={`${textSize} font-medium text-gray-700 dark:text-gray-300`}>Usuario Especifico</span>
                </label>
              </div>

              {/* Specific user within sector */}
              {destinationType === 'sector_specific' && (
                <div className="mt-1.5">
                  <label className={`block ${labelSize} font-medium text-gray-600 dark:text-gray-400 mb-1.5`}>
                    <Users className="w-3 h-3 inline mr-1" />
                    Usuario do Setor
                  </label>
                  {loadingSectorUsers ? (
                    <div className="flex items-center py-2 text-gray-400">
                      <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                      <span className={textSize}>Carregando...</span>
                    </div>
                  ) : (
                    <select
                      value={destinationConfig.user_id || ''}
                      onChange={(e) => onChangeConfig({
                        ...destinationConfig,
                        user_id: e.target.value || null
                      })}
                      disabled={disabled}
                      className={`w-full ${selectSize} bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 dark:focus:ring-gray-500 dark:focus:border-gray-500 dark:text-white`}
                    >
                      <option value="">Selecione...</option>
                      {sectorUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name || user.email}
                        </option>
                      ))}
                    </select>
                  )}
                  {sectorUsers.length === 0 && !loadingSectorUsers && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Nenhum usuario neste setor
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Direct user selector */}
      {destinationType === 'user' && (
        <div>
          <label className={`block ${labelSize} font-medium text-gray-600 dark:text-gray-400 mb-1.5`}>
            <User className="w-3 h-3 inline mr-1" />
            Selecionar Usuario
          </label>
          {loadingUsers ? (
            <div className="flex items-center py-2 text-gray-400">
              <RefreshCw className="w-3 h-3 animate-spin mr-1" />
              <span className={textSize}>Carregando...</span>
            </div>
          ) : (
            <select
              value={destinationConfig.user_id || ''}
              onChange={(e) => onChangeConfig({ user_id: e.target.value || null })}
              disabled={disabled}
              className={`w-full ${selectSize} bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 dark:focus:ring-gray-500 dark:focus:border-gray-500 dark:text-white`}
            >
              <option value="">Selecione...</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Default destination info */}
      {destinationType === 'default' && showDefaultOption && (
        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
          Usara o destino padrao configurado acima
        </p>
      )}
    </div>
  );
};

export default TransferDestinationSelector;
