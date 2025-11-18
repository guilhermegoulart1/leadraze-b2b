import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Plus, Trash2, Building2, RefreshCw, Crown, Briefcase, Users, Settings } from 'lucide-react';
import api from '../services/api';
import LimitConfigModal from '../components/LimitConfigModal';

const LinkedInAccountsPage = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshingAccounts, setRefreshingAccounts] = useState({});
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [healthScores, setHealthScores] = useState({});

  useEffect(() => {
    loadAccounts();
  }, []);

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
        label: 'Sales Navigator'
      },
      'Recruiter': {
        bg: 'bg-purple-100',
        text: 'text-purple-700',
        icon: Users,
        label: 'Recruiter'
      },
      'Premium': {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        icon: Crown,
        label: 'Premium'
      },
      'Free': {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        icon: CheckCircle,
        label: 'Free'
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
        label: 'Saudável'
      };
    } else if (score >= 50) {
      return {
        bg: 'bg-yellow-100',
        text: 'text-yellow-700',
        border: 'border-yellow-300',
        label: 'Atenção'
      };
    } else {
      return {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-300',
        label: 'Crítico'
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando contas LinkedIn...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Contas LinkedIn</h2>
          <p className="text-gray-500 mt-1">Gerencie suas contas conectadas</p>
        </div>
        <button className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-lg hover:opacity-90 font-semibold">
          <Plus className="w-5 h-5" />
          <span>Conectar Nova Conta</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Total de Contas</p>
          <p className="text-3xl font-bold text-gray-900">{accounts.length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Contas Ativas</p>
          <p className="text-3xl font-bold text-green-600">
            {accounts.filter(a => a.status === 'active').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Limite Diário Total</p>
          <p className="text-3xl font-bold text-purple-600">
            {accounts.reduce((sum, a) => sum + (a.daily_limit || 0), 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Enviados Hoje</p>
          <p className="text-3xl font-bold text-blue-600">
            {accounts.reduce((sum, a) => sum + (a.today_sent || 0), 0)}
          </p>
        </div>
      </div>

      {/* Accounts List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {accounts.map((account) => {
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
            <div key={account.id} className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">

              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {account.profile_picture ? (
                    <img
                      src={account.profile_picture}
                      alt={account.profile_name}
                      className="w-16 h-16 rounded-full"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center text-white text-xl font-bold">
                      {account.profile_name?.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-gray-900">{account.profile_name}</h3>
                    <p className="text-sm text-gray-500">@{account.public_identifier || account.linkedin_username}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  {account.status === 'active' ? (
                    <span className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                      <CheckCircle className="w-4 h-4" />
                      <span>Ativa</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                      <AlertCircle className="w-4 h-4" />
                      <span>Inativa</span>
                    </span>
                  )}
                  <span className={`flex items-center space-x-1 px-3 py-1 ${typeStyle.bg} ${typeStyle.text} text-xs font-semibold rounded-full`}>
                    <TypeIcon className="w-3 h-3" />
                    <span>{typeStyle.label}</span>
                  </span>
                  {healthStyle && (
                    <span className={`flex items-center space-x-1 px-3 py-1 ${healthStyle.bg} ${healthStyle.text} text-xs font-semibold rounded-full border ${healthStyle.border}`}>
                      <span className="font-bold">{healthScore.health_score}</span>
                      <span>/100</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-200">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Limite Diário</p>
                  <p className="text-lg font-bold text-gray-900">{account.daily_limit}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Enviados Hoje</p>
                  <p className="text-lg font-bold text-purple-600">{account.today_sent}</p>
                </div>
              </div>

              {/* Usage Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-gray-500">Uso diário</span>
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
                  <p className="text-xs text-gray-500 mb-2">Organizações Conectadas:</p>
                  <div className="flex flex-wrap gap-2">
                    {organizations.slice(0, 3).map((org, idx) => (
                      <span key={idx} className="flex items-center space-x-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg">
                        <Building2 className="w-3 h-3" />
                        <span>{org.name}</span>
                      </span>
                    ))}
                    {organizations.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg">
                        +{organizations.length - 3} mais
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="text-xs text-gray-500 space-y-1 mb-4">
                <p>Conectada: {new Date(account.connected_at).toLocaleDateString('pt-BR')}</p>
                <p>ID Unipile: {account.unipile_account_id}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="flex items-center space-x-3">
                  <button className="text-sm text-purple-600 hover:text-purple-700 font-semibold">
                    Ver Detalhes
                  </button>
                  <button
                    onClick={() => handleOpenLimitConfig(account)}
                    className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-800 font-semibold"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Configurar Limites</span>
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleRefreshAccount(account.id)}
                    disabled={refreshingAccounts[account.id]}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Atualizar dados da conta"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshingAccounts[account.id] ? 'animate-spin' : ''}`} />
                  </button>
                  <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {accounts.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Nenhuma conta LinkedIn conectada</p>
          <button className="text-purple-600 hover:text-purple-700 font-semibold">
            Conectar primeira conta
          </button>
        </div>
      )}

      {/* Modal de Configuração de Limites */}
      {showLimitModal && selectedAccount && (
        <LimitConfigModal
          account={selectedAccount}
          onClose={handleCloseLimitModal}
          onUpdate={handleLimitUpdate}
        />
      )}

    </div>
  );
};

export default LinkedInAccountsPage;