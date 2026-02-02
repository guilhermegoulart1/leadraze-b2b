// frontend/src/pages/SearchPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api';
import SearchSidebar from '../components/SearchSidebar';
import SearchResults from '../components/SearchResults';
import SendInviteModal from '../components/SendInviteModal';
import {
  X,
  PlayCircle,
  Target
} from 'lucide-react';

const SearchPage = () => {
  const { t } = useTranslation(['search', 'common']);
  const navigate = useNavigate();

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

  // Novos filtros avançados (v1.3.0)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [selectedPastCompanies, setSelectedPastCompanies] = useState([]);
  const [networkDistance, setNetworkDistance] = useState('');
  const [tenure, setTenure] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [profileLanguage, setProfileLanguage] = useState('');

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

  // Estados do modal de envio de convite
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteProfile, setInviteProfile] = useState(null);

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
      return (response.data || []).map(item =>
        typeof item === 'string' ? { value: item, label: item } : item
      );
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
      return (response.data || []).map(item =>
        typeof item === 'string' ? { value: item, label: item } : item
      );
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
      return (response.data || []).map(item =>
        typeof item === 'string' ? { value: item, label: item } : item
      );
    } catch (error) {
      console.error('Erro ao buscar empresas:', error);
      return [];
    }
  };

  // Novos autocompletes (v1.3.0)
  const fetchSkillSuggestions = async (inputValue) => {
    if (!inputValue || inputValue.length < 2) return [];
    try {
      const response = await apiService.searchSkills(
        inputValue,
        searchParams.linkedin_account_id
      );
      return (response.data || []).map(item => ({
        value: item,
        label: item
      }));
    } catch (error) {
      console.error('Erro ao buscar skills:', error);
      return [];
    }
  };

  const fetchSchoolSuggestions = async (inputValue) => {
    if (!inputValue || inputValue.length < 2) return [];
    try {
      const response = await apiService.searchSchools(
        inputValue,
        searchParams.linkedin_account_id
      );
      return (response.data || []).map(item => ({
        value: item.id || item,
        label: item.name || item
      }));
    } catch (error) {
      console.error('Erro ao buscar escolas:', error);
      return [];
    }
  };

  // Busca normal
  const handleSearch = async () => {
    if (!searchParams.linkedin_account_id) {
      alert(t('messages.selectLinkedInAccount'));
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
          : undefined,
        // Novos filtros avançados (v1.3.0)
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        skills: selectedSkills.length > 0
          ? selectedSkills.map(s => s.value)
          : undefined,
        school: selectedSchool?.value || undefined,
        past_companies: selectedPastCompanies.length > 0
          ? selectedPastCompanies.map(c => c.value)
          : undefined,
        network_distance: networkDistance || undefined,
        tenure: tenure || undefined,
        years_experience: yearsExperience || undefined,
        profile_language: profileLanguage || undefined
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
      alert(t('messages.errorSearching', { error: error.message }));
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
      alert(t('messages.errorLoadingMore', { error: error.message }));
    } finally {
      setLoadingMore(false);
    }
  };

  // Criar campanha nova
  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) {
      alert(t('messages.enterCampaignName'));
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
        alert(t('messages.campaignCreatedSuccess'));
      }
    } catch (error) {
      console.error('❌ Erro ao criar campanha:', error);
      alert(t('messages.errorCreatingCampaign', { error: error.message }));
    } finally {
      setCreatingCampaign(false);
    }
  };

  // Iniciar coleta em lote
  const startBulkCollection = async () => {
    if (!selectedCampaign) {
      alert(t('messages.selectCampaignError'));
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
          // Include full location data for country detection
          location_data: selectedLocation ? {
            id: selectedLocation.value,
            label: selectedLocation.label,
            country: selectedLocation.country
          } : undefined,
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
        alert(t('messages.bulkCollectionStarted'));
        setShowBulkModal(false);
      }
    } catch (error) {
      console.error('❌ Erro ao iniciar coleta:', error);
      alert(t('messages.errorStartingCollection', { error: error.message }));
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

  // Abrir modal de envio de convite
  const handleSendInvite = (profile) => {
    setInviteProfile(profile);
    setShowInviteModal(true);
  };

  // Callback quando convite é enviado com sucesso
  const handleInviteSuccess = (data) => {
    // Atualizar o perfil na lista se necessário
    if (data?.lead_created) {
      setSearchResults(prev =>
        prev.map(p =>
          (p.id === inviteProfile?.id || p.provider_id === inviteProfile?.provider_id)
            ? { ...p, already_opportunity: true }
            : p
        )
      );
    }
    setShowInviteModal(false);
    setInviteProfile(null);
  };

  // Iniciar conversa com conexão existente
  const handleStartConversation = (profile) => {
    // Navegar para a página de mensagens com o perfil selecionado
    // Passar os dados necessários via state
    const profileId = profile.provider_id || profile.id;
    const accountId = searchParams.linkedin_account_id;

    // Navegar para inbox com o perfil pré-selecionado
    navigate('/inbox', {
      state: {
        startConversationWith: {
          id: profileId,
          name: profile.name,
          title: profile.title || profile.headline,
          company: profile.company || profile.current_company,
          profile_picture: profile.profile_picture || profile.profile_picture_url,
          profile_url: profile.profile_url || profile.url,
          linkedin_account_id: accountId
        }
      }
    });
  };

  return (
    <div className="flex h-full bg-gray-100 dark:bg-gray-900">
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
        // Novos filtros avançados (v1.3.0)
        firstName={firstName}
        onFirstNameChange={setFirstName}
        lastName={lastName}
        onLastNameChange={setLastName}
        selectedSkills={selectedSkills}
        onSkillsChange={setSelectedSkills}
        selectedSchool={selectedSchool}
        onSchoolChange={setSelectedSchool}
        selectedPastCompanies={selectedPastCompanies}
        onPastCompaniesChange={setSelectedPastCompanies}
        networkDistance={networkDistance}
        onNetworkDistanceChange={setNetworkDistance}
        tenure={tenure}
        onTenureChange={setTenure}
        yearsExperience={yearsExperience}
        onYearsExperienceChange={setYearsExperience}
        profileLanguage={profileLanguage}
        onProfileLanguageChange={setProfileLanguage}
        fetchSkillSuggestions={fetchSkillSuggestions}
        fetchSchoolSuggestions={fetchSchoolSuggestions}
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
        onSendInvite={handleSendInvite}
        onStartConversation={handleStartConversation}
      />

      {/* Modal de Envio de Convite */}
      <SendInviteModal
        isOpen={showInviteModal}
        onClose={() => {
          setShowInviteModal(false);
          setInviteProfile(null);
        }}
        profile={inviteProfile}
        linkedinAccountId={searchParams.linkedin_account_id}
        onSuccess={handleInviteSuccess}
      />

      {/* Modal de Bulk Collection */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('bulkCollection.title')}</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {t('bulkCollection.subtitle')}
                </p>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {/* Quantos perfis */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Target className="w-4 h-4 inline mr-1" />
                  {t('bulkCollection.targetCount')}
                </label>
                <input
                  type="number"
                  value={bulkTargetCount}
                  onChange={(e) => setBulkTargetCount(e.target.value)}
                  min="10"
                  max="1000"
                  step="10"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('bulkCollection.targetCountHelp')}
                </p>
              </div>

              {/* Campanha */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('bulkCollection.selectCampaign')}
                </label>

                {!showCreateCampaign ? (
                  <>
                    <select
                      value={selectedCampaign}
                      onChange={(e) => setSelectedCampaign(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">{t('bulkCollection.selectCampaignPlaceholder')}</option>
                      {campaigns.map(campaign => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.name} ({campaign.status})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowCreateCampaign(true)}
                      className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
                    >
                      {t('bulkCollection.createNew')}
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newCampaignName}
                      onChange={(e) => setNewCampaignName(e.target.value)}
                      placeholder={t('bulkCollection.campaignNamePlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={handleCreateCampaign}
                        disabled={creatingCampaign || !newCampaignName.trim()}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
                      >
                        {creatingCampaign ? t('bulkCollection.creating') : t('bulkCollection.create')}
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateCampaign(false);
                          setNewCampaignName('');
                        }}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        {t('bulkCollection.cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
                <p className="text-sm text-purple-800 dark:text-purple-300 font-medium mb-1">ℹ️ {t('bulkCollection.howItWorks')}</p>
                <ul className="text-sm text-purple-700 dark:text-purple-400 space-y-1">
                  {t('bulkCollection.howItWorksList', { returnObjects: true }).map((item, index) => (
                    <li key={index}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowBulkModal(false);
                  setShowCreateCampaign(false);
                  setNewCampaignName('');
                }}
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 font-medium text-gray-700 dark:text-gray-300"
              >
                {t('bulkCollection.cancel')}
              </button>
              <button
                onClick={startBulkCollection}
                disabled={!selectedCampaign}
                className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
              >
                <PlayCircle className="w-5 h-5" />
                <span>{t('bulkCollection.startCollection')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPage;