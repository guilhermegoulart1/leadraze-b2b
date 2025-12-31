/**
 * OpenCorporates Service - Global Company Data
 *
 * Largest open database of companies in the world
 * Free tier: 50 requests/day
 *
 * @see https://api.opencorporates.com/
 *
 * Features:
 * - Company search worldwide
 * - Officers and directors
 * - Subsidiary information
 * - Corporate filings
 */

const axios = require('axios');
const { Pool } = require('pg');

// Cache TTL: 7 days (corporate data doesn't change often)
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

// Rate limiting for free tier
const DAILY_LIMIT = 50;
let dailyRequestCount = 0;
let lastResetDate = new Date().toDateString();

class OpenCorporatesService {
  constructor() {
    this.apiKey = process.env.OPENCORPORATES_API_KEY; // Optional for more requests
    this.baseUrl = 'https://api.opencorporates.com/v0.4';
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'getraze',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  /**
   * Check and reset daily counter if needed
   */
  checkDailyLimit() {
    const today = new Date().toDateString();
    if (today !== lastResetDate) {
      dailyRequestCount = 0;
      lastResetDate = today;
    }

    if (dailyRequestCount >= DAILY_LIMIT) {
      throw new Error('OpenCorporates daily limit reached (50 requests). Try again tomorrow.');
    }
  }

  /**
   * Generate cache key
   */
  getCacheKey(method, params) {
    const normalized = JSON.stringify({ method, ...params });
    return `opencorp:${Buffer.from(normalized).toString('base64').substring(0, 100)}`;
  }

  /**
   * Check cache
   */
  async getCached(cacheKey) {
    try {
      const result = await this.pool.query(
        `SELECT response_data, expires_at
         FROM secret_agent_cache
         WHERE cache_key = $1 AND expires_at > NOW()`,
        [cacheKey]
      );

      if (result.rows.length > 0) {
        console.log(`[OpenCorporates] Cache hit`);
        return result.rows[0].response_data;
      }
      return null;
    } catch (error) {
      console.error('[OpenCorporates] Cache read error:', error.message);
      return null;
    }
  }

  /**
   * Save to cache
   */
  async setCache(cacheKey, data) {
    try {
      const expiresAt = new Date(Date.now() + CACHE_TTL_SECONDS * 1000);
      await this.pool.query(
        `INSERT INTO secret_agent_cache (cache_key, source, response_data, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (cache_key) DO UPDATE SET
           response_data = EXCLUDED.response_data,
           expires_at = EXCLUDED.expires_at`,
        [cacheKey, 'opencorporates', data, expiresAt]
      );
    } catch (error) {
      console.error('[OpenCorporates] Cache write error:', error.message);
    }
  }

  /**
   * Make API request
   */
  async request(endpoint, params = {}) {
    this.checkDailyLimit();

    const url = new URL(`${this.baseUrl}${endpoint}`);

    // Add API key if available
    if (this.apiKey) {
      params.api_token = this.apiKey;
    }

    // Add params to URL
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });

    try {
      dailyRequestCount++;
      console.log(`[OpenCorporates] Request ${dailyRequestCount}/${DAILY_LIMIT}: ${endpoint}`);

      const response = await axios.get(url.toString(), {
        timeout: 30000,
        headers: {
          'Accept': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Invalid OpenCorporates API key');
      }
      if (error.response?.status === 403) {
        throw new Error('OpenCorporates access denied - check API key');
      }
      if (error.response?.status === 429) {
        throw new Error('OpenCorporates rate limit exceeded');
      }
      if (error.response?.status === 404) {
        return null; // Company not found
      }
      throw new Error(`OpenCorporates API error: ${error.message}`);
    }
  }

  /**
   * Search for companies by name
   *
   * @param {string} query - Company name
   * @param {Object} options - Search options
   * @returns {Object} Search results
   */
  async searchCompanies(query, options = {}) {
    const {
      jurisdictionCode = null, // e.g., 'us_de', 'gb', 'br'
      countryCode = null, // e.g., 'us', 'gb', 'br'
      currentStatus = null, // 'Active', 'Inactive'
      perPage = 10,
      page = 1
    } = options;

    const cacheKey = this.getCacheKey('searchCompanies', { query, ...options });
    const cached = await this.getCached(cacheKey);
    if (cached) return cached;

    const params = {
      q: query,
      per_page: perPage,
      page
    };

    if (jurisdictionCode) params.jurisdiction_code = jurisdictionCode;
    if (countryCode) params.country_code = countryCode;
    if (currentStatus) params.current_status = currentStatus;

    const result = await this.request('/companies/search', params);

    if (!result) {
      return { companies: [], total: 0 };
    }

    const normalized = {
      query,
      companies: (result.results?.companies || []).map(c => this.normalizeCompany(c.company)),
      totalCount: result.results?.total_count || 0,
      totalPages: result.results?.total_pages || 0,
      currentPage: result.results?.page || 1,
      _source: 'opencorporates',
      _fetchedAt: new Date().toISOString()
    };

    await this.setCache(cacheKey, normalized);
    return normalized;
  }

  /**
   * Get company details by jurisdiction and company number
   *
   * @param {string} jurisdictionCode - e.g., 'us_de', 'gb'
   * @param {string} companyNumber - Company registration number
   * @returns {Object} Company details
   */
  async getCompany(jurisdictionCode, companyNumber) {
    const cacheKey = this.getCacheKey('getCompany', { jurisdictionCode, companyNumber });
    const cached = await this.getCached(cacheKey);
    if (cached) return cached;

    const result = await this.request(`/companies/${jurisdictionCode}/${companyNumber}`);

    if (!result?.results?.company) {
      return null;
    }

    const normalized = this.normalizeCompany(result.results.company);
    await this.setCache(cacheKey, normalized);
    return normalized;
  }

  /**
   * Get officers (directors, etc.) of a company
   *
   * @param {string} jurisdictionCode - e.g., 'us_de', 'gb'
   * @param {string} companyNumber - Company registration number
   * @returns {Object} Officers list
   */
  async getOfficers(jurisdictionCode, companyNumber) {
    const cacheKey = this.getCacheKey('getOfficers', { jurisdictionCode, companyNumber });
    const cached = await this.getCached(cacheKey);
    if (cached) return cached;

    const result = await this.request(`/companies/${jurisdictionCode}/${companyNumber}/officers`);

    if (!result) {
      return { officers: [] };
    }

    const normalized = {
      jurisdictionCode,
      companyNumber,
      officers: (result.results?.officers || []).map(o => ({
        id: o.officer?.id,
        name: o.officer?.name,
        position: o.officer?.position,
        startDate: o.officer?.start_date,
        endDate: o.officer?.end_date,
        occupation: o.officer?.occupation,
        nationality: o.officer?.nationality,
        uid: o.officer?.uid
      })),
      _source: 'opencorporates',
      _fetchedAt: new Date().toISOString()
    };

    await this.setCache(cacheKey, normalized);
    return normalized;
  }

  /**
   * Search for officers by name
   *
   * @param {string} name - Officer name
   * @param {Object} options - Search options
   * @returns {Object} Officer search results
   */
  async searchOfficers(name, options = {}) {
    const {
      jurisdictionCode = null,
      position = null,
      perPage = 10
    } = options;

    const cacheKey = this.getCacheKey('searchOfficers', { name, ...options });
    const cached = await this.getCached(cacheKey);
    if (cached) return cached;

    const params = {
      q: name,
      per_page: perPage
    };

    if (jurisdictionCode) params.jurisdiction_code = jurisdictionCode;
    if (position) params.position = position;

    const result = await this.request('/officers/search', params);

    if (!result) {
      return { officers: [], total: 0 };
    }

    const normalized = {
      query: name,
      officers: (result.results?.officers || []).map(o => ({
        id: o.officer?.id,
        name: o.officer?.name,
        position: o.officer?.position,
        companyName: o.officer?.company?.name,
        companyJurisdiction: o.officer?.company?.jurisdiction_code,
        companyNumber: o.officer?.company?.company_number,
        startDate: o.officer?.start_date,
        endDate: o.officer?.end_date
      })),
      totalCount: result.results?.total_count || 0,
      _source: 'opencorporates',
      _fetchedAt: new Date().toISOString()
    };

    await this.setCache(cacheKey, normalized);
    return normalized;
  }

  /**
   * Normalize company data to standard format
   */
  normalizeCompany(raw) {
    return {
      name: raw.name,
      companyNumber: raw.company_number,
      jurisdictionCode: raw.jurisdiction_code,
      incorporationDate: raw.incorporation_date,
      dissolutionDate: raw.dissolution_date,
      companyType: raw.company_type,
      currentStatus: raw.current_status,

      // Address
      registeredAddress: raw.registered_address_in_full,
      registeredAddressDetails: raw.registered_address ? {
        streetAddress: raw.registered_address.street_address,
        locality: raw.registered_address.locality,
        region: raw.registered_address.region,
        postalCode: raw.registered_address.postal_code,
        country: raw.registered_address.country
      } : null,

      // Additional data
      industryCode: raw.industry_code_uids,
      previousNames: (raw.previous_names || []).map(n => ({
        name: n.company_name,
        startDate: n.con_date
      })),

      // Source info
      sourceUrl: raw.source?.url,
      sourcePublisher: raw.source?.publisher,
      retrievedAt: raw.retrieved_at,
      registryUrl: raw.registry_url,
      opencorporatesUrl: raw.opencorporates_url,

      // Metadata
      _source: 'opencorporates',
      _fetchedAt: new Date().toISOString()
    };
  }

  // ============================================
  // High-level methods for Secret Agent
  // ============================================

  /**
   * Get comprehensive company profile
   *
   * @param {string} companyName - Company name
   * @param {string} country - Country code (optional)
   * @returns {Object} Company profile with officers
   */
  async getCompanyProfile(companyName, country = null) {
    // First search for the company
    const searchResult = await this.searchCompanies(companyName, {
      countryCode: country,
      currentStatus: 'Active',
      perPage: 5
    });

    if (searchResult.companies.length === 0) {
      return {
        companyName,
        found: false,
        message: 'Company not found in OpenCorporates database'
      };
    }

    const company = searchResult.companies[0];

    // Get officers if we have jurisdiction and company number
    let officers = { officers: [] };
    if (company.jurisdictionCode && company.companyNumber) {
      try {
        officers = await this.getOfficers(company.jurisdictionCode, company.companyNumber);
      } catch (error) {
        console.error('[OpenCorporates] Error fetching officers:', error.message);
      }
    }

    return {
      companyName,
      found: true,
      company,
      officers: officers.officers,
      alternativeMatches: searchResult.companies.slice(1),
      _source: 'opencorporates',
      _fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Find all companies associated with a person
   *
   * @param {string} personName - Person's name
   * @param {string} country - Country code (optional)
   * @returns {Object} Companies associated with person
   */
  async getPersonCompanies(personName, country = null) {
    const searchResult = await this.searchOfficers(personName, {
      jurisdictionCode: country,
      perPage: 20
    });

    // Group by company
    const companies = {};
    for (const officer of searchResult.officers) {
      const key = `${officer.companyJurisdiction}:${officer.companyNumber}`;
      if (!companies[key]) {
        companies[key] = {
          companyName: officer.companyName,
          jurisdiction: officer.companyJurisdiction,
          companyNumber: officer.companyNumber,
          roles: []
        };
      }
      companies[key].roles.push({
        position: officer.position,
        startDate: officer.startDate,
        endDate: officer.endDate
      });
    }

    return {
      personName,
      companies: Object.values(companies),
      totalRoles: searchResult.officers.length,
      _source: 'opencorporates',
      _fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Get remaining daily requests
   */
  getRemainingRequests() {
    const today = new Date().toDateString();
    if (today !== lastResetDate) {
      return DAILY_LIMIT;
    }
    return Math.max(0, DAILY_LIMIT - dailyRequestCount);
  }
}

// Singleton instance
const openCorporatesService = new OpenCorporatesService();

module.exports = openCorporatesService;
