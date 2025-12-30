// backend/src/routes/unipile.js
// Refatorado para usar Relay (@guilhermegoulart1/relay-core)
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');
const unipileClient = require('../config/unipile');

// Aplicar autenticação em todas as rotas
router.use(authenticateToken);

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

    console.log('🔍 Buscando com unipile_account_id:', linkedinAccount.unipile_account_id);

    const unipileResponse = await unipileClient.searchParams.locations({
      account_id: linkedinAccount.unipile_account_id,
      keywords: query.trim(),
      limit: Math.min(parseInt(limit), 50)
    });

    const locations = unipileResponse.items || unipileResponse.data || [];

    // Processar localizações para formato { value, label, country }
    const processedLocations = locations.map(location => {
      const label = location.name || location.title || location.label || location.displayName || 'Localização sem nome';

      // Extrair país do nome se não vier separado
      let country = location.country || location.countryCode || null;

      if (!country && label.includes(',')) {
        const parts = label.split(',');
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

    const unipileResponse = await unipileClient.searchParams.industries({
      account_id: linkedinAccount.unipile_account_id,
      keywords: query.trim(),
      limit: Math.min(parseInt(limit), 50)
    });

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

    const unipileResponse = await unipileClient.searchParams.jobTitles({
      account_id: linkedinAccount.unipile_account_id,
      keywords: query.trim(),
      limit: Math.min(parseInt(limit), 50)
    });

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

    const unipileResponse = await unipileClient.searchParams.companies({
      account_id: linkedinAccount.unipile_account_id,
      keywords: query.trim(),
      limit: Math.min(parseInt(limit), 50)
    });

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

// ================================
// 🎯 BUSCA DE SKILLS
// ================================

router.get('/skills', async (req, res) => {
  const { query, account_id, limit = 20 } = req.query;
  const userId = req.user.id;

  console.log('🎯 [/unipile/skills] Iniciando busca:', { query, account_id });

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

    const unipileResponse = await unipileClient.searchParams.skills({
      account_id: linkedinAccount.unipile_account_id,
      keywords: query.trim(),
      limit: Math.min(parseInt(limit), 50)
    });

    const skills = unipileResponse.items || unipileResponse.data || [];

    const processedSkills = skills
      .map(skill => {
        if (typeof skill === 'string') return { value: skill, label: skill };
        return {
          value: skill.id || skill.name || skill.title,
          label: skill.name || skill.title || skill.label || skill.displayName
        };
      })
      .filter(skill => skill.label && typeof skill.label === 'string')
      .slice(0, parseInt(limit));

    console.log(`✅ Processadas ${processedSkills.length} skills`);

    res.json({
      success: true,
      data: processedSkills
    });

  } catch (error) {
    console.error('❌ Erro na busca de skills:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erro ao buscar skills',
      error: error.message
    });
  }
});

// ================================
// 🎓 BUSCA DE ESCOLAS/UNIVERSIDADES
// ================================

router.get('/schools', async (req, res) => {
  const { query, account_id, limit = 20 } = req.query;
  const userId = req.user.id;

  console.log('🎓 [/unipile/schools] Iniciando busca:', { query, account_id });

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

    const unipileResponse = await unipileClient.searchParams.schools({
      account_id: linkedinAccount.unipile_account_id,
      keywords: query.trim(),
      limit: Math.min(parseInt(limit), 50)
    });

    const schools = unipileResponse.items || unipileResponse.data || [];

    const processedSchools = schools
      .map(school => {
        if (typeof school === 'string') return { value: school, label: school };
        return {
          value: school.id || school.name || school.title,
          label: school.name || school.title || school.label || school.displayName
        };
      })
      .filter(school => school.label && typeof school.label === 'string')
      .slice(0, parseInt(limit));

    console.log(`✅ Processadas ${processedSchools.length} escolas/universidades`);

    res.json({
      success: true,
      data: processedSchools
    });

  } catch (error) {
    console.error('❌ Erro na busca de escolas:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erro ao buscar escolas',
      error: error.message
    });
  }
});

// ================================
// 🏢 PERFIL DE EMPRESA
// ================================

router.get('/company/:identifier', async (req, res) => {
  const { identifier } = req.params;
  const { account_id } = req.query;
  const userId = req.user.id;

  console.log('🏢 [/unipile/company] Buscando empresa:', { identifier, account_id });

  if (!account_id) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetro account_id é obrigatório'
    });
  }

  try {
    const linkedinAccount = await getLinkedInAccountByUUID(account_id, userId);

    const companyData = await unipileClient.company.getOne({
      account_id: linkedinAccount.unipile_account_id,
      identifier
    });

    console.log('✅ Dados da empresa obtidos:', companyData?.name || identifier);

    res.json({
      success: true,
      data: companyData
    });

  } catch (error) {
    console.error('❌ Erro ao buscar empresa:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erro ao buscar empresa',
      error: error.message
    });
  }
});

// ================================
// 📝 BUSCA DE POSTS
// ================================

router.post('/posts/search', async (req, res) => {
  const { account_id, keywords, date_posted, content_type, author, limit = 25, cursor } = req.body;
  const userId = req.user.id;

  console.log('📝 [/unipile/posts/search] Buscando posts:', { keywords, account_id });

  if (!account_id) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetro account_id é obrigatório'
    });
  }

  try {
    const linkedinAccount = await getLinkedInAccountByUUID(account_id, userId);

    const postsData = await unipileClient.posts.search({
      account_id: linkedinAccount.unipile_account_id,
      keywords,
      date_posted,
      content_type,
      author,
      limit: Math.min(parseInt(limit), 50),
      cursor
    });

    const posts = postsData.items || postsData.data || [];

    console.log(`✅ Encontrados ${posts.length} posts`);

    res.json({
      success: true,
      data: posts,
      cursor: postsData.cursor || postsData.paging?.cursor,
      total: postsData.paging?.total_count || posts.length
    });

  } catch (error) {
    console.error('❌ Erro na busca de posts:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erro ao buscar posts',
      error: error.message
    });
  }
});

module.exports = router;
