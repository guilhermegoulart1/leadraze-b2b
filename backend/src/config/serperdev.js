// backend/src/config/serperdev.js
// Serper.dev client for Google Search - used for Instagram profile discovery

const axios = require('axios');

const SERPERDEV_API_KEY = process.env.SERPERDEV_API_KEY;
const SERPERDEV_BASE_URL = 'https://google.serper.dev/search';

/**
 * Serper.dev Client for Google Search
 *
 * Used to find Instagram profiles via Google: site:instagram.com "niche" "location"
 * Returns ~10 organic results per page
 * Pagination: page parameter (1-based)
 */
class SerperDevClient {
  constructor() {
    if (!SERPERDEV_API_KEY) {
      console.warn('⚠️  SERPERDEV_API_KEY not found in environment variables');
      this.initialized = false;
    } else {
      this.initialized = true;
      console.log('✅ Serper.dev client initialized');
    }
  }

  isInitialized() {
    return this.initialized;
  }

  /**
   * Search Google for Instagram profiles by niche and location
   *
   * @param {Object} params
   * @param {string} params.niche - Business niche (e.g., "dentista", "personal trainer")
   * @param {string} params.location - City/state (e.g., "São Paulo - SP")
   * @param {number} params.page - Page number (1-based)
   * @param {number} params.num - Results per page (default 10, max 100)
   * @returns {Promise<Object>} - { profiles: [...], hasMore: boolean }
   */
  async searchInstagramProfiles(params) {
    if (!this.initialized) {
      throw new Error('Serper.dev client not initialized. Check SERPERDEV_API_KEY environment variable.');
    }

    const { niche, location, page = 1, num = 10 } = params;

    if (!niche) {
      throw new Error('Niche is required for Instagram search');
    }

    if (!location) {
      throw new Error('Location is required for Instagram search');
    }

    try {
      const query = `site:instagram.com "${niche}" "${location}"`;

      const response = await axios.post(SERPERDEV_BASE_URL, {
        q: query,
        gl: 'br',
        hl: 'pt-br',
        num: num,
        page: page
      }, {
        headers: {
          'X-API-KEY': SERPERDEV_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      const organic = response.data.organic || [];
      const profiles = this._parseOrganicToProfiles(organic, page);

      return {
        profiles,
        hasMore: organic.length >= num,
        rawResultCount: organic.length
      };

    } catch (error) {
      if (error.response?.status === 429) {
        throw new Error('Serper.dev rate limit exceeded. Try again later.');
      }
      if (error.response?.status === 401) {
        throw new Error('Serper.dev API key is invalid.');
      }
      console.error('❌ Serper.dev search error:', error.message);
      throw new Error(`Google search failed: ${error.message}`);
    }
  }

  /**
   * Parse Google organic results into structured Instagram profiles
   */
  _parseOrganicToProfiles(organicResults, page) {
    return organicResults
      .map((result, index) => {
        const username = this._extractUsername(result.link);
        if (!username) return null;

        const displayName = this._extractDisplayName(result.title || '');

        return {
          username,
          display_name: displayName,
          profile_url: result.link,
          bio_excerpt: result.snippet || '',
          search_page: page,
          position: index + 1,
          found_at: new Date().toISOString()
        };
      })
      .filter(Boolean);
  }

  /**
   * Extract Instagram username from URL
   * Valid: https://www.instagram.com/dra.maria/
   * Invalid: /p/, /reel/, /stories/, /explore/, /accounts/
   */
  _extractUsername(url) {
    if (!url || !url.includes('instagram.com')) return null;

    const match = url.match(/instagram\.com\/([a-zA-Z0-9._]+)\/?$/);
    if (!match) return null;

    const username = match[1];
    const invalidPaths = ['p', 'reel', 'reels', 'stories', 'explore', 'tv', 'accounts', 'directory', 'about', 'legal', 'developer', 'static'];
    if (invalidPaths.includes(username.toLowerCase())) return null;

    return username;
  }

  /**
   * Extract display name from Google title
   * "Dra. Maria (@dra.maria) - Instagram" -> "Dra. Maria"
   * "Dra. Maria - Instagram photos and videos" -> "Dra. Maria"
   */
  _extractDisplayName(title) {
    // Remove "(@username)" part
    let name = title.replace(/\s*\(@[^)]+\)/g, '');
    // Remove " - Instagram..." suffix
    name = name.replace(/\s*[-|•]\s*Instagram.*$/i, '');
    // Remove "Instagram" if it's the whole thing
    name = name.replace(/^Instagram\s*[-|•]\s*/i, '');
    return name.trim() || title.trim();
  }
}

// Singleton export
const serperDevClient = new SerperDevClient();
module.exports = serperDevClient;
