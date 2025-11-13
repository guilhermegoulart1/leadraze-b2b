import React, { useState, useEffect } from 'react';
import { X, MapPin, Building2, Briefcase, Target, Loader } from 'lucide-react';
import api from '../services/api';

const SearchFilters = ({ accountId, filters, onFiltersChange }) => {
  const [locationSearch, setLocationSearch] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  
  const [industrySearch, setIndustrySearch] = useState('');
  const [industrySuggestions, setIndustrySuggestions] = useState([]);
  const [loadingIndustries, setLoadingIndustries] = useState(false);
  
  const [jobTitleSearch, setJobTitleSearch] = useState('');
  const [jobTitleSuggestions, setJobTitleSuggestions] = useState([]);
  const [loadingJobTitles, setLoadingJobTitles] = useState(false);
  
  const [companySearch, setCompanySearch] = useState('');
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  // Debounce para busca de locations
  useEffect(() => {
    if (!accountId) return;
    
    const timer = setTimeout(() => {
      if (locationSearch.length >= 2) {
        searchLocations(locationSearch);
      } else {
        setLocationSuggestions([]);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [locationSearch, accountId]);

  useEffect(() => {
    if (!accountId) return;
    
    const timer = setTimeout(() => {
      if (industrySearch.length >= 2) {
        searchIndustries(industrySearch);
      } else {
        setIndustrySuggestions([]);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [industrySearch, accountId]);

  useEffect(() => {
    if (!accountId) return;
    
    const timer = setTimeout(() => {
      if (jobTitleSearch.length >= 2) {
        searchJobTitles(jobTitleSearch);
      } else {
        setJobTitleSuggestions([]);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [jobTitleSearch, accountId]);

  useEffect(() => {
    if (!accountId) return;
    
    const timer = setTimeout(() => {
      if (companySearch.length >= 2) {
        searchCompanies(companySearch);
      } else {
        setCompanySuggestions([]);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [companySearch, accountId]);

  const searchLocations = async (query) => {
    try {
      setLoadingLocations(true);
      const response = await api.searchLocations(query, accountId);
      
      console.log('📍 Locations response:', response);
      
      if (response.success) {
        setLocationSuggestions(response.data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar localizações:', error);
    } finally {
      setLoadingLocations(false);
    }
  };

  const searchIndustries = async (query) => {
    try {
      setLoadingIndustries(true);
      const response = await api.searchIndustries(query, accountId);
      if (response.success) {
        setIndustrySuggestions(response.data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar setores:', error);
    } finally {
      setLoadingIndustries(false);
    }
  };

  const searchJobTitles = async (query) => {
    try {
      setLoadingJobTitles(true);
      const response = await api.searchJobTitles(query, accountId);
      if (response.success) {
        setJobTitleSuggestions(response.data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar cargos:', error);
    } finally {
      setLoadingJobTitles(false);
    }
  };

  const searchCompanies = async (query) => {
    try {
      setLoadingCompanies(true);
      const response = await api.searchCompanies(query, accountId);
      if (response.success) {
        setCompanySuggestions(response.data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar empresas:', error);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const addFilter = (type, value) => {
    onFiltersChange({
      ...filters,
      [type]: [...filters[type], value]
    });
  };

  const removeFilter = (type, index) => {
    onFiltersChange({
      ...filters,
      [type]: filters[type].filter((_, i) => i !== index)
    });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      locations: [],
      industries: [],
      job_titles: [],
      companies: []
    });
  };

  const hasActiveFilters = Object.values(filters).some(arr => arr.length > 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">Filtros</h2>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-sm text-purple-600 hover:text-purple-700 font-semibold"
          >
            Limpar Tudo
          </button>
        )}
      </div>

      {!accountId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            Selecione uma conta LinkedIn para habilitar os filtros
          </p>
        </div>
      )}

      {/* LOCALIZAÇÃO */}
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-3">
          <MapPin className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">Localização</h3>
        </div>

        {/* Selected Locations */}
        {filters.locations.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {filters.locations.map((location, index) => (
              <span key={index} className="flex items-center space-x-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                <span>{location.label}</span>
                <button
                  onClick={() => removeFilter('locations', index)}
                  className="hover:bg-purple-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={locationSearch}
            onChange={(e) => setLocationSearch(e.target.value)}
            placeholder="Digite uma cidade ou país..."
            disabled={!accountId}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm disabled:bg-gray-100"
          />
          {loadingLocations && (
            <Loader className="w-4 h-4 animate-spin absolute right-3 top-3 text-gray-400" />
          )}
        </div>

        {/* Lista de Sugestões EMBAIXO */}
        {locationSuggestions.length > 0 && (
          <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto bg-white">
            {locationSuggestions.map((location, index) => {
              const alreadySelected = filters.locations.some(loc => loc.value === location.value);
              
              return (
                <button
                  key={index}
                  onClick={() => {
                    if (!alreadySelected) {
                      addFilter('locations', location);
                    }
                    setLocationSearch('');
                    setLocationSuggestions([]);
                  }}
                  disabled={alreadySelected}
                  className={`w-full text-left px-4 py-3 text-sm border-b border-gray-100 last:border-0 ${
                    alreadySelected 
                      ? 'bg-gray-50 text-gray-400 cursor-not-allowed' 
                      : 'hover:bg-purple-50 cursor-pointer'
                  }`}
                >
                  <div className="font-medium">{location.label}</div>
                  {location.country && (
                    <div className="text-xs text-gray-500 mt-1">{location.country}</div>
                  )}
                  {alreadySelected && (
                    <span className="text-xs text-green-600">✓ Já adicionado</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* SETOR/INDÚSTRIA */}
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-3">
          <Target className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">Setor/Indústria</h3>
        </div>

        {filters.industries.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {filters.industries.map((item, index) => (
              <span key={index} className="flex items-center space-x-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                <span>{item}</span>
                <button
                  onClick={() => removeFilter('industries', index)}
                  className="hover:bg-purple-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="relative">
          <input
            type="text"
            value={industrySearch}
            onChange={(e) => setIndustrySearch(e.target.value)}
            placeholder="Digite um setor..."
            disabled={!accountId}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm disabled:bg-gray-100"
          />
          {loadingIndustries && (
            <Loader className="w-4 h-4 animate-spin absolute right-3 top-3 text-gray-400" />
          )}
        </div>

        {industrySuggestions.length > 0 && (
          <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto bg-white">
            {industrySuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => {
                  if (!filters.industries.includes(suggestion)) {
                    addFilter('industries', suggestion);
                  }
                  setIndustrySearch('');
                  setIndustrySuggestions([]);
                }}
                className="w-full text-left px-4 py-3 hover:bg-purple-50 text-sm border-b border-gray-100 last:border-0"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CARGO */}
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-3">
          <Briefcase className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">Cargo</h3>
        </div>

        {filters.job_titles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {filters.job_titles.map((item, index) => (
              <span key={index} className="flex items-center space-x-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                <span>{item}</span>
                <button
                  onClick={() => removeFilter('job_titles', index)}
                  className="hover:bg-purple-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="relative">
          <input
            type="text"
            value={jobTitleSearch}
            onChange={(e) => setJobTitleSearch(e.target.value)}
            placeholder="Digite um cargo..."
            disabled={!accountId}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm disabled:bg-gray-100"
          />
          {loadingJobTitles && (
            <Loader className="w-4 h-4 animate-spin absolute right-3 top-3 text-gray-400" />
          )}
        </div>

        {jobTitleSuggestions.length > 0 && (
          <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto bg-white">
            {jobTitleSuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => {
                  if (!filters.job_titles.includes(suggestion)) {
                    addFilter('job_titles', suggestion);
                  }
                  setJobTitleSearch('');
                  setJobTitleSuggestions([]);
                }}
                className="w-full text-left px-4 py-3 hover:bg-purple-50 text-sm border-b border-gray-100 last:border-0"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* EMPRESA */}
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-3">
          <Building2 className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">Empresa</h3>
        </div>

        {filters.companies.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {filters.companies.map((item, index) => (
              <span key={index} className="flex items-center space-x-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                <span>{item}</span>
                <button
                  onClick={() => removeFilter('companies', index)}
                  className="hover:bg-purple-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="relative">
          <input
            type="text"
            value={companySearch}
            onChange={(e) => setCompanySearch(e.target.value)}
            placeholder="Digite uma empresa..."
            disabled={!accountId}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm disabled:bg-gray-100"
          />
          {loadingCompanies && (
            <Loader className="w-4 h-4 animate-spin absolute right-3 top-3 text-gray-400" />
          )}
        </div>

        {companySuggestions.length > 0 && (
          <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto bg-white">
            {companySuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => {
                  if (!filters.companies.includes(suggestion)) {
                    addFilter('companies', suggestion);
                  }
                  setCompanySearch('');
                  setCompanySuggestions([]);
                }}
                className="w-full text-left px-4 py-3 hover:bg-purple-50 text-sm border-b border-gray-100 last:border-0"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchFilters;