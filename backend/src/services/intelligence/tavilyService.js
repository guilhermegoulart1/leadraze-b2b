/**
 * Tavily Service - Factual/RAG-Optimized Search
 *
 * Search API optimized for LLM applications and RAG
 * Perfect for: news, facts verification, current data
 *
 * @see https://tavily.com/
 *
 * Features:
 * - RAG-ready responses
 * - Automatic content extraction
 * - Topic filtering
 * - News search
 */

const axios = require('axios');
const { Pool } = require('pg');

// Cache TTL: 6 hours for news, 24 hours for general
const CACHE_TTL_NEWS = 6 * 60 * 60;
const CACHE_TTL_GENERAL = 24 * 60 * 60;

class TavilyService {
  constructor() {
    this.apiKey = process.env.TAVILY_API_KEY;
    this.baseUrl = 'https://api.tavily.com';
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
    return `tavily:${Buffer.from(normalized).toString('base64').substring(0, 100)}`;
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
        console.log(`[Tavily] Cache hit`);
        return result.rows[0].response_data;
      }
      return null;
    } catch (error) {
      console.error('[Tavily] Cache read error:', error.message);
      return null;
    }
  }

  /**
   * Save to cache
   */
  async setCache(cacheKey, data, ttl) {
    try {
      const expiresAt = new Date(Date.now() + ttl * 1000);
      await this.pool.query(
        `INSERT INTO secret_agent_cache (cache_key, source, response_data, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (cache_key) DO UPDATE SET
           response_data = EXCLUDED.response_data,
           expires_at = EXCLUDED.expires_at`,
        [cacheKey, 'tavily', data, expiresAt]
      );
    } catch (error) {
      console.error('[Tavily] Cache write error:', error.message);
    }
  }

  /**
   * Make API request
   */
  async request(endpoint, data) {
    if (!this.isConfigured()) {
      throw new Error('Tavily API key not configured. Set TAVILY_API_KEY environment variable.');
    }

    try {
      const response = await axios.post(`${this.baseUrl}${endpoint}`, {
        api_key: this.apiKey,
        ...data
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Tavily API key');
      }
      if (error.response?.status === 429) {
        throw new Error('Tavily rate limit exceeded');
      }
      throw new Error(`Tavily API error: ${error.message}`);
    }
  }

  /**
   * General search with AI-extracted content
   *
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} Search results
   */
  async search(query, options = {}) {
    const {
      searchDepth = 'advanced', // 'basic' or 'advanced'
      topic = 'general', // 'general' or 'news'
      maxResults = 10,
      includeDomains = [],
      excludeDomains = [],
      includeAnswer = true, // AI-generated answer
      includeRawContent = false,
      includeImages = false,
      days = null // For news: limit to last N days
    } = options;

    const isNews = topic === 'news';
    const cacheKey = this.getCacheKey('search', query, options);
    const cached = await this.getCached(cacheKey);
    if (cached) return cached;

    console.log(`[Tavily] Searching: "${query}" (topic: ${topic})`);

    const searchParams = {
      query,
      search_depth: searchDepth,
      topic,
      max_results: maxResults,
      include_answer: includeAnswer,
      include_raw_content: includeRawContent,
      include_images: includeImages
    };

    if (includeDomains.length > 0) searchParams.include_domains = includeDomains;
    if (excludeDomains.length > 0) searchParams.exclude_domains = excludeDomains;
    if (days && isNews) searchParams.days = days;

    const result = await this.request('/search', searchParams);

    // Normalize results
    const normalized = {
      query,
      answer: result.answer || null,
      results: (result.results || []).map(r => ({
        url: r.url,
        title: r.title,
        content: r.content,
        rawContent: r.raw_content || null,
        score: r.score,
        publishedDate: r.published_date || null
      })),
      images: result.images || [],
      responseTime: result.response_time,
      _source: 'tavily',
      _fetchedAt: new Date().toISOString()
    };

    await this.setCache(cacheKey, normalized, isNews ? CACHE_TTL_NEWS : CACHE_TTL_GENERAL);
    return normalized;
  }

  /**
   * Search for recent news
   *
   * @param {string} query - Search query
   * @param {number} days - Limit to last N days (default: 30)
   * @returns {Object} News results
   */
  async searchNews(query, days = 30) {
    return this.search(query, {
      topic: 'news',
      maxResults: 10,
      days,
      includeAnswer: true
    });
  }

  /**
   * Deep research on a topic
   * Uses advanced search depth for comprehensive results
   *
   * @param {string} query - Research topic
   * @returns {Object} Research results with AI answer
   */
  async research(query) {
    return this.search(query, {
      searchDepth: 'advanced',
      topic: 'general',
      maxResults: 15,
      includeAnswer: true,
      includeRawContent: true
    });
  }

  // ============================================
  // High-level methods for Secret Agent
  // ============================================

  /**
   * Get recent news about a company
   *
   * @param {string} companyName - Company name
   * @param {number} days - Days to look back
   * @returns {Object} Company news
   */
  async getCompanyNews(companyName, days = 30) {
    const query = `${companyName} news announcements updates`;
    const result = await this.searchNews(query, days);

    return {
      companyName,
      newsCount: result.results.length,
      summary: result.answer,
      articles: result.results.map(r => ({
        title: r.title,
        url: r.url,
        content: r.content,
        publishedDate: r.publishedDate,
        relevanceScore: r.score
      })),
      _source: 'tavily',
      _fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Get market/industry analysis
   *
   * @param {string} industry - Industry/niche name
   * @returns {Object} Market analysis
   */
  async getMarketAnalysis(industry) {
    const queries = [
      `${industry} market size trends 2024`,
      `${industry} industry analysis forecast`,
      `${industry} competitive landscape players`
    ];

    const results = [];
    for (const query of queries) {
      try {
        const searchResult = await this.search(query, {
          searchDepth: 'advanced',
          maxResults: 5,
          includeAnswer: true
        });
        results.push({
          aspect: query.includes('size') ? 'market_size' :
                  query.includes('analysis') ? 'analysis' : 'competition',
          answer: searchResult.answer,
          sources: searchResult.results
        });
      } catch (error) {
        console.error(`[Tavily] Market analysis error: ${error.message}`);
      }
    }

    return {
      industry,
      aspects: results,
      _source: 'tavily',
      _fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Verify facts about a company
   *
   * @param {string} companyName - Company name
   * @param {string[]} claims - List of claims to verify
   * @returns {Object} Verification results
   */
  async verifyCompanyFacts(companyName, claims = []) {
    const baseQuery = `${companyName} company information facts`;
    const result = await this.research(baseQuery);

    const verifications = [];
    for (const claim of claims) {
      const claimResult = await this.search(`${companyName} ${claim}`, {
        searchDepth: 'basic',
        maxResults: 3,
        includeAnswer: true
      });
      verifications.push({
        claim,
        verified: !!claimResult.answer,
        evidence: claimResult.answer,
        sources: claimResult.results.map(r => r.url)
      });
    }

    return {
      companyName,
      generalInfo: result.answer,
      verifications,
      _source: 'tavily',
      _fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Get person's public profile and mentions
   *
   * @param {string} personName - Person's name
   * @param {string} context - Additional context (company, role)
   * @returns {Object} Person profile
   */
  async getPersonProfile(personName, context = '') {
    const query = `"${personName}" ${context} profile biography career`;
    const newsQuery = `"${personName}" ${context} news interviews`;

    const [profile, news] = await Promise.all([
      this.research(query),
      this.searchNews(newsQuery, 90)
    ]);

    return {
      personName,
      context,
      biography: profile.answer,
      sources: profile.results,
      recentMentions: news.results,
      _source: 'tavily',
      _fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Analyze company online reputation
   *
   * @param {string} companyName - Company name
   * @returns {Object} Reputation analysis
   */
  async analyzeReputation(companyName) {
    const positiveQuery = `${companyName} positive reviews awards achievements`;
    const negativeQuery = `${companyName} complaints problems issues controversy`;
    const neutralQuery = `${companyName} company overview description`;

    const [positive, negative, neutral] = await Promise.all([
      this.search(positiveQuery, { maxResults: 5 }),
      this.search(negativeQuery, { maxResults: 5 }),
      this.search(neutralQuery, { maxResults: 5 })
    ]);

    return {
      companyName,
      positive: {
        summary: positive.answer,
        sources: positive.results
      },
      negative: {
        summary: negative.answer,
        sources: negative.results
      },
      neutral: {
        summary: neutral.answer,
        sources: neutral.results
      },
      overallSentiment: this.calculateSentiment(positive, negative),
      _source: 'tavily',
      _fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Calculate simple sentiment score
   */
  calculateSentiment(positive, negative) {
    const posCount = positive.results?.length || 0;
    const negCount = negative.results?.length || 0;
    const total = posCount + negCount;

    if (total === 0) return 'unknown';
    const score = (posCount - negCount) / total;

    if (score > 0.3) return 'positive';
    if (score < -0.3) return 'negative';
    return 'neutral';
  }
}

// Singleton instance
const tavilyService = new TavilyService();

module.exports = tavilyService;
