// backend/src/config/serpapi.js
// SerpApi client for Google Maps searches with pagination support

const axios = require('axios');

const SERPAPI_KEY = process.env.SERPAPI_KEY;
const SERPAPI_BASE_URL = 'https://serpapi.com/search';

/**
 * SerpApi Client for Google Maps searches
 *
 * Pricing: $0.00275 per query (Reserved plan)
 * Returns: 20 results per query (fixed by Google Maps)
 * Pagination: Uses 'start' parameter (0, 20, 40, 60...)
 */
class SerpApiClient {
  constructor() {
    if (!SERPAPI_KEY) {
      console.warn('⚠️  SERPAPI_KEY not found in environment variables');
      this.initialized = false;
    } else {
      this.initialized = true;
      console.log('✅ SerpApi client initialized');
    }
  }

  /**
   * Check if client is initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Search Google Maps
   *
   * @param {Object} params - Search parameters
   * @param {string} params.query - Search query (e.g., "academias em São Paulo")
   * @param {string} params.location - Location string (e.g., "São Paulo, SP, Brazil")
   * @param {number} params.start - Pagination offset (0, 20, 40...) - default 0
   * @param {string} params.hl - Language (default: 'pt')
   * @returns {Promise<Object>} - Search results with places array
   */
  async searchGoogleMaps(params) {
    if (!this.initialized) {
      throw new Error('SerpApi client not initialized. Check SERPAPI_KEY environment variable.');
    }

    const { query, location, start = 0, hl = 'pt' } = params;

    if (!query) {
      throw new Error('Query is required for Google Maps search');
    }

    if (!location) {
      throw new Error('Location is required for Google Maps search');
    }

    try {
      const searchParams = {
        engine: 'google_maps',
        type: 'search',
        q: query,
        ll: location,  // Can be coordinates or location string
        start: start,
        hl: hl,
        api_key: SERPAPI_KEY
      };

      console.log(`🔍 SerpApi request: query="${query}", location="${location}", start=${start}`);

      const response = await axios.get(SERPAPI_BASE_URL, {
        params: searchParams,
        timeout: 30000  // 30 second timeout
      });

      const data = response.data;

      // Extract relevant data
      const results = {
        success: true,
        places: data.local_results || [],
        total_results: data.local_results?.length || 0,
        search_metadata: {
          id: data.search_metadata?.id,
          status: data.search_metadata?.status,
          created_at: data.search_metadata?.created_at,
          google_maps_url: data.search_metadata?.google_maps_url
        },
        search_parameters: {
          query: data.search_parameters?.q,
          location: data.search_parameters?.ll,
          start: data.search_parameters?.start || 0
        },
        pagination: {
          current_page: Math.floor(start / 20),
          has_next_page: data.serpapi_pagination?.next ? true : false,
          next_page_url: data.serpapi_pagination?.next
        }
      };

      console.log(`✅ SerpApi success: ${results.total_results} places found (page ${results.pagination.current_page})`);

      return results;

    } catch (error) {
      console.error('❌ SerpApi error:', error.response?.data || error.message);

      if (error.response?.status === 401) {
        throw new Error('SerpApi authentication failed. Check API key.');
      }

      if (error.response?.status === 429) {
        throw new Error('SerpApi rate limit exceeded. Please try again later.');
      }

      throw new Error(`SerpApi request failed: ${error.message}`);
    }
  }

  /**
   * Search Google Maps with automatic pagination
   * Fetches ALL results up to a maximum limit
   *
   * @param {Object} params - Search parameters
   * @param {string} params.query - Search query
   * @param {string} params.location - Location string
   * @param {number} params.maxResults - Maximum results to fetch (default: 100)
   * @param {string} params.hl - Language (default: 'pt')
   * @returns {Promise<Object>} - All results combined
   */
  async searchGoogleMapsComplete(params) {
    const { query, location, maxResults = 100, hl = 'pt' } = params;

    let allPlaces = [];
    let currentPage = 0;
    let hasMoreResults = true;

    console.log(`🔍 Starting complete search: max ${maxResults} results`);

    while (hasMoreResults && allPlaces.length < maxResults) {
      const start = currentPage * 20;

      const results = await this.searchGoogleMaps({
        query,
        location,
        start,
        hl
      });

      allPlaces = allPlaces.concat(results.places);

      // Check if we should continue
      if (results.total_results < 20 || !results.pagination.has_next_page) {
        hasMoreResults = false;
      }

      currentPage++;

      // Safety: max 25 pages (500 results)
      if (currentPage >= 25) {
        console.warn('⚠️  Reached maximum pagination limit (25 pages)');
        break;
      }

      // Small delay to avoid rate limiting
      if (hasMoreResults) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`✅ Complete search finished: ${allPlaces.length} total places found`);

    return {
      success: true,
      places: allPlaces.slice(0, maxResults),
      total_results: allPlaces.length,
      pages_fetched: currentPage,
      api_calls_made: currentPage,
      estimated_cost: currentPage * 0.00275  // $0.00275 per query
    };
  }

  /**
   * Normalize a place result from SerpApi to our contact schema
   *
   * @param {Object} place - Raw place object from SerpApi
   * @returns {Object} - Normalized contact data
   */
  normalizePlaceToContact(place) {
    return {
      // Google Maps identifiers
      place_id: place.place_id,
      data_cid: place.data_cid,
      google_maps_url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,

      // Basic information
      name: place.title,
      company: place.title,  // For businesses, name = company
      phone: place.phone || null,
      email: null,  // Google Maps doesn't typically provide emails
      website: place.website || null,

      // Address details
      address: place.address || null,
      location: place.address || null,  // Backwards compatibility
      // Note: city, state, country need to be parsed from address
      // or geocoded separately

      // Geographic coordinates
      latitude: place.gps_coordinates?.latitude || null,
      longitude: place.gps_coordinates?.longitude || null,

      // Business ratings
      rating: place.rating || null,
      review_count: place.reviews || 0,

      // Business classification
      business_category: place.type || null,
      business_types: place.types || null,
      price_level: place.price || null,

      // Business information (JSONB)
      opening_hours: place.operating_hours || null,
      service_options: place.service_options || null,
      photos: place.thumbnail ? [place.thumbnail] : null,

      // Additional data
      headline: place.description || null,
      about: place.description || null,

      // Metadata
      source: 'google_maps',
      verified: false,  // Would need additional verification
      permanently_closed: false  // Would need to check status

      // Note: custom_fields can store any additional data from SerpApi
    };
  }
}

// Export singleton instance
const serpApiClient = new SerpApiClient();

module.exports = serpApiClient;
