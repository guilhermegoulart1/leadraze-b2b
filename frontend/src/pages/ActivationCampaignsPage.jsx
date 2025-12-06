import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Award, Play, Pause, Square, BarChart3, Mail, MessageCircle, Linkedin } from 'lucide-react';
import api from '../services/api';
import ActivationCampaignWizard from '../components/ActivationCampaignWizard';

const ActivationCampaignsPage = () => {
  const { t } = useTranslation(['activationcampaigns', 'common']);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const response = await api.getActivationCampaigns();
      if (response.success) {
        setCampaigns(response.data.campaigns || []);
      }
    } catch (error) {
      console.error(t('errors.loadFailed'), error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async (formData) => {
    try {
      const response = await api.createActivationCampaign(formData);
      if (response.success) {
        await loadCampaigns();
        setShowWizard(false);
      }
    } catch (error) {
      console.error(t('errors.createFailed'), error);
      throw error;
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
      scheduled: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
      paused: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
      completed: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
      stopped: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
        {t(`status.${status}`, status)}
      </span>
    );
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'whatsapp': return <MessageCircle className="w-4 h-4" />;
      case 'linkedin': return <Linkedin className="w-4 h-4" />;
      default: return <Award className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'email': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'whatsapp': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'linkedin': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  const activeCampaigns = campaigns.filter(c => c.status === 'active');
  const totalContacts = campaigns.reduce((sum, c) => sum + (c.total_contacts || 0), 0);
  const totalActivated = campaigns.reduce((sum, c) => sum + (c.contacts_activated || 0), 0);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('subtitle')}
            </p>
          </div>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('newCampaign')}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('stats.totalCampaigns')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{campaigns.length}</p>
            </div>
            <Award className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('stats.activeCampaigns')}</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{activeCampaigns.length}</p>
            </div>
            <Play className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('stats.totalContacts')}</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{totalContacts}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('stats.activated')}</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{totalActivated}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 dark:border-purple-400 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">{t('loading')}</p>
          </div>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {t('empty.title')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('empty.subtitle')}
          </p>
          <button
            onClick={() => setShowWizard(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            {t('empty.button')}
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('table.campaign')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('table.type')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('table.status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('table.list')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('table.progress')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('table.dailyLimit')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {campaigns.map((campaign) => {
                const progress = campaign.total_contacts > 0
                  ? Math.round((campaign.contacts_activated / campaign.total_contacts) * 100)
                  : 0;

                return (
                  <tr key={campaign.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">{campaign.name}</div>
                        {campaign.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                            {campaign.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(campaign.activation_channels || [campaign.activation_type]).filter(Boolean).map((channel, idx) => (
                          <div key={idx} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getTypeColor(channel)}`}>
                            {getTypeIcon(channel)}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(campaign.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-gray-100">{campaign.list_name || 'N/A'}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {campaign.total_contacts || 0} {t('table.contacts')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-32">
                        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                          <span>{campaign.contacts_activated || 0}</span>
                          <span>{campaign.total_contacts || 0}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      {campaign.daily_limit || 50} {t('table.perDay')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {campaign.status === 'draft' && (
                          <button className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors">
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        {campaign.status === 'active' && (
                          <button className="p-2 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg transition-colors">
                            <Pause className="w-4 h-4" />
                          </button>
                        )}
                        {campaign.status === 'paused' && (
                          <>
                            <button className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors">
                              <Play className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                              <Square className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button className="p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors">
                          <BarChart3 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Wizard */}
      <ActivationCampaignWizard
        isOpen={showWizard}
        onClose={() => {
          setShowWizard(false);
          setSelectedCampaign(null);
        }}
        onSubmit={handleCreateCampaign}
        campaign={selectedCampaign}
      />
    </div>
  );
};

export default ActivationCampaignsPage;
