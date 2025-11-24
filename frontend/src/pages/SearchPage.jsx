// frontend/src/pages/SearchPage.jsx
import React, { useState, useEffect } from 'react';
import apiService from '../services/api';
import SearchSidebar from '../components/SearchSidebar';
import SearchResults from '../components/SearchResults';
import {
  X,
  PlayCircle,
  Target
} from 'lucide-react';

const SearchPage = () => {
  // Estados de busca
  const [searchParams, setSearchParams] = useState({
    query: '',
    api: 'classic',
    category: 'people',
    linkedin_account_id: '',
    limit: 25
  });

  const [searchResults, setSearchResults] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedIndustries, setSelectedIndustries] = useState([]);
  const [selectedJobTitles, setSelectedJobTitles] = useState([]);
  const [selectedCompanies, setSelectedCompanies] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMoreResults, setHasMoreResults] = useState(false);

  const [linkedinAccounts, setLinkedinAccounts] = useState([]);
  const [selectedProfiles, setSelectedProfiles] = useState([]);

  // Estados de coleta em lote
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkTargetCount, setBulkTargetCount] = useState(100);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  // Carregar contas LinkedIn e campanhas
  useEffect(() => {
    loadLinkedInAccounts();
    loadCampaigns();
  }, []);

  const loadLinkedInAccounts = async () => {
    try {
      const response = await apiService.getLinkedInAccounts();
      if (response.success) {
        setLinkedinAccounts(response.data || []);
        if (response.data?.length > 0) {
          setSearchParams(prev => ({ 
            ...prev, 
            linkedin_account_id: response.data[0].id 
          }));
        }
      }
    } catch (error) {
      console.error('❌ Erro ao carregar contas:', error);
    }
  };

  const loadCampaigns = async () => {
    try {
      const response = await apiService.getCampaigns();
      if (response.success) {
        setCampaigns(response.data || []);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar campanhas:', error);
    }
  };

  // Funções de autocomplete
  const fetchLocationSuggestions = async (inputValue) => {
    if (!inputValue || inputValue.length < 2) return [];
    try {
      const response = await apiService.searchLocations(
        inputValue, 
        searchParams.linkedin_account_id
      );
      return response.data || [];
    } catch (error) {
      console.error('Erro ao buscar localizações:', error);
      return [];
    }
  };

  const fetchIndustrySuggestions = async (inputValue) => {
    if (!inputValue || inputValue.length < 2) return [];
    try {
      const response = await apiService.searchIndustries(
        inputValue, 
        searchParams.linkedin_account_id
      );
      return (response.data || []).map(item => ({
        value: item,
        label: item
      }));
    } catch (error) {
      console.error('Erro ao buscar setores:', error);
      return [];
    }
  };

  const fetchJobTitleSuggestions = async (inputValue) => {
    if (!inputValue || inputValue.length < 2) return [];
    try {
      const response = await apiService.searchJobTitles(
        inputValue, 
        searchParams.linkedin_account_id
      );
      return (response.data || []).map(item => ({
        value: item,
        label: item
      }));
    } catch (error) {
      console.error('Erro ao buscar cargos:', error);
      return [];
    }
  };

  const fetchCompanySuggestions = async (inputValue) => {
    if (!inputValue || inputValue.length < 2) return [];
    try {
      const response = await apiService.searchCompanies(
        inputValue, 
        searchParams.linkedin_account_id
      );
      return (response.data || []).map(item => ({
        value: item,
        label: item
      }));
    } catch (error) {
      console.error('Erro ao buscar empresas:', error);
      return [];
    }
  };

  // Busca normal
  const handleSearch = async () => {
    if (!searchParams.linkedin_account_id) {
      alert('Selecione uma conta LinkedIn');
      return;
    }

    setSearchResults([]);
    setNextCursor(null);
    setHasMoreResults(false);
    setSelectedProfiles([]);
    setLoading(true);

    try {
      const searchData = {
        linkedin_account_id: searchParams.linkedin_account_id,
        api: searchParams.api,
        category: searchParams.category,
        limit: searchParams.limit,
        keywords: searchParams.query || undefined,
        location: selectedLocation ? [selectedLocation.value] : undefined,
        industries: selectedIndustries.length > 0 
          ? selectedIndustries.map(i => i.value) 
          : undefined,
        job_titles: selectedJobTitles.length > 0 
          ? selectedJobTitles.map(j => j.value) 
          : undefined,
        companies: selectedCompanies.length > 0 
          ? selectedCompanies.map(c => c.value) 
          : undefined
      };

      console.log('🔍 Buscando com:', searchData);

      const response = await apiService.searchProfiles(searchData);
      
      console.log('📥 Resposta completa:', response);

      if (response.success && response.data) {
        const profiles = response.data.data || [];
        const pagination = response.data.pagination || {};

        console.log('✅ === RESPOSTA DA BUSCA ===');
        console.log('📊 Perfis recebidos:', profiles.length);
        console.log('📄 Paginação completa:', pagination);
        console.log('🔗 Next cursor:', pagination.next_cursor);
        console.log('📊 Has more:', pagination.has_more);
        console.log('==========================');

        setSearchResults(profiles);
        setNextCursor(pagination.next_cursor);
        setHasMoreResults(pagination.has_more || false);
      }
    } catch (error) {
      console.error('❌ Erro na busca:', error);
      alert(`Erro ao buscar perfis: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Load more
  const loadMoreResults = async () => {
    console.log('🔄 === LOAD MORE CHAMADO ===');
    console.log('📊 Estado atual:', {
      hasMoreResults,
      loadingMore,
      nextCursor,
      currentResultsCount: searchResults.length
    });

    if (!hasMoreResults || loadingMore || !nextCursor) {
      console.log('⚠️ Não pode carregar mais:', {
        hasMoreResults,
        loadingMore,
        nextCursor
      });
      return;
    }

    setLoadingMore(true);

    try {
      const searchData = {
        linkedin_account_id: searchParams.linkedin_account_id,
        api: searchParams.api,
        category: searchParams.category,
        limit: searchParams.limit,
        cursor: nextCursor
      };

      console.log('📤 Enviando request com cursor:', nextCursor);
      console.log('📤 Dados da requisição:', searchData);

      const response = await apiService.searchProfiles(searchData);

      if (response.success && response.data) {
        const newProfiles = response.data.data || [];
        const pagination = response.data.pagination || {};

        console.log('✅ === LOAD MORE RESPONSE ===');
        console.log('📊 Novos perfis recebidos:', newProfiles.length);
        console.log('📄 Paginação:', pagination);
        console.log('🔗 Próximo cursor:', pagination.next_cursor);
        console.log('📊 Has more:', pagination.has_more);
        console.log('===========================');

        setSearchResults(prev => [...prev, ...newProfiles]);
        setNextCursor(pagination.next_cursor);
        setHasMoreResults(pagination.has_more || false);
      }
    } catch (error) {
      console.error('❌ Erro no load more:', error);
      alert(`Erro ao carregar mais resultados: ${error.message}`);
    } finally {
      setLoadingMore(false);
    }
  };

  // Criar campanha nova
  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) {
      alert('Digite um nome para a campanha');
      return;
    }

    setCreatingCampaign(true);

    try {
      const response = await apiService.createCampaign({
        name: newCampaignName,
        status: 'draft'
      });

      if (response.success) {
        const newCampaign = response.data;
        setCampaigns(prev => [...prev, newCampaign]);
        setSelectedCampaign(newCampaign.id);
        setShowCreateCampaign(false);
        setNewCampaignName('');
        alert('✅ Campanha criada com sucesso!');
      }
    } catch (error) {
      console.error('❌ Erro ao criar campanha:', error);
      alert(`Erro ao criar campanha: ${error.message}`);
    } finally {
      setCreatingCampaign(false);
    }
  };

  // Iniciar coleta em lote
  const startBulkCollection = async () => {
    if (!selectedCampaign) {
      alert('Selecione uma campanha');
      return;
    }

    try {
      const bulkData = {
        linkedin_account_id: searchParams.linkedin_account_id,
        campaign_id: selectedCampaign,
        target_count: parseInt(bulkTargetCount),
        api: searchParams.api,
        search_filters: {
          keywords: searchParams.query || undefined,
          location: selectedLocation ? [selectedLocation.value] : undefined,
          industries: selectedIndustries.length > 0 
            ? selectedIndustries.map(i => i.value) 
            : undefined,
          job_titles: selectedJobTitles.length > 0 
            ? selectedJobTitles.map(j => j.value) 
            : undefined,
          companies: selectedCompanies.length > 0 
            ? selectedCompanies.map(c => c.value) 
            : undefined
        }
      };

      console.log('🚀 Iniciando coleta em lote:', bulkData);

      const response = await apiService.createBulkCollectionJob(bulkData);

      if (response.success) {
        alert('✅ Coleta em lote iniciada! Você receberá uma notificação quando concluir.');
        setShowBulkModal(false);
      }
    } catch (error) {
      console.error('❌ Erro ao iniciar coleta:', error);
      alert(`Erro ao iniciar coleta: ${error.message}`);
    }
  };

  // Toggle seleção de perfil
  const toggleProfileSelection = (profile) => {
    setSelectedProfiles(prev => {
      const exists = prev.find(p => p.id === profile.id);
      if (exists) {
        return prev.filter(p => p.id !== profile.id);
      } else {
        return [...prev, profile];
      }
    });
  };

  return (
    <div className="flex h-full bg-gray-100">
      {/* Sidebar com Filtros */}
      <SearchSidebar
        searchParams={searchParams}
        onSearchParamsChange={setSearchParams}
        linkedinAccounts={linkedinAccounts}
        selectedLocation={selectedLocation}
        onLocationChange={setSelectedLocation}
        selectedIndustries={selectedIndustries}
        onIndustriesChange={setSelectedIndustries}
        selectedJobTitles={selectedJobTitles}
        onJobTitlesChange={setSelectedJobTitles}
        selectedCompanies={selectedCompanies}
        onCompaniesChange={setSelectedCompanies}
        fetchLocationSuggestions={fetchLocationSuggestions}
        fetchIndustrySuggestions={fetchIndustrySuggestions}
        fetchJobTitleSuggestions={fetchJobTitleSuggestions}
        fetchCompanySuggestions={fetchCompanySuggestions}
        onSearch={handleSearch}
        loading={loading}
        resultsCount={searchResults.length}
      />

      {/* Área de Resultados */}
      <SearchResults
        results={searchResults}
        loading={loading}
        selectedProfiles={selectedProfiles}
        onToggleProfile={toggleProfileSelection}
        hasMoreResults={hasMoreResults}
        loadingMore={loadingMore}
        onLoadMore={loadMoreResults}
        onBulkCollection={() => setShowBulkModal(true)}
      />

      {/* Modal de Bulk Collection */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Coleta em Lote</h2>
                <p className="text-gray-600 mt-1">
                  Colete centenas de perfis automaticamente
                </p>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {/* Quantos perfis */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Target className="w-4 h-4 inline mr-1" />
                  Quantos perfis deseja coletar?
                </label>
                <input
                  type="number"
                  value={bulkTargetCount}
                  onChange={(e) => setBulkTargetCount(e.target.value)}
                  min="10"
                  max="1000"
                  step="10"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Mínimo: 10 | Máximo: 1.000 perfis
                </p>
              </div>

              {/* Campanha */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Salvar perfis em qual campanha?
                </label>

                {!showCreateCampaign ? (
                  <>
                    <select
                      value={selectedCampaign}
                      onChange={(e) => setSelectedCampaign(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2"
                    >
                      <option value="">Selecione uma campanha...</option>
                      {campaigns.map(campaign => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.name} ({campaign.status})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowCreateCampaign(true)}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      + Criar nova campanha
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newCampaignName}
                      onChange={(e) => setNewCampaignName(e.target.value)}
                      placeholder="Nome da nova campanha..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={handleCreateCampaign}
                        disabled={creatingCampaign || !newCampaignName.trim()}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
                      >
                        {creatingCampaign ? 'Criando...' : 'Criar'}
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateCampaign(false);
                          setNewCampaignName('');
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-800 font-medium mb-1">ℹ️ Como funciona:</p>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• A coleta será feita em background</li>
                  <li>• Você receberá notificações do progresso</li>
                  <li>• Os perfis serão salvos automaticamente na campanha</li>
                  <li>• Pode levar alguns minutos dependendo da quantidade</li>
                </ul>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowBulkModal(false);
                  setShowCreateCampaign(false);
                  setNewCampaignName('');
                }}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={startBulkCollection}
                disabled={!selectedCampaign}
                className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
              >
                <PlayCircle className="w-5 h-5" />
                <span>Iniciar Coleta</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPage;