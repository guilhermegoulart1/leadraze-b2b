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
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center">
          <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Acesso Negado</h2>
          <p className="text-gray-600">Você não tem permissão para gerenciar permissões.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestão de Permissões</h1>
            <p className="text-sm text-gray-500 mt-1">
              Marque as permissões que cada perfil deve ter
            </p>
          </div>

          {/* Save Button */}
          {hasChanges && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Descartar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Save Message */}
        {saveMessage && (
          <div className={`mb-4 p-3 rounded-lg flex items-start gap-2 ${
            saveMessage.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            {saveMessage.type === 'success' ? (
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <p className={`text-sm ${
              saveMessage.type === 'success' ? 'text-green-700' : 'text-red-700'
            }`}>
              {saveMessage.text}
            </p>
            <button
              onClick={() => setSaveMessage(null)}
              className="ml-auto"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Permissions Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <div className="p-6">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left p-3 font-semibold text-gray-900">Permissão</th>
                  <th className="text-center p-3 font-semibold text-red-600 w-32">
                    <div className="flex flex-col items-center gap-1">
                      <Shield className="w-5 h-5" />
                      <span>Admin</span>
                    </div>
                  </th>
                  <th className="text-center p-3 font-semibold text-blue-600 w-32">
                    <div className="flex flex-col items-center gap-1">
                      <Users className="w-5 h-5" />
                      <span>Supervisor</span>
                    </div>
                  </th>
                  <th className="text-center p-3 font-semibold text-gray-600 w-32">
                    <div className="flex flex-col items-center gap-1">
                      <User className="w-5 h-5" />
                      <span>Usuário</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedPermissions).map(([category, perms]) => (
                  <React.Fragment key={category}>
                    {/* Category Header */}
                    <tr className="bg-gray-100">
                      <td colSpan="4" className="p-3 font-semibold text-gray-900 text-sm uppercase tracking-wide">
                        {category}
                      </td>
                    </tr>

                    {/* Permissions in this category */}
                    {perms.map((perm) => (
                      <tr key={perm.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="p-3">
                          <div>
                            <div className="font-medium text-sm text-gray-900">{perm.name}</div>
                            {perm.description && (
                              <div className="text-xs text-gray-500 mt-0.5">{perm.description}</div>
                            )}
                          </div>
                        </td>

                        {/* Admin Checkbox - Always checked and disabled */}
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={true}
                            disabled={true}
                            className="w-5 h-5 text-red-600 border-gray-300 rounded cursor-not-allowed opacity-50"
                          />
                        </td>

                        {/* Supervisor Checkbox */}
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={hasPermission('supervisor', perm.id)}
                            onChange={() => togglePermission('supervisor', perm.id)}
                            disabled={!isAdmin}
                            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </td>

                        {/* User Checkbox */}
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={hasPermission('user', perm.id)}
                            onChange={() => togglePermission('user', perm.id)}
                            disabled={!isAdmin && !isSupervisor}
                            className="w-5 h-5 text-gray-600 border-gray-300 rounded focus:ring-2 focus:ring-gray-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Você tem alterações não salvas</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-white transition-colors"
              >
                Descartar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
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
