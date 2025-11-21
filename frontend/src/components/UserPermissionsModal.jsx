import React, { useState, useEffect } from 'react';
import {
  X, Shield, Users as UsersIcon, Check, Plus, Trash2, AlertCircle, Loader
} from 'lucide-react';
import api from '../services/api';

const UserPermissionsModal = ({ user, onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState('permissions');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Permissions state
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [userPermissions, setUserPermissions] = useState([]);
  const [effectivePermissions, setEffectivePermissions] = useState([]);
  const [customPermissions, setCustomPermissions] = useState({});

  // Sectors state
  const [availableSectors, setAvailableSectors] = useState([]);
  const [userSectors, setUserSectors] = useState([]);
  const [selectedSectorId, setSelectedSectorId] = useState('');

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load permissions data
      const [availablePermsRes, userPermsRes, effectivePermsRes] = await Promise.all([
        api.getAvailablePermissions(),
        api.getUserPermissions(user.id),
        api.getUserEffectivePermissions(user.id)
      ]);

      if (availablePermsRes.success) {
        // Backend returns { all: [...], grouped: {...} }
        const perms = availablePermsRes.data?.all || [];
        setAvailablePermissions(Array.isArray(perms) ? perms : []);
      }
      if (userPermsRes.success) {
        // Backend returns array directly (no wrapper)
        const permissions = Array.isArray(userPermsRes.data) ? userPermsRes.data : [];
        setUserPermissions(permissions);

        // Convert to object for easier manipulation
        const permsObj = {};
        if (Array.isArray(permissions)) {
          permissions.forEach(p => {
            permsObj[p.permission_name] = p.granted;
          });
        }
        setCustomPermissions(permsObj);
      }
      if (effectivePermsRes.success) {
        const effectivePerms = effectivePermsRes.data?.permissions || effectivePermsRes.data || [];
        setEffectivePermissions(Array.isArray(effectivePerms) ? effectivePerms : []);
      }

      // Load sectors data
      const sectorsRes = await api.getSectors();

      if (sectorsRes.success) {
        const sectors = sectorsRes.data?.sectors || sectorsRes.data || [];
        setAvailableSectors(Array.isArray(sectors) ? sectors : []);
      }

      // Load user sectors
      try {
        const userSectorsRes = await api.getUserSectors(user.id);
        if (userSectorsRes.success) {
          const userSects = userSectorsRes.data?.sectors || userSectorsRes.data || [];
          setUserSectors(Array.isArray(userSects) ? userSects : []);
        } else {
          setUserSectors([]);
        }
      } catch (err) {
        console.log('User sectors not loaded:', err);
        setUserSectors([]);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = (permissionKey) => {
    setCustomPermissions(prev => {
      const newPerms = { ...prev };

      // Check if this permission is part of the user's role
      const roleHasPermission = effectivePermissions.some(
        p => p.name === permissionKey && p.source === 'role'
      );

      if (newPerms[permissionKey] === undefined) {
        // Not customized yet
        if (roleHasPermission) {
          // Role has it, so setting to false will revoke it
          newPerms[permissionKey] = false;
        } else {
          // Role doesn't have it, so grant it
          newPerms[permissionKey] = true;
        }
      } else if (newPerms[permissionKey] === true) {
        // Currently granted, change to revoked
        newPerms[permissionKey] = false;
      } else if (newPerms[permissionKey] === false) {
        // Currently revoked, remove customization
        delete newPerms[permissionKey];
      }

      return newPerms;
    });
  };

  const handleSavePermissions = async () => {
    try {
      setSaving(true);
      setError('');

      // Convert customPermissions object to array format with permission IDs
      const permissions = Object.entries(customPermissions).map(([permName, granted]) => {
        // Find permission ID from availablePermissions
        const perm = availablePermissions.find(p => p.name === permName);
        if (!perm) {
          console.warn(`Permission ${permName} not found in available permissions`);
          return null;
        }
        return {
          permissionId: perm.id,
          granted
        };
      }).filter(p => p !== null); // Remove any null entries

      await api.bulkSetUserPermissions(user.id, permissions);

      if (onUpdate) {
        onUpdate();
      }
      onClose();
    } catch (err) {
      console.error('Error saving permissions:', err);
      setError(err.response?.data?.message || 'Erro ao salvar permissões');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSector = async () => {
    if (!selectedSectorId) return;

    try {
      setSaving(true);
      setError('');

      await api.assignUserToSector({
        user_id: user.id,
        sector_id: parseInt(selectedSectorId)
      });

      setSelectedSectorId('');
      await loadData();

      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('Error adding sector:', err);
      setError(err.response?.data?.message || 'Erro ao adicionar setor');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSector = async (sectorId) => {
    try {
      setSaving(true);
      setError('');

      await api.removeUserFromSector(sectorId, user.id);
      await loadData();

      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('Error removing sector:', err);
      setError(err.response?.data?.message || 'Erro ao remover setor');
    } finally {
      setSaving(false);
    }
  };

  const getPermissionStatus = (permissionKey) => {
    const roleHasPermission = effectivePermissions.some(
      p => p.name === permissionKey && p.source === 'role'
    );
    const customValue = customPermissions[permissionKey];

    if (customValue === true) {
      return 'granted'; // Custom grant
    } else if (customValue === false) {
      return 'revoked'; // Custom revoke
    } else if (roleHasPermission) {
      return 'role'; // From role
    } else {
      return 'none'; // Not granted
    }
  };

  const getPermissionBadge = (permissionKey) => {
    const status = getPermissionStatus(permissionKey);

    switch (status) {
      case 'granted':
        return (
          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
            Concedida
          </span>
        );
      case 'revoked':
        return (
          <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
            Revogada
          </span>
        );
      case 'role':
        return (
          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
            Do Perfil
          </span>
        );
      default:
        return null;
    }
  };

  // Group permissions by resource
  const groupedPermissions = availablePermissions.reduce((acc, perm) => {
    const category = perm.resource || 'Outros';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(perm);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Gerenciar: {user?.name}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Perfil: {user?.role === 'admin' ? 'Admin' : user?.role === 'supervisor' ? 'Supervisor' : 'Usuário'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('permissions')}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === 'permissions'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Shield className="w-4 h-4" />
            Permissões Customizadas
          </button>
          <button
            onClick={() => setActiveTab('sectors')}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === 'sectors'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <UsersIcon className="w-4 h-4" />
            Setores
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : activeTab === 'permissions' ? (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Como funciona:</strong> As permissões customizadas podem <strong>conceder</strong> permissões
                  adicionais ao usuário ou <strong>revogar</strong> permissões do perfil.
                </p>
              </div>

              {Object.keys(groupedPermissions).length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  Nenhuma permissão disponível
                </p>
              ) : (
                Object.entries(groupedPermissions).map(([category, permissions]) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                      {category}
                    </h3>
                    <div className="space-y-2">
                      {permissions.map((perm) => {
                        const permKey = perm.name; // Backend uses 'name' field for permission key
                        const status = getPermissionStatus(permKey);
                        const isChecked = status === 'granted' || status === 'role';

                        return (
                          <div
                            key={perm.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleTogglePermission(permKey)}
                                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                              />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {perm.name}
                                </p>
                                {perm.description && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {perm.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="ml-3">
                              {getPermissionBadge(permKey)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Os setores definem quais dados o usuário pode acessar. Usuários só veem campanhas,
                  leads e conversas dos setores atribuídos a eles.
                </p>
              </div>

              {/* Add Sector */}
              <div className="flex gap-3">
                <select
                  value={selectedSectorId}
                  onChange={(e) => setSelectedSectorId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={saving}
                >
                  <option value="">Selecione um setor...</option>
                  {availableSectors
                    .filter(s => !userSectors.some(us => us.id === s.id))
                    .map(sector => (
                      <option key={sector.id} value={sector.id}>
                        {sector.name}
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleAddSector}
                  disabled={!selectedSectorId || saving}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar
                </button>
              </div>

              {/* User Sectors List */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Setores Atribuídos ({userSectors.length})
                </h3>
                {userSectors.length === 0 ? (
                  <p className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
                    Nenhum setor atribuído
                  </p>
                ) : (
                  <div className="space-y-2">
                    {userSectors.map((sector) => (
                      <div
                        key={sector.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: sector.color || '#6366f1' }}
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {sector.name}
                            </p>
                            {sector.description && (
                              <p className="text-xs text-gray-500">
                                {sector.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveSector(sector.id)}
                          disabled={saving || sector.name === 'Geral'}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={sector.name === 'Geral' ? 'Não é possível remover o setor Geral' : 'Remover setor'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'permissions' && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              onClick={handleSavePermissions}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader className="w-4 h-4 animate-spin" />}
              Salvar Permissões
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserPermissionsModal;
