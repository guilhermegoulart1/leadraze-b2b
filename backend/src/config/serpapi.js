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
        },
        // Raw data for logging/debugging
        raw_serpapi_pagination: data.serpapi_pagination || null,
        raw_search_information: data.search_information || null
      };

      console.log(`✅ SerpApi success: ${results.total_results} places found (page ${results.pagination.current_page})`);

      // Log first place raw data for debugging
      if (results.places.length > 0) {
        console.log('\n📋 [SERPAPI DEBUG] First place RAW data:');
        console.log(JSON.stringify(results.places[0], null, 2));
        console.log('---');
      }

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
   * Parse address string to extract street, city, state, country, postal_code
   * Brazilian format: "R. Example, 123 - Bairro, Cidade - RS, 12345-678, Brazil"
   * @param {string} address - Full address string
   * @returns {Object} - { street_address, city, state, country, postal_code }
   */
  parseAddress(address) {
    if (!address) return { street_address: null, city: null, state: null, country: null, postal_code: null };

    const result = { street_address: null, city: null, state: null, country: null, postal_code: null };

    // Common country names at the end
    const countryPatterns = [
      'Brazil', 'Brasil', 'United States', 'USA', 'Argentina', 'Chile',
      'Portugal', 'Spain', 'México', 'Mexico', 'Colombia', 'Peru'
    ];

    // Brazilian state abbreviations
    const brStates = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
      'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO',
      'RR', 'SC', 'SP', 'SE', 'TO'];

    // Extract CEP (Brazilian postal code): 12345-678 or 12345678
    const cepMatch = address.match(/(\d{5}-?\d{3})/);
    if (cepMatch) {
      result.postal_code = cepMatch[1];
    }

    // Split by comma and clean
    const parts = address.split(',').map(p => p.trim());

    // Check last part for country
    const lastPart = parts[parts.length - 1];
    for (const country of countryPatterns) {
      if (lastPart && lastPart.toLowerCase().includes(country.toLowerCase())) {
        result.country = country;
        parts.pop();
        break;
      }
    }

    // Extract street address (first part usually contains street + number)
    if (parts.length > 0) {
      const streetPart = parts[0];
      // Check if it's actually a street address (starts with R., Rua, Av., Avenida, etc.)
      if (streetPart.match(/^(R\.|Rua|Av\.|Avenida|Alameda|Al\.|Estrada|Est\.|Travessa|Tv\.|Praça|Pç\.|Rod\.|Rodovia)/i) ||
          streetPart.match(/^\d+/) || // Starts with number
          streetPart.match(/,\s*\d+/) // Contains number after comma
      ) {
        // Include number if on first or second part
        if (parts.length > 1 && parts[1].match(/^\d+/)) {
          result.street_address = `${streetPart}, ${parts[1]}`;
        } else {
          result.street_address = streetPart;
        }
      }
    }

    // Look for state abbreviation (typically after city with dash)
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      // Match patterns like "Cidade - RS" or "RS" or "12345-678" (CEP)
      const stateMatch = part.match(/[-\s]([A-Z]{2})(?:\s|$|,)/);
      if (stateMatch && brStates.includes(stateMatch[1])) {
        result.state = stateMatch[1];
        // The city is usually before the state
        const cityPart = part.split('-')[0].trim();
        if (cityPart && !cityPart.match(/^\d+$/)) {
          result.city = cityPart;
        }
        break;
      }
      // Also check for standalone state code
      if (brStates.includes(part.toUpperCase())) {
        result.state = part.toUpperCase();
        if (i > 0) {
          result.city = parts[i - 1].split('-')[0].trim();
        }
        break;
      }
    }

    // If no city found, try to get from second-to-last non-state/country part
    if (!result.city && parts.length >= 2) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const part = parts[i].split('-')[0].trim();
        if (part && !part.match(/^\d/) && part.length > 2 && part !== result.street_address) {
          result.city = part;
          break;
        }
      }
    }

    // Default country to Brazil if state was found
    if (result.state && !result.country) {
      result.country = 'Brazil';
    }

    return result;
  }

  /**
   * Clean website URL - extract real URL from Google redirect
   * Google sometimes returns URLs like: /url?q=https://real-site.com/&opi=...
   * @param {string} url - Raw URL that may contain Google redirect
   * @returns {string|null} - Clean URL or null
   */
  _cleanWebsiteUrl(url) {
    if (!url) return null;

    // Check if it's a Google redirect URL
    if (url.includes('/url?q=') || url.includes('?q=http')) {
      try {
        // Extract the 'q' parameter which contains the real URL
        const match = url.match(/[?&]q=([^&]+)/);
        if (match && match[1]) {
          const decodedUrl = decodeURIComponent(match[1]);
          // Make sure it's a valid URL
          if (decodedUrl.startsWith('http')) {
            console.log(`   🔗 Cleaned Google redirect: ${url.substring(0, 50)}... → ${decodedUrl}`);
            return decodedUrl;
          }
        }
      } catch (e) {
        console.log(`   ⚠️ Failed to clean URL: ${e.message}`);
      }
    }

    // If it's a relative URL starting with /url, it's invalid
    if (url.startsWith('/url')) {
      console.log(`   ⚠️ Invalid relative URL, skipping: ${url.substring(0, 50)}...`);
      return null;
    }

    // Return as-is if it's already a clean URL
    return url;
  }

  /**
   * Normalize a place result from SerpApi to our contact schema
   *
   * @param {Object} place - Raw place object from SerpApi
   * @returns {Object} - Normalized contact data
   */
  normalizePlaceToContact(place) {
    // Parse address to extract city/state/country
    const addressParts = this.parseAddress(place.address);

    // Clean website URL (extract from Google redirect if needed)
    const cleanedWebsite = this._cleanWebsiteUrl(place.website);

    // Debug log for field mapping
    console.log(`\n🔄 [NORMALIZE] ${place.title}:`);
    console.log(`   - rating: ${place.rating} (type: ${typeof place.rating})`);
    console.log(`   - reviews: ${place.reviews} (type: ${typeof place.reviews})`);
    console.log(`   - type: ${place.type}`);
    console.log(`   - types: ${JSON.stringify(place.types)}`);
    console.log(`   - address: ${place.address}`);
    console.log(`   - phone: ${place.phone}`);
    console.log(`   - website (raw): ${place.website}`);
    console.log(`   - website (clean): ${cleanedWebsite}`);
    console.log(`   - gps_coordinates: ${JSON.stringify(place.gps_coordinates)}`);
    console.log(`   - parsed address: ${JSON.stringify(addressParts)}`);

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
      website: cleanedWebsite,

      // Address details (full and structured)
      address: place.address || null,
      location: place.address || null,  // Backwards compatibility
      street_address: addressParts.street_address,
      city: addressParts.city,
      state: addressParts.state,
      country: addressParts.country || 'Brazil',  // Default for most searches
      postal_code: addressParts.postal_code,

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
      // Collect all available photos (thumbnail + any additional images)
      photos: this._collectPhotos(place),

      // Additional data
      headline: place.description || null,
      about: place.description || null,

      // Metadata
      source: 'google_maps',
      verified: false,  // Would need additional verification
      permanently_closed: false  // Would need to check status
    };
  }

  /**
   * Collect all available photos from a SerpAPI place result
   * @param {Object} place - Raw place object from SerpAPI
   * @returns {Array<string>|null} - Array of photo URLs or null
   */
  _collectPhotos(place) {
    const photos = [];

    // Add thumbnail if available
    if (place.thumbnail) {
      photos.push(place.thumbnail);
    }

    // Add photos array if available (SerpAPI may return this)
    if (Array.isArray(place.photos)) {
      place.photos.forEach(photo => {
        // Handle both string URLs and objects with image property
        const url = typeof photo === 'string' ? photo : (photo.image || photo.src || photo.url);
        if (url && !photos.includes(url)) {
          photos.push(url);
        }
      });
    }

    // Add images array if available
    if (Array.isArray(place.images)) {
      place.images.forEach(img => {
        const url = typeof img === 'string' ? img : (img.image || img.src || img.url);
        if (url && !photos.includes(url)) {
          photos.push(url);
        }
      });
    }

    // Return null if no photos found
    return photos.length > 0 ? photos : null;
  }
}

// Export singleton instance
const serpApiClient = new SerpApiClient();

module.exports = serpApiClient;
