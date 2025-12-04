import React, { useState, useEffect } from 'react';
import { User, Lock, Bell, CreditCard, Database, Shield, Mail, Users, X, Trash2, RefreshCw, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { EmailSettingsTab } from '../components/email-settings';
import api from '../services/api';

// Partner Access Tab Component
const PartnersAccessTab = () => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const response = await api.get('/partners/access');
      if (response.success) {
        setPartners(response.data || []);
      }
    } catch (err) {
      console.error('Error fetching partners:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPartner = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setAddLoading(true);
    setError('');

    try {
      const response = await api.post('/partners/access', { email: email.trim() });
      if (response.success) {
        setEmail('');
        fetchPartners();
      }
    } catch (err) {
      setError(err.message || 'Erro ao conceder acesso');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRevokeAccess = async (partnerId) => {
    if (!confirm('Tem certeza que deseja revogar o acesso deste partner?')) return;

    try {
      const response = await api.delete(`/partners/access/${partnerId}`);
      if (response.success) {
        fetchPartners();
      }
    } catch (err) {
      console.error('Error revoking access:', err);
      alert('Erro ao revogar acesso');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Acesso de Partners</h3>
          <p className="text-sm text-gray-500 mt-1">
            Conceda acesso a partners para gerenciar sua conta
          </p>
        </div>
        <button
          onClick={fetchPartners}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Add Partner Form */}
      <form onSubmit={handleAddPartner} className="mb-6">
        <div className="flex gap-3">
          <div className="flex-1">
            <div className="relative">
              <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                placeholder="Email do partner..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={addLoading || !email.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {addLoading ? 'Adicionando...' : 'Conceder Acesso'}
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-500 mt-2">{error}</p>
        )}
      </form>

      {/* Partners List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      ) : partners.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p>Nenhum partner com acesso</p>
          <p className="text-sm mt-1">Adicione o email de um partner aprovado para conceder acesso</p>
        </div>
      ) : (
        <div className="space-y-3">
          {partners.map((partner) => (
            <div
              key={partner.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{partner.partner_name}</p>
                  <p className="text-sm text-gray-500">{partner.partner_email}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-xs text-gray-400">
                  Desde {formatDate(partner.granted_at)}
                </span>
                <button
                  onClick={() => handleRevokeAccess(partner.partner_id)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  title="Revogar acesso"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Como funciona?</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Partners são agências ou profissionais que ajudam a gerenciar sua conta</li>
          <li>• Ao conceder acesso, o partner poderá entrar na sua conta</li>
          <li>• Você pode revogar o acesso a qualquer momento</li>
        </ul>
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const { t } = useTranslation('settings');
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: t('tabs.profile'), icon: User },
    { id: 'email', label: t('tabs.email', 'Email'), icon: Mail },
    { id: 'security', label: t('tabs.security'), icon: Lock },
    { id: 'notifications', label: t('tabs.notifications'), icon: Bell },
    { id: 'billing', label: t('tabs.billing'), icon: CreditCard },
    { id: 'integrations', label: t('tabs.integrations'), icon: Database },
    { id: 'privacy', label: t('tabs.privacy'), icon: Shield },
    { id: 'partners', label: 'Acesso de Partners', icon: Users },
  ];

  return (
    <div className="p-6">
      
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
        <p className="text-gray-500 mt-1">{t('subtitle')}</p>
      </div>

      <div className="flex gap-6">
        
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
                    ${activeTab === tab.id 
                      ? 'bg-purple-50 text-purple-600' 
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">{t('profile.title')}</h3>

              <div className="space-y-6">

                {/* Avatar */}
                <div className="flex items-center space-x-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                    {user?.name?.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:opacity-90 font-semibold text-sm">
                      {t('profile.changePhoto')}
                    </button>
                    <p className="text-xs text-gray-500 mt-2">{t('profile.photoRequirements')}</p>
                  </div>
                </div>

                {/* Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('profile.fullName')}
                    </label>
                    <input
                      type="text"
                      defaultValue={user?.name}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('profile.email')}
                    </label>
                    <input
                      type="email"
                      defaultValue={user?.email}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('profile.phone')}
                    </label>
                    <input
                      type="tel"
                      placeholder={t('profile.phonePlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('profile.position')}
                    </label>
                    <input
                      type="text"
                      placeholder={t('profile.positionPlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('profile.company')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('profile.companyPlaceholder')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold">
                    {t('profile.cancel')}
                  </button>
                  <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:opacity-90 font-semibold">
                    {t('profile.saveChanges')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">{t('security.title')}</h3>

              <div className="space-y-6">

                {/* Change Password */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">{t('security.changePassword')}</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('security.currentPassword')}
                      </label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('security.newPassword')}
                      </label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('security.confirmNewPassword')}
                      </label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* 2FA */}
                <div className="pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">{t('security.twoFactor')}</h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {t('security.twoFactorDescription')}
                      </p>
                    </div>
                    <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:opacity-90 font-semibold">
                      {t('security.enable2FA')}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:opacity-90 font-semibold">
                    {t('security.updatePassword')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">{t('notifications.title')}</h3>

              <div className="space-y-4">
                {[
                  { key: 'newLeads' },
                  { key: 'acceptedInvites' },
                  { key: 'qualifiedLeads' },
                  { key: 'receivedMessages' },
                  { key: 'completedCampaigns' },
                  { key: 'weeklyReports' },
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b border-gray-200 last:border-0">
                    <div>
                      <p className="font-medium text-gray-900">{t(`notifications.items.${item.key}.title`)}</p>
                      <p className="text-sm text-gray-500">{t(`notifications.items.${item.key}.description`)}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Email Tab */}
          {activeTab === 'email' && (
            <EmailSettingsTab />
          )}

          {/* Partners Tab */}
          {activeTab === 'partners' && (
            <PartnersAccessTab />
          )}

          {/* Other tabs placeholder */}
          {['billing', 'integrations', 'privacy'].includes(activeTab) && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {tabs.find(t => t.id === activeTab)?.label}
              </h3>
              <p className="text-gray-500">{t('placeholder.title')}</p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};

export default SettingsPage;