import React, { useState, useEffect } from 'react';
import {
  Shield, Users, User, Save, AlertCircle, Check, X, Lock
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const PermissionsPage = () => {
  const { isAdmin, isSupervisor } = useAuth();

  // State
  const [permissions, setPermissions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({
    admin: [],
    supervisor: [],
    user: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load all permissions
      const permResponse = await api.getAllPermissions();
      if (permResponse.success) {
        setPermissions(permResponse.data.permissions || []);
      }

      // Load permissions for each role
      const roles = ['admin', 'supervisor', 'user'];
      const rolePermsData = {};

      for (const role of roles) {
        const response = await api.getRolePermissions(role);
        if (response.success) {
          const perms = response.data.permissions || [];
          // Extract permission IDs
          rolePermsData[role] = perms.map(p => typeof p === 'object' ? p.id : p);
        }
      }

      setRolePermissions(rolePermsData);
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group permissions by resource
  const groupedPermissions = permissions.reduce((acc, perm) => {
    const category = perm.category || perm.resource || 'Outros';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(perm);
    return acc;
  }, {});

  const hasPermission = (role, permissionId) => {
    return rolePermissions[role]?.includes(permissionId);
  };

  const togglePermission = (role, permissionId) => {
    // Cannot modify admin permissions
    if (role === 'admin') {
      return;
    }

    // Supervisors can only modify user permissions
    if (isSupervisor && role !== 'user') {
      return;
    }

    setRolePermissions(prev => {
      const rolePerms = prev[role] || [];
      const newPerms = rolePerms.includes(permissionId)
        ? rolePerms.filter(p => p !== permissionId)
        : [...rolePerms, permissionId];

      return {
        ...prev,
        [role]: newPerms
      };
    });

    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveMessage(null);

      // Save permissions for supervisor and user roles
      const rolesToSave = isAdmin ? ['supervisor', 'user'] : ['user'];

      for (const role of rolesToSave) {
        await api.updateRolePermissions(role, {
          permission_ids: rolePermissions[role]
        });
      }

      setSaveMessage({ type: 'success', text: 'Permissões salvas com sucesso!' });
      setHasChanges(false);

      // Reload to ensure consistency
      setTimeout(() => {
        loadData();
        setSaveMessage(null);
      }, 2000);
    } catch (error) {
      console.error('Error saving permissions:', error);
      setSaveMessage({
        type: 'error',
        text: error.response?.data?.message || 'Erro ao salvar permissões'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Deseja descartar as alterações não salvas?')) {
      loadData();
      setHasChanges(false);
    }
  };

  // Determine which roles the current user can manage
  if (!isAdmin && !isSupervisor) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Lock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-100 mb-2">Acesso Negado</h2>
          <p className="text-gray-400">Você não tem permissão para gerenciar permissões.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-100">Gestão de Permissões</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Marque as permissões que cada perfil deve ter
            </p>
          </div>

          {/* Save Button */}
          {hasChanges && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-xs font-medium text-gray-400 border border-gray-600 rounded-lg hover:bg-gray-800 hover:text-gray-200 transition-colors"
              >
                Descartar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">
                  {saving ? 'Salvando...' : 'Salvar'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Save Message */}
        {saveMessage && (
          <div className={`mt-3 p-2.5 rounded-lg flex items-center gap-2 ${
            saveMessage.type === 'success'
              ? 'bg-green-900/40 border border-green-700'
              : 'bg-red-900/40 border border-red-700'
          }`}>
            {saveMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            )}
            <p className={`text-xs ${
              saveMessage.type === 'success' ? 'text-green-300' : 'text-red-300'
            }`}>
              {saveMessage.text}
            </p>
            <button
              onClick={() => setSaveMessage(null)}
              className="ml-auto text-gray-400 hover:text-gray-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Permissions Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          <div className="px-4">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-gray-800 z-10">
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase">Permissão</th>
                  <th className="text-center py-2.5 px-2 text-xs font-semibold text-red-400 w-20">
                    <div className="flex items-center justify-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      <span>Admin</span>
                    </div>
                  </th>
                  <th className="text-center py-2.5 px-2 text-xs font-semibold text-blue-400 w-24">
                    <div className="flex items-center justify-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      <span>Supervisor</span>
                    </div>
                  </th>
                  <th className="text-center py-2.5 px-2 text-xs font-semibold text-gray-400 w-20">
                    <div className="flex items-center justify-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      <span>Usuário</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedPermissions).map(([category, perms]) => (
                  <React.Fragment key={category}>
                    {/* Category Header */}
                    <tr className="bg-gray-800/60">
                      <td colSpan="4" className="py-2 px-3 font-medium text-gray-300 text-xs uppercase tracking-wide">
                        {category}
                      </td>
                    </tr>

                    {/* Permissions in this category */}
                    {perms.map((perm) => (
                      <tr key={perm.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-1.5 px-3">
                          <div className="text-xs text-gray-200">{perm.description || perm.name}</div>
                          {perm.description && (
                            <div className="text-[10px] text-gray-500 mt-0.5">{perm.name}</div>
                          )}
                        </td>

                        {/* Admin Checkbox - Always checked and disabled */}
                        <td className="py-1.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={true}
                            disabled={true}
                            className="w-4 h-4 rounded cursor-not-allowed opacity-50 accent-red-500 bg-gray-700 border-gray-600"
                            style={{ accentColor: '#ef4444' }}
                          />
                        </td>

                        {/* Supervisor Checkbox */}
                        <td className="py-1.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={hasPermission('supervisor', perm.id)}
                            onChange={() => togglePermission('supervisor', perm.id)}
                            disabled={!isAdmin}
                            className="w-4 h-4 rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 accent-blue-500"
                            style={{ accentColor: '#3b82f6' }}
                          />
                        </td>

                        {/* User Checkbox */}
                        <td className="py-1.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={hasPermission('user', perm.id)}
                            onChange={() => togglePermission('user', perm.id)}
                            disabled={!isAdmin && !isSupervisor}
                            className="w-4 h-4 rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 accent-purple-500"
                            style={{ accentColor: '#a855f7' }}
                          />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sticky Footer with Save Button */}
      {hasChanges && (
        <div className="flex-shrink-0 px-4 py-3 border-t border-gray-700 bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-amber-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-medium">Alterações não salvas</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-xs font-medium text-gray-400 border border-gray-600 rounded-lg hover:bg-gray-700 hover:text-gray-200 transition-colors"
              >
                Descartar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">
                  {saving ? 'Salvando...' : 'Salvar'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PermissionsPage;
