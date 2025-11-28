import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, Filter, Users, Linkedin, Building2, MapPin,
  CheckSquare, Square, PlayCircle, Eye, Tag, Loader2,
  ChevronDown, Settings, AlertCircle, RefreshCw
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import StartConnectionCampaignModal from '../components/StartConnectionCampaignModal';
import ConnectionProfileModal from '../components/ConnectionProfileModal';

const MyConnectionsPage = () => {
  const { t } = useTranslation(['connections', 'common']);
  const { user } = useAuth();

  // State
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [linkedinAccounts, setLinkedinAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    job_title: '',
    company: '',
    location: ''
  });

  // Selection
  const [selectedConnections, setSelectedConnections] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // Daily limit
  const [dailyLimit, setDailyLimit] = useState({ daily_limit: 100, today_sent: 0, remaining: 100 });
  const [showLimitSettings, setShowLimitSettings] = useState(false);
  const [newLimit, setNewLimit] = useState(100);

  // Modals
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);

  // Load LinkedIn accounts on mount
  useEffect(() => {
    loadLinkedinAccounts();
    loadDailyLimit();
  }, []);

  // Load connections when account changes
  useEffect(() => {
    if (selectedAccount) {
      loadConnections(true);
    }
  }, [selectedAccount]);

  const loadLinkedinAccounts = async () => {
    try {
      const response = await api.getLinkedInAccounts();
      console.log('LinkedIn accounts response:', response);

      // A API retorna response.data como array direto
      const accounts = response.data || [];

      if (response.success && accounts.length > 0) {
        setLinkedinAccounts(accounts);
        // NAO seleciona automaticamente - usuario deve escolher primeiro
      }
    } catch (error) {
      console.error('Error loading LinkedIn accounts:', error);
    }
  };

  const loadDailyLimit = async () => {
    try {
      const response = await api.getConnectionDailyLimit();
      if (response.success) {
        setDailyLimit(response.data);
        setNewLimit(response.data.daily_limit);
      }
    } catch (error) {
      console.error('Error loading daily limit:', error);
    }
  };

  const loadConnections = async (reset = false) => {
    if (!selectedAccount) return;

    try {
      if (reset) {
        setLoading(true);
        setConnections([]);
        setCursor(null);
      } else {
        setLoadingMore(true);
      }

      const params = {
        linkedin_account_id: selectedAccount.id,
        limit: 50,
        ...(cursor && !reset && { cursor }),
        ...(searchQuery && { keywords: searchQuery }),
        ...(filters.job_title && { job_title: filters.job_title }),
        ...(filters.location && { location: filters.location })
      };

      const response = await api.getMyConnections(params);

      if (response.success) {
        const newConnections = response.data.connections || [];

        if (reset) {
          setConnections(newConnections);
        } else {
          setConnections(prev => [...prev, ...newConnections]);
        }

        setCursor(response.data.cursor);
        setHasMore(response.data.has_more);
      }
    } catch (error) {
      console.error('Error loading connections:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSearch = () => {
    loadConnections(true);
  };

  const handleUpdateLimit = async () => {
    try {
      const response = await api.updateConnectionDailyLimit(newLimit);
      if (response.success) {
        setDailyLimit(prev => ({ ...prev, daily_limit: newLimit, remaining: newLimit - prev.today_sent }));
        setShowLimitSettings(false);
      }
    } catch (error) {
      console.error('Error updating limit:', error);
      alert(error.message || 'Erro ao atualizar limite');
    }
  };

  // Selection handlers
  const toggleConnectionSelection = (connection) => {
    setSelectedConnections(prev => {
      const isSelected = prev.some(c => c.provider_id === connection.provider_id);
      if (isSelected) {
        return prev.filter(c => c.provider_id !== connection.provider_id);
      } else {
        return [...prev, connection];
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedConnections([]);
    } else {
      setSelectedConnections([...connections]);
    }
    setSelectAll(!selectAll);
  };

  const isConnectionSelected = (connection) => {
    return selectedConnections.some(c => c.provider_id === connection.provider_id);
  };

  // View profile
  const handleViewProfile = async (connection) => {
    try {
      const response = await api.getConnectionFullProfile(
        connection.provider_id,
        selectedAccount.id
      );

      if (response.success) {
        setSelectedProfile(response.data.profile);
        setShowProfileModal(true);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  // Start campaign
  const handleStartCampaign = () => {
    if (selectedConnections.length === 0) {
      alert('Selecione pelo menos uma conexao para ativar');
      return;
    }

    if (selectedConnections.length > dailyLimit.remaining) {
      alert(`Voce so pode ativar mais ${dailyLimit.remaining} conexoes hoje. Selecione menos conexoes ou aumente seu limite diario.`);
      return;
    }

    setShowCampaignModal(true);
  };

  const handleCampaignCreated = () => {
    setShowCampaignModal(false);
    setSelectedConnections([]);
    loadDailyLimit();
    // Could redirect to campaigns page or show success message
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Minhas Conexoes
            </h1>
            <p className="text-gray-600 mt-1">
              Ative suas conexoes de 1 grau no LinkedIn com mensagens personalizadas
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Daily Limit Info */}
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-sm text-gray-600">Limite diario:</span>
              <span className="font-semibold text-gray-900">
                {dailyLimit.today_sent}/{dailyLimit.daily_limit}
              </span>
              <button
                onClick={() => setShowLimitSettings(!showLimitSettings)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <Settings className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Activate Button */}
            <button
              onClick={handleStartCampaign}
              disabled={selectedConnections.length === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                selectedConnections.length > 0
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <PlayCircle className="w-4 h-4" />
              Ativar Agora ({selectedConnections.length})
            </button>
          </div>
        </div>

        {/* Limit Settings Dropdown */}
        {showLimitSettings && (
          <div className="absolute right-8 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
            <h3 className="font-semibold text-gray-900 mb-2">Limite Diario de Ativacoes</h3>
            <p className="text-sm text-gray-600 mb-4">
              Defina quantas conexoes voce pode ativar por dia. Recomendamos comecar com 100 para evitar restricoes do LinkedIn.
            </p>

            <div className="flex items-center gap-2 mb-4">
              <input
                type="number"
                value={newLimit}
                onChange={(e) => setNewLimit(parseInt(e.target.value) || 100)}
                min={1}
                max={500}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
              />
              <span className="text-sm text-gray-600">/dia</span>
            </div>

            <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg mb-4">
              <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
              <p className="text-xs text-yellow-800">
                Limites acima de 150/dia podem aumentar o risco de restricoes temporarias na sua conta LinkedIn.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowLimitSettings(false)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateLimit}
                className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Salvar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Account Selector & Search */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        {/* LinkedIn Account Selector */}
        <div className="w-full md:w-64">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Conta LinkedIn
          </label>
          <select
            value={selectedAccount?.id || ''}
            onChange={(e) => {
              const account = linkedinAccounts.find(a => a.id === e.target.value);
              setSelectedAccount(account);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Selecione uma conta...</option>
            {linkedinAccounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.profile_name || account.linkedin_username}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Buscar conexoes
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Nome, cargo, empresa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Buscar
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg border ${
                showFilters ? 'bg-purple-50 border-purple-300 text-purple-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cargo
              </label>
              <input
                type="text"
                placeholder="CEO, Diretor, Gerente..."
                value={filters.job_title}
                onChange={(e) => setFilters(prev => ({ ...prev, job_title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Localizacao
              </label>
              <input
                type="text"
                placeholder="Sao Paulo, Brasil..."
                value={filters.location}
                onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({ job_title: '', company: '', location: '' });
                  loadConnections(true);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                Limpar filtros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selection Bar */}
      {connections.length > 0 && (
        <div className="mb-4 flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
            >
              {selectAll ? (
                <CheckSquare className="w-5 h-5 text-purple-600" />
              ) : (
                <Square className="w-5 h-5" />
              )}
              Selecionar todas ({connections.length})
            </button>

            {selectedConnections.length > 0 && (
              <span className="text-sm text-purple-600 font-medium">
                {selectedConnections.length} selecionada(s)
              </span>
            )}
          </div>

          <button
            onClick={() => loadConnections(true)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      )}

      {/* Connections List */}
      {linkedinAccounts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Linkedin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Nenhuma conta LinkedIn conectada
          </h3>
          <p className="text-gray-600 mb-6">
            Conecte uma conta LinkedIn para ver suas conexoes
          </p>
          <a
            href="/linkedin-accounts"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Linkedin className="w-4 h-4" />
            Conectar LinkedIn
          </a>
        </div>
      ) : !selectedAccount ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Linkedin className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Selecione uma conta LinkedIn
          </h3>
          <p className="text-gray-600">
            Escolha uma conta no menu acima para ver suas conexoes de 1 grau
          </p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto" />
            <p className="mt-4 text-gray-600">Carregando conexoes...</p>
          </div>
        </div>
      ) : connections.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Nenhuma conexao encontrada
          </h3>
          <p className="text-gray-600">
            {searchQuery
              ? 'Tente ajustar seus filtros de busca'
              : 'Suas conexoes de 1 grau aparecerao aqui'}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-12 px-4 py-3"></th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nome</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Cargo</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Empresa</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Localizacao</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Campanhas</th>
                  <th className="w-20 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {connections.map((connection) => (
                  <tr
                    key={connection.provider_id}
                    className={`hover:bg-gray-50 ${
                      isConnectionSelected(connection) ? 'bg-purple-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleConnectionSelection(connection)}
                        className="text-gray-400 hover:text-purple-600"
                      >
                        {isConnectionSelected(connection) ? (
                          <CheckSquare className="w-5 h-5 text-purple-600" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {connection.profile_picture ? (
                          <img
                            src={connection.profile_picture}
                            alt={connection.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                            <span className="text-purple-600 font-semibold">
                              {connection.first_name?.[0] || connection.name?.[0] || '?'}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{connection.name}</p>
                          <p className="text-xs text-gray-500">{connection.first_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900 truncate max-w-[200px]">
                        {connection.title || connection.headline || '-'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <p className="text-sm text-gray-700 truncate max-w-[150px]">
                          {connection.company || '-'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <p className="text-sm text-gray-700 truncate max-w-[150px]">
                          {connection.location || '-'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {connection.previous_campaigns?.length > 0 ? (
                          connection.previous_campaigns.slice(0, 2).map((campaign, idx) => (
                            <span
                              key={idx}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
                                campaign.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              <Tag className="w-3 h-3" />
                              {campaign.name?.substring(0, 15)}...
                            </span>
                          ))
                        ) : connection.in_crm ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                            No CRM
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleViewProfile(connection)}
                        className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                        title="Ver perfil completo"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="mt-4 text-center">
              <button
                onClick={() => loadConnections(false)}
                disabled={loadingMore}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando...
                  </span>
                ) : (
                  'Carregar mais'
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* Campaign Modal */}
      <StartConnectionCampaignModal
        isOpen={showCampaignModal}
        onClose={() => setShowCampaignModal(false)}
        onSuccess={handleCampaignCreated}
        selectedConnections={selectedConnections}
        linkedinAccountId={selectedAccount?.id}
      />

      {/* Profile Modal */}
      <ConnectionProfileModal
        isOpen={showProfileModal}
        onClose={() => {
          setShowProfileModal(false);
          setSelectedProfile(null);
        }}
        profile={selectedProfile}
        linkedinAccountId={selectedAccount?.id}
      />
    </div>
  );
};

export default MyConnectionsPage;
