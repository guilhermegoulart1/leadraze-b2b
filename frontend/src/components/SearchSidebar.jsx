// frontend/src/components/SearchSidebar.jsx
import React from 'react';
import AsyncSelect from 'react-select/async';
import { useTranslation } from 'react-i18next';
import {
  Search,
  MapPin,
  Building,
  Briefcase,
  Users,
  X,
  Settings
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
  resultsCount = 0
}) => {
  const { t } = useTranslation('search');

  // Contar filtros ativos
  const activeFiltersCount = [
    searchParams.query,
    selectedLocation,
    selectedIndustries.length > 0,
    selectedJobTitles.length > 0,
    selectedCompanies.length > 0
  ].filter(Boolean).length;

  const handleClearFilters = () => {
    onSearchParamsChange({ ...searchParams, query: '' });
    onLocationChange(null);
    onIndustriesChange([]);
    onJobTitlesChange([]);
    onCompaniesChange([]);
  };

  const customSelectStyles = {
    control: (provided, state) => ({
      ...provided,
      minHeight: '38px',
      borderColor: state.isFocused ? '#7229f7' : '#d1d5db',
      boxShadow: state.isFocused ? '0 0 0 1px #7229f7' : 'none',
      '&:hover': {
        borderColor: '#7229f7'
      }
    }),
    input: (provided) => ({
      ...provided,
      fontSize: '14px'
    }),
    placeholder: (provided) => ({
      ...provided,
      fontSize: '14px',
      color: '#9ca3af'
    }),
    option: (provided, state) => ({
      ...provided,
      fontSize: '14px',
      backgroundColor: state.isSelected
        ? '#7229f7'
        : state.isFocused
        ? '#f3f4f6'
        : 'white'
    })
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">{t('sidebar.title')}</h2>
          <Settings className="w-5 h-5 text-gray-400" />
        </div>

        {/* Conta LinkedIn */}
        <div className="mb-3">
          <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase">
            {t('sidebar.linkedinAccount')}
          </label>
          <select
            value={searchParams.linkedin_account_id}
            onChange={(e) => onSearchParamsChange({
              ...searchParams,
              linkedin_account_id: e.target.value
            })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
          <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase">
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
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={!searchParams.linkedin_account_id}
            />
          </div>
        </div>
      </div>

      {/* Filtros - Sempre Visíveis */}
      <div className="px-4 py-3 border-b border-gray-200 space-y-3 overflow-y-auto flex-1">
          {/* Localização */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5 uppercase">
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
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5 uppercase">
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
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5 uppercase">
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
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5 uppercase">
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

        {/* Limpar Filtros */}
        {activeFiltersCount > 0 && (
          <button
            onClick={handleClearFilters}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            {t('sidebar.clearFilters')}
          </button>
        )}
      </div>

      {/* Action Button */}
      <div className="p-4 border-b border-gray-200">
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
        <div className="px-4 py-3 border-b border-gray-200 bg-purple-50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-purple-900">
              {resultsCount} {resultsCount === 1 ? t('sidebar.profileFound') : t('sidebar.profilesFound')}
            </span>
          </div>
        </div>
      )}

      {/* Pills de Filtros Ativos */}
      {activeFiltersCount > 0 && (
        <div className="px-4 py-3 space-y-2">
          <span className="text-xs font-semibold text-gray-500 uppercase">{t('sidebar.activeFilters')}</span>
          <div className="flex flex-wrap gap-1.5">
            {searchParams.query && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                <Search className="w-3 h-3" />
                {searchParams.query}
                <button
                  onClick={() => onSearchParamsChange({ ...searchParams, query: '' })}
                  className="hover:bg-purple-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedLocation && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                <MapPin className="w-3 h-3" />
                {selectedLocation.label}
                <button
                  onClick={() => onLocationChange(null)}
                  className="hover:bg-blue-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedIndustries.map((industry) => (
              <span
                key={industry.value}
                className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full"
              >
                <Building className="w-3 h-3" />
                {industry.label}
                <button
                  onClick={() => onIndustriesChange(selectedIndustries.filter(i => i.value !== industry.value))}
                  className="hover:bg-green-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedJobTitles.map((job) => (
              <span
                key={job.value}
                className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full"
              >
                <Briefcase className="w-3 h-3" />
                {job.label}
                <button
                  onClick={() => onJobTitlesChange(selectedJobTitles.filter(j => j.value !== job.value))}
                  className="hover:bg-yellow-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedCompanies.map((company) => (
              <span
                key={company.value}
                className="inline-flex items-center gap-1 px-2 py-1 bg-pink-100 text-pink-700 text-xs rounded-full"
              >
                <Users className="w-3 h-3" />
                {company.label}
                <button
                  onClick={() => onCompaniesChange(selectedCompanies.filter(c => c.value !== company.value))}
                  className="hover:bg-pink-200 rounded-full p-0.5"
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
