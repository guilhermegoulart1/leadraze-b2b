// backend/src/services/googleMapsSearchService.js
const outscraperClient = require('../config/outscraper');

/**
 * Service para busca de estabelecimentos no Google Maps via Outscraper
 */
class GoogleMapsSearchService {

  /**
   * Executa busca no Google Maps
   * @param {Object} filters - Filtros de busca
   * @param {string} filters.country - País (ex: "Brazil", "United States")
   * @param {string} filters.location - Localização (ex: "São Paulo, SP", "New York, NY")
   * @param {string} filters.query - Nicho/categoria (ex: "restaurantes italianos", "academias")
   * @param {number} filters.radius - Raio em metros (opcional)
   * @param {number} filters.minRating - Rating mínimo 1-5 (opcional)
   * @param {number} filters.minReviews - Número mínimo de reviews (opcional)
   * @param {boolean} filters.requirePhone - Apenas com telefone (opcional)
   * @param {boolean} filters.requireEmail - Apenas com email (opcional)
   * @param {number} filters.limit - Limite de resultados (padrão: 100, máx: 500)
   * @returns {Promise<Object>} - Resultados da busca
   */
  async search(filters) {
    try {
      // Validação
      if (!filters.location || !filters.query) {
        throw new Error('Location and query are required');
      }

      // Verificar se cliente está inicializado
      if (!outscraperClient.isInitialized()) {
        throw new Error(outscraperClient.getError() || 'Outscraper client not initialized');
      }

      // Construir query completa
      const fullQuery = this._buildQuery(filters);

      console.log('🔍 === GOOGLE MAPS SEARCH SERVICE ===');
      console.log('📍 Full query:', fullQuery);
      console.log('📊 Filters:', JSON.stringify(filters, null, 2));

      // Parâmetros para Outscraper
      const searchParams = {
        query: fullQuery,
        language: filters.language || 'pt',
        region: this._getRegionCode(filters.country),
        limit: Math.min(filters.limit || 100, 500), // Máximo 500
        extractContacts: filters.requireEmail || false
      };

      // Adicionar filtros opcionais
      if (filters.minRating) {
        searchParams.rating = filters.minRating;
      }

      if (filters.minReviews) {
        searchParams.minReviews = filters.minReviews;
      }

      // Executar busca
      const searchResult = await outscraperClient.maps.search(searchParams);

      // Se for assíncrono, fazer polling até completar
      if (searchResult.isAsync) {
        console.log('⏳ Search is async, polling for results...');

        const results = await outscraperClient.tasks.pollUntilComplete(
          searchResult.taskId,
          60, // 60 tentativas
          5000 // 5 segundos entre tentativas
        );

        return this._processResults(results.businesses, filters);
      }

      // Resultado síncrono
      return this._processResults(searchResult.businesses, filters);

    } catch (error) {
      console.error('❌ Error in Google Maps search service:', error.message);
      throw error;
    }
  }

  /**
   * Constrói a query de busca completa
   * @private
   */
  _buildQuery(filters) {
    const parts = [];

    // Nicho/categoria
    if (filters.query) {
      parts.push(filters.query.trim());
    }

    // Localização
    if (filters.location) {
      parts.push('em ' + filters.location.trim());
    }

    // País (se não estiver incluído na localização)
    if (filters.country && !filters.location.toLowerCase().includes(filters.country.toLowerCase())) {
      parts.push(filters.country.trim());
    }

    return parts.join(' ');
  }

  /**
   * Retorna o código de região baseado no país
   * @private
   */
  _getRegionCode(country) {
    const regionMap = {
      'brazil': 'br',
      'brasil': 'br',
      'united states': 'us',
      'usa': 'us',
      'portugal': 'pt',
      'spain': 'es',
      'espanha': 'es',
      'mexico': 'mx',
      'méxico': 'mx',
      'argentina': 'ar',
      'chile': 'cl',
      'colombia': 'co',
      'peru': 'pe'
    };

    const normalizedCountry = (country || '').toLowerCase().trim();
    return regionMap[normalizedCountry] || 'br'; // Default: Brasil
  }

  /**
   * Processa e normaliza os resultados
   * @private
   */
  _processResults(businesses, filters) {
    if (!businesses || businesses.length === 0) {
      return {
        success: true,
        count: 0,
        businesses: [],
        message: 'No results found for this search'
      };
    }

    // Filtrar resultados adicionais (client-side)
    let filtered = businesses;

    // Filtrar por telefone obrigatório
    if (filters.requirePhone) {
      filtered = filtered.filter(b => b.phone || b.phone_number);
    }

    // Filtrar por email obrigatório
    if (filters.requireEmail) {
      filtered = filtered.filter(b => b.email || b.emails?.length > 0);
    }

    // Normalizar dados
    const normalized = filtered.map(business => this._normalizeBusiness(business));

    console.log(`✅ Processed ${normalized.length} businesses (from ${businesses.length} total)`);

    return {
      success: true,
      count: normalized.length,
      businesses: normalized
    };
  }

  /**
   * Normaliza os dados de um estabelecimento
   * @private
   */
  _normalizeBusiness(business) {
    return {
      // Identificação
      placeId: business.place_id || business.google_id,
      name: business.name,
      category: business.category || business.type || business.categories?.[0],

      // Localização
      address: business.full_address || business.address,
      city: business.city,
      state: business.state,
      postalCode: business.postal_code || business.zip_code,
      country: business.country,
      latitude: business.latitude || business.lat,
      longitude: business.longitude || business.lng,

      // Contato
      phone: business.phone || business.phone_number,
      email: business.email || business.emails?.[0] || null,
      website: business.site || business.website,

      // Avaliações
      rating: business.rating || business.reviews_rating,
      reviewCount: business.reviews || business.reviews_count || business.reviews_per_score_total || 0,
      reviewsPerScore: business.reviews_per_score || null,

      // Informações adicionais
      description: business.description || business.about?.summary,
      priceLevel: business.price_level,
      hours: business.working_hours || business.hours,
      popularTimes: business.popular_times,

      // Links
      googleMapsUrl: business.url || business.google_maps_url,
      photos: business.photo || business.photos || [],

      // Metadata
      verifiedBusiness: business.verified || false,
      plusCode: business.plus_code,

      // Dados brutos (para referência)
      _raw: business
    };
  }

  /**
   * Converte resultados para CSV
   * @param {Array} businesses - Lista de estabelecimentos
   * @returns {string} - String CSV
   */
  exportToCSV(businesses) {
    if (!businesses || businesses.length === 0) {
      throw new Error('No businesses to export');
    }

    // Cabeçalhos
    const headers = [
      'Nome',
      'Categoria',
      'Endereço',
      'Cidade',
      'Estado',
      'País',
      'Telefone',
      'Email',
      'Website',
      'Rating',
      'Reviews',
      'Google Maps URL'
    ];

    // Linhas
    const rows = businesses.map(b => [
      this._escapeCsvValue(b.name),
      this._escapeCsvValue(b.category),
      this._escapeCsvValue(b.address),
      this._escapeCsvValue(b.city),
      this._escapeCsvValue(b.state),
      this._escapeCsvValue(b.country),
      this._escapeCsvValue(b.phone),
      this._escapeCsvValue(b.email),
      this._escapeCsvValue(b.website),
      b.rating || '',
      b.reviewCount || 0,
      this._escapeCsvValue(b.googleMapsUrl)
    ]);

    // Montar CSV
    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return csv;
  }

  /**
   * Escapa valores para CSV (handle vírgulas, aspas, quebras de linha)
   * @private
   */
  _escapeCsvValue(value) {
    if (value === null || value === undefined) {
      return '';
    }

    const stringValue = String(value);

    // Se contém vírgula, aspas ou quebra de linha, envolver em aspas
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      // Duplicar aspas internas
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  /**
   * Verifica créditos disponíveis na conta Outscraper
   * @returns {Promise<Object>} - Informações da conta
   */
  async getAccountInfo() {
    try {
      if (!outscraperClient.isInitialized()) {
        throw new Error(outscraperClient.getError() || 'Outscraper client not initialized');
      }

      const profile = await outscraperClient.account.getProfile();

      return {
        success: true,
        credits: profile.credits || 0,
        email: profile.email,
        plan: profile.plan
      };

    } catch (error) {
      console.error('❌ Error getting Outscraper account info:', error.message);
      throw error;
    }
  }
}

module.exports = new GoogleMapsSearchService();
