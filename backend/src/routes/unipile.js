// backend/src/routes/unipile.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');

// Aplicar autenticação em todas as rotas
router.use(authenticateToken);

// ================================
// 🧪 ROTA DE DEBUG - TESTAR CREDENCIAIS
// ================================
router.get('/debug/credentials', async (req, res) => {
  console.log('🧪 [DEBUG] Verificando credenciais Unipile...');
  
  const dsn = process.env.UNIPILE_DSN;
  const apiKey = process.env.UNIPILE_API_KEY;
  const accessToken = process.env.UNIPILE_ACCESS_TOKEN;
  const token = apiKey || accessToken;
  
  res.json({
    success: true,
    debug: {
      dsn_exists: !!dsn,
      dsn_value: dsn || 'MISSING',
      api_key_exists: !!apiKey,
      access_token_exists: !!accessToken,
      token_being_used: token ? token.substring(0, 15) + '...' : 'MISSING',
      token_length: token ? token.length : 0
    }
  });
});

// Helper para buscar conta LinkedIn
async function getLinkedInAccountByUUID(account_id, userId) {
  const result = await db.query(
    'SELECT * FROM linkedin_accounts WHERE id = $1 AND user_id = $2',
    [account_id, userId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Conta LinkedIn não encontrada');
  }
  
  return result.rows[0];
}

// Helper para fazer request na Unipile
async function makeUnipileRequest(endpoint, params) {
  const dsn = process.env.UNIPILE_DSN;
  const token = process.env.UNIPILE_API_KEY || process.env.UNIPILE_ACCESS_TOKEN;
  
  if (!dsn) {
    console.error('❌ UNIPILE_DSN não configurado no .env');
    throw new Error('UNIPILE_DSN não configurado');
  }
  
  if (!token) {
    console.error('❌ UNIPILE_ACCESS_TOKEN ou UNIPILE_API_KEY não configurado no .env');
    throw new Error('Token Unipile não configurado');
  }
  
  const url = `https://${dsn}${endpoint}`;
  
  console.log('🔑 Usando DSN:', dsn);
  console.log('🔑 Token (primeiros 15 chars):', token.substring(0, 15) + '...');
  console.log('🌐 URL completa:', url);
  console.log('📦 Params:', params);
  
  try {
    const response = await axios({
      method: 'GET',
      url,
      headers: {
        'X-API-KEY': token,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      params,
      timeout: 15000
    });
    
    console.log('✅ Resposta Unipile recebida:', response.status);
    return response.data;
    
  } catch (error) {
    console.error('❌ Erro Unipile completo:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
}

// ================================
// 📍 BUSCA DE LOCALIZAÇÕES
// ================================

router.get('/locations', async (req, res) => {
  const { query, account_id, limit = 20 } = req.query;
  const userId = req.user.id;

  console.log('📍 [/unipile/locations] Iniciando busca:', { 
    query, 
    account_id, 
    limit,
    user_id: userId
  });

  if (!query || query.trim().length < 2) {
    console.log('🚫 Query muito curta:', query);
    return res.json({ 
      success: true, 
      data: [],
      message: 'Digite pelo menos 2 caracteres'
    });
  }

  if (!account_id) {
    return res.status(400).json({ 
      success: false,
      message: 'Parâmetro account_id é obrigatório'
    });
  }

  try {
    const linkedinAccount = await getLinkedInAccountByUUID(account_id, userId);

    if (!linkedinAccount.unipile_account_id) {
      return res.status(400).json({
        success: false,
        message: 'Conta LinkedIn não tem unipile_account_id configurado'
      });
    }

    const unipileParams = {
      account_id: linkedinAccount.unipile_account_id,
      type: 'LOCATION',
      keywords: query.trim(),
      limit: Math.min(parseInt(limit), 50)
    };

    console.log('🔍 Buscando com unipile_account_id:', linkedinAccount.unipile_account_id);

    const unipileResponse = await makeUnipileRequest(
      '/api/v1/linkedin/search/parameters',
      unipileParams
    );

    const locations = unipileResponse.items || unipileResponse.data || [];

    // Processar localizações para formato { value, label, country }
    const processedLocations = locations.map(location => {
      const label = location.name || location.title || location.label || location.displayName || 'Localização sem nome';

      // Extrair país do nome se não vier separado
      // Exemplo: "São Paulo, São Paulo, Brazil" -> country = "Brazil"
      let country = location.country || location.countryCode || null;

      if (!country && label.includes(',')) {
        const parts = label.split(',');
        // Último elemento geralmente é o país
        country = parts[parts.length - 1].trim();
      }

      return {
        value: location.id || location.value || location.urn_id || `${location.name}_${Date.now()}`,
        label,
        country,
        state: location.state || location.region || null
      };
    });

    console.log(`✅ Processadas ${processedLocations.length} localizações`);

    res.json({
      success: true,
      data: processedLocations
    });

  } catch (error) {
    console.error('❌ Erro na busca de localizações:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar localizações',
      error: error.message
    });
  }
});

// ================================
// 🏭 BUSCA DE SETORES/INDÚSTRIAS
// ================================

router.get('/industries', async (req, res) => {
  const { query, account_id, limit = 20 } = req.query;
  const userId = req.user.id;

  console.log('🏭 [/unipile/industries] Iniciando busca:', { query, account_id });

  if (!query || query.trim().length < 2) {
    return res.json({ 
      success: true, 
      data: [],
      message: 'Digite pelo menos 2 caracteres'
    });
  }

  if (!account_id) {
    return res.status(400).json({ 
      success: false,
      message: 'Parâmetro account_id é obrigatório'
    });
  }

  try {
    const linkedinAccount = await getLinkedInAccountByUUID(account_id, userId);

    const unipileParams = {
      account_id: linkedinAccount.unipile_account_id,
      type: 'INDUSTRY',
      keywords: query.trim(),
      limit: Math.min(parseInt(limit), 50)
    };

    const unipileResponse = await makeUnipileRequest(
      '/api/v1/linkedin/search/parameters',
      unipileParams
    );

    const industries = unipileResponse.items || unipileResponse.data || [];
    
    const processedIndustries = industries
      .map(industry => {
        if (typeof industry === 'string') return industry;
        return industry.name || industry.title || industry.label || industry.displayName;
      })
      .filter(industry => industry && typeof industry === 'string')
      .slice(0, parseInt(limit));

    console.log(`✅ Processados ${processedIndustries.length} setores`);

    res.json({
      success: true,
      data: processedIndustries
    });

  } catch (error) {
    console.error('❌ Erro na busca de setores:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar setores',
      error: error.message
    });
  }
});

// ================================
// 💼 BUSCA DE CARGOS/TÍTULOS
// ================================

router.get('/job-titles', async (req, res) => {
  const { query, account_id, limit = 20 } = req.query;
  const userId = req.user.id;

  console.log('💼 [/unipile/job-titles] Iniciando busca:', { query, account_id });

  if (!query || query.trim().length < 2) {
    return res.json({ 
      success: true, 
      data: [],
      message: 'Digite pelo menos 2 caracteres'
    });
  }

  if (!account_id) {
    return res.status(400).json({ 
      success: false,
      message: 'Parâmetro account_id é obrigatório'
    });
  }

  try {
    const linkedinAccount = await getLinkedInAccountByUUID(account_id, userId);

    const unipileParams = {
      account_id: linkedinAccount.unipile_account_id,
      type: 'JOB_TITLE',
      keywords: query.trim(),
      limit: Math.min(parseInt(limit), 50)
    };

    const unipileResponse = await makeUnipileRequest(
      '/api/v1/linkedin/search/parameters',
      unipileParams
    );

    const jobTitles = unipileResponse.items || unipileResponse.data || [];
    
    const processedJobTitles = jobTitles
      .map(title => {
        if (typeof title === 'string') return title;
        return title.name || title.title || title.label || title.displayName;
      })
      .filter(title => title && typeof title === 'string')
      .slice(0, parseInt(limit));

    console.log(`✅ Processados ${processedJobTitles.length} cargos`);

    res.json({
      success: true,
      data: processedJobTitles
    });

  } catch (error) {
    console.error('❌ Erro na busca de cargos:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar cargos',
      error: error.message
    });
  }
});

// ================================
// 🏢 BUSCA DE EMPRESAS
// ================================

router.get('/companies', async (req, res) => {
  const { query, account_id, limit = 20 } = req.query;
  const userId = req.user.id;

  console.log('🏢 [/unipile/companies] Iniciando busca:', { query, account_id });

  if (!query || query.trim().length < 2) {
    return res.json({ 
      success: true, 
      data: [],
      message: 'Digite pelo menos 2 caracteres'
    });
  }

  if (!account_id) {
    return res.status(400).json({ 
      success: false,
      message: 'Parâmetro account_id é obrigatório'
    });
  }

  try {
    const linkedinAccount = await getLinkedInAccountByUUID(account_id, userId);

    const unipileParams = {
      account_id: linkedinAccount.unipile_account_id,
      type: 'COMPANY',
      keywords: query.trim(),
      limit: Math.min(parseInt(limit), 50)
    };

    const unipileResponse = await makeUnipileRequest(
      '/api/v1/linkedin/search/parameters',
      unipileParams
    );

    const companies = unipileResponse.items || unipileResponse.data || [];
    
    const processedCompanies = companies
      .map(company => {
        if (typeof company === 'string') return company;
        return company.name || company.title || company.label || company.displayName;
      })
      .filter(company => company && typeof company === 'string')
      .slice(0, parseInt(limit));

    console.log(`✅ Processadas ${processedCompanies.length} empresas`);

    res.json({
      success: true,
      data: processedCompanies
    });

  } catch (error) {
    console.error('❌ Erro na busca de empresas:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar empresas',
      error: error.message
    });
  }
});

module.exports = router;