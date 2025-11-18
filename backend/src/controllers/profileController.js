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
const inviteService = require('../services/inviteService');
const accountHealthService = require('../services/accountHealthService');

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
        console.log('📊 DADOS DO PERFIL NA CONEXÃO:', JSON.stringify(profileData, null, 2));
        console.log('🔍 Premium:', profileData?.premium);
        console.log('🔍 Sales Navigator:', profileData?.sales_navigator);
        console.log('🔍 Recruiter:', profileData?.recruiter);
      } catch (profileError) {
        console.warn('⚠️ Erro ao buscar perfil:', profileError.message);
      }

      // Criar objeto estruturado com informações do tipo de conta
      const accountTypeInfo = profileData ? {
        premium: profileData.premium || false,
        sales_navigator: profileData.sales_navigator || null,
        recruiter: profileData.recruiter || null
      } : null;

      // 🆕 AUTO-DETECTAR TIPO DE CONTA
      let detectedAccountType = 'free';
      if (profileData) {
        if (profileData.recruiter !== null && profileData.recruiter !== undefined) {
          detectedAccountType = 'recruiter';
        } else if (profileData.sales_navigator !== null && profileData.sales_navigator !== undefined) {
          detectedAccountType = 'sales_navigator';
        } else if (profileData.premium === true) {
          detectedAccountType = 'premium';
        }
      }

      console.log(`🔍 Tipo de conta detectado: ${detectedAccountType}`);

      // 🆕 DEFINIR LIMITE SEGURO INICIAL
      const initialLimit = accountHealthService.ACCOUNT_TYPE_LIMITS[detectedAccountType].safe;
      console.log(`💡 Limite inicial sugerido: ${initialLimit}/dia`);

      const accountData = {
        user_id: userId,
        unipile_account_id: accountId,
        linkedin_username: username,
        profile_name: profileData?.name || `${profileData?.first_name} ${profileData?.last_name}`.trim() || username,
        profile_url: profileData?.url || null,
        profile_picture: profileData?.profile_picture || profileData?.profile_picture_url || null,
        public_identifier: profileData?.public_identifier || null,
        status: 'active',
        account_type: detectedAccountType,
        daily_limit: initialLimit,
        organizations: profileData?.organizations ? JSON.stringify(profileData.organizations) : null,
        premium_features: accountTypeInfo ? JSON.stringify(accountTypeInfo) : null
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
// 5B. ATUALIZAR DADOS DA CONTA LINKEDIN (REFRESH)
// ================================
const refreshLinkedInAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`🔄 Atualizando dados da conta LinkedIn ${id}`);

    // Buscar conta no banco
    const account = await db.findOne('linkedin_accounts', { id, user_id: userId });

    if (!account) {
      throw new NotFoundError('LinkedIn account not found');
    }

    if (!account.unipile_account_id) {
      throw new ValidationError('Account does not have unipile_account_id');
    }

    if (!unipileClient.isInitialized()) {
      throw new UnipileError(`Unipile client error: ${unipileClient.getError()}`);
    }

    console.log(`📡 Buscando dados atualizados da Unipile para account_id: ${account.unipile_account_id}`);

    try {
      // Buscar dados da conta na Unipile
      const accountData = await unipileClient.account.getAccountById(account.unipile_account_id);
      console.log('✅ Dados da conta obtidos da Unipile');

      // Buscar perfil atualizado
      const profileData = await unipileClient.users.getOwnProfile(account.unipile_account_id);
      console.log('✅ Perfil atualizado obtido:', profileData?.name || 'Nome não disponível');
      console.log('📊 DADOS COMPLETOS DO PERFIL:', JSON.stringify(profileData, null, 2));
      console.log('📊 DADOS COMPLETOS DA CONTA:', JSON.stringify(accountData, null, 2));
      console.log('🔍 Premium:', profileData?.premium);
      console.log('🔍 Sales Navigator:', profileData?.sales_navigator);
      console.log('🔍 Recruiter:', profileData?.recruiter);

      // Criar objeto estruturado com informações do tipo de conta
      const accountTypeInfo = {
        premium: profileData?.premium || false,
        sales_navigator: profileData?.sales_navigator || null,
        recruiter: profileData?.recruiter || null
      };

      console.log('✅ Tipo de conta estruturado:', accountTypeInfo);

      // Preparar dados para atualização
      const updateData = {
        profile_name: profileData?.name || `${profileData?.first_name} ${profileData?.last_name}`.trim() || account.profile_name,
        profile_url: profileData?.url || account.profile_url,
        profile_picture: profileData?.profile_picture || profileData?.profile_picture_url || account.profile_picture,
        public_identifier: profileData?.public_identifier || account.public_identifier,
        organizations: profileData?.organizations ? JSON.stringify(profileData.organizations) : account.organizations,
        premium_features: JSON.stringify(accountTypeInfo),
        status: accountData?.status === 'active' ? 'active' : account.status
      };

      // 🆕 AUTO-DETECTAR TIPO DE CONTA
      let detectedAccountType = 'free';
      if (accountTypeInfo.recruiter !== null && accountTypeInfo.recruiter !== undefined) {
        detectedAccountType = 'recruiter';
      } else if (accountTypeInfo.sales_navigator !== null && accountTypeInfo.sales_navigator !== undefined) {
        detectedAccountType = 'sales_navigator';
      } else if (accountTypeInfo.premium === true) {
        detectedAccountType = 'premium';
      }

      updateData.account_type = detectedAccountType;
      console.log(`🔍 Tipo de conta detectado: ${detectedAccountType}`);

      // 🆕 SUGERIR LIMITE SE NÃO ESTIVER CONFIGURADO
      if (!account.daily_limit || account.daily_limit === 0) {
        const suggestedLimit = accountHealthService.ACCOUNT_TYPE_LIMITS[detectedAccountType].safe;
        updateData.daily_limit = suggestedLimit;
        console.log(`💡 Limite sugerido automaticamente: ${suggestedLimit}/dia`);
      }

      console.log('💾 Salvando dados atualizados no banco de dados');

      // Atualizar no banco de dados
      const updatedAccount = await db.update('linkedin_accounts', updateData, { id });

      console.log('✅ Conta LinkedIn atualizada com sucesso');

      sendSuccess(res, {
        ...updatedAccount,
        profile_data: profileData,
        account_data: accountData
      }, 'LinkedIn account refreshed successfully');

    } catch (unipileError) {
      console.error('❌ Erro ao buscar dados da Unipile:', unipileError);

      let errorMessage = 'Failed to refresh LinkedIn account data';

      if (unipileError.response?.status === 404) {
        errorMessage = 'LinkedIn account not found in Unipile';
      } else if (unipileError.response?.status === 401) {
        errorMessage = 'Invalid Unipile credentials';
      }

      throw new UnipileError(errorMessage, unipileError);
    }

  } catch (error) {
    console.error('💥 Erro ao atualizar conta:', error);
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

        // Map multiple possible photo fields from Unipile API
        const profilePicture = profile.profile_picture ||
                              profile.profile_picture_url ||
                              profile.profile_picture_url_large ||
                              profile.picture ||
                              profile.photo ||
                              profile.image ||
                              profile.avatar ||
                              profile.photoUrl ||
                              null;

        return {
          id: profileId || `temp_${index}`,
          provider_id: profile.provider_id || profile.id,
          name: profile.name || profile.full_name || profile.firstName || 'Nome não disponível',
          title: profile.title || profile.headline || profile.occupation || null,
          company: profile.company || profile.current_company || profile.companyName || null,
          location: profile.location || profile.geo_location || null,
          profile_url: profile.profile_url || profile.url || profile.public_profile_url || null,
          profile_picture: profilePicture,
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
  // Check all possible photo fields
  if (profile.profile_picture || profile.profile_picture_url || profile.profile_picture_url_large ||
      profile.picture || profile.photo || profile.image || profile.avatar || profile.photoUrl) score += 10;
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
    const { account_id, provider_id, message, campaign_id, lead_id } = req.body;
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

    // ✅ Verificar limite diário usando o novo serviço
    const limitCheck = await inviteService.canSendInvite(account_id);

    if (!limitCheck.canSend) {
      console.log(`⚠️ Limite diário atingido: ${limitCheck.sent}/${limitCheck.limit}`);
      throw new ForbiddenError(
        `Daily invitation limit reached (${limitCheck.sent}/${limitCheck.limit}). ` +
        `${limitCheck.remaining} invites remaining today.`
      );
    }

    console.log(`✅ Pode enviar: ${limitCheck.remaining} convites restantes`);

    const inviteParams = {
      account_id: account.unipile_account_id,
      user_id: provider_id
    };

    if (message) {
      inviteParams.message = message;
    }

    console.log('📡 Enviando via Unipile:', inviteParams);

    let inviteStatus = 'sent';
    try {
      const result = await unipileClient.users.sendConnectionRequest(inviteParams);

      // ✅ Registrar envio bem-sucedido
      await inviteService.logInviteSent({
        linkedinAccountId: account_id,
        campaignId: campaign_id,
        leadId: lead_id,
        status: 'sent'
      });

      console.log('✅ Convite enviado com sucesso');

      sendSuccess(res, {
        ...result,
        invites_remaining: limitCheck.remaining - 1,
        daily_limit: limitCheck.limit
      }, 'Invitation sent successfully');

    } catch (unipileError) {
      inviteStatus = 'failed';

      // ✅ Registrar falha no envio
      await inviteService.logInviteSent({
        linkedinAccountId: account_id,
        campaignId: campaign_id,
        leadId: lead_id,
        status: 'failed'
      });

      throw unipileError;
    }

  } catch (error) {
    console.error('❌ Erro ao enviar convite:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 8. ESTATÍSTICAS DE CONVITES
// ================================
const getInviteStats = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`📊 Buscando estatísticas de convites para conta ${id}`);

    // Verificar se conta pertence ao usuário
    const account = await db.findOne('linkedin_accounts', {
      id,
      user_id: userId
    });

    if (!account) {
      throw new NotFoundError('LinkedIn account not found');
    }

    const stats = await inviteService.getInviteStats(id);

    console.log(`✅ Estatísticas obtidas:`, {
      sent: stats.sent_today,
      remaining: stats.remaining,
      limit: stats.daily_limit
    });

    sendSuccess(res, stats, 'Invite stats retrieved successfully');

  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 9. ATUALIZAR LIMITE DIÁRIO
// ================================
const updateInviteLimit = async (req, res) => {
  try {
    const { id } = req.params;
    const { daily_limit } = req.body;
    const userId = req.user.id;

    console.log(`⚙️ Atualizando limite diário da conta ${id} para ${daily_limit}`);

    if (daily_limit === undefined || daily_limit === null) {
      throw new ValidationError('daily_limit is required');
    }

    // Verificar se conta pertence ao usuário
    const account = await db.findOne('linkedin_accounts', {
      id,
      user_id: userId
    });

    if (!account) {
      throw new NotFoundError('LinkedIn account not found');
    }

    const updatedAccount = await inviteService.updateDailyLimit(id, parseInt(daily_limit));

    console.log('✅ Limite atualizado com sucesso');

    sendSuccess(res, updatedAccount, 'Daily limit updated successfully');

  } catch (error) {
    console.error('❌ Erro ao atualizar limite:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 10. OBTER HEALTH SCORE DA CONTA
// ================================
const getAccountHealth = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`🏥 Buscando health score da conta ${id}`);

    // Verificar se conta pertence ao usuário
    const account = await db.findOne('linkedin_accounts', {
      id,
      user_id: userId
    });

    if (!account) {
      throw new NotFoundError('LinkedIn account not found');
    }

    // Calcular métricas de saúde
    const healthData = await accountHealthService.calculateHealthScore(id);
    const acceptance7d = await accountHealthService.getAcceptanceRate(id, 7);
    const acceptance30d = await accountHealthService.getAcceptanceRate(id, 30);
    const avgResponseTime = await accountHealthService.getAverageResponseTime(id);
    const accountAge = accountHealthService.getAccountAge(account.connected_at);
    const risks = await accountHealthService.checkRiskPatterns(id);

    console.log(`✅ Health Score: ${healthData.score}/100 (${healthData.level})`);

    sendSuccess(res, {
      health_score: healthData.score,
      risk_level: healthData.level,
      account_age_days: accountAge,
      metrics: {
        acceptance_rate_7d: acceptance7d.rate,
        acceptance_rate_30d: acceptance30d.rate,
        invites_sent_7d: acceptance7d.sent,
        invites_sent_30d: acceptance30d.sent,
        invites_accepted_7d: acceptance7d.accepted,
        invites_accepted_30d: acceptance30d.accepted,
        avg_response_time_hours: avgResponseTime
      },
      factors: healthData.factors,
      risks: risks,
      account_type: account.account_type || 'free'
    }, 'Account health retrieved successfully');

  } catch (error) {
    console.error('❌ Erro ao buscar health:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 11. OBTER LIMITE RECOMENDADO
// ================================
const getRecommendedLimit = async (req, res) => {
  try {
    const { id } = req.params;
    const { strategy = 'moderate' } = req.query;
    const userId = req.user.id;

    console.log(`💡 Calculando limite recomendado para conta ${id} (estratégia: ${strategy})`);

    // Verificar se conta pertence ao usuário
    const account = await db.findOne('linkedin_accounts', {
      id,
      user_id: userId
    });

    if (!account) {
      throw new NotFoundError('LinkedIn account not found');
    }

    // Calcular limite recomendado
    const recommended = await accountHealthService.getRecommendedLimit(id, strategy);

    console.log(`✅ Limite recomendado: ${recommended.recommended}/dia`);

    sendSuccess(res, {
      ...recommended,
      current_limit: account.daily_limit || 0
    }, 'Recommended limit calculated successfully');

  } catch (error) {
    console.error('❌ Erro ao calcular limite recomendado:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 12. OVERRIDE MANUAL DE LIMITE
// ================================
const overrideLimit = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_limit, reason } = req.body;
    const userId = req.user.id;

    console.log(`⚠️ Override manual de limite para conta ${id}: ${new_limit}`);

    if (new_limit === undefined || new_limit === null) {
      throw new ValidationError('new_limit is required');
    }

    if (new_limit < 0 || new_limit > 200) {
      throw new ValidationError('Limit must be between 0 and 200');
    }

    // Verificar se conta pertence ao usuário
    const account = await db.findOne('linkedin_accounts', {
      id,
      user_id: userId
    });

    if (!account) {
      throw new NotFoundError('LinkedIn account not found');
    }

    const oldLimit = account.daily_limit || 0;

    // Log de alteração
    await accountHealthService.logLimitChange({
      linkedinAccountId: id,
      oldLimit,
      newLimit: new_limit,
      userId,
      isManualOverride: true,
      reason: reason || 'Manual override via API'
    });

    // Atualizar limite
    const updatedAccount = await db.update('linkedin_accounts', {
      daily_limit: new_limit
    }, { id });

    console.log(`✅ Limite atualizado: ${oldLimit} → ${new_limit}`);

    // Calcular limite recomendado para comparação
    const recommended = await accountHealthService.getRecommendedLimit(id);

    sendSuccess(res, {
      ...updatedAccount,
      old_limit: oldLimit,
      new_limit: new_limit,
      recommended_limit: recommended.recommended,
      is_above_recommended: new_limit > recommended.recommended,
      risk_level: new_limit > recommended.max ? 'high' :
                   new_limit > recommended.recommended * 1.2 ? 'medium' : 'low'
    }, 'Limit updated successfully');

  } catch (error) {
    console.error('❌ Erro ao atualizar limite:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 13. HISTÓRICO DE ALTERAÇÕES DE LIMITE
// ================================
const getLimitHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;
    const userId = req.user.id;

    console.log(`📜 Buscando histórico de limites da conta ${id}`);

    // Verificar se conta pertence ao usuário
    const account = await db.findOne('linkedin_accounts', {
      id,
      user_id: userId
    });

    if (!account) {
      throw new NotFoundError('LinkedIn account not found');
    }

    // Buscar histórico
    const history = await db.query(
      `SELECT
        id,
        old_limit,
        new_limit,
        recommended_limit,
        is_manual_override,
        reason,
        risk_level,
        account_health_score,
        acceptance_rate,
        created_at
       FROM linkedin_account_limit_changes
       WHERE linkedin_account_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [id, limit]
    );

    console.log(`✅ Encontrados ${history.rows.length} registros`);

    sendSuccess(res, {
      history: history.rows,
      current_limit: account.daily_limit || 0
    }, 'Limit history retrieved successfully');

  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  connectLinkedInAccount,
  getLinkedInAccounts,
  getLinkedInAccount,
  updateLinkedInAccount,
  deleteLinkedInAccount,
  refreshLinkedInAccount,
  searchProfiles,
  searchProfilesAdvanced,
  sendInvitation,
  getInviteStats,
  updateInviteLimit,
  getAccountHealth,
  getRecommendedLimit,
  overrideLimit,
  getLimitHistory
};