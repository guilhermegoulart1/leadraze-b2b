// frontend/src/pages/GoogleMapsSearchPage.jsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api';
import GoogleMapsSearchSidebar from '../components/GoogleMapsSearchSidebar';
import GoogleMapsResults from '../components/GoogleMapsResults';
import { MapPin, Download, AlertCircle, Loader2 } from 'lucide-react';

const GoogleMapsSearchPage = () => {
  const { t } = useTranslation(['googlemaps', 'common']);
  // Estados de busca
  const [searchFilters, setSearchFilters] = useState({
    country: 'Brazil',
    location: '',
    query: '',
    radius: 5000, // 5km em metros
    minRating: null,
    minReviews: null,
    requirePhone: false,
    requireEmail: false,
    limit: 100
  });

  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Estado de créditos Outscraper
  const [credits, setCredits] = useState(null);
  const [loadingCredits, setLoadingCredits] = useState(false);

  // Carregar créditos ao montar componente
  React.useEffect(() => {
    loadAccountInfo();
  }, []);

  const loadAccountInfo = async () => {
    try {
      setLoadingCredits(true);
      const response = await apiService.getGoogleMapsAccountInfo();
      if (response.success) {
        setCredits(response.credits);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar informações da conta:', error);
      // Não mostrar erro ao usuário - créditos são informação adicional
    } finally {
      setLoadingCredits(false);
    }
  };

  // Executar busca
  const handleSearch = async () => {
    // Validação
    if (!searchFilters.location.trim()) {
      setError(t('search.validationLocation'));
      return;
    }

    if (!searchFilters.query.trim()) {
      setError(t('search.validationQuery'));
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSearchResults([]);
      setHasSearched(true);

      console.log('🔍 Iniciando busca no Google Maps:', searchFilters);

      const response = await apiService.searchGoogleMaps(searchFilters);

      if (response.success) {
        setSearchResults(response.businesses || []);
        console.log(`✅ ${response.count} estabelecimentos encontrados`);

        // Atualizar créditos após busca
        loadAccountInfo();
      } else {
        setError(response.message || t('search.errorExecuting'));
      }

    } catch (error) {
      console.error('❌ Erro na busca:', error);
      setError(error.message || t('search.errorMessage'));
    } finally {
      setLoading(false);
    }
  };

  // Exportar para CSV
  const handleExportCSV = async () => {
    if (searchResults.length === 0) {
      alert(t('search.noResults'));
      return;
    }

    try {
      console.log('📥 Exportando resultados para CSV...');

      const response = await apiService.exportGoogleMapsCSV(searchResults);

      // O backend retorna o CSV como texto
      // Criar um blob e fazer download
      const blob = new Blob([response], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      const timestamp = new Date().toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `google-maps-${searchFilters.query}-${timestamp}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('✅ CSV exportado com sucesso');

    } catch (error) {
      console.error('❌ Erro ao exportar CSV:', error);
      alert(t('search.exportError', 'Error exporting CSV. Try again.'));
    }
  };

  // Limpar busca
  const handleClearSearch = () => {
    setSearchResults([]);
    setHasSearched(false);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <MapPin className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {t('search.title')}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('search.subtitle')}
                </p>
              </div>
            </div>

            {/* Créditos */}
            {credits !== null && (
              <div className="flex items-center space-x-2 bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-lg">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {t('search.creditsAvailable')}:
                </span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {credits.toLocaleString()}
                </span>
              </div>
            )}

            {loadingCredits && (
              <div className="flex items-center space-x-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">{t('search.loading')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Filtros */}
          <div className="lg:col-span-1">
            <GoogleMapsSearchSidebar
              filters={searchFilters}
              onFiltersChange={setSearchFilters}
              onSearch={handleSearch}
              loading={loading}
            />
          </div>

          {/* Resultados */}
          <div className="lg:col-span-3">
            {/* Mensagem de erro */}
            {error && (
              <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                      {t('search.errorTitle')}
                    </h3>
                    <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                  <div className="text-center">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {t('search.searching')}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {t('search.searchingSubtitle')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Resultados */}
            {!loading && hasSearched && (
              <>
                {/* Header dos resultados */}
                {searchResults.length > 0 && (
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {searchResults.length}
                      </span>{' '}
                      {t('search.resultsFound')}
                    </div>

                    <button
                      onClick={handleExportCSV}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>{t('search.exportCSV')}</span>
                    </button>
                  </div>
                )}

                {/* Grid de resultados */}
                <GoogleMapsResults businesses={searchResults} />

                {/* Mensagem quando não há resultados */}
                {searchResults.length === 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12">
                    <div className="text-center">
                      <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        {t('search.noResultsTitle')}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('search.noResultsSubtitle')}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Estado inicial */}
            {!loading && !hasSearched && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12">
                <div className="text-center">
                  <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {t('search.readyTitle')}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('search.readySubtitle')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleMapsSearchPage;
