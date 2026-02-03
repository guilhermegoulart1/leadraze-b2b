// frontend/src/pages/SearchPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api';
import SearchSidebar from '../components/SearchSidebar';
import SearchResults from '../components/SearchResults';
import SendInviteModal from '../components/SendInviteModal';
import AddToCampaignModal from '../components/AddToCampaignModal';

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

  // Estados de campanhas e modal adicionar a campanha
  const [campaigns, setCampaigns] = useState([]);
  const [showAddToCampaignModal, setShowAddToCampaignModal] = useState(false);

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
        setCampaigns(response.data?.campaigns || response.data || []);
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

  // Adicionar perfis a campanha
  const handleAddToCampaign = () => {
    if (selectedProfiles.length === 0) return;
    setShowAddToCampaignModal(true);
  };

  const handleAddToCampaignSuccess = () => {
    setShowAddToCampaignModal(false);
    setSelectedProfiles([]);
    loadCampaigns();
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
        onAddToCampaign={handleAddToCampaign}
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

      {/* Modal de Adicionar a Campanha */}
      <AddToCampaignModal
        isOpen={showAddToCampaignModal}
        onClose={() => setShowAddToCampaignModal(false)}
        onSuccess={handleAddToCampaignSuccess}
        selectedProfiles={selectedProfiles}
        campaigns={campaigns}
      />
    </div>
  );
};

export default SearchPage;