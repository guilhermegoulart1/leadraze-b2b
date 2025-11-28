import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Plus, Trash2, Building2, RefreshCw, Crown, Briefcase, Users, Settings, Linkedin, Power, PowerOff, RotateCcw, X, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import LimitConfigModal from '../components/LimitConfigModal';
import { useOnboarding } from '../contexts/OnboardingContext';

const LinkedInAccountsPage = () => {
  const { t } = useTranslation(['linkedinaccounts', 'common']);
  const { completeStep } = useOnboarding();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshingAccounts, setRefreshingAccounts] = useState({});
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [healthScores, setHealthScores] = useState({});

  // Estados para modais de gerenciamento de conta
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [accountToManage, setAccountToManage] = useState(null);
  const [reactivateCredentials, setReactivateCredentials] = useState({ username: '', password: '' });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  // Completar step do onboarding quando houver conta conectada
  useEffect(() => {
    const hasActiveAccount = accounts.some(acc => acc.status === 'connected');
    if (hasActiveAccount) {
      completeStep('connect_linkedin');
    }
  }, [accounts, completeStep]);

  // Determinar tipo de conta LinkedIn
  const getAccountType = (account) => {
    console.log('🔍 Analisando conta:', account.profile_name);
    console.log('📊 premium_features bruto:', account.premium_features);

    // Parse do premium_features
    let accountTypeInfo = {};
    try {
      accountTypeInfo = typeof account.premium_features === 'string'
        ? JSON.parse(account.premium_features || '{}')
        : account.premium_features || {};
    } catch (e) {
      console.warn('⚠️ Erro ao parsear premium_features:', e);
      accountTypeInfo = {};
    }

    console.log('📊 accountTypeInfo parseado:', accountTypeInfo);

    // Verificar tipo de conta baseado nos campos da Unipile
    if (accountTypeInfo.sales_navigator !== null && accountTypeInfo.sales_navigator !== undefined) {
      console.log('✅ Detectado: Sales Navigator');
      return 'Sales Navigator';
    }

    if (accountTypeInfo.recruiter !== null && accountTypeInfo.recruiter !== undefined) {
      console.log('✅ Detectado: Recruiter');
      return 'Recruiter';
    }

    if (accountTypeInfo.premium === true) {
      console.log('✅ Detectado: Premium');
      return 'Premium';
    }

    console.log('⚠️ Tipo Free (premium=false ou não definido)');
    return 'Free';
  };

  // Obter configuração de estilo para cada tipo de conta
  const getAccountTypeStyle = (type) => {
    const styles = {
      'Sales Navigator': {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        icon: Briefcase,
        label: t('accountTypes.salesNavigator')
      },
      'Recruiter': {
        bg: 'bg-purple-100',
        text: 'text-purple-700',
        icon: Users,
        label: t('accountTypes.recruiter')
      },
      'Premium': {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        icon: Crown,
        label: t('accountTypes.premium')
      },
      'Free': {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        icon: CheckCircle,
        label: t('accountTypes.free')
      }
    };

    return styles[type] || styles['Free'];
  };

  // Obter estilo do health score
  const getHealthScoreStyle = (score) => {
    if (score >= 70) {
      return {
        bg: 'bg-green-100',
        text: 'text-green-700',
        border: 'border-green-300',
        label: t('healthScore.healthy')
      };
    } else if (score >= 50) {
      return {
        bg: 'bg-yellow-100',
        text: 'text-yellow-700',
        border: 'border-yellow-300',
        label: t('healthScore.warning')
      };
    } else {
      return {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-300',
        label: t('healthScore.critical')
      };
    }
  };

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await api.getLinkedInAccounts();

      if (response.success) {
        setAccounts(response.data || []);
        // Carregar health scores em paralelo
        loadHealthScores(response.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHealthScores = async (accountsList) => {
    // Carregar health scores de todas as contas em paralelo
    const healthPromises = accountsList.map(async (account) => {
      try {
        const response = await api.getAccountHealth(account.id);
        if (response.success) {
          return { id: account.id, data: response.data };
        }
      } catch (error) {
        console.error(`Erro ao carregar health score da conta ${account.id}:`, error);
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

  const handleRefreshAccount = async (accountId) => {
    try {
      setRefreshingAccounts(prev => ({ ...prev, [accountId]: true }));

      const response = await api.refreshLinkedInAccount(accountId);

      if (response.success) {
        // Atualizar a conta na lista
        setAccounts(prevAccounts =>
          prevAccounts.map(acc =>
            acc.id === accountId ? response.data : acc
          )
        );

        // Mostrar mensagem de sucesso (opcional - você pode adicionar um toast aqui)
        console.log('✅ Conta atualizada com sucesso');
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar conta:', error);
      alert('Erro ao atualizar conta. Tente novamente.');
    } finally {
      setRefreshingAccounts(prev => ({ ...prev, [accountId]: false }));
    }
  };

  const handleOpenLimitConfig = (account) => {
    setSelectedAccount(account);
    setShowLimitModal(true);
  };

  const handleCloseLimitModal = () => {
    setShowLimitModal(false);
    setSelectedAccount(null);
  };

  const handleLimitUpdate = async (accountId, newLimit) => {
    // Atualizar a conta na lista local
    setAccounts(prevAccounts =>
      prevAccounts.map(acc =>
        acc.id === accountId ? { ...acc, daily_limit: newLimit } : acc
      )
    );

    // Recarregar contas para pegar dados atualizados
    await loadAccounts();
  };

  // ================================
  // HANDLERS PARA GERENCIAMENTO DE CONTA
  // ================================

  const handleOpenDisconnectModal = (account) => {
    setAccountToManage(account);
    setShowDisconnectModal(true);
  };

  const handleOpenDeleteModal = (account) => {
    setAccountToManage(account);
    setShowDeleteModal(true);
  };

  const handleOpenReactivateModal = (account) => {
    setAccountToManage(account);
    setReactivateCredentials({ username: account.linkedin_username, password: '' });
    setShowReactivateModal(true);
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
      console.error('Erro ao desconectar:', error);
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
      console.error('Erro ao excluir:', error);
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
      console.error('Erro ao reativar:', error);
      alert('Erro ao reativar conta. Verifique as credenciais e tente novamente.');
    } finally {
      setActionLoading(false);
    }
  };

  // Separar contas ativas e desconectadas
  const activeAccounts = accounts.filter(a => a.status === 'active');
  const disconnectedAccounts = accounts.filter(a => a.status === 'disconnected');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loading')}</p>
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
            <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors shadow-sm">
            <Plus className="w-5 h-5" />
            <span>{t('connectChannel')}</span>
          </button>
        </div>
      </div>

      <div className="p-6">

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">{t('stats.totalAccounts')}</p>
          <p className="text-3xl font-bold text-gray-900">{accounts.length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">{t('stats.activeAccounts')}</p>
          <p className="text-3xl font-bold text-green-600">
            {accounts.filter(a => a.status === 'active').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">{t('stats.dailyLimitTotal')}</p>
          <p className="text-3xl font-bold text-purple-600">
            {accounts.reduce((sum, a) => sum + (a.daily_limit || 0), 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">{t('stats.sentToday')}</p>
          <p className="text-3xl font-bold text-blue-600">
            {accounts.reduce((sum, a) => sum + (a.today_sent || 0), 0)}
          </p>
        </div>
      </div>

      {/* Active Accounts List */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Contas Ativas ({activeAccounts.length})</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activeAccounts.map((account) => {
          const usagePercent = account.daily_limit > 0
            ? ((account.today_sent / account.daily_limit) * 100).toFixed(0)
            : 0;

          const organizations = typeof account.organizations === 'string'
            ? JSON.parse(account.organizations)
            : account.organizations || [];

          const accountType = getAccountType(account);
          const typeStyle = getAccountTypeStyle(accountType);
          const TypeIcon = typeStyle.icon;

          const healthScore = healthScores[account.id];
          const healthStyle = healthScore ? getHealthScoreStyle(healthScore.health_score) : null;

          return (
            <div key={account.id} className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all">
              {/* Canal Badge - Sempre no topo */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 rounded-t-lg flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <Linkedin className="w-4 h-4" />
                  <span className="text-sm font-semibold">{t('channel')}</span>
                </div>
                <span className={`flex items-center gap-1 px-2 py-0.5 ${typeStyle.bg} ${typeStyle.text} text-xs font-semibold rounded-full`}>
                  <TypeIcon className="w-3 h-3" />
                  <span>{typeStyle.label}</span>
                </span>
              </div>

              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    {account.profile_picture ? (
                      <img
                        src={account.profile_picture}
                        alt={account.profile_name}
                        className="w-14 h-14 rounded-full border-2 border-blue-200"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white text-lg font-bold">
                        {account.profile_name?.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{account.profile_name}</h3>
                      <p className="text-sm text-gray-500 truncate">@{account.public_identifier || account.linkedin_username}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {account.status === 'active' ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>{t('status.active')}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{t('status.inactive')}</span>
                      </span>
                    )}
                    {healthStyle && (
                      <span className={`flex items-center gap-1 px-2.5 py-1 ${healthStyle.bg} ${healthStyle.text} text-xs font-medium rounded-full`}>
                        <span className="font-semibold">{healthScore.health_score}</span>
                        <span>/100</span>
                      </span>
                    )}
                  </div>
                </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-200">
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t('card.dailyLimit')}</p>
                  <p className="text-lg font-bold text-gray-900">{account.daily_limit}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t('card.sentToday')}</p>
                  <p className="text-lg font-bold text-purple-600">{account.today_sent}</p>
                </div>
              </div>

              {/* Usage Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-gray-500">{t('card.dailyUsage')}</span>
                  <span className="font-semibold text-gray-900">{usagePercent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      usagePercent >= 90 ? 'bg-red-600' :
                      usagePercent >= 70 ? 'bg-yellow-600' :
                      'bg-green-600'
                    }`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              </div>

              {/* Organizations */}
              {organizations.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2">{t('card.connectedOrganizations')}:</p>
                  <div className="flex flex-wrap gap-2">
                    {organizations.slice(0, 3).map((org, idx) => (
                      <span key={idx} className="flex items-center space-x-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg">
                        <Building2 className="w-3 h-3" />
                        <span>{org.name}</span>
                      </span>
                    ))}
                    {organizations.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg">
                        +{organizations.length - 3} {t('card.more')}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="text-xs text-gray-500 space-y-1 mb-4">
                <p>{t('card.connectedAt')}: {new Date(account.connected_at).toLocaleDateString('pt-BR')}</p>
                <p>{t('card.unipileId')}: {account.unipile_account_id}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleOpenLimitConfig(account)}
                    className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    <Settings className="w-4 h-4" />
                    <span>{t('card.limits')}</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRefreshAccount(account.id)}
                    disabled={refreshingAccounts[account.id]}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={t('card.refresh')}
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshingAccounts[account.id] ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleOpenDisconnectModal(account)}
                    className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                    title="Desconectar"
                  >
                    <PowerOff className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenDeleteModal(account)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir permanentemente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* Disconnected Accounts Section */}
      {disconnectedAccounts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <PowerOff className="w-5 h-5 text-gray-500" />
            Contas Desativadas ({disconnectedAccounts.length})
          </h2>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              Contas desativadas ainda contam como slot ativo na sua assinatura. Para liberar o slot, você precisa excluir a conta.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {disconnectedAccounts.map((account) => (
              <div key={account.id} className="bg-white rounded-lg border border-gray-200 opacity-75">
                {/* Canal Badge - Desativado */}
                <div className="bg-gradient-to-r from-gray-500 to-gray-600 px-4 py-2 rounded-t-lg flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <Linkedin className="w-4 h-4" />
                    <span className="text-sm font-semibold">{t('channel')}</span>
                  </div>
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-semibold rounded-full">
                    <PowerOff className="w-3 h-3" />
                    <span>Desativada</span>
                  </span>
                </div>

                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1">
                      {account.profile_picture ? (
                        <img
                          src={account.profile_picture}
                          alt={account.profile_name}
                          className="w-14 h-14 rounded-full border-2 border-gray-300 grayscale"
                        />
                      ) : (
                        <div className="w-14 h-14 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center text-white text-lg font-bold">
                          {account.profile_name?.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-700 truncate">{account.profile_name}</h3>
                        <p className="text-sm text-gray-500 truncate">@{account.public_identifier || account.linkedin_username}</p>
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="text-xs text-gray-500 space-y-1 mb-4">
                    <p>Desconectada em: {account.disconnected_at ? new Date(account.disconnected_at).toLocaleDateString('pt-BR') : '-'}</p>
                    <p>Conectada originalmente: {new Date(account.connected_at).toLocaleDateString('pt-BR')}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => handleOpenReactivateModal(account)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reativar
                    </button>
                    <button
                      onClick={() => handleOpenDeleteModal(account)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {accounts.length === 0 && (
        <div className="text-center py-16 bg-white rounded-lg border-2 border-dashed border-gray-300">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Linkedin className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('messages.noChannels')}</h3>
            <p className="text-gray-500 mb-6">{t('messages.noChannelsDescription')}</p>
            <button className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors shadow-sm">
              {t('messages.connectFirstChannel')}
            </button>
          </div>
        </div>
      )}
      </div>

      {/* Modal de Configuração de Limites */}
      {showLimitModal && selectedAccount && (
        <LimitConfigModal
          account={selectedAccount}
          onClose={handleCloseLimitModal}
          onUpdate={handleLimitUpdate}
        />
      )}

      {/* Modal de Desconectar Conta */}
      {showDisconnectModal && accountToManage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <PowerOff className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Desconectar Conta</h3>
                  <p className="text-sm text-gray-500">{accountToManage.profile_name}</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-amber-800">
                  <strong>Atenção:</strong> Você poderá reativar esta conta depois. Ela continuará contando como slot ativo na sua assinatura até ser excluída permanentemente.
                </p>
              </div>

              <p className="text-gray-600 mb-6">
                O histórico de conversas e leads serão mantidos. Você precisará das credenciais do LinkedIn para reativar a conta.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDisconnectModal(false);
                    setAccountToManage(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  disabled={actionLoading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Desconectando...' : 'Desconectar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Excluir Conta */}
      {showDeleteModal && accountToManage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Excluir Conta Permanentemente</h3>
                  <p className="text-sm text-gray-500">{accountToManage.profile_name}</p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800">
                  <strong>ATENÇÃO:</strong> Esta ação é irreversível! O histórico de conversas será perdido permanentemente.
                </p>
              </div>

              <div className="space-y-2 mb-6">
                <p className="text-gray-600 text-sm flex items-center gap-2">
                  <span className="text-red-500">✗</span>
                  Histórico de conversas será excluído
                </p>
                <p className="text-gray-600 text-sm flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Leads serão mantidos no sistema
                </p>
                <p className="text-gray-600 text-sm flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Libera o slot da assinatura
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setAccountToManage(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  disabled={actionLoading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Excluindo...' : 'Excluir Permanentemente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reativar Conta */}
      {showReactivateModal && accountToManage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <RotateCcw className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Reativar Conta</h3>
                  <p className="text-sm text-gray-500">{accountToManage.profile_name}</p>
                </div>
              </div>

              <p className="text-gray-600 mb-4">
                Para reativar esta conta, insira as credenciais do LinkedIn. A conta deve ser a mesma que foi desconectada anteriormente.
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usuário do LinkedIn</label>
                  <input
                    type="text"
                    value={reactivateCredentials.username}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Senha do LinkedIn</label>
                  <input
                    type="password"
                    value={reactivateCredentials.password}
                    onChange={(e) => setReactivateCredentials(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Digite sua senha"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  disabled={actionLoading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleReactivate}
                  disabled={actionLoading || !reactivateCredentials.password}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Reativando...' : 'Reativar Conta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LinkedInAccountsPage;