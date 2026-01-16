// frontend/src/components/CampaignReviewModal.jsx
import React, { useState, useEffect } from 'react';
import {
  X, CheckCircle, Users, Sparkles, MessageSquare, Play,
  ArrowLeft, Loader, AlertCircle, Trash2, Settings, Clock,
  Save, Globe, Calendar, Bot, Download, Check, XCircle, Ban
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

// Timezones comuns
const TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
  { value: 'America/New_York', label: 'New York (GMT-5)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (GMT-8)' },
  { value: 'Europe/London', label: 'London (GMT+0)' },
  { value: 'Europe/Paris', label: 'Paris (GMT+1)' },
  { value: 'Europe/Berlin', label: 'Berlin (GMT+1)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (GMT+9)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (GMT+8)' },
  { value: 'Australia/Sydney', label: 'Sydney (GMT+11)' },
  { value: 'UTC', label: 'UTC (GMT+0)' },
];

const CampaignReviewModal = ({ isOpen, onClose, campaign, onActivate }) => {
  const { t } = useTranslation('modals');
  const [contacts, setContacts] = useState([]);
  const [contactsStats, setContactsStats] = useState({});
  const [aiAgent, setAiAgent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('collected'); // collected, approved, rejected, all

  // Configuration states
  const [sectors, setSectors] = useState([]);
  const [users, setUsers] = useState([]);
  const [sectorUsers, setSectorUsers] = useState([]);
  const [config, setConfig] = useState({
    sector_id: '',
    round_robin_users: [],
    invite_expiry_days: 7,
    max_pending_invites: 100,
    withdraw_expired_invites: true,
    send_start_hour: 9,
    send_end_hour: 18,
    timezone: 'America/Sao_Paulo',
    ai_initiate_delay_min: 5,
    ai_initiate_delay_max: 60,
  });
  const [isConfigSaved, setIsConfigSaved] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    if (isOpen && campaign) {
      loadData();
    }
  }, [isOpen, campaign]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load contacts from campaign_contacts (with high limit to get all)
      const contactsResponse = await api.getCampaignContacts(campaign.id, { limit: 1000 });
      const rawContacts = contactsResponse.data?.contacts || [];
      // Map contact_ prefixed fields to expected field names
      const campaignContacts = rawContacts.map(contact => ({
        ...contact,
        name: contact.contact_name || contact.name,
        profile_picture: contact.contact_profile_picture || contact.profile_picture,
        profile_url: contact.contact_profile_url || contact.profile_url,
        title: contact.contact_title || contact.title,
        company: contact.contact_company || contact.company,
        email: contact.contact_email || contact.email,
        phone: contact.contact_phone || contact.phone,
      }));
      setContacts(campaignContacts);

      // Load contacts stats
      try {
        const statsResponse = await api.getCampaignContactsStats(campaign.id);
        setContactsStats(statsResponse.data?.stats || {});
      } catch (e) {
        console.warn('Could not load contacts stats:', e);
      }

      // Load AI agent if exists
      if (campaign.ai_agent_id) {
        const agentResponse = await api.getAIAgent(campaign.ai_agent_id);
        setAiAgent(agentResponse.data);
      }

      // Load sectors for configuration
      try {
        const sectorsResponse = await api.getSectors();
        setSectors(sectorsResponse.data || []);
      } catch (e) {
        console.warn('Could not load sectors:', e);
      }

      // Load existing config if any
      try {
        const configResponse = await api.getReviewConfig(campaign.id);
        if (configResponse.data) {
          const existingConfig = configResponse.data;
          setConfig({
            sector_id: existingConfig.sector_id || '',
            round_robin_users: existingConfig.round_robin_users || [],
            invite_expiry_days: existingConfig.invite_expiry_days || 7,
            max_pending_invites: existingConfig.max_pending_invites || 100,
            withdraw_expired_invites: existingConfig.withdraw_expired_invites !== false,
            send_start_hour: existingConfig.send_start_hour || 9,
            send_end_hour: existingConfig.send_end_hour || 18,
            timezone: existingConfig.timezone || 'America/Sao_Paulo',
            ai_initiate_delay_min: existingConfig.ai_initiate_delay_min || 5,
            ai_initiate_delay_max: existingConfig.ai_initiate_delay_max || 60,
          });
          setIsConfigSaved(existingConfig.is_reviewed === true);

          // Load sector users if sector is selected
          if (existingConfig.sector_id) {
            loadSectorUsers(existingConfig.sector_id);
          }
        }
      } catch (e) {
        console.warn('Could not load review config:', e);
      }

      // Start with no contacts selected
      setSelectedContacts(new Set());

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSectorUsers = async (sectorId) => {
    if (!sectorId) {
      setSectorUsers([]);
      return;
    }
    try {
      const response = await api.getSectorUsers(sectorId);
      setSectorUsers(response.data || []);
    } catch (e) {
      console.warn('Could not load sector users:', e);
      setSectorUsers([]);
    }
  };

  const handleSectorChange = (sectorId) => {
    setConfig(prev => ({
      ...prev,
      sector_id: sectorId,
      round_robin_users: [], // Reset users when sector changes
    }));
    setIsConfigSaved(false);
    loadSectorUsers(sectorId);
  };

  const handleUserToggle = (userId) => {
    setConfig(prev => {
      const current = prev.round_robin_users || [];
      const newUsers = current.includes(userId)
        ? current.filter(id => id !== userId)
        : [...current, userId];
      return { ...prev, round_robin_users: newUsers };
    });
    setIsConfigSaved(false);
  };

  const handleConfigChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setIsConfigSaved(false);
  };

  const handleSaveConfig = async () => {
    try {
      setIsSavingConfig(true);
      await api.saveReviewConfig(campaign.id, config);
      setIsConfigSaved(true);
    } catch (error) {
      console.error('Error saving config:', error);
      alert(t('campaignReview.saveConfigError', 'Erro ao salvar configuração'));
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleActivate = async () => {
    try {
      setIsActivating(true);
      await onActivate(campaign.id);
      onClose();
    } catch (error) {
      console.error('Error activating campaign:', error);
    } finally {
      setIsActivating(false);
    }
  };

  const toggleContact = (contactId) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const toggleAll = () => {
    const filteredContacts = getFilteredContacts();
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
    }
  };

  // Filter contacts by status
  const getFilteredContacts = () => {
    if (statusFilter === 'all') return contacts;
    return contacts.filter(c => c.status === statusFilter);
  };

  // Approve selected contacts
  const handleApproveSelected = async () => {
    if (selectedContacts.size === 0) return;

    try {
      setIsApproving(true);
      await api.approveContacts(campaign.id, Array.from(selectedContacts));

      // Update local state
      setContacts(contacts.map(c =>
        selectedContacts.has(c.id) ? { ...c, status: 'approved' } : c
      ));
      setSelectedContacts(new Set());

      // Reload stats
      const statsResponse = await api.getCampaignContactsStats(campaign.id);
      setContactsStats(statsResponse.data?.stats || {});
    } catch (error) {
      console.error('Error approving contacts:', error);
      alert(t('campaignReview.approveError', 'Erro ao aprovar contatos'));
    } finally {
      setIsApproving(false);
    }
  };

  // Reject selected contacts
  const handleRejectSelected = async () => {
    if (selectedContacts.size === 0) return;

    try {
      setIsRejecting(true);
      await api.rejectContacts(campaign.id, Array.from(selectedContacts));

      // Update local state
      setContacts(contacts.map(c =>
        selectedContacts.has(c.id) ? { ...c, status: 'rejected' } : c
      ));
      setSelectedContacts(new Set());

      // Reload stats
      const statsResponse = await api.getCampaignContactsStats(campaign.id);
      setContactsStats(statsResponse.data?.stats || {});
    } catch (error) {
      console.error('Error rejecting contacts:', error);
      alert(t('campaignReview.rejectError', 'Erro ao rejeitar contatos'));
    } finally {
      setIsRejecting(false);
    }
  };

  // Approve all collected contacts
  const handleApproveAll = async () => {
    if (!confirm(t('campaignReview.confirmApproveAll', 'Deseja aprovar todos os contatos coletados?'))) {
      return;
    }

    try {
      setIsApproving(true);
      await api.approveContacts(campaign.id, null, true); // approveAll = true

      // Update local state
      setContacts(contacts.map(c =>
        c.status === 'collected' ? { ...c, status: 'approved' } : c
      ));
      setSelectedContacts(new Set());

      // Reload stats
      const statsResponse = await api.getCampaignContactsStats(campaign.id);
      setContactsStats(statsResponse.data?.stats || {});
    } catch (error) {
      console.error('Error approving all contacts:', error);
      alert(t('campaignReview.approveError', 'Erro ao aprovar contatos'));
    } finally {
      setIsApproving(false);
    }
  };

  // Exportar contatos para CSV
  const handleExportCSV = () => {
    if (contacts.length === 0) return;

    const headers = [
      'Nome',
      'Cargo',
      'Empresa',
      'Email',
      'Telefone',
      'Localização',
      'Headline',
      'URL LinkedIn',
      'Conexões',
      'Seguidores',
      'Status',
      'Premium',
      'Creator',
      'Influencer'
    ];

    const escapeCsvValue = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = contacts.map(contact => [
      escapeCsvValue(contact.name || ''),
      escapeCsvValue(contact.title || ''),
      escapeCsvValue(contact.company || ''),
      escapeCsvValue(contact.email || ''),
      escapeCsvValue(contact.phone || ''),
      escapeCsvValue(contact.location || ''),
      escapeCsvValue(contact.headline || ''),
      escapeCsvValue(contact.profile_url || ''),
      contact.connections_count || '',
      contact.follower_count || '',
      contact.status || '',
      contact.is_premium ? 'Sim' : 'Não',
      contact.is_creator ? 'Sim' : 'Não',
      contact.is_influencer ? 'Sim' : 'Não'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contatos-${campaign?.name || 'campanha'}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-6xl w-full h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-purple-800 bg-[#7229f7] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{campaign?.name}</h2>
                <p className="text-sm text-purple-100">{t('campaignReview.subtitle')}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content - Layout de 2 colunas */}
        <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">{t('campaignReview.loadingData')}</p>
              </div>
            </div>
          ) : (
            <div className="flex h-full" style={{ minHeight: 0 }}>
              {/* Coluna Esquerda - Informações da Campanha */}
              <div className="flex-1 p-6 space-y-6 overflow-y-auto" style={{ minHeight: 0 }}>
                {/* Stats Overview - 4 cards showing contact status */}
                <div className="grid grid-cols-4 gap-3">
                  {/* Total coletados */}
                  <button
                    onClick={() => setStatusFilter('collected')}
                    className={`rounded-lg p-3 border transition-all ${
                      statusFilter === 'collected'
                        ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-600 ring-2 ring-blue-500'
                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-medium text-blue-900 dark:text-blue-300">{t('campaignReview.collected', 'Coletados')}</span>
                    </div>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{contactsStats.collected || 0}</p>
                  </button>

                  {/* Aprovados */}
                  <button
                    onClick={() => setStatusFilter('approved')}
                    className={`rounded-lg p-3 border transition-all ${
                      statusFilter === 'approved'
                        ? 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-600 ring-2 ring-green-500'
                        : 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="text-xs font-medium text-green-900 dark:text-green-300">{t('campaignReview.approved', 'Aprovados')}</span>
                    </div>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">{contactsStats.approved || 0}</p>
                  </button>

                  {/* Rejeitados */}
                  <button
                    onClick={() => setStatusFilter('rejected')}
                    className={`rounded-lg p-3 border transition-all ${
                      statusFilter === 'rejected'
                        ? 'bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-600 ring-2 ring-red-500'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Ban className="w-4 h-4 text-red-600 dark:text-red-400" />
                      <span className="text-xs font-medium text-red-900 dark:text-red-300">{t('campaignReview.rejected', 'Rejeitados')}</span>
                    </div>
                    <p className="text-xl font-bold text-red-600 dark:text-red-400">{contactsStats.rejected || 0}</p>
                  </button>

                  {/* Todos */}
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`rounded-lg p-3 border transition-all ${
                      statusFilter === 'all'
                        ? 'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-600 ring-2 ring-purple-500'
                        : 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-xs font-medium text-purple-900 dark:text-purple-300">{t('campaignReview.total', 'Total')}</span>
                    </div>
                    <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{contacts.length}</p>
                  </button>
                </div>

              {/* AI Agent Section */}
              {aiAgent && (
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 rounded-lg p-6 border border-purple-200 dark:border-purple-700">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{aiAgent.name}</h3>
                        <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 rounded text-xs font-medium">
                          {t('campaignReview.aiAgent')}
                        </span>
                      </div>
                      {aiAgent.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{aiAgent.description}</p>
                      )}

                      {/* Message Template */}
                      {aiAgent.system_prompt && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('campaignReview.messageToSend')}</span>
                          </div>
                          <p className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">
                            {aiAgent.system_prompt}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Configuration Section */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => setShowConfig(!showConfig)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {t('campaignReview.configuration', 'Configuração da Campanha')}
                    </span>
                    {isConfigSaved && (
                      <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 rounded text-xs font-medium">
                        {t('campaignReview.saved', 'Salvo')}
                      </span>
                    )}
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${showConfig ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showConfig && (
                  <div className="p-4 space-y-6">
                    {/* Round Robin Section */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        {t('campaignReview.roundRobin', 'Distribuição Round Robin')}
                      </h4>

                      {/* Sector Select */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('campaignReview.sector', 'Setor')}
                        </label>
                        <select
                          value={config.sector_id}
                          onChange={(e) => handleSectorChange(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        >
                          <option value="">{t('campaignReview.selectSector', 'Selecione um setor')}</option>
                          {sectors.map(sector => (
                            <option key={sector.id} value={sector.id}>{sector.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Users Multi-select */}
                      {config.sector_id && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('campaignReview.usersForRotation', 'Usuários para Rotação')}
                          </label>
                          {sectorUsers.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                              {t('campaignReview.noUsersInSector', 'Nenhum usuário neste setor')}
                            </p>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                              {sectorUsers.map(user => (
                                <label key={user.id} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-white dark:bg-gray-800">
                                  <input
                                    type="checkbox"
                                    checked={config.round_robin_users.includes(user.id)}
                                    onChange={() => handleUserToggle(user.id)}
                                    className="w-4 h-4 text-blue-600 dark:text-blue-400 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{user.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Invite Settings */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-green-600 dark:text-green-400" />
                        {t('campaignReview.inviteSettings', 'Configurações de Convite')}
                      </h4>

                      {/* Expiry Days Slider */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('campaignReview.expiryDays', 'Dias de espera para expirar')}: <span className="font-bold text-blue-600 dark:text-blue-400">{config.invite_expiry_days}</span>
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="14"
                          value={config.invite_expiry_days}
                          onChange={(e) => handleConfigChange('invite_expiry_days', parseInt(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <span>1 dia</span>
                          <span>14 dias</span>
                        </div>
                      </div>

                      {/* Withdraw Expired */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.withdraw_expired_invites}
                          onChange={(e) => handleConfigChange('withdraw_expired_invites', e.target.checked)}
                          className="w-4 h-4 text-blue-600 dark:text-blue-400 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {t('campaignReview.withdrawExpired', 'Retirar convites expirados automaticamente')}
                        </span>
                      </label>
                    </div>

                    {/* Business Hours */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-orange-600" />
                        {t('campaignReview.businessHours', 'Horário de Envio')}
                      </h4>

                      <div className="grid grid-cols-3 gap-4">
                        {/* Start Hour */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('campaignReview.startHour', 'Início')}
                          </label>
                          <select
                            value={config.send_start_hour}
                            onChange={(e) => handleConfigChange('send_start_hour', parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                            ))}
                          </select>
                        </div>

                        {/* End Hour */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('campaignReview.endHour', 'Fim')}
                          </label>
                          <select
                            value={config.send_end_hour}
                            onChange={(e) => handleConfigChange('send_end_hour', parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                            ))}
                          </select>
                        </div>

                        {/* Timezone */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            <Globe className="w-3 h-3 inline mr-1" />
                            {t('campaignReview.timezone', 'Fuso')}
                          </label>
                          <select
                            value={config.timezone}
                            onChange={(e) => handleConfigChange('timezone', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          >
                            {TIMEZONES.map(tz => (
                              <option key={tz.value} value={tz.value}>{tz.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* AI Delay Settings */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        {t('campaignReview.aiDelay', 'Delay do Agente de IA')}
                      </h4>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('campaignReview.minDelay', 'Mínimo (min)')}
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="120"
                            value={config.ai_initiate_delay_min}
                            onChange={(e) => handleConfigChange('ai_initiate_delay_min', parseInt(e.target.value) || 5)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('campaignReview.maxDelay', 'Máximo (min)')}
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="120"
                            value={config.ai_initiate_delay_max}
                            onChange={(e) => handleConfigChange('ai_initiate_delay_max', parseInt(e.target.value) || 60)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t('campaignReview.aiDelayHelp', 'Tempo aleatório entre aceite do convite e primeira mensagem do agente')}
                      </p>
                    </div>

                    {/* Save Button */}
                    <div className="pt-2">
                      <button
                        onClick={handleSaveConfig}
                        disabled={isSavingConfig}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                      >
                        {isSavingConfig ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            {t('campaignReview.saving', 'Salvando...')}
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            {t('campaignReview.saveConfig', 'Salvar Configuração')}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </div>

              {/* Coluna Direita - Lista de Contatos */}
              <div className="w-96 border-l border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-800" style={{ minHeight: 0 }}>
                {/* Header da lista */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {statusFilter === 'all' ? t('campaignReview.allContacts', 'Todos os Contatos') :
                         statusFilter === 'collected' ? t('campaignReview.pendingReview', 'Aguardando Revisão') :
                         statusFilter === 'approved' ? t('campaignReview.approvedContacts', 'Contatos Aprovados') :
                         t('campaignReview.rejectedContacts', 'Contatos Rejeitados')}
                      </h3>
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 rounded text-xs font-medium">
                        {getFilteredContacts().length}
                      </span>
                    </div>
                    <button
                      onClick={handleExportCSV}
                      disabled={contacts.length === 0}
                      className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={t('campaignReview.exportCSV', 'Exportar CSV')}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Actions bar */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={toggleAll}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
                    >
                      {selectedContacts.size === getFilteredContacts().length && getFilteredContacts().length > 0
                        ? t('campaignReview.unselectAll', 'Desmarcar')
                        : t('campaignReview.selectAll', 'Selecionar')} {t('campaignReview.all', 'Todos')}
                    </button>

                    {/* Show approve all button for collected filter */}
                    {statusFilter === 'collected' && (contactsStats.collected || 0) > 0 && (
                      <>
                        <span className="text-gray-300">•</span>
                        <button
                          onClick={handleApproveAll}
                          disabled={isApproving}
                          className="text-xs text-green-600 dark:text-green-400 hover:text-green-700 font-medium flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          {t('campaignReview.approveAll', 'Aprovar Todos')}
                        </button>
                      </>
                    )}

                    {/* Show actions when items selected */}
                    {selectedContacts.size > 0 && (
                      <>
                        <span className="text-gray-300">•</span>
                        <button
                          onClick={handleApproveSelected}
                          disabled={isApproving}
                          className="text-xs text-green-600 dark:text-green-400 hover:text-green-700 font-medium flex items-center gap-1"
                        >
                          {isApproving ? <Loader className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          {t('campaignReview.approve', 'Aprovar')} {selectedContacts.size}
                        </button>
                        <button
                          onClick={handleRejectSelected}
                          disabled={isRejecting}
                          className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 font-medium flex items-center gap-1"
                        >
                          {isRejecting ? <Loader className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                          {t('campaignReview.reject', 'Rejeitar')} {selectedContacts.size}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Lista scrollável */}
                <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
                  {getFilteredContacts().length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <AlertCircle className="w-12 h-12 text-gray-400 mb-3" />
                      <p className="text-gray-600 dark:text-gray-400">{t('campaignReview.noContactsFound', 'Nenhum contato encontrado')}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {getFilteredContacts().map((contact) => (
                        <div
                          key={contact.id}
                          className={`px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900/50 transition-colors cursor-pointer ${
                            selectedContacts.has(contact.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                          onClick={() => toggleContact(contact.id)}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedContacts.has(contact.id)}
                              onChange={() => toggleContact(contact.id)}
                              className="w-4 h-4 text-blue-600 dark:text-blue-400 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                            />

                            {contact.profile_picture ? (
                              <img
                                src={contact.profile_picture}
                                alt={contact.name}
                                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                                <span className="text-white font-semibold text-base">
                                  {contact.name?.charAt(0) || '?'}
                                </span>
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">{contact.name}</h4>
                                  {/* Status badge */}
                                  {statusFilter === 'all' && (
                                    <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      contact.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                      contact.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                      contact.status === 'invite_sent' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                      contact.status === 'invite_accepted' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' :
                                      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    }`}>
                                      {contact.status === 'collected' ? t('campaignReview.statusCollected', 'Novo') :
                                       contact.status === 'approved' ? t('campaignReview.statusApproved', 'Aprovado') :
                                       contact.status === 'rejected' ? t('campaignReview.statusRejected', 'Rejeitado') :
                                       contact.status === 'invite_sent' ? t('campaignReview.statusInviteSent', 'Convite Enviado') :
                                       contact.status === 'invite_accepted' ? t('campaignReview.statusInviteAccepted', 'Conectado') :
                                       contact.status}
                                    </span>
                                  )}
                                </div>
                                {contact.profile_url && (
                                  <a
                                    href={contact.profile_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex-shrink-0 p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                                    title={t('campaignReview.viewLinkedInProfile')}
                                  >
                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                    </svg>
                                  </a>
                                )}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 truncate">
                                {[contact.title, contact.company].filter(Boolean).join(' • ')}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 transition-colors font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('campaignReview.back')}
            </button>

            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {(contactsStats.collected || 0) > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {t('campaignReview.pendingApproval', { count: contactsStats.collected }, `${contactsStats.collected} contatos aguardando aprovação`)}
                  </span>
                ) : !isConfigSaved ? (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {t('campaignReview.configRequired', 'Configure e salve antes de iniciar')}
                  </span>
                ) : (contactsStats.approved || 0) === 0 ? (
                  <span className="text-gray-500 dark:text-gray-400">
                    {t('campaignReview.noApprovedContacts', 'Nenhum contato aprovado para enviar convites')}
                  </span>
                ) : (
                  <>
                    <span className="font-medium text-green-600 dark:text-green-400">{contactsStats.approved || 0}</span> {t('campaignReview.contactsReadyForInvite', 'contatos prontos para envio de convite')}
                  </>
                )}
              </div>
              <button
                onClick={handleActivate}
                disabled={isActivating || isLoading || (contactsStats.approved || 0) === 0 || !isConfigSaved}
                className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                title={!isConfigSaved ? t('campaignReview.saveConfigFirst', 'Salve a configuração primeiro') : (contactsStats.approved || 0) === 0 ? t('campaignReview.approveContactsFirst', 'Aprove contatos primeiro') : ''}
              >
                {isActivating ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    {t('campaignReview.activating')}
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    {t('campaignReview.activateCampaign')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignReviewModal;
