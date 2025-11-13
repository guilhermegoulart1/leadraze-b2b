// frontend/src/pages/SearchPage.jsx
import React, { useState, useEffect } from 'react';
import AsyncSelect from 'react-select/async';
import apiService from '../services/api';
import { 
  Search, 
  Loader, 
  MapPin, 
  Building, 
  Users,
  ArrowRight,
  Filter,
  Zap,
  X,
  PlayCircle,
  CheckCircle,
  Clock,
  Target,
  ExternalLink,
  Linkedin,
  Briefcase
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
        
        console.log('✅ Perfis:', profiles);
        console.log('📄 Paginação:', pagination);
        console.log('🔗 Next cursor:', pagination.next_cursor);
        console.log('📊 Has more:', pagination.has_more);
        
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

      console.log('📄 Carregando mais com cursor:', nextCursor);

      const response = await apiService.searchProfiles(searchData);
      
      if (response.success && response.data) {
        const newProfiles = response.data.data || [];
        const pagination = response.data.pagination || {};
        
        console.log('✅ Novos perfis:', newProfiles.length);
        console.log('🔗 Próximo cursor:', pagination.next_cursor);
        
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

  // ✅ COMPONENTE DE CARD DE PERFIL MELHORADO
  const ProfileCard = ({ profile }) => {
    const isSelected = selectedProfiles.find(p => p.id === profile.id);
    
    // ✅ Buscar foto em múltiplos campos (baseado na base de conhecimento)
    const profilePicture = profile.profile_picture || 
                          profile.profile_picture_url ||
                          profile.profile_picture_url_large ||
                          profile.picture ||
                          profile.profilePicture ||
                          null;
    
    // ✅ URL do LinkedIn
    const linkedinUrl = profile.profile_url || 
                       profile.url || 
                       profile.public_profile_url ||
                       (profile.provider_id ? `https://linkedin.com/in/${profile.provider_id}` : null);
    
    return (
      <div
        className={`bg-white rounded-xl shadow-sm p-6 border-2 transition-all cursor-pointer hover:shadow-md ${
          isSelected
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-100 hover:border-gray-300'
        }`}
        onClick={() => toggleProfileSelection(profile)}
      >
        <div className="flex items-start space-x-4">
          {/* ✅ AVATAR COM FOTO OU FALLBACK */}
          <div className="relative flex-shrink-0">
            {profilePicture ? (
              <img 
                src={profilePicture}
                alt={profile.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-blue-200"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold"
              style={{ display: profilePicture ? 'none' : 'flex' }}
            >
              {profile.name?.charAt(0) || '?'}
            </div>
            
            {/* Badge se já é lead */}
            {profile.already_lead && (
              <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                Lead
              </div>
            )}
          </div>

          {/* ✅ INFO DO PERFIL */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {profile.name}
                </h3>
                
                {/* Título */}
                {profile.title && (
                  <p className="text-gray-700 font-medium flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-gray-400" />
                    {profile.title}
                  </p>
                )}
              </div>

              {/* ✅ CHECKBOX DE SELEÇÃO */}
              <div className="flex items-center ml-4">
                {isSelected ? (
                  <CheckCircle className="w-7 h-7 text-blue-600" />
                ) : (
                  <div className="w-7 h-7 border-2 border-gray-300 rounded-full" />
                )}
              </div>
            </div>

            {/* ✅ INFORMAÇÕES SECUNDÁRIAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
              {/* Empresa */}
              {profile.company && (
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{profile.company}</span>
                </div>
              )}
              
              {/* Localização */}
              {profile.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{profile.location}</span>
                </div>
              )}
              
              {/* Conexões */}
              {profile.connections && (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>{profile.connections} conexões</span>
                </div>
              )}
              
              {/* Indústria */}
              {profile.industry && (
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{profile.industry}</span>
                </div>
              )}
            </div>

            {/* ✅ RESUMO (se tiver) */}
            {profile.summary && (
              <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                {profile.summary}
              </p>
            )}

            {/* ✅ AÇÕES */}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              {linkedinUrl && (
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Linkedin className="w-4 h-4" />
                  <span>Ver Perfil</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              
              {profile.already_lead && (
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                  ✓ Já é lead
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Buscar Perfis no LinkedIn
          </h1>
          <p className="text-gray-600">
            Use filtros avançados para encontrar os perfis ideais
          </p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          {/* Conta LinkedIn */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conta LinkedIn
            </label>
            <select
              value={searchParams.linkedin_account_id}
              onChange={(e) => setSearchParams(prev => ({
                ...prev,
                linkedin_account_id: e.target.value
              }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione uma conta...</option>
              {linkedinAccounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.profile_name || account.linkedin_username}
                </option>
              ))}
            </select>
          </div>

          {/* Keywords */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Palavras-chave
            </label>
            <input
              type="text"
              value={searchParams.query}
              onChange={(e) => setSearchParams(prev => ({
                ...prev,
                query: e.target.value
              }))}
              placeholder="Ex: desenvolvedor, gerente, CEO..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={!searchParams.linkedin_account_id}
            />
          </div>

          {/* Grid de filtros */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Localização */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />
                Localização
              </label>
              <AsyncSelect
                cacheOptions
                defaultOptions={false}
                loadOptions={fetchLocationSuggestions}
                value={selectedLocation}
                onChange={setSelectedLocation}
                placeholder="Digite uma localização..."
                isClearable
                isDisabled={!searchParams.linkedin_account_id}
              />
            </div>

            {/* Setores */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building className="w-4 h-4 inline mr-1" />
                Setores
              </label>
              <AsyncSelect
                cacheOptions
                defaultOptions={false}
                loadOptions={fetchIndustrySuggestions}
                value={selectedIndustries}
                onChange={setSelectedIndustries}
                placeholder="Digite um setor..."
                isMulti
                isClearable
                isDisabled={!searchParams.linkedin_account_id}
              />
            </div>

            {/* Cargos */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💼 Cargos
              </label>
              <AsyncSelect
                cacheOptions
                defaultOptions={false}
                loadOptions={fetchJobTitleSuggestions}
                value={selectedJobTitles}
                onChange={setSelectedJobTitles}
                placeholder="Digite um cargo..."
                isMulti
                isClearable
                isDisabled={!searchParams.linkedin_account_id}
              />
            </div>

            {/* Empresas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏢 Empresas
              </label>
              <AsyncSelect
                cacheOptions
                defaultOptions={false}
                loadOptions={fetchCompanySuggestions}
                value={selectedCompanies}
                onChange={setSelectedCompanies}
                placeholder="Digite uma empresa..."
                isMulti
                isClearable
                isDisabled={!searchParams.linkedin_account_id}
              />
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {searchResults.length > 0 && `${searchResults.length} perfis encontrados`}
            </div>
            
            <div className="flex items-center space-x-3">
              {searchResults.length > 0 && (
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700"
                >
                  <Zap className="w-5 h-5" />
                  <span>Coleta em Lote</span>
                </button>
              )}
              
              <button
                onClick={handleSearch}
                disabled={loading || !searchParams.linkedin_account_id}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading && <Loader className="w-5 h-5 animate-spin" />}
                <Search className="w-5 h-5" />
                <span>{loading ? 'Buscando...' : 'Buscar'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading && searchResults.length === 0 ? (
          <div className="text-center py-12">
            <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Buscando perfis...</h3>
          </div>
        ) : searchResults.length > 0 ? (
          <div className="space-y-4">
            {/* Profile Cards */}
            {searchResults.map(profile => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}

            {/* ✅ BOTÃO DE LOAD MORE - SEMPRE APARECE SE hasMoreResults === true */}
            {hasMoreResults && (
              <div className="text-center mt-8 py-6">
                <button
                  onClick={loadMoreResults}
                  disabled={loadingMore}
                  className="flex items-center space-x-2 px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 mx-auto transform hover:scale-105 transition-all shadow-lg"
                >
                  {loadingMore && <Loader className="w-5 h-5 animate-spin" />}
                  <span className="font-medium">{loadingMore ? 'Carregando...' : 'Carregar Mais Resultados'}</span>
                  {!loadingMore && <ArrowRight className="w-5 h-5" />}
                </button>
                <p className="text-sm text-gray-500 mt-3">
                  Mostrando {searchResults.length} perfis • Clique para carregar mais
                </p>
              </div>
            )}
            
            {/* Mensagem de fim */}
            {!hasMoreResults && searchResults.length > 0 && (
              <div className="text-center py-6 text-gray-500">
                <p>✓ Todos os perfis foram carregados</p>
              </div>
            )}
          </div>
        ) : !loading && (
          <div className="text-center py-12 bg-white rounded-xl">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum resultado ainda
            </h3>
            <p className="text-gray-600">
              Use os filtros acima e clique em "Buscar" para encontrar perfis
            </p>
          </div>
        )}

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
                        className="text-sm text-blue-600 hover:text-blue-700"
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={handleCreateCampaign}
                          disabled={creatingCampaign || !newCampaignName.trim()}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 font-medium mb-1">ℹ️ Como funciona:</p>
                  <ul className="text-sm text-yellow-700 space-y-1">
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
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={startBulkCollection}
                  disabled={!selectedCampaign}
                  className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <PlayCircle className="w-5 h-5" />
                  <span>Iniciar Coleta</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;