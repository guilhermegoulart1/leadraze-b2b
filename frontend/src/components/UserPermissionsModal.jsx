import React, { useState, useEffect } from 'react';
import {
  X, Shield, Users as UsersIcon, Check, Plus, Trash2, AlertCircle, Loader, Radio
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

  // Channel permissions state
  const [channelPermissions, setChannelPermissions] = useState([]);
  const [channelPermissionsChanged, setChannelPermissionsChanged] = useState(false);

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
        const perms = availablePermsRes.data?.all || [];
        setAvailablePermissions(Array.isArray(perms) ? perms : []);
      }
      if (userPermsRes.success) {
        const permissions = Array.isArray(userPermsRes.data) ? userPermsRes.data : [];
        setUserPermissions(permissions);

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

      // Load channel permissions
      try {
        const channelPermsRes = await api.getUserChannelPermissions(user.id);
        if (channelPermsRes.success) {
          const perms = channelPermsRes.data?.permissions || [];
          setChannelPermissions(Array.isArray(perms) ? perms : []);
        } else {
          setChannelPermissions([]);
        }
      } catch (err) {
        console.log('Channel permissions not loaded:', err);
        setChannelPermissions([]);
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

      const roleHasPermission = effectivePermissions.some(
        p => p.name === permissionKey && p.source === 'role'
      );

      if (newPerms[permissionKey] === undefined) {
        if (roleHasPermission) {
          newPerms[permissionKey] = false;
        } else {
          newPerms[permissionKey] = true;
        }
      } else if (newPerms[permissionKey] === true) {
        newPerms[permissionKey] = false;
      } else if (newPerms[permissionKey] === false) {
        delete newPerms[permissionKey];
      }

      return newPerms;
    });
  };

  const handleSavePermissions = async () => {
    try {
      setSaving(true);
      setError('');

      const permissions = Object.entries(customPermissions).map(([permName, granted]) => {
        const perm = availablePermissions.find(p => p.name === permName);
        if (!perm) {
          console.warn(`Permission ${permName} not found in available permissions`);
          return null;
        }
        return {
          permissionId: perm.id,
          granted
        };
      }).filter(p => p !== null);

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
        userId: user.id,
        sectorId: selectedSectorId
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

  // Channel permissions handlers
  const handleChannelAccessChange = (channelId, accessType) => {
    setChannelPermissions(prev => prev.map(ch =>
      ch.channel_id === channelId ? { ...ch, access_type: accessType } : ch
    ));
    setChannelPermissionsChanged(true);
  };

  const handleSaveChannelPermissions = async () => {
    try {
      setSaving(true);
      setError('');

      const permissions = channelPermissions.map(ch => ({
        channel_id: ch.channel_id,
        access_type: ch.access_type
      }));

      await api.setBulkChannelPermissions(user.id, permissions);
      setChannelPermissionsChanged(false);

      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('Error saving channel permissions:', err);
      setError(err.response?.data?.message || 'Erro ao salvar permissões de canal');
    } finally {
      setSaving(false);
    }
  };

  const getChannelTypeLabel = (providerType) => {
    switch (providerType) {
      case 'WHATSAPP': return 'WhatsApp';
      case 'LINKEDIN': return 'LinkedIn';
      case 'INSTAGRAM': return 'Instagram';
      case 'MESSENGER': return 'Messenger';
      case 'EMAIL': return 'E-mail';
      default: return providerType || 'Canal';
    }
  };

  const getChannelTypeColor = (providerType) => {
    switch (providerType) {
      case 'WHATSAPP': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'LINKEDIN': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'INSTAGRAM': return 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400';
      case 'MESSENGER': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
      case 'EMAIL': return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    }
  };

  const getPermissionStatus = (permissionKey) => {
    const roleHasPermission = effectivePermissions.some(
      p => p.name === permissionKey && p.source === 'role'
    );
    const customValue = customPermissions[permissionKey];

    if (customValue === true) {
      return 'granted';
    } else if (customValue === false) {
      return 'revoked';
    } else if (roleHasPermission) {
      return 'role';
    } else {
      return 'none';
    }
  };

  const getPermissionBadge = (permissionKey) => {
    const status = getPermissionStatus(permissionKey);

    switch (status) {
      case 'granted':
        return (
          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
            Concedida
          </span>
        );
      case 'revoked':
        return (
          <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full">
            Revogada
          </span>
        );
      case 'role':
        return (
          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Gerenciar: {user?.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Perfil: {user?.role === 'admin' ? 'Admin' : user?.role === 'supervisor' ? 'Supervisor' : 'Usuário'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('permissions')}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === 'permissions'
                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            Permissões Customizadas
          </button>
          <button
            onClick={() => setActiveTab('sectors')}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === 'sectors'
                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <UsersIcon className="w-4 h-4" />
            Setores
          </button>
          <button
            onClick={() => setActiveTab('channels')}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === 'channels'
                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Radio className="w-4 h-4" />
            Canais
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader className="w-8 h-8 animate-spin text-purple-600 dark:text-purple-400" />
            </div>
          ) : activeTab === 'permissions' ? (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>Como funciona:</strong> As permissões customizadas podem <strong>conceder</strong> permissões
                  adicionais ao usuário ou <strong>revogar</strong> permissões do perfil.
                </p>
              </div>

              {Object.keys(groupedPermissions).length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  Nenhuma permissão disponível
                </p>
              ) : (
                Object.entries(groupedPermissions).map(([category, permissions]) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
                      {category}
                    </h3>
                    <div className="space-y-2">
                      {permissions.map((perm) => {
                        const permKey = perm.name;
                        const status = getPermissionStatus(permKey);
                        const isChecked = status === 'granted' || status === 'role';

                        return (
                          <div
                            key={perm.id}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleTogglePermission(permKey)}
                                className="w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500 dark:bg-gray-700"
                              />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {perm.name}
                                </p>
                                {perm.description && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
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
          ) : activeTab === 'sectors' ? (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Os setores definem quais dados o usuário pode acessar. Usuários só veem campanhas,
                  leads e conversas dos setores atribuídos a eles.
                </p>
              </div>

              {/* Add Sector */}
              <div className="flex gap-3">
                <select
                  value={selectedSectorId}
                  onChange={(e) => setSelectedSectorId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Setores Atribuídos ({userSectors.length})
                </h3>
                {userSectors.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    Nenhum setor atribuído
                  </p>
                ) : (
                  <div className="space-y-2">
                    {userSectors.map((sector) => (
                      <div
                        key={sector.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: sector.color || '#6366f1' }}
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {sector.name}
                            </p>
                            {sector.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {sector.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveSector(sector.id)}
                          disabled={saving || sector.name === 'Geral'}
                          className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          ) : activeTab === 'channels' ? (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Configure quais canais este usuário pode acessar e seu nível de permissão em cada um.
                </p>
              </div>

              {channelPermissions.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  Nenhum canal disponível
                </p>
              ) : (
                <div className="space-y-3">
                  {channelPermissions.map((channel) => (
                    <div
                      key={channel.channel_id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getChannelTypeColor(channel.provider_type)}`}>
                          {getChannelTypeLabel(channel.provider_type)}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {channel.channel_name}
                        </span>
                        {channel.channel_status !== 'active' && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full">
                            Inativo
                          </span>
                        )}
                      </div>

                      <select
                        value={channel.access_type}
                        onChange={(e) => handleChannelAccessChange(channel.channel_id, e.target.value)}
                        className={`px-3 py-1.5 text-sm rounded-lg border focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${
                          channel.access_type === 'all'
                            ? 'bg-green-100 border-green-300 text-green-700 dark:bg-green-800 dark:border-green-600 dark:text-green-300'
                            : channel.access_type === 'assigned_only'
                            ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-800 dark:border-blue-600 dark:text-blue-300'
                            : 'bg-red-100 border-red-300 text-red-700 dark:bg-red-800 dark:border-red-600 dark:text-red-300'
                        }`}
                        style={{ colorScheme: 'dark' }}
                      >
                        <option value="all" className="bg-gray-800 text-white">Todas as conversas</option>
                        <option value="assigned_only" className="bg-gray-800 text-white">Só minhas</option>
                        <option value="none" className="bg-gray-800 text-white">Sem acesso</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {activeTab === 'permissions' && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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

        {activeTab === 'channels' && channelPermissionsChanged && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                loadData();
                setChannelPermissionsChanged(false);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveChannelPermissions}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader className="w-4 h-4 animate-spin" />}
              Salvar Canais
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserPermissionsModal;
