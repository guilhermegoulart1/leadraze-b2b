import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Plus, Edit2, Trash2, Shield, Users, User,
  ChevronDown, ChevronRight, X, Check, AlertCircle, Settings
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PermissionGate from '../components/PermissionGate';
import UserPermissionsModal from '../components/UserPermissionsModal';

const UsersPage = () => {
  const { user: currentUser, isAdmin, isSupervisor } = useAuth();

  // State
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState(null);
  const [expandedUsers, setExpandedUsers] = useState({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    is_active: true
  });
  const [formErrors, setFormErrors] = useState({});

  const roleConfig = {
    admin: { label: 'Admin', icon: Shield, color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-200' },
    supervisor: { label: 'Supervisor', icon: Users, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
    user: { label: 'Usuário', icon: User, color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-200' }
  };

  useEffect(() => {
    loadUsers();
  }, [searchQuery, selectedRole]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (selectedRole) params.role = selectedRole;

      const response = await api.getUsers(params);
      if (response.success) {
        setUsers(response.data.users || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setSelectedUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'user',
      is_active: true
    });
    setFormErrors({});
    setShowUserModal(true);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // Don't populate password
      role: user.role,
      is_active: user.is_active !== false
    });
    setFormErrors({});
    setShowUserModal(true);
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name?.trim()) {
      errors.name = 'Nome é obrigatório';
    }

    if (!formData.email?.trim()) {
      errors.email = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email inválido';
    }

    // Password is required only when creating new user
    if (!selectedUser && !formData.password) {
      errors.password = 'Senha é obrigatória';
    } else if (formData.password && formData.password.length < 6) {
      errors.password = 'Senha deve ter pelo menos 6 caracteres';
    }

    // Check if trying to create another admin
    if (!selectedUser && formData.role === 'admin') {
      const hasAdmin = users.some(u => u.role === 'admin');
      if (hasAdmin) {
        errors.role = 'Já existe um Admin no sistema';
      }
    }

    // Check if trying to change existing admin to another role
    if (selectedUser && selectedUser.role === 'admin' && formData.role !== 'admin') {
      errors.role = 'Não é possível alterar o perfil do Admin';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveUser = async () => {
    if (!validateForm()) return;

    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        is_active: formData.is_active
      };

      // Only include password if provided
      if (formData.password) {
        payload.password = formData.password;
      }

      if (selectedUser) {
        // Update
        await api.updateUser(selectedUser.id, payload);
      } else {
        // Create
        await api.createUser(payload);
      }

      // Reload users list first, then close modal
      await loadUsers();
      setShowUserModal(false);
    } catch (error) {
      console.error('Error saving user:', error);
      setFormErrors({
        general: error.response?.data?.message || 'Erro ao salvar usuário'
      });
    }
  };

  const handleDeleteUser = async (userId) => {
    const user = users.find(u => u.id === userId);

    if (user?.role === 'admin') {
      alert('Não é possível excluir o Admin do sistema');
      return;
    }

    if (userId === currentUser.id) {
      alert('Você não pode excluir sua própria conta');
      return;
    }

    if (!confirm('Tem certeza que deseja excluir este usuário?')) {
      return;
    }

    try {
      await api.deleteUser(userId);
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Erro ao excluir usuário');
    }
  };

  const handleManagePermissions = (user) => {
    setPermissionsUser(user);
    setShowPermissionsModal(true);
  };

  const toggleExpand = (userId) => {
    setExpandedUsers(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const filteredUsers = users.filter(user => {
    // Supervisors can only see their team members
    if (isSupervisor && user.role !== 'user') {
      return false;
    }
    return true;
  });

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-200">
        {/* Title and Actions */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestão de Usuários</h1>
            <p className="text-sm text-gray-500 mt-1">
              {filteredUsers.length} usuário{filteredUsers.length !== 1 ? 's' : ''} cadastrado{filteredUsers.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Action Buttons */}
          <PermissionGate permission="users:create">
            <button
              onClick={handleCreateUser}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Novo Usuário</span>
            </button>
          </PermissionGate>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome ou email..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters
                ? 'bg-purple-50 border-purple-300 text-purple-700'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filtros</span>
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">Perfil</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedRole('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedRole === ''
                    ? 'bg-purple-100 text-purple-700 border-purple-300'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Todos
              </button>
              {Object.entries(roleConfig).map(([role, config]) => {
                const IconComponent = config.icon;
                return (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      selectedRole === role
                        ? `${config.bg} ${config.color} ${config.border}`
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span>{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <User className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg font-medium">Nenhum usuário encontrado</p>
            <p className="text-sm">Tente ajustar os filtros ou criar um novo usuário</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-8">
                  {/* Expand icon column */}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Usuário
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Perfil
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Data de Criação
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user) => {
                const config = roleConfig[user.role] || roleConfig.user;
                const RoleIcon = config.icon;
                const isExpanded = expandedUsers[user.id];
                const hasTeam = user.role === 'supervisor' || user.role === 'user';

                return (
                  <React.Fragment key={user.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      {/* Expand Icon */}
                      <td className="px-4 py-3">
                        {hasTeam && (
                          <button
                            onClick={() => toggleExpand(user.id)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-600" />
                            )}
                          </button>
                        )}
                      </td>

                      {/* Usuário */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                            {user.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-gray-900">
                              {user.name}
                              {user.id === currentUser.id && (
                                <span className="ml-2 text-xs text-purple-600">(Você)</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Perfil */}
                      <td className="px-4 py-3">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${config.bg} ${config.color} ${config.border}`}>
                          <RoleIcon className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">{config.label}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {user.is_active !== false ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full border border-green-200">
                            <Check className="w-3 h-3" />
                            <span className="text-xs font-medium">Ativo</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full border border-gray-200">
                            <X className="w-3 h-3" />
                            <span className="text-xs font-medium">Inativo</span>
                          </div>
                        )}
                      </td>

                      {/* Data de Criação */}
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-600">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '-'}
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <PermissionGate permission="users:edit:all">
                            <button
                              onClick={() => handleEditUser(user)}
                              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </PermissionGate>
                          {(isAdmin || isSupervisor) && (
                            <button
                              onClick={() => handleManagePermissions(user)}
                              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                              title="Gerenciar Permissões e Setores"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                          )}
                          <PermissionGate permission="users:delete:all">
                            {user.role !== 'admin' && user.id !== currentUser.id && (
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Team Info */}
                    {isExpanded && hasTeam && (
                      <tr>
                        <td colSpan="6" className="px-4 py-3 bg-gray-50">
                          <div className="ml-12 p-4 bg-white rounded-lg border border-gray-200">
                            <div className="text-sm font-medium text-gray-700 mb-2">
                              {user.role === 'supervisor' ? 'Membros da Equipe' : 'Supervisor'}
                            </div>
                            <div className="text-sm text-gray-600">
                              {/* TODO: Load and display team information */}
                              <p className="text-gray-500 italic">Informações da equipe serão exibidas aqui</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* User Permissions and Sectors Modal */}
      {showPermissionsModal && permissionsUser && (
        <UserPermissionsModal
          user={permissionsUser}
          onClose={() => {
            setShowPermissionsModal(false);
            setPermissionsUser(null);
          }}
          onUpdate={loadUsers}
        />
      )}

      {/* User Form Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h2>
              <button
                onClick={() => setShowUserModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-6 space-y-4">
              {formErrors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{formErrors.general}</p>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    formErrors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Nome completo"
                />
                {formErrors.name && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    formErrors.email ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="email@exemplo.com"
                />
                {formErrors.email && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.email}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Senha {!selectedUser && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    formErrors.password ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder={selectedUser ? 'Deixe em branco para não alterar' : 'Mínimo 6 caracteres'}
                />
                {formErrors.password && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.password}</p>
                )}
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Perfil <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                  disabled={selectedUser?.role === 'admin'}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    formErrors.role ? 'border-red-300' : 'border-gray-300'
                  } ${selectedUser?.role === 'admin' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                >
                  <option value="user">Usuário</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
                {formErrors.role && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.role}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {formData.role === 'admin' && 'Admin tem todas as permissões'}
                  {formData.role === 'supervisor' && 'Supervisores gerenciam equipes'}
                  {formData.role === 'user' && 'Usuários padrão com permissões limitadas'}
                </p>
              </div>

              {/* Active Status */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Usuário ativo
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveUser}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
              >
                {selectedUser ? 'Salvar' : 'Criar Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
