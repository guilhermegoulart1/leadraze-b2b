/**
 * CNPJ Service - ReceitaWS Integration
 *
 * Free API for Brazilian company data (CNPJ lookup)
 * Rate limit: 3 requests per minute (free tier)
 *
 * @see https://receitaws.com.br/
 */

const axios = require('axios');
const { Pool } = require('pg');

// Rate limiting
const RATE_LIMIT = 3; // requests per minute
const RATE_WINDOW = 60000; // 1 minute
let requestQueue = [];
let lastRequestTime = 0;

// Cache TTL: 7 days (company data doesn't change often)
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

class CnpjService {
  constructor() {
    this.baseUrl = 'https://receitaws.com.br/v1/cnpj';
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
   * Clean CNPJ string (remove dots, slashes, dashes)
   */
  cleanCnpj(cnpj) {
    return cnpj.replace(/[^\d]/g, '');
  }

  /**
   * Validate CNPJ format
   */
  isValidCnpj(cnpj) {
    const cleaned = this.cleanCnpj(cnpj);
    return cleaned.length === 14 && /^\d+$/.test(cleaned);
  }

  /**
   * Check cache for existing data
   */
  async getCached(cnpj) {
    try {
      const cacheKey = `cnpj:${this.cleanCnpj(cnpj)}`;
      const result = await this.pool.query(
        `SELECT response_data, expires_at
         FROM secret_agent_cache
         WHERE cache_key = $1 AND expires_at > NOW()`,
        [cacheKey]
      );

      if (result.rows.length > 0) {
        console.log(`[CNPJ] Cache hit for ${cnpj}`);
        return result.rows[0].response_data;
      }
      return null;
    } catch (error) {
      console.error('[CNPJ] Cache read error:', error.message);
      return null;
    }
  }

  /**
   * Save to cache
   */
  async setCache(cnpj, data) {
    try {
      const cacheKey = `cnpj:${this.cleanCnpj(cnpj)}`;
      const expiresAt = new Date(Date.now() + CACHE_TTL_SECONDS * 1000);

      await this.pool.query(
        `INSERT INTO secret_agent_cache (cache_key, source, response_data, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (cache_key) DO UPDATE SET
           response_data = EXCLUDED.response_data,
           expires_at = EXCLUDED.expires_at`,
        [cacheKey, 'receitaws', data, expiresAt]
      );
    } catch (error) {
      console.error('[CNPJ] Cache write error:', error.message);
    }
  }

  /**
   * Rate limiter - waits if necessary
   */
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    const minInterval = RATE_WINDOW / RATE_LIMIT; // ~20 seconds between requests

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      console.log(`[CNPJ] Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    lastRequestTime = Date.now();
  }

  /**
   * Fetch CNPJ data from ReceitaWS
   * @param {string} cnpj - CNPJ number (with or without formatting)
   * @returns {Object} Company data
   */
  async lookup(cnpj) {
    if (!this.isValidCnpj(cnpj)) {
      throw new Error('Invalid CNPJ format');
    }

    const cleanedCnpj = this.cleanCnpj(cnpj);

    // Check cache first
    const cached = await this.getCached(cleanedCnpj);
    if (cached) {
      return cached;
    }

    // Wait for rate limit
    await this.waitForRateLimit();

    try {
      console.log(`[CNPJ] Fetching data for ${cleanedCnpj}`);

      const response = await axios.get(`${this.baseUrl}/${cleanedCnpj}`, {
        timeout: 30000,
        headers: {
          'User-Agent': 'GetRaze/1.0 (https://getraze.co)',
          'Accept': 'application/json'
        }
      });

      const data = response.data;

      // Check for API error
      if (data.status === 'ERROR') {
        throw new Error(data.message || 'CNPJ not found');
      }

      // Transform to normalized format
      const normalized = this.normalizeData(data);

      // Cache the result
      await this.setCache(cleanedCnpj, normalized);

      return normalized;

    } catch (error) {
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in 1 minute.');
      }
      if (error.response?.status === 404) {
        throw new Error('CNPJ not found in database.');
      }
      throw new Error(`CNPJ lookup failed: ${error.message}`);
    }
  }

  /**
   * Normalize ReceitaWS data to standard format
   */
  normalizeData(raw) {
    return {
      cnpj: raw.cnpj,
      razaoSocial: raw.nome,
      nomeFantasia: raw.fantasia || null,
      situacao: raw.situacao,
      dataSituacao: raw.data_situacao,
      motivoSituacao: raw.motivo_situacao,

      // Address
      endereco: {
        logradouro: raw.logradouro,
        numero: raw.numero,
        complemento: raw.complemento,
        bairro: raw.bairro,
        cep: raw.cep,
        municipio: raw.municipio,
        uf: raw.uf
      },

      // Contact
      contato: {
        telefone: raw.telefone,
        email: raw.email
      },

      // Classification
      atividadePrincipal: raw.atividade_principal?.[0] || null,
      atividadesSecundarias: raw.atividades_secundarias || [],
      naturezaJuridica: raw.natureza_juridica,

      // Financial
      capitalSocial: raw.capital_social ? parseFloat(raw.capital_social) : null,
      porte: raw.porte,

      // Partners/Shareholders
      qsa: (raw.qsa || []).map(partner => ({
        nome: partner.nome,
        qualificacao: partner.qual,
        paisOrigem: partner.pais_origem,
        nomeRepresentante: partner.nome_rep_legal,
        qualificacaoRepresentante: partner.qual_rep_legal
      })),

      // Dates
      dataAbertura: raw.abertura,
      ultimaAtualizacao: raw.ultima_atualizacao,

      // Additional
      tipo: raw.tipo,
      efr: raw.efr,
      situacaoEspecial: raw.situacao_especial,
      dataSituacaoEspecial: raw.data_situacao_especial,

      // Metadata
      _source: 'receitaws',
      _fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Format capital social for display
   */
  formatCapitalSocial(value) {
    if (!value) return 'Não informado';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  /**
   * Get company summary for agent report
   */
  getSummary(data) {
    const partners = data.qsa?.length || 0;
    const activities = data.atividadesSecundarias?.length || 0;

    return {
      title: data.nomeFantasia || data.razaoSocial,
      status: data.situacao,
      location: `${data.endereco.municipio}/${data.endereco.uf}`,
      capitalSocial: this.formatCapitalSocial(data.capitalSocial),
      porte: data.porte,
      partnersCount: partners,
      activitiesCount: activities + 1,
      dataAbertura: data.dataAbertura,
      mainActivity: data.atividadePrincipal?.text || 'Não informado'
    };
  }
}

// Singleton instance
const cnpjService = new CnpjService();

module.exports = cnpjService;
