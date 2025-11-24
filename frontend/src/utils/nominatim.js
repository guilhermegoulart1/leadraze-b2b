// frontend/src/utils/nominatim.js
// Free geocoding service using OpenStreetMap Nominatim API

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

// Required headers for Nominatim
const HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'LeadRaze-B2B/1.0' // Required by Nominatim usage policy
};

/**
 * Search for a location by query string
 * @param {string} query - Search query (e.g., "New York, USA")
 * @param {number} limit - Maximum results to return (default: 5)
 * @returns {Promise<Array>} Array of location results
 */
export const searchLocation = async (query, limit = 5) => {
  if (!query || query.trim().length < 2) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: limit.toString(),
      addressdetails: '1'
    });

    const response = await fetch(
      `${NOMINATIM_BASE_URL}/search?${params}`,
      { headers: HEADERS }
    );

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const results = await response.json();

    return results.map(result => ({
      display_name: result.display_name,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      city: result.address?.city || result.address?.town || result.address?.village,
      state: result.address?.state,
      country: result.address?.country,
      country_code: result.address?.country_code?.toUpperCase(),
      type: result.type,
      importance: result.importance
    }));

  } catch (error) {
    console.error('Nominatim search error:', error);
    return [];
  }
};

/**
 * Reverse geocode coordinates to get location name
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object|null>} Location data or null
 */
export const reverseGeocode = async (lat, lng) => {
  if (!lat || !lng || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lng.toString(),
      format: 'json',
      addressdetails: '1'
    });

    const response = await fetch(
      `${NOMINATIM_BASE_URL}/reverse?${params}`,
      { headers: HEADERS }
    );

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const result = await response.json();

    if (!result || result.error) {
      return null;
    }

    return {
      display_name: result.display_name,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      city: result.address?.city || result.address?.town || result.address?.village,
      state: result.address?.state,
      country: result.address?.country,
      country_code: result.address?.country_code?.toUpperCase(),
      formatted: formatAddress(result.address)
    };

  } catch (error) {
    console.error('Nominatim reverse geocode error:', error);
    return null;
  }
};

/**
 * Get user's approximate location using IP geolocation
 * Uses ipapi.co (free tier: 1000 requests/day)
 * @returns {Promise<Object|null>} Location data or null
 */
export const getIPLocation = async () => {
  try {
    const response = await fetch('https://ipapi.co/json/');

    if (!response.ok) {
      throw new Error(`IP API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.reason || 'IP geolocation failed');
    }

    return {
      lat: data.latitude,
      lng: data.longitude,
      city: data.city,
      state: data.region,
      country: data.country_name,
      country_code: data.country_code,
      display_name: `${data.city}, ${data.region}, ${data.country_name}`
    };

  } catch (error) {
    console.error('IP geolocation error:', error);
    // Fallback to world map center
    return {
      lat: 20,
      lng: 0,
      display_name: 'World',
      city: null,
      state: null,
      country: null,
      country_code: null
    };
  }
};

/**
 * Format address object to readable string
 * @param {Object} address - Nominatim address object
 * @returns {string} Formatted address
 */
const formatAddress = (address) => {
  if (!address) return '';

  const parts = [];

  if (address.city || address.town || address.village) {
    parts.push(address.city || address.town || address.village);
  }

  if (address.state) {
    parts.push(address.state);
  }

  if (address.country) {
    parts.push(address.country);
  }

  return parts.join(', ');
};

/**
 * Debounce function for search input
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait = 500) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};
