import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Plus, Edit2, Trash2, Shield, Users, User,
  ChevronDown, ChevronRight, X, Check, AlertCircle, Settings
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PermissionGate from '../components/PermissionGate';
import UserPermissionsModal from '../components/UserPermissionsModal';

const UsersPage = () => {
  const { t } = useTranslation(['users', 'common']);
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
    admin: { label: t('roles.admin'), icon: Shield, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/40', border: 'border-red-300 dark:border-red-700/50' },
    supervisor: { label: t('roles.supervisor'), icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40', border: 'border-blue-300 dark:border-blue-700/50' },
    user: { label: t('roles.user'), icon: User, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700/50', border: 'border-gray-300 dark:border-gray-600' }
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
      errors.name = t('form.nameRequired');
    }

    if (!formData.email?.trim()) {
      errors.email = t('form.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = t('form.emailInvalid');
    }

    // Password is NOT required for new users - they will receive a magic link via email
    // Password validation only applies if password is provided (for edits)
    if (formData.password && formData.password.length < 6) {
      errors.password = t('form.passwordMinLength');
    }

    // Check if trying to create another admin
    if (!selectedUser && formData.role === 'admin') {
      const hasAdmin = users.some(u => u.role === 'admin');
      if (hasAdmin) {
        errors.role = t('messages.adminExists');
      }
    }

    // Check if trying to change existing admin to another role
    if (selectedUser && selectedUser.role === 'admin' && formData.role !== 'admin') {
      errors.role = t('messages.cannotChangeAdminRole');
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
        general: error.response?.data?.message || t('form.generalError')
      });
    }
  };

  const handleDeleteUser = async (userId) => {
    const user = users.find(u => u.id === userId);

    if (user?.role === 'admin') {
      alert(t('messages.cannotDeleteAdmin'));
      return;
    }

    if (userId === currentUser.id) {
      alert(t('messages.cannotDeleteSelf'));
      return;
    }

    if (!confirm(t('messages.confirmDelete'))) {
      return;
    }

    try {
      await api.deleteUser(userId);
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(t('messages.errorDeleting'));
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
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        {/* Title and Actions */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('subtitle', { count: filteredUsers.length })}
            </p>
          </div>

          {/* Action Buttons */}
          <PermissionGate permission="users:create">
            <button
              onClick={handleCreateUser}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">{t('newUser')}</span>
            </button>
          </PermissionGate>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters
                ? 'bg-purple-100 dark:bg-purple-900/40 border-purple-500 dark:border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">{t('filters')}</span>
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('filterByRole')}</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedRole('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedRole === ''
                    ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 border-purple-500 dark:border-purple-600'
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {t('all')}
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
                        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-500">
            <User className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg font-medium text-gray-600 dark:text-gray-400">{t('messages.noUsers')}</p>
            <p className="text-sm text-gray-500">{t('messages.noUsersDescription')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-8">
                  {/* Expand icon column */}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  {t('table.user')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  {t('table.profile')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  {t('table.status')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  {t('table.createdAt')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  {t('table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {filteredUsers.map((user) => {
                const config = roleConfig[user.role] || roleConfig.user;
                const RoleIcon = config.icon;
                const isExpanded = expandedUsers[user.id];
                const hasTeam = user.role === 'supervisor' || user.role === 'user';

                return (
                  <React.Fragment key={user.id}>
                    <tr className="hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors">
                      {/* Expand Icon */}
                      <td className="px-4 py-3">
                        {hasTeam && (
                          <button
                            onClick={() => toggleExpand(user.id)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
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
                            <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                              {user.name}
                              {user.id === currentUser.id && (
                                <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">{t('table.you')}</span>
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
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-full border border-green-300 dark:border-green-700/50">
                            <Check className="w-3 h-3" />
                            <span className="text-xs font-medium">{t('status.active')}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 rounded-full border border-gray-300 dark:border-gray-600">
                            <X className="w-3 h-3" />
                            <span className="text-xs font-medium">{t('status.inactive')}</span>
                          </div>
                        )}
                      </td>

                      {/* Data de Criação */}
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '-'}
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <PermissionGate permission="users:edit:all">
                            <button
                              onClick={() => handleEditUser(user)}
                              className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 rounded transition-colors"
                              title={t('actions.edit')}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </PermissionGate>
                          {(isAdmin || isSupervisor) && (
                            <button
                              onClick={() => handleManagePermissions(user)}
                              className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded transition-colors"
                              title={t('actions.permissions')}
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                          )}
                          <PermissionGate permission="users:delete:all">
                            {user.role !== 'admin' && user.id !== currentUser.id && (
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition-colors"
                                title={t('actions.delete')}
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
                        <td colSpan="6" className="px-4 py-3 bg-gray-100 dark:bg-gray-800/50">
                          <div className="ml-12 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              {user.role === 'supervisor' ? t('table.teamMembers') : t('table.supervisor')}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {/* TODO: Load and display team information */}
                              <p className="text-gray-500 italic">{t('table.teamInfo')}</p>
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {selectedUser ? t('form.editUser') : t('form.newUser')}
              </h2>
              <button
                onClick={() => setShowUserModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-6 space-y-4">
              {formErrors.general && (
                <div className="p-3 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600 dark:text-red-300">{formErrors.general}</p>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('form.name')} <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={`w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    formErrors.name ? 'border-red-500 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder={t('form.namePlaceholder')}
                />
                {formErrors.name && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">{formErrors.name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('form.email')} <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className={`w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    formErrors.email ? 'border-red-500 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder={t('form.emailPlaceholder')}
                />
                {formErrors.email && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">{formErrors.email}</p>
                )}
              </div>

              {/* Password - only shown for editing existing users */}
              {selectedUser ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('form.password')}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className={`w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                      formErrors.password ? 'border-red-500 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder={t('form.passwordLeaveBlank')}
                  />
                  {formErrors.password && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">{formErrors.password}</p>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700/50 rounded-lg">
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    {t('form.magicLinkInfo', 'O novo usuário receberá um email com link de acesso para criar sua própria senha.')}
                  </p>
                </div>
              )}

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('form.role')} <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                  disabled={selectedUser?.role === 'admin'}
                  className={`w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    formErrors.role ? 'border-red-500 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                  } ${selectedUser?.role === 'admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <option value="user">{t('roles.user')}</option>
                  <option value="supervisor">{t('roles.supervisor')}</option>
                  <option value="admin">{t('roles.admin')}</option>
                </select>
                {formErrors.role && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">{formErrors.role}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {formData.role === 'admin' && t('roles.adminDescription')}
                  {formData.role === 'supervisor' && t('roles.supervisorDescription')}
                  {formData.role === 'user' && t('roles.userDescription')}
                </p>
              </div>

              {/* Active Status */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 text-purple-600 bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">
                  {t('form.userActive')}
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg transition-colors"
              >
                {t('form.cancel')}
              </button>
              <button
                onClick={handleSaveUser}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
              >
                {selectedUser ? t('form.save') : t('form.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
