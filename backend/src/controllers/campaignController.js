// backend/src/controllers/campaignController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const {
  ValidationError,
  NotFoundError,
  ForbiddenError
} = require('../utils/errors');
const { CAMPAIGN_STATUS } = require('../utils/helpers');
const { getAccessibleSectorIds } = require('../middleware/permissions');

// ================================
// HELPER: Build sector filter for campaign queries
// ================================
async function buildCampaignSectorFilter(userId, accountId, paramIndex = 3) {
  const accessibleSectorIds = await getAccessibleSectorIds(userId, accountId);

  if (accessibleSectorIds.length > 0) {
    return {
      filter: `AND (c.sector_id = ANY($${paramIndex}) OR c.sector_id IS NULL)`,
      params: [accessibleSectorIds]
    };
  } else {
    return {
      filter: 'AND c.sector_id IS NULL',
      params: []
    };
  }
}

// ================================
// 1. LISTAR CAMPANHAS DO USUÁRIO
// ================================
const getCampaigns = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { status, page = 1, limit = 20 } = req.query;

    console.log(`📋 Listando campanhas do usuário ${userId} (conta ${accountId})`);

    // Construir query - MULTI-TENANCY + SECTOR filtering
    let whereConditions = ['c.account_id = $1', 'c.user_id = $2', '(c.is_system = false OR c.is_system IS NULL)'];
    let queryParams = [accountId, userId];
    let paramIndex = 3;

    // SECTOR FILTER: Add sector filtering
    const { filter: sectorFilter, params: sectorParams } = await buildCampaignSectorFilter(userId, accountId, paramIndex);
    if (sectorParams.length > 0) {
      whereConditions.push(sectorFilter.replace(/^AND /, ''));
      queryParams.push(...sectorParams);
      paramIndex += sectorParams.length;
    } else if (sectorFilter) {
      whereConditions.push(sectorFilter.replace(/^AND /, ''));
    }

    // Filtro por status
    if (status) {
      whereConditions.push(`c.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.join(' AND ');

    // Query com JOIN para pegar dados da conta LinkedIn e contagens de leads
    const query = `
      SELECT
        c.*,
        la.linkedin_username,
        la.profile_name as linkedin_profile_name,
        la.profile_name as linkedin_account_name,
        la.status as linkedin_account_status,
        aa.name as ai_agent_name,
        COALESCE(COUNT(l.id), 0) as total_leads,
        COALESCE(SUM(CASE WHEN l.status = 'leads' THEN 1 ELSE 0 END), 0) as leads_count,
        COALESCE(SUM(CASE WHEN l.status = 'qualifying' THEN 1 ELSE 0 END), 0) as leads_qualifying,
        COALESCE(SUM(CASE WHEN l.status = 'invite_sent' THEN 1 ELSE 0 END), 0) as leads_invited,
        COALESCE(SUM(CASE WHEN l.status = 'accepted' THEN 1 ELSE 0 END), 0) as leads_accepted,
        COALESCE(SUM(CASE WHEN l.status = 'qualified' THEN 1 ELSE 0 END), 0) as leads_won,
        COALESCE(SUM(CASE WHEN l.status = 'discarded' THEN 1 ELSE 0 END), 0) as leads_lost,
        0 as leads_scheduled
      FROM campaigns c
      LEFT JOIN linkedin_accounts la ON c.linkedin_account_id = la.id
      LEFT JOIN ai_agents aa ON c.ai_agent_id = aa.id
      LEFT JOIN leads l ON c.id = l.campaign_id
      WHERE ${whereClause}
      GROUP BY c.id, la.linkedin_username, la.profile_name, la.status, aa.name
      ORDER BY c.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const campaigns = await db.query(query, queryParams);

    // Buscar contas vinculadas para cada campanha
    if (campaigns.rows.length > 0) {
      const campaignIds = campaigns.rows.map(c => c.id);

      const accountsQuery = await db.query(
        `SELECT
          cla.campaign_id,
          la.id,
          la.profile_name,
          la.linkedin_username,
          la.daily_limit,
          la.status,
          cla.priority,
          cla.is_active,
          cla.invites_sent as campaign_invites_sent
         FROM campaign_linkedin_accounts cla
         JOIN linkedin_accounts la ON cla.linkedin_account_id = la.id
         WHERE cla.campaign_id = ANY($1)
         ORDER BY cla.campaign_id, cla.priority`,
        [campaignIds]
      );

      // Agrupar contas por campanha
      const accountsByCampaign = {};
      accountsQuery.rows.forEach(acc => {
        if (!accountsByCampaign[acc.campaign_id]) {
          accountsByCampaign[acc.campaign_id] = [];
        }
        accountsByCampaign[acc.campaign_id].push(acc);
      });

      // Adicionar contas vinculadas e limite total a cada campanha
      campaigns.rows.forEach(campaign => {
        const linkedAccounts = accountsByCampaign[campaign.id] || [];
        campaign.linked_accounts = linkedAccounts;
        campaign.linked_accounts_count = linkedAccounts.length;
        campaign.total_daily_limit = linkedAccounts.reduce((sum, acc) => sum + (acc.daily_limit || 0), 0);
      });
    }

    // Contar total
    const countQuery = `
      SELECT COUNT(*)
      FROM campaigns c
      WHERE ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    console.log(`✅ Encontradas ${campaigns.rows.length} campanhas`);

    sendSuccess(res, {
      campaigns: campaigns.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 2. OBTER CAMPANHA ESPECÍFICA
// ================================
const getCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`🔍 Buscando campanha ${id} (conta ${accountId})`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildCampaignSectorFilter(userId, accountId, 4);

    const query = `
      SELECT
        c.*,
        la.linkedin_username,
        la.profile_name as linkedin_profile_name,
        la.daily_limit as linkedin_daily_limit,
        la.today_sent as linkedin_today_sent,
        la.status as linkedin_account_status,
        aa.name as ai_agent_name,
        aa.personality_tone,
        aa.is_active as ai_agent_active
      FROM campaigns c
      LEFT JOIN linkedin_accounts la ON c.linkedin_account_id = la.id AND la.account_id = $3
      LEFT JOIN ai_agents aa ON c.ai_agent_id = aa.id AND aa.account_id = $3
      WHERE c.id = $1 AND c.account_id = $3 AND c.user_id = $2 ${sectorFilter}
    `;

    const result = await db.query(query, [id, userId, accountId, ...sectorParams]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Campaign not found');
    }

    const campaign = result.rows[0];

    // Buscar contas vinculadas
    const accountsQuery = await db.query(
      `SELECT
        cla.campaign_id,
        la.id,
        la.profile_name,
        la.linkedin_username,
        la.daily_limit,
        la.today_sent,
        la.status,
        cla.priority,
        cla.is_active,
        cla.invites_sent as campaign_invites_sent,
        cla.invites_accepted as campaign_invites_accepted
       FROM campaign_linkedin_accounts cla
       JOIN linkedin_accounts la ON cla.linkedin_account_id = la.id
       WHERE cla.campaign_id = $1
       ORDER BY cla.priority`,
      [id]
    );

    campaign.linked_accounts = accountsQuery.rows;
    campaign.linked_accounts_count = accountsQuery.rows.length;
    campaign.total_daily_limit = accountsQuery.rows.reduce((sum, acc) => sum + (acc.daily_limit || 0), 0);
    campaign.total_today_sent = accountsQuery.rows.reduce((sum, acc) => sum + (acc.today_sent || 0), 0);

    console.log(`✅ Campanha encontrada: ${campaign.name} (${campaign.linked_accounts_count} contas vinculadas)`);

    sendSuccess(res, campaign);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 3. CRIAR CAMPANHA
// ================================
const createCampaign = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      name,
      description,
      type,
      sector_id,                 // Sector assignment
      linkedin_account_id,      // Single account (legacy)
      linkedin_account_ids,      // Multiple accounts (new)
      ai_agent_id,
      search_filters,
      ai_search_prompt,
      target_profiles_count,
      current_step,
      status,
      // Campos legados (manter compatibilidade)
      industry,
      location,
      target_titles,
      target_keywords,
      template_message,
      daily_limit
    } = req.body;

    console.log(`📝 Criando nova campanha: ${name} (conta ${accountId})`);
    console.log(`📊 Tipo: ${type}, Filtros:`, search_filters);

    // Validações básicas
    if (!name) {
      throw new ValidationError('Campaign name is required');
    }

    // Determinar quais contas usar (suporta single e múltiplas)
    let accountIds = [];

    if (linkedin_account_ids && Array.isArray(linkedin_account_ids) && linkedin_account_ids.length > 0) {
      // Novo formato: múltiplas contas
      accountIds = linkedin_account_ids;
      console.log(`📱 Múltiplas contas selecionadas: ${accountIds.length}`);
    } else if (linkedin_account_id) {
      // Formato legado: uma conta
      accountIds = [linkedin_account_id];
      console.log(`📱 Conta única (legado): ${linkedin_account_id}`);
    } else {
      throw new ValidationError('At least one LinkedIn account is required');
    }

    // Verificar se todas as contas pertencem ao usuário E à mesma conta (multi-tenancy)
    const linkedinAccounts = await db.query(
      `SELECT id, profile_name, daily_limit
       FROM linkedin_accounts
       WHERE id = ANY($1) AND user_id = $2 AND account_id = $3`,
      [accountIds, userId, accountId]
    );

    if (linkedinAccounts.rows.length !== accountIds.length) {
      throw new NotFoundError('One or more LinkedIn accounts not found or do not belong to your account');
    }

    // Calcular limite total disponível
    const totalDailyLimit = linkedinAccounts.rows.reduce((sum, acc) => sum + (acc.daily_limit || 0), 0);
    console.log(`📊 Limite total disponível: ${totalDailyLimit} convites/dia`);

    // Se AI agent foi especificado, verificar se pertence ao usuário E à conta
    if (ai_agent_id) {
      const aiAgent = await db.query(
        'SELECT id FROM ai_agents WHERE id = $1 AND user_id = $2 AND account_id = $3',
        [ai_agent_id, userId, accountId]
      );

      if (aiAgent.rows.length === 0) {
        throw new NotFoundError('AI Agent not found in your account');
      }
    }

    // Se sector_id foi especificado, verificar se pertence à conta
    if (sector_id) {
      const sector = await db.query(
        'SELECT id FROM sectors WHERE id = $1 AND account_id = $2 AND is_active = true',
        [sector_id, accountId]
      );

      if (sector.rows.length === 0) {
        throw new NotFoundError('Sector not found in your account');
      }
    }

    // Criar campanha com account_id (multi-tenancy) e sector_id
    const campaignData = {
      user_id: userId,
      account_id: accountId,
      sector_id: sector_id || null,
      name,
      description: description || null,
      type: type || 'manual',
      linkedin_account_id: accountIds[0], // Primeira conta (compatibilidade)
      ai_agent_id: ai_agent_id || null,
      status: status || CAMPAIGN_STATUS.DRAFT,
      automation_active: false,
      search_filters: search_filters ? JSON.stringify(search_filters) : null,
      ai_search_prompt: ai_search_prompt || null,
      target_profiles_count: target_profiles_count || 100,
      current_step: current_step || 1,
      // Campos legados
      industry: industry || null,
      location: location || null,
      target_titles: target_titles ? JSON.stringify(target_titles) : null,
      target_keywords: target_keywords ? JSON.stringify(target_keywords) : null,
      template_message: template_message || null,
      daily_limit: daily_limit || totalDailyLimit
    };

    const campaign = await db.insert('campaigns', campaignData);

    // Inserir relacionamentos na tabela campaign_linkedin_accounts
    const accountRelations = accountIds.map((accountId, index) => ({
      campaign_id: campaign.id,
      linkedin_account_id: accountId,
      priority: index + 1, // Ordem de seleção
      is_active: true
    }));

    await db.query(
      `INSERT INTO campaign_linkedin_accounts (campaign_id, linkedin_account_id, priority, is_active)
       VALUES ${accountRelations.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ')}`,
      accountRelations.flatMap(r => [r.campaign_id, r.linkedin_account_id, r.priority, r.is_active])
    );

    console.log(`✅ Campanha criada: ${campaign.id}`);
    console.log(`📋 ${accountIds.length} conta(s) vinculada(s)`);
    console.log(`📊 Limite total: ${totalDailyLimit} convites/dia`);

    // Retornar campanha com informações das contas
    const responseData = {
      ...campaign,
      linked_accounts: linkedinAccounts.rows,
      total_daily_limit: totalDailyLimit
    };

    sendSuccess(res, responseData, 'Campaign created successfully', 201);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 4. ATUALIZAR CAMPANHA
// ================================
const updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      name,
      ai_agent_id,
      industry,
      location,
      target_titles,
      target_keywords,
      template_message,
      daily_limit,
      status
    } = req.body;

    console.log(`📝 Atualizando campanha ${id} (conta ${accountId})`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildCampaignSectorFilter(userId, accountId, 4);

    // Verificar se campanha pertence ao usuário E à conta (MULTI-TENANCY + SECTOR)
    const campaign = await db.query(
      `SELECT * FROM campaigns c WHERE c.id = $1 AND c.user_id = $2 AND c.account_id = $3 ${sectorFilter}`,
      [id, userId, accountId, ...sectorParams]
    );

    if (campaign.rows.length === 0) {
      throw new NotFoundError('Campaign not found');
    }

    // Preparar dados para atualização
    const updateData = {};
    
    if (name !== undefined) updateData.name = name;
    if (ai_agent_id !== undefined) updateData.ai_agent_id = ai_agent_id;
    if (industry !== undefined) updateData.industry = industry;
    if (location !== undefined) updateData.location = location;
    if (target_titles !== undefined) updateData.target_titles = JSON.stringify(target_titles);
    if (target_keywords !== undefined) updateData.target_keywords = JSON.stringify(target_keywords);
    if (template_message !== undefined) updateData.template_message = template_message;
    if (daily_limit !== undefined) updateData.daily_limit = daily_limit;
    if (status !== undefined) updateData.status = status;

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No fields to update');
    }

    // Atualizar
    const updatedCampaign = await db.update('campaigns', updateData, { id });

    console.log(`✅ Campanha atualizada`);

    sendSuccess(res, updatedCampaign, 'Campaign updated successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 5. DELETAR CAMPANHA
// ================================
const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`🗑️ Deletando campanha ${id} (conta ${accountId})`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildCampaignSectorFilter(userId, accountId, 4);

    // Verificar se campanha pertence ao usuário E à conta (MULTI-TENANCY + SECTOR)
    const campaign = await db.query(
      `SELECT * FROM campaigns c WHERE c.id = $1 AND c.user_id = $2 AND c.account_id = $3 ${sectorFilter}`,
      [id, userId, accountId, ...sectorParams]
    );

    if (campaign.rows.length === 0) {
      throw new NotFoundError('Campaign not found');
    }

    const campaignData = campaign.rows[0];

    // Verificar se há coleta em andamento
    const collectionJobCheck = await db.query(
      'SELECT id FROM bulk_collection_jobs WHERE campaign_id = $1 AND status IN ($2, $3)',
      [id, 'pending', 'processing']
    );

    if (collectionJobCheck.rows.length > 0) {
      throw new ForbiddenError('Cannot delete campaign with collection in progress. Please wait for collection to complete.');
    }

    // Não permitir deletar campanhas com automação ativa E que tenham leads
    if (campaignData.automation_active) {
      // Verificar se tem leads
      const leadsCheck = await db.query(
        'SELECT COUNT(*) FROM leads WHERE campaign_id = $1',
        [id]
      );
      const leadsCount = parseInt(leadsCheck.rows[0].count);

      if (leadsCount > 0) {
        throw new ForbiddenError('Cannot delete active campaign with leads. Pause it first.');
      }

      // Se não tem leads, pode deletar mesmo estando com automação ativa
      console.log('⚠️ Deletando campanha ativa sem leads');
    }

    // Deletar dados relacionados
    await db.query('DELETE FROM bulk_collection_jobs WHERE campaign_id = $1', [id]);
    await db.query('DELETE FROM leads WHERE campaign_id = $1', [id]);

    // Deletar campanha
    await db.delete('campaigns', { id });

    console.log(`✅ Campanha deletada`);

    sendSuccess(res, null, 'Campaign deleted successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 6. INICIAR AUTOMAÇÃO
// ================================
const startCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`▶️ Iniciando campanha ${id} (conta ${accountId})`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildCampaignSectorFilter(userId, accountId, 4);

    // Verificar se campanha pertence ao usuário E à conta (MULTI-TENANCY + SECTOR)
    const campaign = await db.query(
      `SELECT * FROM campaigns c WHERE c.id = $1 AND c.user_id = $2 AND c.account_id = $3 ${sectorFilter}`,
      [id, userId, accountId, ...sectorParams]
    );

    if (campaign.rows.length === 0) {
      throw new NotFoundError('Campaign not found');
    }

    const campaignData = campaign.rows[0];

    // Verificar se já está ativa
    if (campaignData.automation_active) {
      throw new ValidationError('Campaign is already active');
    }

    // Verificar se tem leads pendentes
    const leadsCount = await db.query(
      'SELECT COUNT(*) FROM leads WHERE campaign_id = $1 AND status = $2',
      [id, 'leads']
    );

    const pendingLeads = parseInt(leadsCount.rows[0].count);

    if (pendingLeads === 0) {
      throw new ValidationError('Campaign has no pending leads. Add leads first.');
    }

    // Atualizar campanha
    const updatedCampaign = await db.update('campaigns', {
      automation_active: true,
      status: CAMPAIGN_STATUS.ACTIVE
    }, { id });

    console.log(`✅ Campanha iniciada - ${pendingLeads} leads pendentes`);

    sendSuccess(res, {
      ...updatedCampaign,
      pending_leads: pendingLeads
    }, 'Campaign started successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 7. PAUSAR AUTOMAÇÃO
// ================================
const pauseCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`⏸️ Pausando campanha ${id}`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildCampaignSectorFilter(userId, accountId, 4);

    // Verificar se campanha pertence ao usuário E à conta (MULTI-TENANCY + SECTOR)
    const campaignResult = await db.query(
      `SELECT * FROM campaigns c WHERE c.id = $1 AND c.user_id = $2 AND c.account_id = $3 ${sectorFilter}`,
      [id, userId, accountId, ...sectorParams]
    );

    if (campaignResult.rows.length === 0) {
      throw new NotFoundError('Campaign not found');
    }

    const campaign = campaignResult.rows[0];

    // Verificar se está ativa
    if (!campaign.automation_active) {
      throw new ValidationError('Campaign is not active');
    }

    // Atualizar campanha
    const updatedCampaign = await db.update('campaigns', {
      automation_active: false,
      status: CAMPAIGN_STATUS.PAUSED
    }, { id });

    console.log(`✅ Campanha pausada`);

    sendSuccess(res, updatedCampaign, 'Campaign paused successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 7.1 RETOMAR CAMPANHA PAUSADA
// ================================
const resumeCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`▶️ Retomando campanha ${id}`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildCampaignSectorFilter(userId, accountId, 4);

    // Verificar se campanha pertence ao usuário E à conta (MULTI-TENANCY + SECTOR)
    const campaignResult = await db.query(
      `SELECT * FROM campaigns c WHERE c.id = $1 AND c.user_id = $2 AND c.account_id = $3 ${sectorFilter}`,
      [id, userId, accountId, ...sectorParams]
    );

    if (campaignResult.rows.length === 0) {
      throw new NotFoundError('Campaign not found');
    }

    const campaign = campaignResult.rows[0];

    // Verificar se está pausada
    if (campaign.status !== CAMPAIGN_STATUS.PAUSED) {
      throw new ValidationError('Campaign is not paused');
    }

    // Verificar se tem leads pendentes
    const leadsCount = await db.query(
      'SELECT COUNT(*) FROM leads WHERE campaign_id = $1 AND status = $2',
      [id, 'leads']
    );

    const pendingLeads = parseInt(leadsCount.rows[0].count);

    if (pendingLeads === 0) {
      throw new ValidationError('Campaign has no pending leads');
    }

    // Atualizar campanha
    const updatedCampaign = await db.update('campaigns', {
      automation_active: true,
      status: CAMPAIGN_STATUS.ACTIVE
    }, { id });

    console.log(`✅ Campanha retomada - ${pendingLeads} leads pendentes`);

    sendSuccess(res, {
      ...updatedCampaign,
      pending_leads: pendingLeads
    }, 'Campaign resumed successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 7.2 PARAR CAMPANHA DEFINITIVAMENTE
// ================================
const stopCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`⏹️ Parando campanha ${id}`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildCampaignSectorFilter(userId, accountId, 4);

    // Verificar se campanha pertence ao usuário E à conta (MULTI-TENANCY + SECTOR)
    const campaignResult = await db.query(
      `SELECT * FROM campaigns c WHERE c.id = $1 AND c.user_id = $2 AND c.account_id = $3 ${sectorFilter}`,
      [id, userId, accountId, ...sectorParams]
    );

    if (campaignResult.rows.length === 0) {
      throw new NotFoundError('Campaign not found');
    }

    const campaign = campaignResult.rows[0];

    // Atualizar campanha (parar = voltar para draft)
    const updatedCampaign = await db.update('campaigns', {
      automation_active: false,
      status: CAMPAIGN_STATUS.DRAFT
    }, { id });

    console.log(`✅ Campanha parada`);

    sendSuccess(res, updatedCampaign, 'Campaign stopped successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 8. OBTER ESTATÍSTICAS DA CAMPANHA
// ================================
const getCampaignStats = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`📊 Buscando estatísticas da campanha ${id}`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildCampaignSectorFilter(userId, accountId, 4);

    // Verificar se campanha pertence ao usuário E à conta (MULTI-TENANCY + SECTOR)
    const campaignResult = await db.query(
      `SELECT * FROM campaigns c WHERE c.id = $1 AND c.user_id = $2 AND c.account_id = $3 ${sectorFilter}`,
      [id, userId, accountId, ...sectorParams]
    );

    if (campaignResult.rows.length === 0) {
      throw new NotFoundError('Campaign not found');
    }

    const campaign = campaignResult.rows[0];

    // Buscar estatísticas dos leads
    const statsQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM leads
      WHERE campaign_id = $1
      GROUP BY status
    `;

    const statsResult = await db.query(statsQuery, [id]);

    // Organizar stats por status
    const stats = {
      leads: 0,
      invite_sent: 0,
      accepted: 0,
      qualifying: 0,
      qualified: 0,
      discarded: 0
    };

    statsResult.rows.forEach(row => {
      stats[row.status] = parseInt(row.count);
    });

    // Taxa de conversão
    const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
    const conversionRate = stats.invite_sent > 0 
      ? ((stats.accepted / stats.invite_sent) * 100).toFixed(2)
      : 0;

    const qualificationRate = stats.accepted > 0
      ? ((stats.qualified / stats.accepted) * 100).toFixed(2)
      : 0;

    console.log(`✅ Estatísticas calculadas`);

    sendSuccess(res, {
      campaign_id: id,
      campaign_name: campaign.name,
      status: campaign.status,
      automation_active: campaign.automation_active,
      stats,
      total_leads: total,
      conversion_rate: parseFloat(conversionRate),
      qualification_rate: parseFloat(qualificationRate),
      daily_limit: campaign.daily_limit
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 9. INICIAR COLETA DE PERFIS
// ================================
const campaignCollectionService = require('../services/campaignCollectionService');

const startCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`🚀 Iniciando coleta para campanha ${id}`);

    // Criar job de coleta
    const job = await campaignCollectionService.createCollectionJob(id, userId);

    sendSuccess(res, job, 'Coleta iniciada com sucesso');

  } catch (error) {
    console.error('❌ Erro ao iniciar coleta:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 10. OBTER STATUS DA COLETA
// ================================
const getCollectionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const status = await campaignCollectionService.getCollectionStatus(id, userId);

    if (!status) {
      sendSuccess(res, null, 'Nenhuma coleta iniciada para esta campanha');
    } else {
      sendSuccess(res, status);
    }

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  stopCampaign,
  getCampaignStats,
  startCollection,
  getCollectionStatus
};