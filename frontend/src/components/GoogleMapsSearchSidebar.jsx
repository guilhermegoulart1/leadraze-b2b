// frontend/src/components/GoogleMapsSearchSidebar.jsx
import React from 'react';
import { Search, MapPin, Star, Phone, Mail, Loader2 } from 'lucide-react';

const GoogleMapsSearchSidebar = ({ filters, onFiltersChange, onSearch, loading }) => {

  const updateFilter = (key, value) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Título */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Filtros de Busca
          </h2>
        </div>

        {/* País */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            País
          </label>
          <select
            value={filters.country}
            onChange={(e) => updateFilter('country', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="Brazil">Brasil</option>
            <option value="United States">Estados Unidos</option>
            <option value="Portugal">Portugal</option>
            <option value="Spain">Espanha</option>
            <option value="Mexico">México</option>
            <option value="Argentina">Argentina</option>
            <option value="Chile">Chile</option>
            <option value="Colombia">Colômbia</option>
            <option value="Peru">Peru</option>
          </select>
        </div>

        {/* Localização */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Localização <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filters.location}
              onChange={(e) => updateFilter('location', e.target.value)}
              placeholder="Ex: São Paulo, SP"
              required
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Cidade, estado ou endereço
          </p>
        </div>

        {/* Nicho/Categoria */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Nicho / Categoria <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={filters.query}
            onChange={(e) => updateFilter('query', e.target.value)}
            placeholder="Ex: restaurantes italianos, academias"
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            O que você está procurando
          </p>
        </div>

        {/* Raio de busca */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Raio de busca: {(filters.radius / 1000).toFixed(0)} km
          </label>
          <input
            type="range"
            min="1000"
            max="50000"
            step="1000"
            value={filters.radius}
            onChange={(e) => updateFilter('radius', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>1 km</span>
            <span>50 km</span>
          </div>
        </div>

        {/* Avaliação mínima */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Avaliação mínima
          </label>
          <select
            value={filters.minRating || ''}
            onChange={(e) => updateFilter('minRating', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Qualquer avaliação</option>
            <option value="4.5">⭐ 4.5+</option>
            <option value="4.0">⭐ 4.0+</option>
            <option value="3.5">⭐ 3.5+</option>
            <option value="3.0">⭐ 3.0+</option>
          </select>
        </div>

        {/* Número mínimo de avaliações */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Mínimo de avaliações
          </label>
          <select
            value={filters.minReviews || ''}
            onChange={(e) => updateFilter('minReviews', e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Qualquer quantidade</option>
            <option value="50">50+ avaliações</option>
            <option value="20">20+ avaliações</option>
            <option value="10">10+ avaliações</option>
            <option value="5">5+ avaliações</option>
          </select>
        </div>

        {/* Filtros de contato */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Informações de contato
          </label>

          {/* Telefone obrigatório */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="requirePhone"
              checked={filters.requirePhone}
              onChange={(e) => updateFilter('requirePhone', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label htmlFor="requirePhone" className="ml-2 text-sm text-gray-700 dark:text-gray-300 flex items-center">
              <Phone className="w-4 h-4 mr-1" />
              Apenas com telefone
            </label>
          </div>

          {/* Email obrigatório */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="requireEmail"
              checked={filters.requireEmail}
              onChange={(e) => updateFilter('requireEmail', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label htmlFor="requireEmail" className="ml-2 text-sm text-gray-700 dark:text-gray-300 flex items-center">
              <Mail className="w-4 h-4 mr-1" />
              Apenas com email
            </label>
          </div>
        </div>

        {/* Limite de resultados */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Limite de resultados
          </label>
          <select
            value={filters.limit}
            onChange={(e) => updateFilter('limit', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="50">50 resultados</option>
            <option value="100">100 resultados</option>
            <option value="200">200 resultados</option>
            <option value="500">500 resultados</option>
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Mais resultados = mais créditos
          </p>
        </div>

        {/* Botão de busca */}
        <button
          type="submit"
          disabled={loading || !filters.location.trim() || !filters.query.trim()}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Buscando...</span>
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              <span>Buscar</span>
            </>
          )}
        </button>

        {/* Aviso sobre créditos */}
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-xs text-yellow-800 dark:text-yellow-300">
            <strong>Atenção:</strong> Cada busca consome créditos da sua conta Outscraper.
            O custo varia conforme a quantidade de resultados.
          </p>
        </div>
      </form>
    </div>
  );
};

export default GoogleMapsSearchSidebar;
