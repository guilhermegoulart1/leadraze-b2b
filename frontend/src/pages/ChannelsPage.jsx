import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Plus, Trash2, Building2, RefreshCw, Crown, Briefcase, Users, Settings, Linkedin, Power, PowerOff, RotateCcw, X, AlertTriangle, MessageCircle, Instagram, Facebook, Send, Twitter, Mail, Cog, MoreVertical, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import LimitConfigModal from '../components/LimitConfigModal';
import ChannelSettingsModal from '../components/ChannelSettingsModal';
import { useOnboarding } from '../contexts/OnboardingContext';

// ================================
// MULTI-CHANNEL: Configuração de ícones e cores por provider
// ================================
const CHANNEL_CONFIG = {
  LINKEDIN: {
    icon: Linkedin,
    name: 'LinkedIn',
    gradient: 'from-blue-600 to-blue-700',
    bgLight: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200'
  },
  WHATSAPP: {
    icon: MessageCircle,
    name: 'WhatsApp',
    gradient: 'from-green-500 to-green-600',
    bgLight: 'bg-green-50',
    textColor: 'text-green-600',
    borderColor: 'border-green-200'
  },
  INSTAGRAM: {
    icon: Instagram,
    name: 'Instagram',
    gradient: 'from-pink-500 to-purple-600',
    bgLight: 'bg-pink-50',
    textColor: 'text-pink-600',
    borderColor: 'border-pink-200'
  },
  MESSENGER: {
    icon: Facebook,
    name: 'Messenger',
    gradient: 'from-blue-500 to-blue-600',
    bgLight: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200'
  },
  TELEGRAM: {
    icon: Send,
    name: 'Telegram',
    gradient: 'from-sky-500 to-sky-600',
    bgLight: 'bg-sky-50',
    textColor: 'text-sky-600',
    borderColor: 'border-sky-200'
  },
  TWITTER: {
    icon: Twitter,
    name: 'X (Twitter)',
    gradient: 'from-gray-800 to-gray-900',
    bgLight: 'bg-gray-100',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-300'
  },
  GOOGLE: {
    icon: Mail,
    name: 'Google Chat',
    gradient: 'from-red-500 to-red-600',
    bgLight: 'bg-red-50',
    textColor: 'text-red-600',
    borderColor: 'border-red-200'
  },
  OUTLOOK: {
    icon: Mail,
    name: 'Outlook',
    gradient: 'from-blue-600 to-blue-700',
    bgLight: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200'
  },
  MAIL: {
    icon: Mail,
    name: 'Email',
    gradient: 'from-gray-600 to-gray-700',
    bgLight: 'bg-gray-50',
    textColor: 'text-gray-600',
    borderColor: 'border-gray-200'
  }
};

const getChannelConfig = (providerType) => {
  return CHANNEL_CONFIG[providerType?.toUpperCase()] || CHANNEL_CONFIG.LINKEDIN;
};

const ChannelsPage = () => {
  const { t } = useTranslation(['linkedinaccounts', 'common']);
  const { completeStep } = useOnboarding();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshingAccounts, setRefreshingAccounts] = useState({});
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [healthScores, setHealthScores] = useState({});
  const [activeDropdown, setActiveDropdown] = useState(null);

  // Estados para modais de gerenciamento de conta
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [accountToManage, setAccountToManage] = useState(null);
  const [reactivateCredentials, setReactivateCredentials] = useState({ username: '', password: '' });
  const [actionLoading, setActionLoading] = useState(false);

  // Estado para conexão
  const [connectLoading, setConnectLoading] = useState(false);

  // Estado para modal de configurações do canal
  const [showChannelSettingsModal, setShowChannelSettingsModal] = useState(false);
  const [channelToConfig, setChannelToConfig] = useState(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    const hasActiveAccount = accounts.some(acc => acc.status === 'connected');
    if (hasActiveAccount) {
      completeStep('connect_linkedin');
    }
  }, [accounts, completeStep]);

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const getAccountType = (account) => {
    let accountTypeInfo = {};
    try {
      accountTypeInfo = typeof account.premium_features === 'string'
        ? JSON.parse(account.premium_features || '{}')
        : account.premium_features || {};
    } catch (e) {
      accountTypeInfo = {};
    }

    if (accountTypeInfo.sales_navigator !== null && accountTypeInfo.sales_navigator !== undefined) {
      return 'Sales Navigator';
    }
    if (accountTypeInfo.recruiter !== null && accountTypeInfo.recruiter !== undefined) {
      return 'Recruiter';
    }
    if (accountTypeInfo.premium === true) {
      return 'Premium';
    }
    return 'Free';
  };

  const getAccountTypeStyle = (type) => {
    const styles = {
      'Sales Navigator': { bg: 'bg-blue-100', text: 'text-blue-700', icon: Briefcase },
      'Recruiter': { bg: 'bg-purple-100', text: 'text-purple-700', icon: Users },
      'Premium': { bg: 'bg-amber-100', text: 'text-amber-700', icon: Crown },
      'Free': { bg: 'bg-gray-100', text: 'text-gray-600', icon: CheckCircle }
    };
    return styles[type] || styles['Free'];
  };

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await api.getLinkedInAccounts();
      if (response.success) {
        setAccounts(response.data || []);
        loadHealthScores(response.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHealthScores = async (accountsList) => {
    const healthPromises = accountsList.map(async (account) => {
      try {
        const response = await api.getAccountHealth(account.id);
        if (response.success) {
          return { id: account.id, data: response.data };
        }
      } catch (error) {
        return { id: account.id, data: null };
      }
    });

    const results = await Promise.all(healthPromises);
    const scoresMap = {};
    results.forEach(result => {
      if (result && result.data) {
        scoresMap[result.id] = result.data;
      }
    });
    setHealthScores(scoresMap);
  };

  const handleRefreshAccount = async (accountId, e) => {
    e?.stopPropagation();
    try {
      setRefreshingAccounts(prev => ({ ...prev, [accountId]: true }));
      const response = await api.refreshLinkedInAccount(accountId);
      if (response.success) {
        setAccounts(prevAccounts =>
          prevAccounts.map(acc => acc.id === accountId ? response.data : acc)
        );
      }
    } catch (error) {
      alert('Erro ao atualizar conta. Tente novamente.');
    } finally {
      setRefreshingAccounts(prev => ({ ...prev, [accountId]: false }));
    }
  };

  const handleOpenChannelSettings = (account) => {
    setChannelToConfig(account);
    setShowChannelSettingsModal(true);
    setActiveDropdown(null);
  };

  const handleCloseChannelSettings = () => {
    setShowChannelSettingsModal(false);
    setChannelToConfig(null);
  };

  const handleChannelSettingsUpdate = (channelId, newSettings) => {
    setAccounts(prevAccounts =>
      prevAccounts.map(acc =>
        acc.id === channelId ? { ...acc, channel_settings: newSettings } : acc
      )
    );
  };

  const handleOpenLimitConfig = (account) => {
    setSelectedAccount(account);
    setShowLimitModal(true);
    setActiveDropdown(null);
  };

  const handleCloseLimitModal = () => {
    setShowLimitModal(false);
    setSelectedAccount(null);
  };

  const handleLimitUpdate = async (accountId, newLimit) => {
    setAccounts(prevAccounts =>
      prevAccounts.map(acc =>
        acc.id === accountId ? { ...acc, daily_limit: newLimit } : acc
      )
    );
    await loadAccounts();
  };

  const handleOpenDisconnectModal = (account) => {
    setAccountToManage(account);
    setShowDisconnectModal(true);
    setActiveDropdown(null);
  };

  const handleOpenDeleteModal = (account) => {
    setAccountToManage(account);
    setShowDeleteModal(true);
    setActiveDropdown(null);
  };

  const handleOpenReactivateModal = (account) => {
    setAccountToManage(account);
    setReactivateCredentials({ username: account.linkedin_username, password: '' });
    setShowReactivateModal(true);
    setActiveDropdown(null);
  };

  const handleDisconnect = async () => {
    if (!accountToManage) return;
    try {
      setActionLoading(true);
      const response = await api.disconnectLinkedInAccount(accountToManage.id);
      if (response.success) {
        await loadAccounts();
        setShowDisconnectModal(false);
        setAccountToManage(null);
      } else {
        alert('Erro ao desconectar conta: ' + (response.message || 'Erro desconhecido'));
      }
    } catch (error) {
      alert('Erro ao desconectar conta. Tente novamente.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!accountToManage) return;
    try {
      setActionLoading(true);
      const response = await api.deleteLinkedInAccount(accountToManage.id);
      if (response.success) {
        await loadAccounts();
        setShowDeleteModal(false);
        setAccountToManage(null);
      } else {
        alert('Erro ao excluir conta: ' + (response.message || 'Erro desconhecido'));
      }
    } catch (error) {
      alert('Erro ao excluir conta. Tente novamente.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!accountToManage || !reactivateCredentials.password) return;
    try {
      setActionLoading(true);
      const response = await api.reactivateLinkedInAccount(
        accountToManage.id,
        reactivateCredentials.username,
        reactivateCredentials.password
      );
      if (response.success) {
        await loadAccounts();
        setShowReactivateModal(false);
        setAccountToManage(null);
        setReactivateCredentials({ username: '', password: '' });
      } else {
        alert('Erro ao reativar conta: ' + (response.message || 'Erro desconhecido'));
      }
    } catch (error) {
      alert('Erro ao reativar conta. Verifique as credenciais e tente novamente.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConnectChannel = async () => {
    try {
      setConnectLoading(true);
      const response = await api.getHostedAuthLink();
      if (response.success && response.data?.url) {
        const width = 700;
        const height = 800;
        const left = window.screenX + (window.innerWidth - width) / 2;
        const top = window.screenY + (window.innerHeight - height) / 2;
        const popup = window.open(
          response.data.url,
          'unipile-auth',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
        );
        const checkPopup = setInterval(async () => {
          if (popup && popup.closed) {
            clearInterval(checkPopup);
            // Sincronizar contas da Unipile com banco local
            try {
              console.log('🔄 Popup fechado, sincronizando contas...');
              const syncResult = await api.syncChannels();
              console.log('✅ Sync result:', syncResult);
            } catch (syncError) {
              console.error('⚠️ Erro ao sincronizar:', syncError);
            }
            // Recarregar lista
            await loadAccounts();
            setConnectLoading(false);
          }
        }, 500);
      } else {
        throw new Error('URL de autenticação não recebida');
      }
    } catch (error) {
      alert('Erro ao iniciar conexão. Tente novamente.');
      setConnectLoading(false);
    }
  };

  const activeAccounts = accounts.filter(a => a.status === 'active');
  const disconnectedAccounts = accounts.filter(a => a.status === 'disconnected');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{t('title')}</h1>
            <p className="text-sm text-gray-500">{t('subtitle')}</p>
          </div>
          <button
            onClick={handleConnectChannel}
            disabled={connectLoading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {connectLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>{connectLoading ? 'Conectando...' : t('connectChannel')}</span>
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Channels Table */}
        {accounts.length > 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Canal</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Conta</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Health</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Uso Diario</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Conectado em</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeAccounts.map((account) => {
                  const channelConfig = getChannelConfig(account.provider_type);
                  const ChannelIcon = channelConfig.icon;
                  const accountType = getAccountType(account);
                  const typeStyle = getAccountTypeStyle(accountType);
                  const TypeIcon = typeStyle.icon;
                  const healthScore = healthScores[account.id];
                  const usagePercent = account.daily_limit > 0
                    ? Math.round((account.today_sent / account.daily_limit) * 100)
                    : 0;

                  return (
                    <tr key={account.id} className="hover:bg-gray-50 transition-colors">
                      {/* Canal */}
                      <td className="px-4 py-3">
                        <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md ${channelConfig.bgLight}`}>
                          <ChannelIcon className={`w-4 h-4 ${channelConfig.textColor}`} />
                          <span className={`text-sm font-medium ${channelConfig.textColor}`}>{channelConfig.name}</span>
                        </div>
                      </td>

                      {/* Conta */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {account.profile_picture ? (
                            <img
                              src={account.profile_picture}
                              alt={account.profile_name}
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <div className={`w-8 h-8 bg-gradient-to-br ${channelConfig.gradient} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
                              {account.profile_name?.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{account.profile_name}</p>
                            <p className="text-xs text-gray-500">@{account.public_identifier || account.linkedin_username}</p>
                          </div>
                        </div>
                      </td>

                      {/* Tipo */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${typeStyle.bg} ${typeStyle.text}`}>
                          <TypeIcon className="w-3 h-3" />
                          {accountType}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3" />
                          Ativo
                        </span>
                      </td>

                      {/* Health */}
                      <td className="px-4 py-3 text-center">
                        {healthScore ? (
                          <span className={`inline-flex items-center justify-center w-10 h-6 rounded text-xs font-semibold ${
                            healthScore.health_score >= 70 ? 'bg-green-100 text-green-700' :
                            healthScore.health_score >= 50 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {healthScore.health_score}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Uso Diário */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-gray-600">
                            {account.today_sent}/{account.daily_limit}
                          </span>
                          <div className="w-16 bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${
                                usagePercent >= 90 ? 'bg-red-500' :
                                usagePercent >= 70 ? 'bg-yellow-500' :
                                'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(usagePercent, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Conectado em */}
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-gray-500">
                          {new Date(account.connected_at).toLocaleDateString('pt-BR')}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => handleRefreshAccount(account.id, e)}
                            disabled={refreshingAccounts[account.id]}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                            title="Atualizar"
                          >
                            <RefreshCw className={`w-4 h-4 ${refreshingAccounts[account.id] ? 'animate-spin' : ''}`} />
                          </button>
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdown(activeDropdown === account.id ? null : account.id);
                              }}
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {activeDropdown === account.id && (
                              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                                <button
                                  onClick={() => handleOpenChannelSettings(account)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  <Cog className="w-4 h-4" />
                                  Configuracoes
                                </button>
                                <button
                                  onClick={() => handleOpenLimitConfig(account)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  <Settings className="w-4 h-4" />
                                  Limites
                                </button>
                                <hr className="my-1 border-gray-100" />
                                <button
                                  onClick={() => handleOpenDisconnectModal(account)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-orange-600 hover:bg-orange-50"
                                >
                                  <PowerOff className="w-4 h-4" />
                                  Desconectar
                                </button>
                                <button
                                  onClick={() => handleOpenDeleteModal(account)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Excluir
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* Disconnected Accounts */}
                {disconnectedAccounts.map((account) => {
                  const channelConfig = getChannelConfig(account.provider_type);
                  const ChannelIcon = channelConfig.icon;

                  return (
                    <tr key={account.id} className="bg-gray-50/50 opacity-75">
                      {/* Canal */}
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-gray-100">
                          <ChannelIcon className="w-4 h-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-500">{channelConfig.name}</span>
                        </div>
                      </td>

                      {/* Conta */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {account.profile_picture ? (
                            <img
                              src={account.profile_picture}
                              alt={account.profile_name}
                              className="w-8 h-8 rounded-full grayscale"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {account.profile_name?.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-600">{account.profile_name}</p>
                            <p className="text-xs text-gray-400">@{account.public_identifier || account.linkedin_username}</p>
                          </div>
                        </div>
                      </td>

                      {/* Tipo */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-400">-</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                          <PowerOff className="w-3 h-3" />
                          Desativado
                        </span>
                      </td>

                      {/* Health */}
                      <td className="px-4 py-3 text-center">
                        <span className="text-gray-400 text-xs">-</span>
                      </td>

                      {/* Uso Diário */}
                      <td className="px-4 py-3 text-center">
                        <span className="text-gray-400 text-xs">-</span>
                      </td>

                      {/* Conectado em */}
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-gray-400">
                          {account.disconnected_at
                            ? `Desc. ${new Date(account.disconnected_at).toLocaleDateString('pt-BR')}`
                            : '-'}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenReactivateModal(account)}
                            className="px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 rounded transition-colors"
                          >
                            Reativar
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(account)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {disconnectedAccounts.length > 0 && (
              <div className="bg-amber-50 border-t border-amber-200 px-4 py-2">
                <p className="text-xs text-amber-700">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  Contas desativadas ainda contam como slot ativo. Exclua para liberar.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
            <div className="max-w-sm mx-auto">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Linkedin className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-base font-medium text-gray-900 mb-1">{t('messages.noChannels')}</h3>
              <p className="text-sm text-gray-500 mb-4">{t('messages.noChannelsDescription')}</p>
              <button
                onClick={handleConnectChannel}
                disabled={connectLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {connectLoading ? 'Conectando...' : t('messages.connectFirstChannel')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showLimitModal && selectedAccount && (
        <LimitConfigModal
          account={selectedAccount}
          onClose={handleCloseLimitModal}
          onUpdate={handleLimitUpdate}
        />
      )}

      {showDisconnectModal && accountToManage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <PowerOff className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Desconectar Canal</h3>
                  <p className="text-sm text-gray-500">{accountToManage.profile_name}</p>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-800">
                  Voce podera reativar depois. O slot continuara ativo ate excluir.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDisconnectModal(false); setAccountToManage(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  disabled={actionLoading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium disabled:opacity-50"
                >
                  {actionLoading ? 'Desconectando...' : 'Desconectar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && accountToManage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Excluir Permanentemente</h3>
                  <p className="text-sm text-gray-500">{accountToManage.profile_name}</p>
                </div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-800">
                  <strong>Irreversivel!</strong> O historico sera perdido permanentemente.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteModal(false); setAccountToManage(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  disabled={actionLoading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
                >
                  {actionLoading ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReactivateModal && accountToManage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Reativar Canal</h3>
                  <p className="text-sm text-gray-500">{accountToManage.profile_name}</p>
                </div>
              </div>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                  <input
                    type="text"
                    value={reactivateCredentials.username}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                  <input
                    type="password"
                    value={reactivateCredentials.password}
                    onChange={(e) => setReactivateCredentials(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Digite sua senha"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowReactivateModal(false);
                    setAccountToManage(null);
                    setReactivateCredentials({ username: '', password: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  disabled={actionLoading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleReactivate}
                  disabled={actionLoading || !reactivateCredentials.password}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
                >
                  {actionLoading ? 'Reativando...' : 'Reativar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showChannelSettingsModal && channelToConfig && (
        <ChannelSettingsModal
          channel={channelToConfig}
          channelConfig={getChannelConfig(channelToConfig.provider_type)}
          onClose={handleCloseChannelSettings}
          onUpdate={handleChannelSettingsUpdate}
        />
      )}
    </div>
  );
};

export default ChannelsPage;
