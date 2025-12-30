// backend/src/controllers/companyController.js
const db = require('../config/database');
const unipileClient = require('../config/unipile');
const { sendSuccess, sendError } = require('../utils/responses');
const {
  NotFoundError,
  ValidationError,
  UnipileError,
  ForbiddenError
} = require('../utils/errors');

// ================================
// 1. OBTER DETALHES DA EMPRESA
// ================================
const getCompanyDetails = async (req, res) => {
  try {
    const { identifier } = req.params;
    const { linkedin_account_id } = req.query;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log('🏢 === BUSCAR DETALHES DA EMPRESA ===');
    console.log('🔍 Identifier:', identifier);
    console.log('🔐 LinkedIn Account ID:', linkedin_account_id);

    if (!identifier || !linkedin_account_id) {
      throw new ValidationError('identifier and linkedin_account_id are required');
    }

    // Verificar se a conta LinkedIn pertence ao usuário
    const accountQuery = await db.query(
      'SELECT * FROM linkedin_accounts WHERE id = $1 AND user_id = $2 AND account_id = $3',
      [linkedin_account_id, userId, accountId]
    );

    if (accountQuery.rows.length === 0) {
      throw new ForbiddenError('LinkedIn account not found or access denied');
    }

    const account = accountQuery.rows[0];

    if (!unipileClient.isInitialized()) {
      throw new UnipileError(`Unipile client error: ${unipileClient.getError()}`);
    }

    console.log('📡 Buscando detalhes da empresa na Unipile...');

    // Buscar detalhes da empresa via Unipile
    const companyDetails = await unipileClient.company.getOne({
      account_id: account.unipile_account_id,
      identifier: identifier
    });

    console.log('✅ Detalhes da empresa recebidos');
    console.log('📊 DETALHES:', JSON.stringify(companyDetails, null, 2));

    // Processar e normalizar os dados
    const processedCompany = {
      id: companyDetails.id || companyDetails.company_id || identifier,
      name: companyDetails.name || companyDetails.company_name || 'Empresa',
      industry: companyDetails.industry || companyDetails.industries || null,
      location: companyDetails.location || companyDetails.headquarters || null,
      employee_count: companyDetails.employee_count || companyDetails.employees || companyDetails.staff_count || null,
      follower_count: companyDetails.follower_count || companyDetails.followers || null,
      job_count: companyDetails.job_count || companyDetails.open_jobs || null,
      website: companyDetails.website || companyDetails.url || null,
      summary: companyDetails.summary || companyDetails.description || companyDetails.about || null,
      specialties: companyDetails.specialties || companyDetails.specializations || null,
      founded_year: companyDetails.founded_year || companyDetails.founded || companyDetails.year_founded || null,
      company_type: companyDetails.company_type || companyDetails.type || null,
      affiliated_companies: companyDetails.affiliated_companies || null,
      logo: companyDetails.logo || companyDetails.logo_url || companyDetails.profile_picture || null,
      cover_image: companyDetails.cover_image || companyDetails.background_image || null,
      linkedin_url: companyDetails.linkedin_url || companyDetails.url || companyDetails.profile_url || null,
      tagline: companyDetails.tagline || null,
      phone: companyDetails.phone || null,
      // Dados brutos para debug
      raw_data: companyDetails
    };

    sendSuccess(res, {
      data: processedCompany
    }, 'Company details retrieved successfully');

  } catch (error) {
    console.error('❌ Erro ao buscar detalhes da empresa:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 2. BUSCAR EMPRESAS
// ================================
const searchCompanies = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { linkedin_account_id, keywords, location, limit = 25, cursor } = req.body;

    console.log('🏢 === BUSCAR EMPRESAS ===');
    console.log('🔍 Keywords:', keywords);

    if (!linkedin_account_id) {
      throw new ValidationError('linkedin_account_id is required');
    }

    // Verificar conta
    const accountQuery = await db.query(
      'SELECT * FROM linkedin_accounts WHERE id = $1 AND user_id = $2 AND account_id = $3',
      [linkedin_account_id, userId, accountId]
    );

    if (accountQuery.rows.length === 0) {
      throw new ForbiddenError('LinkedIn account not found');
    }

    const account = accountQuery.rows[0];

    // Buscar empresas via Unipile
    const searchResult = await unipileClient.company.search({
      account_id: account.unipile_account_id,
      keywords: keywords || '',
      location: location || null,
      limit: parseInt(limit),
      cursor: cursor || null
    });

    const companies = searchResult.items || [];

    const processedCompanies = companies.map(company => ({
      id: company.id || company.company_id,
      name: company.name || company.company_name || 'Empresa',
      industry: company.industry || null,
      location: company.location || company.headquarters || null,
      employee_count: company.employee_count || company.employees || null,
      logo: company.logo || company.logo_url || null,
      linkedin_url: company.linkedin_url || company.url || null
    }));

    sendSuccess(res, {
      data: processedCompanies,
      pagination: {
        cursor: searchResult.cursor || null,
        has_more: !!searchResult.cursor
      }
    }, 'Companies retrieved successfully');

  } catch (error) {
    console.error('❌ Erro ao buscar empresas:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 3. OBTER POSTS DA EMPRESA
// ================================
const getCompanyPosts = async (req, res) => {
  try {
    const { identifier } = req.params;
    const { linkedin_account_id, limit = 10, cursor } = req.query;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log('🏢 === BUSCAR POSTS DA EMPRESA ===');

    if (!identifier || !linkedin_account_id) {
      throw new ValidationError('identifier and linkedin_account_id are required');
    }

    // Verificar conta
    const accountQuery = await db.query(
      'SELECT * FROM linkedin_accounts WHERE id = $1 AND user_id = $2 AND account_id = $3',
      [linkedin_account_id, userId, accountId]
    );

    if (accountQuery.rows.length === 0) {
      throw new ForbiddenError('LinkedIn account not found');
    }

    const account = accountQuery.rows[0];

    // Buscar posts da empresa
    const postsResult = await unipileClient.company.getPosts({
      account_id: account.unipile_account_id,
      company_id: identifier,
      limit: parseInt(limit),
      cursor: cursor || null
    });

    const posts = postsResult.items || [];

    sendSuccess(res, {
      data: posts,
      pagination: {
        cursor: postsResult.cursor || null,
        has_more: !!postsResult.cursor
      }
    }, 'Company posts retrieved successfully');

  } catch (error) {
    console.error('❌ Erro ao buscar posts da empresa:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 4. OBTER FUNCIONÁRIOS DA EMPRESA
// ================================
const getCompanyEmployees = async (req, res) => {
  try {
    const { identifier } = req.params;
    const { linkedin_account_id, limit = 25, cursor } = req.query;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log('🏢 === BUSCAR FUNCIONÁRIOS DA EMPRESA ===');

    if (!identifier || !linkedin_account_id) {
      throw new ValidationError('identifier and linkedin_account_id are required');
    }

    // Verificar conta
    const accountQuery = await db.query(
      'SELECT * FROM linkedin_accounts WHERE id = $1 AND user_id = $2 AND account_id = $3',
      [linkedin_account_id, userId, accountId]
    );

    if (accountQuery.rows.length === 0) {
      throw new ForbiddenError('LinkedIn account not found');
    }

    const account = accountQuery.rows[0];

    // Buscar funcionários da empresa
    const employeesResult = await unipileClient.company.getEmployees({
      account_id: account.unipile_account_id,
      company_id: identifier,
      limit: parseInt(limit),
      cursor: cursor || null
    });

    const employees = employeesResult.items || [];

    sendSuccess(res, {
      data: employees,
      pagination: {
        cursor: employeesResult.cursor || null,
        has_more: !!employeesResult.cursor
      }
    }, 'Company employees retrieved successfully');

  } catch (error) {
    console.error('❌ Erro ao buscar funcionários da empresa:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  getCompanyDetails,
  searchCompanies,
  getCompanyPosts,
  getCompanyEmployees
};
