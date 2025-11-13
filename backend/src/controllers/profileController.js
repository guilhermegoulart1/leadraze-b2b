// backend/src/controllers/profileController.js
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
// 1. CONECTAR CONTA LINKEDIN
// ================================
const connectLinkedInAccount = async (req, res) => {
  try {
    const { username, password } = req.body;
    const userId = req.user.id;

    console.log(`🔄 Conectando conta LinkedIn para usuário ${userId}`);

    if (!username || !password) {
      throw new ValidationError('Username and password are required');
    }

    if (!unipileClient.isInitialized()) {
      throw new UnipileError(`Unipile client error: ${unipileClient.getError()}`);
    }

    try {
      console.log('📡 Enviando credenciais para Unipile...');

      const response = await unipileClient.account.connectLinkedin({
        username: username,
        password: password
      });

      console.log('✅ Resposta da Unipile:', response);

      const accountId = response.account_id || response.id;

      if (!accountId) {
        throw new UnipileError('No account ID returned from Unipile');
      }

      console.log('🆔 Account ID recebido:', accountId);

      await new Promise(resolve => setTimeout(resolve, 3000));

      let profileData = null;
      try {
        console.log('👤 Buscando dados do perfil...');
        profileData = await unipileClient.users.getOwnProfile(accountId);
        console.log('✅ Perfil obtido:', profileData?.name || 'Nome não disponível');
      } catch (profileError) {
        console.warn('⚠️ Erro ao buscar perfil:', profileError.message);
      }

      const accountData = {
        user_id: userId,
        unipile_account_id: accountId,
        linkedin_username: username,
        profile_name: profileData?.name || username,
        profile_url: profileData?.url || null,
        profile_picture: profileData?.profile_picture || null,
        status: 'active',
        organizations: profileData?.organizations ? JSON.stringify(profileData.organizations) : null,
        premium_features: profileData?.premium_features ? JSON.stringify(profileData.premium_features) : null
      };

      const savedAccount = await db.insert('linkedin_accounts', accountData);

      const { unipile_account_id, ...accountResponse } = savedAccount;

      console.log('✅ Conta LinkedIn conectada com sucesso');

      sendSuccess(res, {
        ...accountResponse,
        profile_data: profileData
      }, 'LinkedIn account connected successfully', 201);

    } catch (unipileError) {
      console.error('❌ Erro na Unipile:', unipileError);

      let errorMessage = 'Failed to connect LinkedIn account';
      let statusCode = 500;

      if (unipileError.body) {
        const { type } = unipileError.body;

        switch (type) {
          case 'errors/invalid_credentials':
            errorMessage = 'Invalid LinkedIn credentials';
            statusCode = 401;
            break;
          case 'errors/multiple_sessions':
            errorMessage = 'LinkedIn account has multiple active sessions';
            statusCode = 409;
            break;
          case 'errors/checkpoint_error':
            errorMessage = 'LinkedIn requires additional verification';
            statusCode = 423;
            break;
          default:
            errorMessage = `LinkedIn connection failed: ${type || 'Unknown error'}`;
        }
      }

      throw new UnipileError(errorMessage, unipileError);
    }

  } catch (error) {
    console.error('💥 Erro geral:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 2. LISTAR CONTAS LINKEDIN
// ================================
const getLinkedInAccounts = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`📋 Listando contas LinkedIn do usuário ${userId}`);

    const accounts = await db.findMany('linkedin_accounts', { user_id: userId }, {
      orderBy: 'connected_at DESC'
    });

    console.log(`✅ Encontradas ${accounts.length} contas`);

    sendSuccess(res, accounts, 'LinkedIn accounts retrieved successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 3. OBTER CONTA ESPECÍFICA
// ================================
const getLinkedInAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`🔍 Buscando conta ${id}`);

    const account = await db.findOne('linkedin_accounts', { id, user_id: userId });

    if (!account) {
      throw new NotFoundError('LinkedIn account not found');
    }

    sendSuccess(res, account, 'LinkedIn account retrieved successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 4. ATUALIZAR CONTA
// ================================
const updateLinkedInAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { daily_limit, status } = req.body;

    console.log(`📝 Atualizando conta ${id}`);

    const account = await db.findOne('linkedin_accounts', { id, user_id: userId });

    if (!account) {
      throw new NotFoundError('LinkedIn account not found');
    }

    const updateData = {};
    if (daily_limit !== undefined) updateData.daily_limit = daily_limit;
    if (status !== undefined) updateData.status = status;

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No fields to update');
    }

    const updatedAccount = await db.update('linkedin_accounts', updateData, { id });

    console.log('✅ Conta atualizada');

    sendSuccess(res, updatedAccount, 'LinkedIn account updated successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 5. DELETAR CONTA
// ================================
const deleteLinkedInAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`🗑️ Deletando conta ${id}`);

    const account = await db.findOne('linkedin_accounts', { id, user_id: userId });

    if (!account) {
      throw new NotFoundError('LinkedIn account not found');
    }

    await db.delete('linkedin_accounts', { id });

    console.log('✅ Conta deletada');

    sendSuccess(res, null, 'LinkedIn account deleted successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 6. BUSCAR PERFIS NO LINKEDIN (GET - Simples)
// ================================
const searchProfiles = async (req, res) => {
  try {
    const { account_id, keywords, location, limit = 10 } = req.query;
    const userId = req.user.id;

    console.log(`🔍 Buscando perfis no LinkedIn (simples)`);

    if (!account_id) {
      throw new ValidationError('account_id is required');
    }

    const account = await db.findOne('linkedin_accounts', { 
      id: account_id, 
      user_id: userId 
    });

    if (!account) {
      throw new NotFoundError('LinkedIn account not found');
    }

    const searchParams = {
      account_id: account.unipile_account_id,
      keywords: keywords || '',
      limit: parseInt(limit)
    };

    if (location) {
      searchParams.location = location;
    }

    console.log('📡 Buscando no Unipile:', searchParams);

    const results = await unipileClient.users.search(searchParams);

    console.log(`✅ Encontrados ${results?.items?.length || 0} perfis`);

    sendSuccess(res, {
      profiles: results?.items || [],
      total: results?.total || 0
    }, 'Profiles retrieved successfully');

  } catch (error) {
    console.error('❌ Erro na busca:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 6B. BUSCAR PERFIS AVANÇADO (POST - Filtros Complexos)
// ================================
const searchProfilesAdvanced = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      keywords,
      api = 'classic',
      category = 'people',
      location, 
      industries,
      job_titles,
      companies,
      linkedin_account_id,
      cursor = null,
      limit = 25
    } = req.body;

    console.log('🔍 === BUSCA AVANÇADA DE PERFIS ===');
    console.log('📋 Parâmetros:', {
      keywords,
      api,
      locations: Array.isArray(location) ? location.length : 0,
      industries: Array.isArray(industries) ? industries.length : 0,
      job_titles: Array.isArray(job_titles) ? job_titles.length : 0,
      companies: Array.isArray(companies) ? companies.length : 0,
      has_cursor: !!cursor
    });

    // Validações
    if (!linkedin_account_id) {
      throw new ValidationError('linkedin_account_id is required');
    }

    // Buscar conta
    const account = await db.findOne('linkedin_accounts', { 
      id: linkedin_account_id, 
      user_id: userId 
    });

    if (!account) {
      throw new NotFoundError('LinkedIn account not found');
    }

    if (account.status !== 'active') {
      throw new ValidationError('LinkedIn account is not active');
    }

    if (!account.unipile_account_id) {
      throw new ValidationError('Account does not have unipile_account_id');
    }

    // Preparar parâmetros
    const searchParams = {
      account_id: account.unipile_account_id,
      api: api,
      category: category,
      limit: parseInt(limit)
    };

    // Se tem cursor, é paginação
    if (cursor && cursor.trim()) {
      searchParams.cursor = cursor;
    } else {
      // Nova busca - adicionar filtros
      if (keywords && keywords.trim()) {
        searchParams.keywords = keywords.trim();
      }

      if (location && Array.isArray(location) && location.length > 0) {
        searchParams.location = location;
      }

      if (industries && Array.isArray(industries) && industries.length > 0) {
        searchParams.industries = industries;
      }

      if (job_titles && Array.isArray(job_titles) && job_titles.length > 0) {
        searchParams.job_titles = job_titles;
      }

      if (companies && Array.isArray(companies) && companies.length > 0) {
        searchParams.companies = companies;
      }
    }

    console.log('📤 Enviando para Unipile:', JSON.stringify(searchParams, null, 2));

    // Buscar via Unipile
    const unipileResponse = await unipileClient.linkedin.search(searchParams);

    const profiles = unipileResponse.items || [];

    console.log(`📥 Recebidos ${profiles.length} perfis`);

    // ✅ PROCESSAR PERFIS COM VERIFICAÇÃO CORRETA DE LEADS
    const processedProfiles = await Promise.all(
      profiles.map(async (profile, index) => {
        const profileId = profile.id || profile.provider_id || profile.urn_id;
        
        // ✅ VERIFICAR SE JÁ É LEAD (via campaigns do usuário)
        let isLead = false;
        if (profileId) {
          try {
            const leadCheck = await db.query(
              `SELECT l.id 
               FROM leads l
               INNER JOIN campaigns c ON l.campaign_id = c.id
               WHERE l.linkedin_profile_id = $1 
               AND c.user_id = $2
               LIMIT 1`,
              [profileId, userId]
            );
            isLead = leadCheck.rows.length > 0;
          } catch (checkError) {
            console.warn('⚠️ Erro ao verificar lead:', checkError.message);
            // Se der erro, continua sem marcar como lead
          }
        }

        return {
          id: profileId || `temp_${index}`,
          provider_id: profile.provider_id || profile.id,
          name: profile.name || profile.full_name || profile.firstName || 'Nome não disponível',
          title: profile.title || profile.headline || profile.occupation || null,
          company: profile.company || profile.current_company || profile.companyName || null,
          location: profile.location || profile.geo_location || null,
          profile_url: profile.profile_url || profile.url || profile.public_profile_url || null,
          profile_picture: profile.profile_picture || profile.picture || profile.photo || null,
          summary: profile.summary || profile.description || null,
          industry: profile.industry || null,
          connections: profile.connections || profile.connection_count || null,
          is_private: profile.is_private || false,
          already_lead: isLead,
          can_get_details: true,
          profile_score: calculateProfileScore(profile)
        };
      })
    );

    // Paginação
    const paginationResponse = {
      current_cursor: cursor,
      next_cursor: unipileResponse.cursor || null,
      has_more: !!(unipileResponse.cursor && profiles.length === parseInt(limit)),
      page_count: profiles.length,
      limit: parseInt(limit)
    };

    console.log('✅ Busca concluída:', {
      found: processedProfiles.length,
      has_next: paginationResponse.has_more
    });

    sendSuccess(res, {
      data: processedProfiles,
      pagination: paginationResponse
    }, 'Profiles retrieved successfully');

  } catch (error) {
    console.error('❌ Erro na busca avançada:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// Helper - Calcular score do perfil
function calculateProfileScore(profile) {
  let score = 0;
  if (profile.name || profile.full_name) score += 20;
  if (profile.title || profile.headline) score += 15;
  if (profile.company || profile.current_company) score += 15;
  if (profile.location) score += 10;
  if (profile.profile_picture || profile.picture) score += 10;
  if (profile.profile_url || profile.url) score += 5;
  if (profile.summary || profile.description) score += 10;
  if (profile.connections && profile.connections > 0) score += 10;
  if (profile.industry) score += 5;
  return Math.min(score, 100);
}

// ================================
// 7. ENVIAR CONVITE
// ================================
const sendInvitation = async (req, res) => {
  try {
    const { account_id, provider_id, message } = req.body;
    const userId = req.user.id;

    console.log(`📨 Enviando convite de conexão`);

    if (!account_id || !provider_id) {
      throw new ValidationError('account_id and provider_id are required');
    }

    const account = await db.findOne('linkedin_accounts', { 
      id: account_id, 
      user_id: userId 
    });

    if (!account) {
      throw new NotFoundError('LinkedIn account not found');
    }

    if (account.today_sent >= account.daily_limit) {
      throw new ForbiddenError('Daily invitation limit reached');
    }

    const inviteParams = {
      account_id: account.unipile_account_id,
      user_id: provider_id
    };

    if (message) {
      inviteParams.message = message;
    }

    console.log('📡 Enviando via Unipile:', inviteParams);

    const result = await unipileClient.users.sendConnectionRequest(inviteParams);

    await db.update('linkedin_accounts', {
      today_sent: account.today_sent + 1
    }, { id: account_id });

    console.log('✅ Convite enviado com sucesso');

    sendSuccess(res, result, 'Invitation sent successfully');

  } catch (error) {
    console.error('❌ Erro ao enviar convite:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  connectLinkedInAccount,
  getLinkedInAccounts,
  getLinkedInAccount,
  updateLinkedInAccount,
  deleteLinkedInAccount,
  searchProfiles,
  searchProfilesAdvanced,
  sendInvitation
};