// frontend/src/components/SearchSidebar.jsx
import React, { useState } from 'react';
import AsyncSelect from 'react-select/async';
import { useTranslation } from 'react-i18next';
import {
  Search,
  MapPin,
  Building,
  Briefcase,
  Users,
  X,
  Settings,
  User,
  Award,
  GraduationCap,
  Clock,
  Network,
  Globe,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const SearchSidebar = ({
  searchParams,
  onSearchParamsChange,
  linkedinAccounts,
  selectedLocation,
  onLocationChange,
  selectedIndustries,
  onIndustriesChange,
  selectedJobTitles,
  onJobTitlesChange,
  selectedCompanies,
  onCompaniesChange,
  fetchLocationSuggestions,
  fetchIndustrySuggestions,
  fetchJobTitleSuggestions,
  fetchCompanySuggestions,
  onSearch,
  loading,
  resultsCount = 0,
  // Novos filtros avançados (v1.3.0)
  firstName = '',
  onFirstNameChange,
  lastName = '',
  onLastNameChange,
  selectedSkills = [],
  onSkillsChange,
  selectedSchool = null,
  onSchoolChange,
  selectedPastCompanies = [],
  onPastCompaniesChange,
  networkDistance = '',
  onNetworkDistanceChange,
  tenure = '',
  onTenureChange,
  yearsExperience = '',
  onYearsExperienceChange,
  profileLanguage = '',
  onProfileLanguageChange,
  fetchSkillSuggestions,
  fetchSchoolSuggestions
}) => {
  const { t } = useTranslation('search');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Detectar tipo de conta selecionada
  const selectedAccount = linkedinAccounts.find(acc => acc.id === searchParams.linkedin_account_id);
  const accountType = selectedAccount?.account_type || 'free';

  // Filtros avançados só disponíveis para Sales Navigator e Recruiter
  const hasAdvancedFilters = accountType === 'sales_navigator' || accountType === 'recruiter';

  // LinkedIn Classic suporta apenas: keywords, location, industry, job_title, companies, network_distance
  // Sales Navigator/Recruiter suportam: skills, school, past_companies, tenure, years_experience, profile_language

  // Contar filtros ativos (considerando tipo de conta)
  const basicFilters = [
    searchParams.query,
    selectedLocation,
    selectedIndustries.length > 0,
    selectedJobTitles.length > 0,
    selectedCompanies.length > 0,
    // Filtros básicos disponíveis para todos
    firstName,
    lastName,
    networkDistance
  ];

  // Filtros premium (apenas Sales Navigator/Recruiter)
  const premiumFilters = hasAdvancedFilters ? [
    selectedSkills.length > 0,
    selectedSchool,
    selectedPastCompanies.length > 0,
    tenure,
    yearsExperience,
    profileLanguage
  ] : [];

  const activeFiltersCount = [...basicFilters, ...premiumFilters].filter(Boolean).length;

  // Contar filtros avançados ativos (na seção colapsável)
  const basicAdvancedFilters = [
    firstName,
    lastName,
    networkDistance
  ];

  const premiumAdvancedFilters = hasAdvancedFilters ? [
    selectedSkills.length > 0,
    selectedSchool,
    selectedPastCompanies.length > 0,
    tenure,
    yearsExperience,
    profileLanguage
  ] : [];

  const advancedFiltersCount = [...basicAdvancedFilters, ...premiumAdvancedFilters].filter(Boolean).length;

  const handleClearFilters = () => {
    onSearchParamsChange({ ...searchParams, query: '' });
    onLocationChange(null);
    onIndustriesChange([]);
    onJobTitlesChange([]);
    onCompaniesChange([]);
    // Limpar novos filtros (v1.3.0)
    if (onFirstNameChange) onFirstNameChange('');
    if (onLastNameChange) onLastNameChange('');
    if (onSkillsChange) onSkillsChange([]);
    if (onSchoolChange) onSchoolChange(null);
    if (onPastCompaniesChange) onPastCompaniesChange([]);
    if (onNetworkDistanceChange) onNetworkDistanceChange('');
    if (onTenureChange) onTenureChange('');
    if (onYearsExperienceChange) onYearsExperienceChange('');
    if (onProfileLanguageChange) onProfileLanguageChange('');
  };

  // Check if dark mode is active
  const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const customSelectStyles = {
    control: (provided, state) => ({
      ...provided,
      minHeight: '38px',
      borderColor: state.isFocused ? '#7229f7' : (isDarkMode ? '#4b5563' : '#d1d5db'),
      backgroundColor: isDarkMode ? '#374151' : 'white',
      boxShadow: state.isFocused ? '0 0 0 1px #7229f7' : 'none',
      '&:hover': {
        borderColor: '#7229f7'
      }
    }),
    input: (provided) => ({
      ...provided,
      fontSize: '14px',
      color: isDarkMode ? '#f3f4f6' : '#111827'
    }),
    singleValue: (provided) => ({
      ...provided,
      color: isDarkMode ? '#f3f4f6' : '#111827'
    }),
    placeholder: (provided) => ({
      ...provided,
      fontSize: '14px',
      color: isDarkMode ? '#9ca3af' : '#9ca3af'
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: isDarkMode ? '#374151' : 'white',
      borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
    }),
    option: (provided, state) => ({
      ...provided,
      fontSize: '14px',
      backgroundColor: state.isSelected
        ? '#7229f7'
        : state.isFocused
        ? (isDarkMode ? '#4b5563' : '#f3f4f6')
        : (isDarkMode ? '#374151' : 'white'),
      color: state.isSelected ? 'white' : (isDarkMode ? '#f3f4f6' : '#111827')
    }),
    multiValue: (provided) => ({
      ...provided,
      backgroundColor: isDarkMode ? '#4b5563' : '#e5e7eb'
    }),
    multiValueLabel: (provided) => ({
      ...provided,
      color: isDarkMode ? '#f3f4f6' : '#111827'
    }),
    multiValueRemove: (provided) => ({
      ...provided,
      color: isDarkMode ? '#9ca3af' : '#6b7280',
      '&:hover': {
        backgroundColor: isDarkMode ? '#6b7280' : '#d1d5db',
        color: isDarkMode ? '#f3f4f6' : '#111827'
      }
    })
  };

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('sidebar.title')}</h2>
          <Settings className="w-5 h-5 text-gray-400" />
        </div>

        {/* Conta LinkedIn */}
        <div className="mb-3">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase">
            {t('sidebar.linkedinAccount')}
          </label>
          <select
            value={searchParams.linkedin_account_id}
            onChange={(e) => onSearchParamsChange({
              ...searchParams,
              linkedin_account_id: e.target.value
            })}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="">{t('sidebar.selectAccount')}</option>
            {linkedinAccounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.profile_name || account.linkedin_username}
              </option>
            ))}
          </select>
        </div>

        {/* Keywords */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase">
            {t('sidebar.keywords')}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchParams.query}
              onChange={(e) => onSearchParamsChange({
                ...searchParams,
                query: e.target.value
              })}
              placeholder={t('sidebar.keywordsPlaceholder')}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              disabled={!searchParams.linkedin_account_id}
            />
          </div>
        </div>
      </div>

      {/* Filtros - Sempre Visíveis */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 space-y-3 overflow-y-auto flex-1">
          {/* Localização */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase">
              <MapPin className="w-3.5 h-3.5" />
              {t('sidebar.location')}
            </label>
            <AsyncSelect
              cacheOptions
              defaultOptions={false}
              loadOptions={fetchLocationSuggestions}
              value={selectedLocation}
              onChange={onLocationChange}
              placeholder={t('sidebar.locationPlaceholder')}
              isClearable
              isDisabled={!searchParams.linkedin_account_id}
              styles={customSelectStyles}
            />
          </div>

          {/* Setores */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase">
              <Building className="w-3.5 h-3.5" />
              {t('sidebar.industries')}
            </label>
            <AsyncSelect
              cacheOptions
              defaultOptions={false}
              loadOptions={fetchIndustrySuggestions}
              value={selectedIndustries}
              onChange={onIndustriesChange}
              placeholder={t('sidebar.industriesPlaceholder')}
              isMulti
              isClearable
              isDisabled={!searchParams.linkedin_account_id}
              styles={customSelectStyles}
            />
          </div>

          {/* Cargos */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase">
              <Briefcase className="w-3.5 h-3.5" />
              {t('sidebar.jobTitles')}
            </label>
            <AsyncSelect
              cacheOptions
              defaultOptions={false}
              loadOptions={fetchJobTitleSuggestions}
              value={selectedJobTitles}
              onChange={onJobTitlesChange}
              placeholder={t('sidebar.jobTitlesPlaceholder')}
              isMulti
              isClearable
              isDisabled={!searchParams.linkedin_account_id}
              styles={customSelectStyles}
            />
          </div>

          {/* Empresas */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase">
              <Users className="w-3.5 h-3.5" />
              {t('sidebar.companies')}
            </label>
            <AsyncSelect
              cacheOptions
              defaultOptions={false}
              loadOptions={fetchCompanySuggestions}
              value={selectedCompanies}
              onChange={onCompaniesChange}
              placeholder={t('sidebar.companiesPlaceholder')}
              isMulti
              isClearable
              isDisabled={!searchParams.linkedin_account_id}
              styles={customSelectStyles}
            />
          </div>

          {/* Filtros Avançados (v1.3.0) */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="w-full flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" />
                {t('sidebar.advancedFilters', 'Filtros Avançados')}
                {advancedFiltersCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full">
                    {advancedFiltersCount}
                  </span>
                )}
              </span>
              {showAdvancedFilters ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showAdvancedFilters && (
              <div className="mt-3 space-y-3">
                {/* Nome e Sobrenome - Disponível para TODOS os tipos (usa keywords) */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      <User className="w-3 h-3" />
                      {t('sidebar.firstName', 'Nome')}
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => onFirstNameChange && onFirstNameChange(e.target.value)}
                      placeholder={t('sidebar.firstNamePlaceholder', 'Ex: João')}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                      disabled={!searchParams.linkedin_account_id}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      <User className="w-3 h-3" />
                      {t('sidebar.lastName', 'Sobrenome')}
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => onLastNameChange && onLastNameChange(e.target.value)}
                      placeholder={t('sidebar.lastNamePlaceholder', 'Ex: Silva')}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                      disabled={!searchParams.linkedin_account_id}
                    />
                  </div>
                </div>

                {/* Grau de Conexão - Disponível para TODOS os tipos */}
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    <Network className="w-3 h-3" />
                    {t('sidebar.networkDistance', 'Grau de Conexão')}
                  </label>
                  <select
                    value={networkDistance}
                    onChange={(e) => onNetworkDistanceChange && onNetworkDistanceChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    disabled={!searchParams.linkedin_account_id}
                  >
                    <option value="">{t('sidebar.allConnections', 'Todos')}</option>
                    <option value="F">{t('sidebar.firstDegree', '1º Grau')}</option>
                    <option value="S">{t('sidebar.secondDegree', '2º Grau')}</option>
                    <option value="O">{t('sidebar.thirdDegree', '3º Grau+')}</option>
                  </select>
                </div>

                {/* === FILTROS PREMIUM (Apenas Sales Navigator / Recruiter) === */}
                {hasAdvancedFilters ? (
                  <>
                    {/* Skills */}
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        <Award className="w-3 h-3" />
                        {t('sidebar.skills', 'Habilidades')}
                      </label>
                      <AsyncSelect
                        cacheOptions
                        defaultOptions={false}
                        loadOptions={fetchSkillSuggestions}
                        value={selectedSkills}
                        onChange={(val) => onSkillsChange && onSkillsChange(val || [])}
                        placeholder={t('sidebar.skillsPlaceholder', 'Ex: JavaScript, Python...')}
                        isMulti
                        isClearable
                        isDisabled={!searchParams.linkedin_account_id}
                        styles={customSelectStyles}
                      />
                    </div>

                    {/* Instituição de Ensino */}
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        <GraduationCap className="w-3 h-3" />
                        {t('sidebar.school', 'Instituição de Ensino')}
                      </label>
                      <AsyncSelect
                        cacheOptions
                        defaultOptions={false}
                        loadOptions={fetchSchoolSuggestions}
                        value={selectedSchool}
                        onChange={(val) => onSchoolChange && onSchoolChange(val)}
                        placeholder={t('sidebar.schoolPlaceholder', 'Ex: USP, Unicamp...')}
                        isClearable
                        isDisabled={!searchParams.linkedin_account_id}
                        styles={customSelectStyles}
                      />
                    </div>

                    {/* Empresas Anteriores */}
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        <Building className="w-3 h-3" />
                        {t('sidebar.pastCompanies', 'Empresas Anteriores')}
                      </label>
                      <AsyncSelect
                        cacheOptions
                        defaultOptions={false}
                        loadOptions={fetchCompanySuggestions}
                        value={selectedPastCompanies}
                        onChange={(val) => onPastCompaniesChange && onPastCompaniesChange(val || [])}
                        placeholder={t('sidebar.pastCompaniesPlaceholder', 'Ex: Google, Microsoft...')}
                        isMulti
                        isClearable
                        isDisabled={!searchParams.linkedin_account_id}
                        styles={customSelectStyles}
                      />
                    </div>

                    {/* Tempo na Empresa Atual */}
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        <Clock className="w-3 h-3" />
                        {t('sidebar.tenure', 'Tempo na Empresa')}
                      </label>
                      <select
                        value={tenure}
                        onChange={(e) => onTenureChange && onTenureChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        disabled={!searchParams.linkedin_account_id}
                      >
                        <option value="">{t('sidebar.anyTenure', 'Qualquer')}</option>
                        <option value="1">{t('sidebar.lessThan1Year', 'Menos de 1 ano')}</option>
                        <option value="2">{t('sidebar.1to2Years', '1-2 anos')}</option>
                        <option value="3">{t('sidebar.3to5Years', '3-5 anos')}</option>
                        <option value="4">{t('sidebar.6to10Years', '6-10 anos')}</option>
                        <option value="5">{t('sidebar.moreThan10Years', 'Mais de 10 anos')}</option>
                      </select>
                    </div>

                    {/* Anos de Experiência */}
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        <Briefcase className="w-3 h-3" />
                        {t('sidebar.yearsExperience', 'Experiência Total')}
                      </label>
                      <select
                        value={yearsExperience}
                        onChange={(e) => onYearsExperienceChange && onYearsExperienceChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        disabled={!searchParams.linkedin_account_id}
                      >
                        <option value="">{t('sidebar.anyExperience', 'Qualquer')}</option>
                        <option value="1">{t('sidebar.0to2Years', '0-2 anos')}</option>
                        <option value="2">{t('sidebar.3to5YearsExp', '3-5 anos')}</option>
                        <option value="3">{t('sidebar.6to10YearsExp', '6-10 anos')}</option>
                        <option value="4">{t('sidebar.moreThan10YearsExp', 'Mais de 10 anos')}</option>
                      </select>
                    </div>

                    {/* Idioma do Perfil */}
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        <Globe className="w-3 h-3" />
                        {t('sidebar.profileLanguage', 'Idioma do Perfil')}
                      </label>
                      <select
                        value={profileLanguage}
                        onChange={(e) => onProfileLanguageChange && onProfileLanguageChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        disabled={!searchParams.linkedin_account_id}
                      >
                        <option value="">{t('sidebar.anyLanguage', 'Qualquer')}</option>
                        <option value="pt">Português</option>
                        <option value="en">English</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                        <option value="it">Italiano</option>
                        <option value="zh">中文</option>
                        <option value="ja">日本語</option>
                      </select>
                    </div>
                  </>
                ) : (
                  /* Mensagem para contas Classic/Free */
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      <strong>💡 {t('sidebar.premiumFiltersTitle', 'Filtros Premium')}</strong>
                      <br />
                      {t('sidebar.premiumFiltersMessage', 'Skills, Instituição, Empresas Anteriores e outros filtros avançados requerem Sales Navigator ou Recruiter.')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

        {/* Limpar Filtros */}
        {activeFiltersCount > 0 && (
          <button
            onClick={handleClearFilters}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            {t('sidebar.clearFilters')}
          </button>
        )}
      </div>

      {/* Action Button */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={onSearch}
          disabled={loading || !searchParams.linkedin_account_id}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
        >
          <Search className="w-5 h-5" />
          {loading ? t('sidebar.searching') : t('sidebar.searchProfiles')}
        </button>
      </div>

      {/* Results Info */}
      {resultsCount > 0 && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-purple-50 dark:bg-purple-900/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-purple-900 dark:text-purple-300">
              {resultsCount} {resultsCount === 1 ? t('sidebar.profileFound') : t('sidebar.profilesFound')}
            </span>
          </div>
        </div>
      )}

      {/* Pills de Filtros Ativos */}
      {activeFiltersCount > 0 && (
        <div className="px-4 py-3 space-y-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('sidebar.activeFilters')}</span>
          <div className="flex flex-wrap gap-1.5">
            {searchParams.query && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs rounded-full">
                <Search className="w-3 h-3" />
                {searchParams.query}
                <button
                  onClick={() => onSearchParamsChange({ ...searchParams, query: '' })}
                  className="hover:bg-purple-200 dark:hover:bg-purple-800 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedLocation && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                <MapPin className="w-3 h-3" />
                {selectedLocation.label}
                <button
                  onClick={() => onLocationChange(null)}
                  className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedIndustries.map((industry) => (
              <span
                key={industry.value}
                className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs rounded-full"
              >
                <Building className="w-3 h-3" />
                {industry.label}
                <button
                  onClick={() => onIndustriesChange(selectedIndustries.filter(i => i.value !== industry.value))}
                  className="hover:bg-green-200 dark:hover:bg-green-800 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedJobTitles.map((job) => (
              <span
                key={job.value}
                className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 text-xs rounded-full"
              >
                <Briefcase className="w-3 h-3" />
                {job.label}
                <button
                  onClick={() => onJobTitlesChange(selectedJobTitles.filter(j => j.value !== job.value))}
                  className="hover:bg-yellow-200 dark:hover:bg-yellow-800 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedCompanies.map((company) => (
              <span
                key={company.value}
                className="inline-flex items-center gap-1 px-2 py-1 bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 text-xs rounded-full"
              >
                <Users className="w-3 h-3" />
                {company.label}
                <button
                  onClick={() => onCompaniesChange(selectedCompanies.filter(c => c.value !== company.value))}
                  className="hover:bg-pink-200 dark:hover:bg-pink-800 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchSidebar;
