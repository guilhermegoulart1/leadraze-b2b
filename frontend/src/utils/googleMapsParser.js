// frontend/src/utils/googleMapsParser.js
// Parse Google Maps URLs to extract location and coordinates

/**
 * Parse a Google Maps URL and extract location data
 *
 * Supports formats:
 * - https://www.google.com/maps/place/Campinas,+SP/@-22.8920329,-47.2327031,11z/...
 * - https://www.google.com/maps/@-22.9099384,-47.0626332,15z
 * - https://maps.google.com/?q=New+York,NY
 *
 * @param {string} url - Google Maps URL
 * @returns {Object|null} { location, lat, lng } or null if invalid
 */
export const parseGoogleMapsUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const urlObj = new URL(url);

    // Check if it's a Google Maps URL
    if (!urlObj.hostname.includes('google.com')) {
      return null;
    }

    let location = null;
    let lat = null;
    let lng = null;

    // Extract location from /place/ path
    // Example: /place/Campinas,+SP/@-22.8920329,-47.2327031
    const placeMatch = url.match(/\/place\/([^/@]+)/);
    if (placeMatch) {
      location = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
    }

    // Extract coordinates from @ parameter
    // Format: @latitude,longitude,zoom
    const coordsMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordsMatch) {
      lat = parseFloat(coordsMatch[1]);
      lng = parseFloat(coordsMatch[2]);
    }

    // Extract from ?q= query parameter
    // Example: ?q=New+York,NY
    const qParam = urlObj.searchParams.get('q');
    if (qParam && !location) {
      location = qParam.replace(/\+/g, ' ');

      // Check if q parameter contains coordinates
      const qCoords = qParam.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
      if (qCoords) {
        lat = parseFloat(qCoords[1]);
        lng = parseFloat(qCoords[2]);
      }
    }

    // Extract from /data= parameter (alternative format)
    const dataMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (dataMatch && !lat) {
      lat = parseFloat(dataMatch[1]);
      lng = parseFloat(dataMatch[2]);
    }

    // Validate coordinates
    if (lat !== null && lng !== null) {
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        lat = null;
        lng = null;
      }
    }

    // Return null if we couldn't extract anything useful
    if (!location && lat === null && lng === null) {
      return null;
    }

    return {
      location: location || `${lat}, ${lng}`,
      lat,
      lng
    };

  } catch (error) {
    console.error('Error parsing Google Maps URL:', error);
    return null;
  }
};

/**
 * Validate if a string is a Google Maps URL
 * @param {string} url - URL to validate
 * @returns {boolean}
 */
export const isGoogleMapsUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('google.com') &&
           (urlObj.pathname.includes('/maps') || urlObj.search.includes('q='));
  } catch {
    return false;
  }
};

/**
 * Format location string for display
 * @param {Object} parsed - Parsed location data
 * @returns {string} Formatted string
 */
export const formatLocationDisplay = (parsed) => {
  if (!parsed) return '';

  if (parsed.location && parsed.lat && parsed.lng) {
    return `${parsed.location} (${parsed.lat.toFixed(4)}, ${parsed.lng.toFixed(4)})`;
  }

  if (parsed.location) {
    return parsed.location;
  }

  if (parsed.lat && parsed.lng) {
    return `${parsed.lat.toFixed(4)}, ${parsed.lng.toFixed(4)}`;
  }

  return '';
};
