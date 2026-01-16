// frontend/src/components/CampaignWizard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { X, ArrowRight, ArrowLeft, Sparkles, Search, Target, CheckCircle, Loader, Bot, Users, MapPin, Briefcase, Crown, ChevronDown, Building } from 'lucide-react';
import AsyncSelect from 'react-select/async';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import TagsInput from './TagsInput';

// Hook para detectar dark mode
const useDarkMode = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  return isDark;
};

const CampaignWizard = ({ isOpen, onClose, onCampaignCreated }) => {
  const { t } = useTranslation('campaigns');
  const isDarkMode = useDarkMode();
  const [currentStep, setCurrentStep] = useState(1.5);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiAgents, setAiAgents] = useState([]);
  const [linkedinAccounts, setLinkedinAccounts] = useState([]);

  const [formData, setFormData] = useState({
    // Step 1: Busca
    type: 'automatic', // Always automatic now
    selected_location: null, // Location selecionada pelo usuário
    search_filters: null,

    // Campos estruturados para busca automática
    manual_job_titles: [], // Cargos (obrigatório)
    manual_industries: [], // Setores (opcional)
    manual_companies: [], // Empresas (opcional)
    searchLinkedinAccountId: '', // Conta LinkedIn para realizar a busca

    // Step 2: Coleta
    name: '',
    description: '',
    target_profiles_count: 100,

    // Step 3: Validação
    linkedin_account_id: '',     // Legacy: single account
    linkedin_account_ids: [],    // New: multiple accounts
    ai_agent_id: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadAIAgents();
      loadLinkedinAccounts();
    }
  }, [isOpen]);

  const loadAIAgents = async () => {
    try {
      const response = await api.getAIAgents();
      setAiAgents(response.data || []);
    } catch (err) {
      console.error('Erro ao carregar agentes:', err);
      setAiAgents([]);
    }
  };

  const loadLinkedinAccounts = async () => {
    try {
      const response = await api.getLinkedInAccounts();
      setLinkedinAccounts(response.data || []);
    } catch (err) {
      console.error('Erro ao carregar contas LinkedIn:', err);
      setLinkedinAccounts([]);
    }
  };

  const handleGenerateFilters = async () => {
    if (!formData.selected_location) {
      setError(t('wizard.errors.selectLocation'));
      return;
    }

    // Validar se os cargos foram preenchidos
    if (formData.manual_job_titles.length === 0) {
      setError(t('wizard.errors.minJobTitles'));
      return;
    }

    console.log('🔍 Location selecionada:', formData.selected_location);
    console.log('📍 Location VALUE:', formData.selected_location.value);
    console.log('📍 Location LABEL:', formData.selected_location.label);

    setIsLoading(true);
    setError('');

    try {
      // Construir prompt incluindo todos os campos para a IA adaptar ao idioma/contexto correto
      let promptParts = [
        `Localização: ${formData.selected_location.label}`,
        `Cargos: ${formData.manual_job_titles.join(', ')}`
      ];

      // Adicionar setores se preenchidos
      if (formData.manual_industries && formData.manual_industries.length > 0) {
        const industries = formData.manual_industries.map(i => i.label || i.value).join(', ');
        promptParts.push(`Setores: ${industries}`);
      }

      // Adicionar empresas se preenchidas
      if (formData.manual_companies && formData.manual_companies.length > 0) {
        const companies = formData.manual_companies.map(c => c.label || c.value).join(', ');
        promptParts.push(`Empresas: ${companies}`);
      }

      const structuredPrompt = promptParts.join('. ');

      console.log('📝 Prompt estruturado:', structuredPrompt);

      const result = await api.generateSearchFilters(structuredPrompt);

      console.log('🤖 Filtros recebidos da IA:', result.data.filters);

      // Combinar filtros da IA com os dados selecionados pelo usuário
      const filters = {
        ...result.data.filters,
        location: [formData.selected_location.value] // Usar o ID da location selecionada
      };

      // Adicionar industries selecionados manualmente (sobrescrever IA se o usuário selecionou)
      if (formData.manual_industries && formData.manual_industries.length > 0) {
        filters.industries = formData.manual_industries.map(i => i.value || i.label);
      }

      // Adicionar companies selecionadas manualmente
      if (formData.manual_companies && formData.manual_companies.length > 0) {
        filters.companies = formData.manual_companies.map(c => c.value || c.label);
      }

      console.log('✅ Filtros finais combinados:', filters);

      // Determinar nome da campanha baseado nos filtros
      const campaignNameBase = formData.manual_industries?.length > 0
        ? formData.manual_industries[0].label
        : (result.data.filters.industries?.[0] || 'Automática');

      setFormData({
        ...formData,
        search_filters: filters,
        name: `Campanha ${campaignNameBase} - ${new Date().toLocaleDateString('pt-BR')}`
      });
      setCurrentStep(2);
    } catch (err) {
      console.error('Erro ao gerar filtros:', err);
      setError(err.message || t('wizard.errors.generateFilters'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    setError('');

    // Validação do Step 1.5 - Busca Automática
    if (currentStep === 1.5) {
      if (!formData.searchLinkedinAccountId) {
        setError('Selecione uma conta LinkedIn para realizar a busca');
        return;
      }
      if (!formData.selected_location) {
        setError(t('wizard.step1_5.location.required') || 'Selecione uma localização');
        return;
      }
      if (formData.manual_job_titles.length === 0) {
        setError(t('wizard.step1_5.jobTitles.required') || 'Adicione pelo menos um cargo');
        return;
      }
    }

    if (currentStep === 2) {
      if (!formData.name || formData.name.trim().length < 3) {
        setError(t('wizard.errors.minName'));
        return;
      }

      if (!formData.target_profiles_count || formData.target_profiles_count < 10) {
        setError(t('wizard.errors.minProfiles'));
        return;
      }
    }

    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setError('');
    if (currentStep === 1.5) {
      // First step - nothing to go back to
      return;
    } else if (currentStep === 2) {
      setCurrentStep(1.5);
    } else {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setError('');

    if (formData.linkedin_account_ids.length === 0) {
      setError(t('wizard.errors.selectLinkedin'));
      return;
    }

    if (!formData.ai_agent_id) {
      setError(t('wizard.errors.selectAgent'));
      return;
    }

    setIsLoading(true);

    try {
      // Criar campanha em status draft
      const campaign = await api.createCampaign({
        name: formData.name,
        description: formData.description,
        type: formData.type,
        search_filters: formData.search_filters,
        ai_search_prompt: formData.ai_search_prompt,
        target_profiles_count: formData.target_profiles_count,
        linkedin_account_ids: formData.linkedin_account_ids, // Múltiplas contas para envio
        search_linkedin_account_id: formData.searchLinkedinAccountId, // Conta para busca
        ai_agent_id: formData.ai_agent_id,
        current_step: 3,
        status: 'draft'
      });

      console.log('✅ Campaign created successfully:', campaign);

      // Iniciar coleta automaticamente após criar a campanha
      if (formData.type === 'automatic' && formData.search_filters) {
        console.log('🚀 Iniciando coleta automática de leads...');
        try {
          await api.startBulkCollection(campaign.data.id);
          console.log('✅ Coleta iniciada com sucesso!');
        } catch (collectionError) {
          console.error('⚠️ Erro ao iniciar coleta, mas campanha foi criada:', collectionError);
          // Não bloqueia o fluxo, apenas avisa
        }
      }

      onCampaignCreated(campaign);
      handleClose();
    } catch (err) {
      console.error('Erro ao criar campanha:', err);
      setError(err.message || t('wizard.errors.createCampaign'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1.5);
    setFormData({
      type: 'automatic',
      ai_search_prompt: '',
      selected_location: null,
      search_filters: null,
      manual_job_titles: [],
      manual_industries: [],
      manual_companies: [],
      manual_keywords: [],
      searchLinkedinAccountId: '',
      name: '',
      description: '',
      target_profiles_count: 100,
      linkedin_account_id: '',
      linkedin_account_ids: [],
      ai_agent_id: ''
    });
    setError('');
    onClose();
  };

  // Função para buscar localizações via Unipile
  const fetchLocationSuggestions = async (inputValue) => {
    if (!inputValue || inputValue.length < 2) return [];
    if (!linkedinAccounts.length) return [];

    try {
      // Use selected search account or first available
      const linkedinAccountId = formData.searchLinkedinAccountId || linkedinAccounts[0]?.id;
      if (!linkedinAccountId) return [];

      const response = await api.searchLocations(inputValue, linkedinAccountId);
      return response.data || [];
    } catch (error) {
      console.error('Erro ao buscar localizações:', error);
      return [];
    }
  };

  // Função para buscar setores via Unipile
  const fetchIndustrySuggestions = async (inputValue) => {
    if (!inputValue || inputValue.length < 2) return [];
    if (!linkedinAccounts.length) return [];

    try {
      const linkedinAccountId = formData.searchLinkedinAccountId || linkedinAccounts[0]?.id;
      if (!linkedinAccountId) return [];

      const response = await api.searchIndustries(inputValue, linkedinAccountId);
      return (response.data || []).map(item => ({
        value: item,
        label: item
      }));
    } catch (error) {
      console.error('Erro ao buscar setores:', error);
      return [];
    }
  };

  // Função para buscar empresas via Unipile
  const fetchCompanySuggestions = async (inputValue) => {
    if (!inputValue || inputValue.length < 2) return [];
    if (!linkedinAccounts.length) return [];

    try {
      const linkedinAccountId = formData.searchLinkedinAccountId || linkedinAccounts[0]?.id;
      if (!linkedinAccountId) return [];

      const response = await api.searchCompanies(inputValue, linkedinAccountId);
      return (response.data || []).map(item => ({
        value: item,
        label: item
      }));
    } catch (error) {
      console.error('Erro ao buscar empresas:', error);
      return [];
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t('wizard.title')}</h2>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          {[
            { num: 1, label: t('wizard.steps.search'), internalStep: 1.5 },
            { num: 2, label: t('wizard.steps.collection'), internalStep: 2 },
            { num: 3, label: t('wizard.steps.validation'), internalStep: 3 }
          ].map((step, idx, arr) => {
            const isCurrent = currentStep === step.internalStep;
            const isPast = currentStep > step.internalStep;

            return (
              <div key={step.num} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  isCurrent
                    ? 'bg-blue-600 text-white'
                    : isPast
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {isPast ? <CheckCircle className="w-4 h-4" /> : step.num}
                </div>
                <div className="ml-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
                  {step.label}
                </div>
                {idx < arr.length - 1 && (
                  <div className={`w-8 h-0.5 mx-1.5 ${
                    currentStep > step.internalStep ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Configuração de Busca (always automatic) */}
          {currentStep === 1.5 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  {t('wizard.step1_5.title')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {t('wizard.step1_5.subtitle')}
                </p>
              </div>

              {/* LinkedIn Account Selector for Search - Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Conta LinkedIn para Busca *
                </label>
                {linkedinAccounts.length === 0 ? (
                  <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      {t('wizard.step3.linkedinAccount.noAccounts')}
                    </p>
                  </div>
                ) : (
                  (() => {
                    // Filter only active accounts and sort alphabetically
                    const activeAccounts = linkedinAccounts
                      .filter(acc => acc.status === 'active')
                      .sort((a, b) => {
                        const nameA = (a.profile_name || a.linkedin_username || '').toLowerCase();
                        const nameB = (b.profile_name || b.linkedin_username || '').toLowerCase();
                        return nameA.localeCompare(nameB);
                      });

                    // Auto-select if only one active account
                    if (activeAccounts.length === 1 && !formData.searchLinkedinAccountId) {
                      setTimeout(() => setFormData(prev => ({ ...prev, searchLinkedinAccountId: activeAccounts[0].id })), 0);
                    }
                    const selectedAccount = activeAccounts.find(acc => acc.id === formData.searchLinkedinAccountId);

                    // Helper to check if account is premium (from premium_features)
                    const isPremiumAccount = (account) => {
                      let info = {};
                      try {
                        info = typeof account.premium_features === 'string'
                          ? JSON.parse(account.premium_features || '{}')
                          : account.premium_features || {};
                      } catch (e) { info = {}; }

                      return (info.sales_navigator !== null && info.sales_navigator !== undefined) ||
                             (info.recruiter !== null && info.recruiter !== undefined) ||
                             info.premium === true;
                    };

                    if (activeAccounts.length === 0) {
                      return (
                        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
                          <p className="text-sm text-yellow-800 dark:text-yellow-300">
                            Nenhuma conta LinkedIn ativa encontrada
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="relative">
                        <select
                          value={formData.searchLinkedinAccountId}
                          onChange={(e) => setFormData({ ...formData, searchLinkedinAccountId: e.target.value })}
                          className="w-full px-4 py-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none cursor-pointer"
                        >
                          <option value="">Selecione uma conta...</option>
                          {activeAccounts.map((account) => {
                            const name = account.profile_name || account.linkedin_username;
                            const premiumIcon = isPremiumAccount(account) ? ' 👑' : '';
                            return (
                              <option key={account.id} value={account.id}>
                                {name}{premiumIcon}
                              </option>
                            );
                          })}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Location Autocomplete */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {t('wizard.step1_5.location.label')} *
                </label>
                <AsyncSelect
                  cacheOptions
                  loadOptions={fetchLocationSuggestions}
                  onChange={(selected) => setFormData({ ...formData, selected_location: selected })}
                  value={formData.selected_location}
                  placeholder={t('wizard.step1_5.location.placeholder')}
                  noOptionsMessage={() => t('wizard.step1_5.location.noOptions')}
                  loadingMessage={() => t('wizard.step1_5.location.loading')}
                  className="text-sm"
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      backgroundColor: isDarkMode ? '#374151' : '#fff',
                      borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                      '&:hover': { borderColor: isDarkMode ? '#6b7280' : '#9ca3af' },
                      boxShadow: 'none',
                      '&:focus-within': {
                        borderColor: '#a855f7',
                        boxShadow: '0 0 0 2px rgba(168, 85, 247, 0.1)'
                      }
                    }),
                    menu: (base) => ({
                      ...base,
                      backgroundColor: isDarkMode ? '#374151' : '#fff',
                      borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isFocused
                        ? (isDarkMode ? '#4b5563' : '#f3f4f6')
                        : (isDarkMode ? '#374151' : '#fff'),
                      color: isDarkMode ? '#f3f4f6' : '#111827',
                      '&:active': {
                        backgroundColor: isDarkMode ? '#6b7280' : '#e5e7eb'
                      }
                    }),
                    singleValue: (base) => ({
                      ...base,
                      color: isDarkMode ? '#f3f4f6' : '#111827'
                    }),
                    input: (base) => ({
                      ...base,
                      color: isDarkMode ? '#f3f4f6' : '#111827'
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: isDarkMode ? '#9ca3af' : '#6b7280'
                    }),
                    indicatorSeparator: (base) => ({
                      ...base,
                      backgroundColor: isDarkMode ? '#4b5563' : '#d1d5db'
                    }),
                    dropdownIndicator: (base) => ({
                      ...base,
                      color: isDarkMode ? '#9ca3af' : '#6b7280'
                    }),
                    loadingIndicator: (base) => ({
                      ...base,
                      color: isDarkMode ? '#9ca3af' : '#6b7280'
                    }),
                    noOptionsMessage: (base) => ({
                      ...base,
                      color: isDarkMode ? '#9ca3af' : '#6b7280'
                    })
                  }}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('wizard.step1_5.location.example')}
                </p>
              </div>

              {/* Cargos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  {t('wizard.step1_5.jobTitles.label')} *
                </label>
                <TagsInput
                  tags={formData.manual_job_titles}
                  onChange={(tags) => setFormData({ ...formData, manual_job_titles: tags })}
                  placeholder={t('wizard.step1_5.jobTitles.placeholder')}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('wizard.step1_5.jobTitles.help')}
                </p>
              </div>

              {/* Setores (opcional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  {t('wizard.step1_5.industries.label', 'Setores')}
                  <span className="text-xs text-gray-400 font-normal">({t('wizard.step1_5.optional', 'opcional')})</span>
                </label>
                <AsyncSelect
                  cacheOptions
                  isMulti
                  loadOptions={fetchIndustrySuggestions}
                  onChange={(selected) => setFormData({ ...formData, manual_industries: selected || [] })}
                  value={formData.manual_industries}
                  placeholder={t('wizard.step1_5.industries.placeholder', 'Busque por setores...')}
                  noOptionsMessage={() => t('wizard.step1_5.industries.noOptions', 'Digite para buscar setores')}
                  loadingMessage={() => t('wizard.step1_5.industries.loading', 'Buscando...')}
                  isDisabled={!formData.searchLinkedinAccountId}
                  className="text-sm"
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      backgroundColor: isDarkMode ? '#374151' : '#fff',
                      borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                      '&:hover': { borderColor: isDarkMode ? '#6b7280' : '#9ca3af' },
                      boxShadow: 'none',
                      '&:focus-within': {
                        borderColor: '#a855f7',
                        boxShadow: '0 0 0 2px rgba(168, 85, 247, 0.1)'
                      }
                    }),
                    menu: (base) => ({
                      ...base,
                      backgroundColor: isDarkMode ? '#374151' : '#fff',
                      borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isFocused
                        ? (isDarkMode ? '#4b5563' : '#f3f4f6')
                        : (isDarkMode ? '#374151' : '#fff'),
                      color: isDarkMode ? '#f3f4f6' : '#111827',
                      '&:active': {
                        backgroundColor: isDarkMode ? '#6b7280' : '#e5e7eb'
                      }
                    }),
                    multiValue: (base) => ({
                      ...base,
                      backgroundColor: isDarkMode ? '#4b5563' : '#e5e7eb'
                    }),
                    multiValueLabel: (base) => ({
                      ...base,
                      color: isDarkMode ? '#f3f4f6' : '#111827'
                    }),
                    multiValueRemove: (base) => ({
                      ...base,
                      color: isDarkMode ? '#9ca3af' : '#6b7280',
                      '&:hover': {
                        backgroundColor: isDarkMode ? '#6b7280' : '#d1d5db',
                        color: isDarkMode ? '#f3f4f6' : '#111827'
                      }
                    }),
                    input: (base) => ({
                      ...base,
                      color: isDarkMode ? '#f3f4f6' : '#111827'
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: isDarkMode ? '#9ca3af' : '#6b7280'
                    }),
                    indicatorSeparator: (base) => ({
                      ...base,
                      backgroundColor: isDarkMode ? '#4b5563' : '#d1d5db'
                    }),
                    dropdownIndicator: (base) => ({
                      ...base,
                      color: isDarkMode ? '#9ca3af' : '#6b7280'
                    }),
                    clearIndicator: (base) => ({
                      ...base,
                      color: isDarkMode ? '#9ca3af' : '#6b7280'
                    })
                  }}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('wizard.step1_5.industries.help', 'Ex: Tecnologia, Financeiro, Saúde')}
                </p>
              </div>

              {/* Empresas (opcional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {t('wizard.step1_5.companies.label', 'Empresas')}
                  <span className="text-xs text-gray-400 font-normal">({t('wizard.step1_5.optional', 'opcional')})</span>
                </label>
                <AsyncSelect
                  cacheOptions
                  isMulti
                  loadOptions={fetchCompanySuggestions}
                  onChange={(selected) => setFormData({ ...formData, manual_companies: selected || [] })}
                  value={formData.manual_companies}
                  placeholder={t('wizard.step1_5.companies.placeholder', 'Busque por empresas...')}
                  noOptionsMessage={() => t('wizard.step1_5.companies.noOptions', 'Digite para buscar empresas')}
                  loadingMessage={() => t('wizard.step1_5.companies.loading', 'Buscando...')}
                  isDisabled={!formData.searchLinkedinAccountId}
                  className="text-sm"
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      backgroundColor: isDarkMode ? '#374151' : '#fff',
                      borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                      '&:hover': { borderColor: isDarkMode ? '#6b7280' : '#9ca3af' },
                      boxShadow: 'none',
                      '&:focus-within': {
                        borderColor: '#a855f7',
                        boxShadow: '0 0 0 2px rgba(168, 85, 247, 0.1)'
                      }
                    }),
                    menu: (base) => ({
                      ...base,
                      backgroundColor: isDarkMode ? '#374151' : '#fff',
                      borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isFocused
                        ? (isDarkMode ? '#4b5563' : '#f3f4f6')
                        : (isDarkMode ? '#374151' : '#fff'),
                      color: isDarkMode ? '#f3f4f6' : '#111827',
                      '&:active': {
                        backgroundColor: isDarkMode ? '#6b7280' : '#e5e7eb'
                      }
                    }),
                    multiValue: (base) => ({
                      ...base,
                      backgroundColor: isDarkMode ? '#4b5563' : '#e5e7eb'
                    }),
                    multiValueLabel: (base) => ({
                      ...base,
                      color: isDarkMode ? '#f3f4f6' : '#111827'
                    }),
                    multiValueRemove: (base) => ({
                      ...base,
                      color: isDarkMode ? '#9ca3af' : '#6b7280',
                      '&:hover': {
                        backgroundColor: isDarkMode ? '#6b7280' : '#d1d5db',
                        color: isDarkMode ? '#f3f4f6' : '#111827'
                      }
                    }),
                    input: (base) => ({
                      ...base,
                      color: isDarkMode ? '#f3f4f6' : '#111827'
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: isDarkMode ? '#9ca3af' : '#6b7280'
                    }),
                    indicatorSeparator: (base) => ({
                      ...base,
                      backgroundColor: isDarkMode ? '#4b5563' : '#d1d5db'
                    }),
                    dropdownIndicator: (base) => ({
                      ...base,
                      color: isDarkMode ? '#9ca3af' : '#6b7280'
                    }),
                    clearIndicator: (base) => ({
                      ...base,
                      color: isDarkMode ? '#9ca3af' : '#6b7280'
                    })
                  }}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('wizard.step1_5.companies.help', 'Ex: Google, Microsoft, Apple')}
                </p>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
                <p className="text-sm text-purple-800 dark:text-purple-300">
                  <strong>✨ {t('wizard.step1_5.howItWorks')}</strong>
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Coleta */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('wizard.step2.title')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {t('wizard.step2.subtitle')}
                </p>
              </div>

              {/* Filtros gerados */}
              {formData.search_filters && (
                <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-purple-900 dark:text-purple-300 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {t('wizard.step2.generatedFilters')}
                  </h4>
                  <div className="space-y-2 text-sm">
                    {formData.search_filters.keywords && (
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{t('wizard.step2.filters.keywords')}</span>{' '}
                        <span className="text-gray-900 dark:text-gray-100">{formData.search_filters.keywords}</span>
                      </div>
                    )}
                    {formData.selected_location && (
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{t('wizard.step2.filters.location')}</span>{' '}
                        <span className="text-gray-900 dark:text-gray-100">{formData.selected_location.label}</span>
                      </div>
                    )}
                    {formData.search_filters.industries && formData.search_filters.industries.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{t('wizard.step2.filters.industries')}</span>{' '}
                        <span className="text-gray-900 dark:text-gray-100">{formData.search_filters.industries.join(', ')}</span>
                      </div>
                    )}
                    {formData.search_filters.job_titles && formData.search_filters.job_titles.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{t('wizard.step2.filters.jobTitles')}</span>{' '}
                        <span className="text-gray-900 dark:text-gray-100">{formData.search_filters.job_titles.join(', ')}</span>
                      </div>
                    )}
                    {formData.search_filters.companies && formData.search_filters.companies.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{t('wizard.step2.filters.companies', 'Empresas:')}</span>{' '}
                        <span className="text-gray-900 dark:text-gray-100">{formData.search_filters.companies.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('wizard.step2.campaignName.label')} *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('wizard.step2.campaignName.placeholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('wizard.step2.description.label')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('wizard.step2.description.placeholder')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('wizard.step2.targetCount.label')} *
                </label>
                <input
                  type="number"
                  value={formData.target_profiles_count}
                  onChange={(e) => setFormData({ ...formData, target_profiles_count: parseInt(e.target.value) || 0 })}
                  min="10"
                  max="1000"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('wizard.step2.targetCount.help')}
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Validação */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('wizard.step3.title')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {t('wizard.step3.subtitle')}
                </p>
              </div>

              {/* LinkedIn Account Selector (Múltiplo) */}
              {linkedinAccounts.length === 0 ? (
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    {t('wizard.step3.linkedinAccount.noAccounts')}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    {t('wizard.step3.linkedinAccount.label')}
                  </label>

                  <div className="space-y-2">
                    {linkedinAccounts.map((account) => {
                      const isSelected = formData.linkedin_account_ids.includes(account.id);

                      return (
                        <div
                          key={account.id}
                          onClick={() => {
                            const newIds = isSelected
                              ? formData.linkedin_account_ids.filter(id => id !== account.id)
                              : [...formData.linkedin_account_ids, account.id];
                            setFormData({ ...formData, linkedin_account_ids: newIds });
                          }}
                          className={`
                            cursor-pointer p-4 rounded-lg border-2 transition-all
                            ${isSelected
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                              : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
                            }
                          `}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // Handled by div onClick
                                className="w-5 h-5 text-purple-600 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500"
                              />
                              <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                  {account.profile_name || account.linkedin_username}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {t('wizard.step3.linkedinAccount.limit', { limit: account.daily_limit || 0 })}
                                </p>
                              </div>
                            </div>
                            {account.status === 'active' && (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Resumo de limites */}
                  {formData.linkedin_account_ids.length > 0 && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 border border-purple-200 dark:border-purple-700 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('wizard.step3.linkedinAccount.selected', { count: formData.linkedin_account_ids.length })}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {t('wizard.step3.linkedinAccount.distribution')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {linkedinAccounts
                              .filter(acc => formData.linkedin_account_ids.includes(acc.id))
                              .reduce((sum, acc) => sum + (acc.daily_limit || 0), 0)
                            }
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{t('wizard.step3.linkedinAccount.totalLimit')}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* AI Agent Selector */}
              {aiAgents.length === 0 ? (
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    {t('wizard.step3.aiAgent.noAgents')}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('wizard.step3.aiAgent.label')} *
                  </label>
                  <select
                    value={formData.ai_agent_id}
                    onChange={(e) => setFormData({ ...formData, ai_agent_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">{t('wizard.step3.aiAgent.placeholder')}</option>
                    {aiAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} ({agent.behavioral_profile})
                      </option>
                    ))}
                  </select>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div>
            {currentStep > 1.5 && (
              <button
                onClick={handleBack}
                disabled={isLoading}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('wizard.buttons.back')}
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
            >
              {t('wizard.buttons.cancel')}
            </button>

            {currentStep === 1.5 ? (
              <button
                onClick={handleGenerateFilters}
                disabled={isLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    {t('wizard.step1_5.generating')}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {t('wizard.step1_5.generateButton')}
                  </>
                )}
              </button>
            ) : currentStep < 3 ? (
              <button
                onClick={handleNext}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {t('wizard.buttons.next')}
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isLoading || formData.linkedin_account_ids.length === 0 || !formData.ai_agent_id}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    {t('wizard.buttons.creating')}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    {t('wizard.buttons.createCampaign')}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignWizard;
