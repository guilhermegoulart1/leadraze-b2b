/**
 * Exa.ai Service - Semantic Search
 *
 * AI-powered search engine with semantic understanding
 * Perfect for: "who knows X", "companies like Y", relationship mapping
 *
 * @see https://exa.ai/
 *
 * Features:
 * - Neural/semantic search (understands intent)
 * - Find similar content
 * - Highlight relevant passages
 * - Domain filtering
 */

const axios = require('axios');
const { Pool } = require('pg');

// Cache TTL: 24 hours
const CACHE_TTL_SECONDS = 24 * 60 * 60;

class ExaService {
  constructor() {
    this.apiKey = process.env.EXA_API_KEY;
    this.baseUrl = 'https://api.exa.ai';
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'leadraze',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  /**
   * Check if API key is configured
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Generate cache key
   */
  getCacheKey(method, query, options = {}) {
    const normalized = JSON.stringify({ method, query, ...options });
    return `exa:${Buffer.from(normalized).toString('base64').substring(0, 100)}`;
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
        console.log(`[Exa] Cache hit`);
        return result.rows[0].response_data;
      }
      return null;
    } catch (error) {
      console.error('[Exa] Cache read error:', error.message);
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
        [cacheKey, 'exa', data, expiresAt]
      );
    } catch (error) {
      console.error('[Exa] Cache write error:', error.message);
    }
  }

  /**
   * Make API request
   */
  async request(endpoint, data) {
    if (!this.isConfigured()) {
      throw new Error('Exa API key not configured. Set EXA_API_KEY environment variable.');
    }

    try {
      const response = await axios.post(`${this.baseUrl}${endpoint}`, data, {
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Exa API key');
      }
      if (error.response?.status === 429) {
        throw new Error('Exa rate limit exceeded');
      }
      throw new Error(`Exa API error: ${error.message}`);
    }
  }

  /**
   * Semantic search - understands intent, not just keywords
   *
   * @param {string} query - Natural language query
   * @param {Object} options - Search options
   * @returns {Object} Search results
   */
  async search(query, options = {}) {
    const {
      numResults = 10,
      type = 'neural', // 'neural' for semantic, 'keyword' for traditional
      includeDomains = [],
      excludeDomains = [],
      startPublishedDate = null,
      endPublishedDate = null,
      useAutoprompt = true, // AI improves your query
      category = null, // 'company', 'research_paper', 'news', 'linkedin', 'twitter', 'github', 'personal_site'
      contents = {
        text: { maxCharacters: 1000, includeHtmlTags: false },
        highlights: { numSentences: 3, highlightsPerUrl: 2 }
      }
    } = options;

    const cacheKey = this.getCacheKey('search', query, options);
    const cached = await this.getCached(cacheKey);
    if (cached) return cached;

    console.log(`[Exa] Searching: "${query}"`);

    const searchParams = {
      query,
      numResults,
      type,
      useAutoprompt,
      contents
    };

    if (includeDomains.length > 0) searchParams.includeDomains = includeDomains;
    if (excludeDomains.length > 0) searchParams.excludeDomains = excludeDomains;
    if (startPublishedDate) searchParams.startPublishedDate = startPublishedDate;
    if (endPublishedDate) searchParams.endPublishedDate = endPublishedDate;
    if (category) searchParams.category = category;

    const result = await this.request('/search', searchParams);

    // Normalize results
    const normalized = {
      query,
      results: (result.results || []).map(r => ({
        url: r.url,
        title: r.title,
        text: r.text,
        highlights: r.highlights || [],
        publishedDate: r.publishedDate,
        author: r.author,
        score: r.score
      })),
      autopromptString: result.autopromptString,
      _source: 'exa',
      _fetchedAt: new Date().toISOString()
    };

    await this.setCache(cacheKey, normalized);
    return normalized;
  }

  /**
   * Find similar content to a URL
   *
   * @param {string} url - Reference URL
   * @param {Object} options - Search options
   * @returns {Object} Similar results
   */
  async findSimilar(url, options = {}) {
    const {
      numResults = 10,
      includeDomains = [],
      excludeDomains = [],
      excludeSourceDomain = true,
      category = null,
      contents = {
        text: { maxCharacters: 1000, includeHtmlTags: false },
        highlights: { numSentences: 3, highlightsPerUrl: 2 }
      }
    } = options;

    const cacheKey = this.getCacheKey('findSimilar', url, options);
    const cached = await this.getCached(cacheKey);
    if (cached) return cached;

    console.log(`[Exa] Finding similar to: ${url}`);

    const searchParams = {
      url,
      numResults,
      excludeSourceDomain,
      contents
    };

    if (includeDomains.length > 0) searchParams.includeDomains = includeDomains;
    if (excludeDomains.length > 0) searchParams.excludeDomains = excludeDomains;
    if (category) searchParams.category = category;

    const result = await this.request('/findSimilar', searchParams);

    const normalized = {
      sourceUrl: url,
      results: (result.results || []).map(r => ({
        url: r.url,
        title: r.title,
        text: r.text,
        highlights: r.highlights || [],
        publishedDate: r.publishedDate,
        author: r.author,
        score: r.score
      })),
      _source: 'exa',
      _fetchedAt: new Date().toISOString()
    };

    await this.setCache(cacheKey, normalized);
    return normalized;
  }

  /**
   * Get content from URLs
   *
   * @param {string[]} urls - URLs to fetch content from
   * @returns {Object} Content from URLs
   */
  async getContents(urls) {
    if (!Array.isArray(urls) || urls.length === 0) {
      throw new Error('URLs must be a non-empty array');
    }

    console.log(`[Exa] Getting content from ${urls.length} URLs`);

    const result = await this.request('/contents', {
      urls,
      text: { maxCharacters: 2000, includeHtmlTags: false },
      highlights: { numSentences: 5, highlightsPerUrl: 3 }
    });

    return {
      contents: (result.results || []).map(r => ({
        url: r.url,
        title: r.title,
        text: r.text,
        highlights: r.highlights || [],
        publishedDate: r.publishedDate,
        author: r.author
      })),
      _source: 'exa',
      _fetchedAt: new Date().toISOString()
    };
  }

  // ============================================
  // High-level methods for Secret Agent
  // ============================================

  /**
   * Find people who can connect you to a target person
   *
   * @param {string} targetPerson - Name of person to connect with
   * @param {Object} context - Additional context
   * @returns {Object} Potential connections
   */
  async findPeopleConnections(targetPerson, context = {}) {
    const queries = [
      `people who have worked with ${targetPerson}`,
      `${targetPerson} business partners and investors`,
      `${targetPerson} interviews and collaborations`,
      `events and conferences featuring ${targetPerson}`
    ];

    const results = [];
    for (const query of queries.slice(0, 3)) { // Limit to 3 queries for cost
      try {
        const searchResult = await this.search(query, {
          numResults: 5,
          category: 'linkedin',
          useAutoprompt: true
        });
        results.push(...searchResult.results);
      } catch (error) {
        console.error(`[Exa] Error in connection search: ${error.message}`);
      }
    }

    return {
      targetPerson,
      potentialConnections: results,
      queriesUsed: queries.slice(0, 3),
      _source: 'exa',
      _fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Find decision makers at a company
   *
   * @param {string} company - Company name
   * @param {string} role - Role/department to target
   * @returns {Object} Decision makers
   */
  async findDecisionMakers(company, role = null) {
    const roleQuery = role ? ` ${role}` : ' leadership executives';
    const query = `${company}${roleQuery} LinkedIn profile`;

    const result = await this.search(query, {
      numResults: 10,
      includeDomains: ['linkedin.com'],
      useAutoprompt: true
    });

    return {
      company,
      role,
      decisionMakers: result.results.map(r => ({
        url: r.url,
        name: this.extractNameFromTitle(r.title),
        title: r.title,
        highlights: r.highlights
      })),
      _source: 'exa',
      _fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Find companies similar to a reference company
   *
   * @param {string} companyName - Reference company
   * @param {string} companyUrl - Company website URL
   * @returns {Object} Similar companies
   */
  async findSimilarCompanies(companyName, companyUrl = null) {
    if (companyUrl) {
      return this.findSimilar(companyUrl, {
        numResults: 10,
        category: 'company',
        excludeSourceDomain: true
      });
    }

    const query = `companies similar to ${companyName} competitors alternatives`;
    return this.search(query, {
      numResults: 10,
      category: 'company',
      useAutoprompt: true
    });
  }

  /**
   * Research a person's profile and history
   *
   * @param {string} personName - Person's name
   * @param {string} company - Current/known company (optional)
   * @returns {Object} Person profile data
   */
  async researchPerson(personName, company = null) {
    const companyContext = company ? ` ${company}` : '';
    const queries = [
      `"${personName}"${companyContext} LinkedIn profile career`,
      `"${personName}" interviews podcast speaker`,
      `"${personName}" articles publications author`
    ];

    const allResults = [];
    for (const query of queries) {
      try {
        const result = await this.search(query, {
          numResults: 5,
          useAutoprompt: true
        });
        allResults.push({
          type: query.includes('LinkedIn') ? 'linkedin' : query.includes('interview') ? 'media' : 'publications',
          results: result.results
        });
      } catch (error) {
        console.error(`[Exa] Research error: ${error.message}`);
      }
    }

    return {
      personName,
      company,
      profiles: allResults,
      _source: 'exa',
      _fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Extract name from LinkedIn title
   */
  extractNameFromTitle(title) {
    // LinkedIn titles are like "John Smith - CEO at Company | LinkedIn"
    const match = title?.match(/^([^-|]+)/);
    return match ? match[1].trim() : title;
  }
}

// Singleton instance
const exaService = new ExaService();

module.exports = exaService;
