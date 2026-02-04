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
const inviteQueueService = require('../services/inviteQueueService');

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

    const query = `
      SELECT
        c.*,
        la.linkedin_username,
        la.profile_name as linkedin_profile_name,
        la.profile_name as linkedin_account_name,
        la.status as linkedin_account_status,
        aa.name as ai_agent_name,
        (SELECT COUNT(*) FROM campaign_contacts cc WHERE cc.campaign_id = c.id) as contacts_count
      FROM campaigns c
      LEFT JOIN linkedin_accounts la ON c.linkedin_account_id = la.id
      LEFT JOIN ai_agents aa ON c.ai_agent_id = aa.id
      WHERE ${whereClause}
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
      search_linkedin_account_id, // Account to use for profile search
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

    // Verificar se a conta de busca pertence ao usuário (se especificada)
    if (search_linkedin_account_id) {
      const searchAccount = await db.query(
        'SELECT id FROM linkedin_accounts WHERE id = $1 AND user_id = $2 AND account_id = $3',
        [search_linkedin_account_id, userId, accountId]
      );
      if (searchAccount.rows.length === 0) {
        throw new NotFoundError('Search LinkedIn account not found in your account');
      }
      console.log(`🔍 Conta de busca selecionada: ${search_linkedin_account_id}`);
    }

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
      linkedin_account_id: search_linkedin_account_id || accountIds[0], // Conta para busca (ou primeira conta)
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
    const { delete_contacts, delete_opportunities } = req.body || {};

    console.log(`🗑️ Deletando campanha ${id} (conta ${accountId})`);
    console.log(`   Opções: delete_contacts=${delete_contacts}, delete_opportunities=${delete_opportunities}`);

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

    // Não permitir deletar campanhas com automação ativa E que tenham opportunities
    if (campaignData.automation_active) {
      // Verificar se tem opportunities
      const oppsCheck = await db.query(
        'SELECT COUNT(*) FROM opportunities WHERE campaign_id = $1',
        [id]
      );
      const oppsCount = parseInt(oppsCheck.rows[0].count);

      if (oppsCount > 0) {
        throw new ForbiddenError('Cannot delete active campaign with opportunities. Pause it first.');
      }

      // Se não tem opportunities, pode deletar mesmo estando com automação ativa
      console.log('⚠️ Deletando campanha ativa sem opportunities');
    }

    // Estatísticas do que será deletado
    let deletedContactsCount = 0;
    let deletedOpportunitiesCount = 0;

    // Se delete_opportunities = true, deletar opportunities associadas
    if (delete_opportunities) {
      const oppsResult = await db.query('DELETE FROM opportunities WHERE campaign_id = $1 RETURNING id', [id]);
      deletedOpportunitiesCount = oppsResult.rowCount;
      console.log(`   🗑️ ${deletedOpportunitiesCount} opportunities deletadas`);
    }

    // Se delete_contacts = true, deletar contacts que estão APENAS nesta campanha
    if (delete_contacts) {
      // Primeiro, buscar IDs dos contacts que estão APENAS nesta campanha (não em outras)
      const contactsToDeleteResult = await db.query(`
        SELECT cc.contact_id
        FROM campaign_contacts cc
        WHERE cc.campaign_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM campaign_contacts cc2
          WHERE cc2.contact_id = cc.contact_id
          AND cc2.campaign_id != $1
        )
        AND NOT EXISTS (
          SELECT 1 FROM opportunities o
          WHERE o.contact_id = cc.contact_id
          AND o.campaign_id != $1
        )
      `, [id]);

      const contactIdsToDelete = contactsToDeleteResult.rows.map(r => r.contact_id);

      if (contactIdsToDelete.length > 0) {
        // Deletar contacts (cascade vai deletar campaign_contacts automaticamente)
        const deleteContactsResult = await db.query(
          'DELETE FROM contacts WHERE id = ANY($1) RETURNING id',
          [contactIdsToDelete]
        );
        deletedContactsCount = deleteContactsResult.rowCount;
        console.log(`   🗑️ ${deletedContactsCount} contacts deletados`);
      }
    }

    // Sempre deletar campaign_contacts (relacionamento campanha-contato)
    await db.query('DELETE FROM campaign_contacts WHERE campaign_id = $1', [id]);

    // Deletar dados relacionados
    await db.query('DELETE FROM bulk_collection_jobs WHERE campaign_id = $1', [id]);
    await db.query('DELETE FROM campaign_invite_queue WHERE campaign_id = $1', [id]);
    await db.query('DELETE FROM campaign_review_config WHERE campaign_id = $1', [id]);

    // Se não pediu para deletar opportunities, mas existem, apenas desvincula da campanha
    if (!delete_opportunities) {
      await db.query('UPDATE opportunities SET campaign_id = NULL WHERE campaign_id = $1', [id]);
    }

    // Deletar campanha
    await db.delete('campaigns', { id });

    console.log(`✅ Campanha deletada`);

    sendSuccess(res, {
      deleted_contacts: deletedContactsCount,
      deleted_opportunities: deletedOpportunitiesCount
    }, 'Campaign deleted successfully');

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

    console.log('\n');
    console.log('🚀 ═══════════════════════════════════════════════════════════');
    console.log('🚀 [CAMPAIGN] INICIANDO CAMPANHA');
    console.log(`🚀    Campaign ID: ${id}`);
    console.log(`🚀    User ID: ${userId}`);
    console.log(`🚀    Account ID: ${accountId}`);
    console.log('🚀 ═══════════════════════════════════════════════════════════');

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildCampaignSectorFilter(userId, accountId, 4);

    // Verificar se campanha pertence ao usuário E à conta (MULTI-TENANCY + SECTOR)
    const campaign = await db.query(
      `SELECT c.*, crc.is_reviewed
       FROM campaigns c
       LEFT JOIN campaign_review_config crc ON crc.campaign_id = c.id
       WHERE c.id = $1 AND c.user_id = $2 AND c.account_id = $3 ${sectorFilter}`,
      [id, userId, accountId, ...sectorParams]
    );

    if (campaign.rows.length === 0) {
      console.log('🚀 ❌ Campanha não encontrada!');
      throw new NotFoundError('Campaign not found');
    }

    const campaignData = campaign.rows[0];
    console.log(`🚀 [STEP 1] Campanha encontrada: ${campaignData.name}`);
    console.log(`🚀    Status atual: ${campaignData.status}`);
    console.log(`🚀    Automation active: ${campaignData.automation_active}`);
    console.log(`🚀    Review completed: ${campaignData.is_reviewed}`);

    // Verificar se foi revisada
    if (!campaignData.is_reviewed && !campaignData.review_completed) {
      console.log('🚀 ❌ Campanha não foi revisada!');
      throw new ValidationError('Campaign must be reviewed before starting. Configure round robin and invite settings first.');
    }

    // Verificar se já está ativa
    if (campaignData.automation_active) {
      console.log('🚀 ⚠️ Campanha já está ativa!');
      throw new ValidationError('Campaign is already active');
    }

    // Verificar se tem opportunities pendentes (sem convite enviado)
    const oppsCount = await db.query(
      `SELECT COUNT(*) FROM opportunities WHERE campaign_id = $1 AND sent_at IS NULL`,
      [id]
    );

    const pendingOpps = parseInt(oppsCount.rows[0].count);
    console.log(`🚀 [STEP 2] Opportunities pendentes: ${pendingOpps}`);

    if (pendingOpps === 0) {
      console.log('🚀 ❌ Nenhuma opportunity pendente!');
      throw new ValidationError('Campaign has no pending opportunities. Add contacts first.');
    }

    // 🆕 CRIAR FILA DE CONVITES
    console.log('🚀 [STEP 3] Criando fila de convites...');
    let queueResult = null;
    try {
      queueResult = await inviteQueueService.createInviteQueue(id, accountId);
      console.log('🚀 ✅ Fila de convites criada:', queueResult);
    } catch (queueError) {
      console.error('🚀 ❌ Erro ao criar fila de convites:', queueError.message);
      // Se falhar na criação da fila, ainda assim podemos ativar a campanha
      // mas sem convites agendados (modo legado)
      console.log('🚀 ⚠️ Continuando sem fila de convites (modo legado)');
    }

    // Atualizar campanha
    console.log('🚀 [STEP 4] Atualizando status da campanha...');
    const updatedCampaign = await db.update('campaigns', {
      automation_active: true,
      status: CAMPAIGN_STATUS.ACTIVE
    }, { id });

    console.log('🚀 ═══════════════════════════════════════════════════════════');
    console.log('🚀 ✅ CAMPANHA INICIADA COM SUCESSO!');
    console.log(`🚀    Nome: ${campaignData.name}`);
    console.log(`🚀    Opportunities pendentes: ${pendingOpps}`);
    if (queueResult) {
      console.log(`🚀    Convites na fila: ${queueResult.totalQueued}`);
      console.log(`🚀    Agendados para hoje: ${queueResult.scheduledToday}`);
      if (queueResult.nextScheduledAt) {
        console.log(`🚀    Próximo envio: ${queueResult.nextScheduledAt}`);
      }
    }
    console.log('🚀 ═══════════════════════════════════════════════════════════');
    console.log('\n');

    sendSuccess(res, {
      ...updatedCampaign,
      pending_opportunities: pendingOpps,
      queue: queueResult
    }, 'Campaign started successfully');

  } catch (error) {
    console.error('🚀 ❌ [CAMPAIGN] Erro ao iniciar campanha:', error.message);
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

    // Cancel Bull jobs + DB entries
    try {
      const canceled = await inviteQueueService.cancelCampaignInvites(id);
      console.log(`⏸️ ${canceled} convites cancelados na fila`);
    } catch (cancelError) {
      console.error('Erro ao cancelar fila de convites:', cancelError.message);
    }

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

    // Verificar se tem opportunities pendentes
    const oppsCount = await db.query(
      'SELECT COUNT(*) FROM opportunities WHERE campaign_id = $1 AND sent_at IS NULL',
      [id]
    );

    const pendingOpps = parseInt(oppsCount.rows[0].count);

    if (pendingOpps === 0) {
      throw new ValidationError('Campaign has no pending opportunities');
    }

    // Atualizar campanha
    const updatedCampaign = await db.update('campaigns', {
      automation_active: true,
      status: CAMPAIGN_STATUS.ACTIVE
    }, { id });

    // Reschedule pending invites as Bull jobs
    let scheduleResult = null;
    try {
      scheduleResult = await inviteQueueService.scheduleInvitesForToday(id, accountId);
      console.log(`▶️ ${scheduleResult.scheduled} convites reagendados via Bull`);
    } catch (schedError) {
      console.error('Erro ao reagendar convites:', schedError.message);
    }

    console.log(`✅ Campanha retomada - ${pendingOpps} opportunities pendentes`);

    sendSuccess(res, {
      ...updatedCampaign,
      pending_opportunities: pendingOpps,
      schedule: scheduleResult
    }, 'Campaign resumed successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 7.1.1 REATIVAR CAMPANHA (após exclusão de agente)
// ================================
const reactivateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const { ai_agent_id } = req.body;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`🔄 Reativando campanha ${id} com novo agente ${ai_agent_id}`);

    // Validar que ai_agent_id foi fornecido
    if (!ai_agent_id) {
      throw new ValidationError('AI Agent is required to reactivate campaign');
    }

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildCampaignSectorFilter(userId, accountId, 4);

    // Verificar se campanha existe e está pausada por falta de agente
    const campaignResult = await db.query(
      `SELECT * FROM campaigns c WHERE c.id = $1 AND c.user_id = $2 AND c.account_id = $3 ${sectorFilter}`,
      [id, userId, accountId, ...sectorParams]
    );

    if (campaignResult.rows.length === 0) {
      throw new NotFoundError('Campaign not found');
    }

    const campaign = campaignResult.rows[0];

    if (campaign.paused_reason !== 'agent_deleted') {
      throw new ValidationError('Campaign is not paused due to agent deletion. Use resume instead.');
    }

    // Verificar se novo agente existe e pertence à conta
    const agentResult = await db.query(
      `SELECT id, name FROM ai_agents WHERE id = $1 AND account_id = $2`,
      [ai_agent_id, accountId]
    );

    if (agentResult.rows.length === 0) {
      throw new NotFoundError('AI Agent not found in your account');
    }

    // Atualizar campanha com novo agente - voltar para draft para permitir revisão/ativação
    const updatedCampaign = await db.update('campaigns', {
      ai_agent_id,
      status: CAMPAIGN_STATUS.DRAFT,
      paused_reason: null,
      paused_at: null
    }, { id });

    console.log(`✅ Campanha ${id} reativada com agente ${agentResult.rows[0].name}`);

    sendSuccess(res, {
      ...updatedCampaign,
      ai_agent_name: agentResult.rows[0].name
    }, 'Campaign reactivated with new agent');

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

    // Buscar estatísticas das opportunities usando campos de data
    const statsQuery = `
      SELECT
        CASE
          WHEN discarded_at IS NOT NULL THEN 'discarded'
          WHEN qualified_at IS NOT NULL THEN 'qualified'
          WHEN qualifying_started_at IS NOT NULL THEN 'qualifying'
          WHEN accepted_at IS NOT NULL THEN 'accepted'
          WHEN sent_at IS NOT NULL THEN 'invite_sent'
          ELSE 'leads'
        END as status,
        COUNT(*) as count
      FROM opportunities
      WHERE campaign_id = $1
      GROUP BY 1
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

// ================================
// 11. SALVAR CONFIGURAÇÃO DE REVISÃO
// ================================
const saveReviewConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    const {
      sector_id,
      round_robin_users,
      invite_expiry_days,
      max_pending_invites,
      withdraw_expired_invites,
      send_start_hour,
      send_end_hour,
      timezone,
      ai_initiate_delay_min,
      ai_initiate_delay_max
    } = req.body;

    console.log('\n');
    console.log('⚙️ ═══════════════════════════════════════════════════════════');
    console.log('⚙️ [REVIEW-CONFIG] SALVANDO CONFIGURAÇÃO DE REVISÃO');
    console.log(`⚙️    Campaign ID: ${id}`);
    console.log('⚙️ ───────────────────────────────────────────────────────────');
    console.log('⚙️ Configurações recebidas:');
    console.log(`⚙️    Setor: ${sector_id || 'Nenhum'}`);
    console.log(`⚙️    Usuários Round Robin: ${round_robin_users?.length || 0} usuários`);
    console.log(`⚙️    Dias para expirar: ${invite_expiry_days || 7}`);
    console.log(`⚙️    Max convites pendentes: ${max_pending_invites || 100}`);
    console.log(`⚙️    Retirar expirados: ${withdraw_expired_invites !== false}`);
    console.log(`⚙️    Horário envio: ${send_start_hour || 9}h - ${send_end_hour || 18}h`);
    console.log(`⚙️    Timezone: ${timezone || 'America/Sao_Paulo'}`);
    console.log(`⚙️    Delay IA: ${ai_initiate_delay_min || 5} - ${ai_initiate_delay_max || 60} minutos`);
    console.log('⚙️ ───────────────────────────────────────────────────────────');

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildCampaignSectorFilter(userId, accountId, 4);

    // Verificar se campanha pertence ao usuário E à conta
    const campaignResult = await db.query(
      `SELECT * FROM campaigns c WHERE c.id = $1 AND c.user_id = $2 AND c.account_id = $3 ${sectorFilter}`,
      [id, userId, accountId, ...sectorParams]
    );

    if (campaignResult.rows.length === 0) {
      throw new NotFoundError('Campaign not found');
    }

    // Validar sector_id se fornecido
    if (sector_id) {
      const sectorCheck = await db.query(
        'SELECT id FROM sectors WHERE id = $1 AND account_id = $2 AND is_active = true',
        [sector_id, accountId]
      );
      if (sectorCheck.rows.length === 0) {
        throw new NotFoundError('Sector not found');
      }
    }

    // Validar usuários do round robin se fornecidos
    if (round_robin_users && round_robin_users.length > 0) {
      const usersCheck = await db.query(
        'SELECT id FROM users WHERE id = ANY($1) AND account_id = $2',
        [round_robin_users, accountId]
      );
      if (usersCheck.rows.length !== round_robin_users.length) {
        throw new ValidationError('One or more users not found in your account');
      }
    }

    // Validar invite_expiry_days
    const expiryDays = invite_expiry_days || 7;
    if (expiryDays < 1 || expiryDays > 14) {
      throw new ValidationError('Invite expiry days must be between 1 and 14');
    }

    // Verificar se já existe configuração
    const existingConfig = await db.query(
      'SELECT id FROM campaign_review_config WHERE campaign_id = $1',
      [id]
    );

    let config;
    if (existingConfig.rows.length > 0) {
      // Atualizar existente
      const updateResult = await db.query(
        `UPDATE campaign_review_config SET
          sector_id = $1,
          round_robin_users = $2,
          invite_expiry_days = $3,
          max_pending_invites = $4,
          withdraw_expired_invites = $5,
          send_start_hour = $6,
          send_end_hour = $7,
          timezone = $8,
          ai_initiate_delay_min = $9,
          ai_initiate_delay_max = $10,
          is_reviewed = true,
          reviewed_at = NOW(),
          reviewed_by = $11,
          updated_at = NOW()
        WHERE campaign_id = $12
        RETURNING *`,
        [
          sector_id || null,
          round_robin_users || [],
          expiryDays,
          max_pending_invites || 100,
          withdraw_expired_invites !== false,
          send_start_hour || 9,
          send_end_hour || 18,
          timezone || 'America/Sao_Paulo',
          ai_initiate_delay_min || 5,
          ai_initiate_delay_max || 60,
          userId,
          id
        ]
      );
      config = updateResult.rows[0];
    } else {
      // Criar nova configuração
      const insertResult = await db.query(
        `INSERT INTO campaign_review_config (
          account_id, campaign_id, sector_id, round_robin_users,
          invite_expiry_days, max_pending_invites, withdraw_expired_invites,
          send_start_hour, send_end_hour, timezone,
          ai_initiate_delay_min, ai_initiate_delay_max,
          is_reviewed, reviewed_at, reviewed_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, NOW(), $13)
        RETURNING *`,
        [
          accountId,
          id,
          sector_id || null,
          round_robin_users || [],
          expiryDays,
          max_pending_invites || 100,
          withdraw_expired_invites !== false,
          send_start_hour || 9,
          send_end_hour || 18,
          timezone || 'America/Sao_Paulo',
          ai_initiate_delay_min || 5,
          ai_initiate_delay_max || 60,
          userId
        ]
      );
      config = insertResult.rows[0];
    }

    // Marcar campanha como revisada
    await db.query(
      'UPDATE campaigns SET review_completed = true WHERE id = $1',
      [id]
    );

    console.log('⚙️ ═══════════════════════════════════════════════════════════');
    console.log('⚙️ ✅ CONFIGURAÇÃO DE REVISÃO SALVA COM SUCESSO!');
    console.log(`⚙️    Config ID: ${config.id}`);
    console.log(`⚙️    Campaign ID: ${id}`);
    console.log('⚙️ ═══════════════════════════════════════════════════════════');
    console.log('\n');

    sendSuccess(res, config, 'Review configuration saved successfully');

  } catch (error) {
    console.error('⚙️ ❌ Erro ao salvar configuração:', error.message);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 12. OBTER CONFIGURAÇÃO DE REVISÃO
// ================================
const getReviewConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`🔍 Buscando configuração de revisão para campanha ${id}`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildCampaignSectorFilter(userId, accountId, 4);

    // Verificar se campanha pertence ao usuário E à conta
    const campaignResult = await db.query(
      `SELECT * FROM campaigns c WHERE c.id = $1 AND c.user_id = $2 AND c.account_id = $3 ${sectorFilter}`,
      [id, userId, accountId, ...sectorParams]
    );

    if (campaignResult.rows.length === 0) {
      throw new NotFoundError('Campaign not found');
    }

    // Buscar configuração
    const configResult = await db.query(
      `SELECT crc.*,
              s.name as sector_name,
              u.name as reviewed_by_name
       FROM campaign_review_config crc
       LEFT JOIN sectors s ON crc.sector_id = s.id
       LEFT JOIN users u ON crc.reviewed_by = u.id
       WHERE crc.campaign_id = $1`,
      [id]
    );

    if (configResult.rows.length === 0) {
      // Retornar configuração padrão se não existir
      sendSuccess(res, {
        campaign_id: id,
        sector_id: null,
        round_robin_users: [],
        invite_expiry_days: 7,
        max_pending_invites: 100,
        withdraw_expired_invites: true,
        send_start_hour: 9,
        send_end_hour: 18,
        timezone: 'America/Sao_Paulo',
        ai_initiate_delay_min: 5,
        ai_initiate_delay_max: 60,
        is_reviewed: false
      });
      return;
    }

    const config = configResult.rows[0];

    // Buscar detalhes dos usuários do round robin
    if (config.round_robin_users && config.round_robin_users.length > 0) {
      const usersResult = await db.query(
        'SELECT id, name, email, avatar_url FROM users WHERE id = ANY($1)',
        [config.round_robin_users]
      );
      config.round_robin_users_details = usersResult.rows;
    } else {
      config.round_robin_users_details = [];
    }

    console.log(`✅ Configuração de revisão encontrada`);

    sendSuccess(res, config);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 13. OBTER RELATÓRIO DA CAMPANHA
// ================================
const getCampaignReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { status, page = 1, limit = 50 } = req.query;

    console.log(`📊 Buscando relatório da campanha ${id}`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildCampaignSectorFilter(userId, accountId, 4);

    // Verificar se campanha pertence ao usuário E à conta
    const campaignResult = await db.query(
      `SELECT c.*,
              crc.invite_expiry_days,
              crc.sector_id,
              s.name as sector_name
       FROM campaigns c
       LEFT JOIN campaign_review_config crc ON c.id = crc.campaign_id
       LEFT JOIN sectors s ON crc.sector_id = s.id
       WHERE c.id = $1 AND c.user_id = $2 AND c.account_id = $3 ${sectorFilter}`,
      [id, userId, accountId, ...sectorParams]
    );

    if (campaignResult.rows.length === 0) {
      throw new NotFoundError('Campaign not found');
    }

    const campaign = campaignResult.rows[0];

    // Buscar relatório via inviteQueueService
    const report = await inviteQueueService.getCampaignReport(id, {
      status,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    // Adicionar informações da campanha
    report.campaign = {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      automation_active: campaign.automation_active,
      invite_expiry_days: campaign.invite_expiry_days || 7,
      sector_name: campaign.sector_name
    };

    console.log(`✅ Relatório da campanha gerado`);

    sendSuccess(res, report);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 14. OBTER STATUS DA FILA DE CONVITES
// ================================
const getQueueStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`📋 Buscando status da fila de convites para campanha ${id}`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildCampaignSectorFilter(userId, accountId, 4);

    // Verificar se campanha pertence ao usuário E à conta
    const campaignResult = await db.query(
      `SELECT * FROM campaigns c WHERE c.id = $1 AND c.user_id = $2 AND c.account_id = $3 ${sectorFilter}`,
      [id, userId, accountId, ...sectorParams]
    );

    if (campaignResult.rows.length === 0) {
      throw new NotFoundError('Campaign not found');
    }

    // Buscar contagens por status
    const statusCounts = await db.query(
      `SELECT status, COUNT(*) as count
       FROM campaign_invite_queue
       WHERE campaign_id = $1
       GROUP BY status`,
      [id]
    );

    // Organizar contagens
    const counts = {
      pending: 0,
      scheduled: 0,
      sent: 0,
      accepted: 0,
      expired: 0,
      withdrawn: 0,
      failed: 0
    };

    statusCounts.rows.forEach(row => {
      counts[row.status] = parseInt(row.count);
    });

    // Buscar próximos agendados
    const nextScheduled = await db.query(
      `SELECT ciq.id, ciq.scheduled_for, ct.name as contact_name
       FROM campaign_invite_queue ciq
       JOIN opportunities o ON ciq.opportunity_id = o.id
       LEFT JOIN contacts ct ON o.contact_id = ct.id
       WHERE ciq.campaign_id = $1 AND ciq.status = 'scheduled'
       ORDER BY ciq.scheduled_for ASC
       LIMIT 5`,
      [id]
    );

    // Buscar últimos enviados
    const lastSent = await db.query(
      `SELECT ciq.id, ciq.sent_at, ct.name as contact_name
       FROM campaign_invite_queue ciq
       JOIN opportunities o ON ciq.opportunity_id = o.id
       LEFT JOIN contacts ct ON o.contact_id = ct.id
       WHERE ciq.campaign_id = $1 AND ciq.status IN ('sent', 'accepted')
       ORDER BY ciq.sent_at DESC
       LIMIT 5`,
      [id]
    );

    console.log(`✅ Status da fila obtido`);

    sendSuccess(res, {
      campaign_id: id,
      counts,
      total: Object.values(counts).reduce((sum, c) => sum + c, 0),
      next_scheduled: nextScheduled.rows,
      last_sent: lastSent.rows
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 15. CANCELAR CAMPANHA
// ================================
const cancelCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`🛑 Cancelando campanha ${id}`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildCampaignSectorFilter(userId, accountId, 4);

    // Verificar se campanha pertence ao usuário E à conta
    const campaignResult = await db.query(
      `SELECT c.*, crc.withdraw_expired_invites
       FROM campaigns c
       LEFT JOIN campaign_review_config crc ON c.id = crc.campaign_id
       WHERE c.id = $1 AND c.user_id = $2 AND c.account_id = $3 ${sectorFilter}`,
      [id, userId, accountId, ...sectorParams]
    );

    if (campaignResult.rows.length === 0) {
      throw new NotFoundError('Campaign not found');
    }

    const campaign = campaignResult.rows[0];

    // Cancelar todos os convites pendentes e agendados
    const pendingInvites = await db.query(
      `SELECT ciq.*, o.linkedin_profile_id, la.unipile_account_id
       FROM campaign_invite_queue ciq
       JOIN opportunities o ON ciq.opportunity_id = o.id
       JOIN linkedin_accounts la ON ciq.linkedin_account_id = la.id
       WHERE ciq.campaign_id = $1 AND ciq.status IN ('pending', 'scheduled', 'sent')`,
      [id]
    );

    let withdrawnCount = 0;
    let cancelledCount = 0;

    for (const invite of pendingInvites.rows) {
      try {
        // Se o convite foi enviado e está configurado para retirar, chamar API
        if (invite.status === 'sent' && campaign.withdraw_expired_invites) {
          const { withdrawInvite } = require('../workers/linkedinInviteWorker');
          await withdrawInvite(
            invite.unipile_account_id,
            invite.linkedin_profile_id
          );
          withdrawnCount++;
        }

        // Marcar como cancelado
        await db.query(
          `UPDATE campaign_invite_queue SET status = 'withdrawn', withdrawn_at = NOW()
           WHERE id = $1`,
          [invite.id]
        );
        cancelledCount++;

      } catch (error) {
        console.error(`Erro ao cancelar convite ${invite.id}:`, error.message);
      }
    }

    // Atualizar status da campanha
    await db.query(
      `UPDATE campaigns SET
        automation_active = false,
        status = 'cancelled',
        pending_invites_count = 0
       WHERE id = $1`,
      [id]
    );

    console.log(`✅ Campanha cancelada - ${cancelledCount} convites cancelados, ${withdrawnCount} retirados`);

    sendSuccess(res, {
      campaign_id: id,
      cancelled_count: cancelledCount,
      withdrawn_count: withdrawnCount
    }, 'Campaign cancelled successfully');

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
  reactivateCampaign,
  stopCampaign,
  getCampaignStats,
  startCollection,
  getCollectionStatus,
  saveReviewConfig,
  getReviewConfig,
  getCampaignReport,
  getQueueStatus,
  cancelCampaign
};