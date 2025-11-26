// backend/src/controllers/activationCampaignController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const {
  ValidationError,
  NotFoundError,
  ForbiddenError
} = require('../utils/errors');
const { getAccessibleSectorIds } = require('../middleware/permissions');
const { startCampaignInvites, cancelCampaignInvites } = require('../workers/linkedinInviteWorker');

// ================================
// HELPER: Build sector filter for activation campaign queries
// ================================
async function buildActivationCampaignSectorFilter(userId, accountId, paramIndex = 3) {
  const accessibleSectorIds = await getAccessibleSectorIds(userId, accountId);

  if (accessibleSectorIds.length > 0) {
    return {
      filter: `AND (ac.sector_id = ANY($${paramIndex}) OR ac.sector_id IS NULL)`,
      params: [accessibleSectorIds]
    };
  } else {
    return {
      filter: 'AND ac.sector_id IS NULL',
      params: []
    };
  }
}

// ================================
// 1. LISTAR CAMPANHAS DE ATIVAÇÃO
// ================================
const getActivationCampaigns = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { status, page = 1, limit = 20 } = req.query;

    console.log(`📋 Listando campanhas de ativação do usuário ${userId} (conta ${accountId})`);

    // Construir query - MULTI-TENANCY + SECTOR filtering
    let whereConditions = ['ac.account_id = $1', 'ac.user_id = $2'];
    let queryParams = [accountId, userId];
    let paramIndex = 3;

    // SECTOR FILTER: Add sector filtering
    const { filter: sectorFilter, params: sectorParams } = await buildActivationCampaignSectorFilter(userId, accountId, paramIndex);
    if (sectorParams.length > 0) {
      whereConditions.push(sectorFilter.replace(/^AND /, ''));
      queryParams.push(...sectorParams);
      paramIndex += sectorParams.length;
    } else if (sectorFilter) {
      whereConditions.push(sectorFilter.replace(/^AND /, ''));
    }

    // Filtro por status
    if (status) {
      whereConditions.push(`ac.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.join(' AND ');

    // Query com joins para dados relacionados (multi-channel support)
    const query = `
      SELECT
        ac.*,
        cl.name as list_name,
        cl.total_contacts as list_total_contacts,
        email_agent.name as email_agent_name,
        whatsapp_agent.name as whatsapp_agent_name,
        linkedin_agent.name as linkedin_agent_name,
        u.name as creator_name,
        s.name as sector_name,
        la.profile_name as linkedin_account_name
      FROM activation_campaigns ac
      LEFT JOIN contact_lists cl ON ac.list_id = cl.id
      LEFT JOIN activation_agents email_agent ON ac.email_agent_id = email_agent.id
      LEFT JOIN activation_agents whatsapp_agent ON ac.whatsapp_agent_id = whatsapp_agent.id
      LEFT JOIN activation_agents linkedin_agent ON ac.linkedin_agent_id = linkedin_agent.id
      LEFT JOIN users u ON ac.user_id = u.id
      LEFT JOIN sectors s ON ac.sector_id = s.id
      LEFT JOIN linkedin_accounts la ON ac.linkedin_account_id = la.id
      WHERE ${whereClause}
      ORDER BY ac.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);

    // Contar total
    const countQuery = `
      SELECT COUNT(DISTINCT ac.id)
      FROM activation_campaigns ac
      WHERE ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    console.log(`✅ Encontradas ${result.rows.length} campanhas de ativação`);

    sendSuccess(res, {
      campaigns: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Erro ao listar campanhas de ativação:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 2. OBTER CAMPANHA ESPECÍFICA
// ================================
const getActivationCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`🔍 Buscando campanha de ativação ${id} (conta ${accountId})`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildActivationCampaignSectorFilter(userId, accountId, 4);

    const query = `
      SELECT
        ac.*,
        cl.name as list_name,
        cl.total_contacts as list_total_contacts,
        cl.list_type as list_type,
        email_agent.name as email_agent_name,
        email_agent.activation_type as email_agent_type,
        email_agent.personality as email_agent_personality,
        email_agent.tone as email_agent_tone,
        email_agent.initial_message as email_agent_initial_message,
        whatsapp_agent.name as whatsapp_agent_name,
        whatsapp_agent.activation_type as whatsapp_agent_type,
        whatsapp_agent.personality as whatsapp_agent_personality,
        whatsapp_agent.tone as whatsapp_agent_tone,
        whatsapp_agent.initial_message as whatsapp_agent_initial_message,
        linkedin_agent.name as linkedin_agent_name,
        linkedin_agent.activation_type as linkedin_agent_type,
        linkedin_agent.personality as linkedin_agent_personality,
        linkedin_agent.tone as linkedin_agent_tone,
        linkedin_agent.initial_message as linkedin_agent_initial_message,
        u.name as creator_name,
        u.email as creator_email,
        s.name as sector_name,
        la.profile_name as linkedin_account_name,
        la.linkedin_username as linkedin_username
      FROM activation_campaigns ac
      LEFT JOIN contact_lists cl ON ac.list_id = cl.id
      LEFT JOIN activation_agents email_agent ON ac.email_agent_id = email_agent.id
      LEFT JOIN activation_agents whatsapp_agent ON ac.whatsapp_agent_id = whatsapp_agent.id
      LEFT JOIN activation_agents linkedin_agent ON ac.linkedin_agent_id = linkedin_agent.id
      LEFT JOIN users u ON ac.user_id = u.id
      LEFT JOIN sectors s ON ac.sector_id = s.id
      LEFT JOIN linkedin_accounts la ON ac.linkedin_account_id = la.id
      WHERE ac.id = $1 AND ac.account_id = $3 AND ac.user_id = $2 ${sectorFilter}
    `;

    const result = await db.query(query, [id, userId, accountId, ...sectorParams]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Campanha de ativação não encontrada');
    }

    console.log(`✅ Campanha de ativação encontrada: ${result.rows[0].name}`);

    sendSuccess(res, { campaign: result.rows[0] });

  } catch (error) {
    console.error('❌ Erro ao buscar campanha de ativação:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 3. CRIAR CAMPANHA DE ATIVAÇÃO
// ================================
const createActivationCampaign = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      name,
      description,
      contact_list_id,
      // Multi-channel agent IDs
      email_agent_id,
      whatsapp_agent_id,
      linkedin_agent_id,
      // Activation flags
      activate_email,
      activate_whatsapp,
      activate_linkedin,
      // Settings
      daily_limit = 50,
      linkedin_account_id,
      whatsapp_account_id,
      email_account_id,
      sector_id,
      start_date
    } = req.body;

    console.log(`➕ Criando nova campanha de ativação para usuário ${userId}`);

    // Validação básica
    if (!name || name.trim() === '') {
      throw new ValidationError('Nome da campanha é obrigatório');
    }

    if (!contact_list_id) {
      throw new ValidationError('Lista de contatos é obrigatória');
    }

    // Validar que pelo menos um canal está ativado
    if (!activate_email && !activate_whatsapp && !activate_linkedin) {
      throw new ValidationError('Ative pelo menos um canal de comunicação');
    }

    // Validar que canais ativos têm agentes selecionados
    if (activate_email && !email_agent_id) {
      throw new ValidationError('Selecione um agente de Email');
    }
    if (activate_whatsapp && !whatsapp_agent_id) {
      throw new ValidationError('Selecione um agente de WhatsApp');
    }
    if (activate_linkedin && !linkedin_agent_id) {
      throw new ValidationError('Selecione um agente de LinkedIn');
    }

    if (daily_limit < 1 || daily_limit > 1000) {
      throw new ValidationError('Limite diário deve estar entre 1 e 1000');
    }

    // Verificar se a lista existe e pertence ao usuário
    const listCheck = await db.query(
      'SELECT * FROM contact_lists WHERE id = $1 AND account_id = $2 AND user_id = $3',
      [contact_list_id, accountId, userId]
    );

    if (listCheck.rows.length === 0) {
      throw new ValidationError('Lista de contatos não encontrada');
    }

    // Verificar agentes ativados
    if (activate_email && email_agent_id) {
      const agentCheck = await db.query(
        'SELECT * FROM activation_agents WHERE id = $1 AND account_id = $2 AND user_id = $3 AND activation_type = $4',
        [email_agent_id, accountId, userId, 'email']
      );

      if (agentCheck.rows.length === 0) {
        throw new ValidationError('Agente de Email não encontrado ou tipo incorreto');
      }
    }

    if (activate_whatsapp && whatsapp_agent_id) {
      const agentCheck = await db.query(
        'SELECT * FROM activation_agents WHERE id = $1 AND account_id = $2 AND user_id = $3 AND activation_type = $4',
        [whatsapp_agent_id, accountId, userId, 'whatsapp']
      );

      if (agentCheck.rows.length === 0) {
        throw new ValidationError('Agente de WhatsApp não encontrado ou tipo incorreto');
      }
    }

    if (activate_linkedin && linkedin_agent_id) {
      const agentCheck = await db.query(
        'SELECT * FROM activation_agents WHERE id = $1 AND account_id = $2 AND user_id = $3 AND activation_type = $4',
        [linkedin_agent_id, accountId, userId, 'linkedin']
      );

      if (agentCheck.rows.length === 0) {
        throw new ValidationError('Agente de LinkedIn não encontrado ou tipo incorreto');
      }
    }

    // Verificar conta LinkedIn se ativado
    if (activate_linkedin && linkedin_account_id) {
      const linkedinCheck = await db.query(
        'SELECT id FROM linkedin_accounts WHERE id = $1 AND account_id = $2',
        [linkedin_account_id, accountId]
      );

      if (linkedinCheck.rows.length === 0) {
        throw new ValidationError('Conta LinkedIn não encontrada');
      }
    }

    // Verificar setor se fornecido
    if (sector_id) {
      const sectorCheck = await db.query(
        'SELECT id FROM sectors WHERE id = $1 AND account_id = $2',
        [sector_id, accountId]
      );

      if (sectorCheck.rows.length === 0) {
        throw new ValidationError('Setor inválido');
      }
    }

    // Criar campanha com estrutura multi-canal
    const query = `
      INSERT INTO activation_campaigns (
        account_id,
        user_id,
        sector_id,
        name,
        description,
        list_id,
        email_agent_id,
        whatsapp_agent_id,
        linkedin_agent_id,
        activate_email,
        activate_whatsapp,
        activate_linkedin,
        daily_limit,
        linkedin_account_id,
        whatsapp_account_id,
        email_account_id,
        status,
        start_date,
        total_contacts
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'draft', $17, $18)
      RETURNING *
    `;

    const listTotalContacts = listCheck.rows[0].total_contacts || 0;

    const result = await db.query(query, [
      accountId,
      userId,
      sector_id || null,
      name.trim(),
      description?.trim() || null,
      contact_list_id,
      email_agent_id || null,
      whatsapp_agent_id || null,
      linkedin_agent_id || null,
      activate_email || false,
      activate_whatsapp || false,
      activate_linkedin || false,
      daily_limit,
      linkedin_account_id || null,
      whatsapp_account_id || null,
      email_account_id || null,
      start_date || null,
      listTotalContacts
    ]);

    console.log(`✅ Campanha de ativação criada com sucesso: ${result.rows[0].id}`);

    sendSuccess(res, { campaign: result.rows[0] }, 201);

  } catch (error) {
    console.error('❌ Erro ao criar campanha de ativação:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 4. ATUALIZAR CAMPANHA DE ATIVAÇÃO
// ================================
const updateActivationCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      name,
      description,
      daily_limit,
      linkedin_account_id,
      whatsapp_account_id,
      email_account_id,
      sector_id,
      start_date
    } = req.body;

    console.log(`📝 Atualizando campanha de ativação ${id}`);

    // Verificar se a campanha existe e pertence ao usuário
    const { filter: sectorFilter, params: sectorParams } = await buildActivationCampaignSectorFilter(userId, accountId, 4);

    const checkQuery = `
      SELECT * FROM activation_campaigns
      WHERE id = $1 AND account_id = $3 AND user_id = $2 ${sectorFilter}
    `;

    const checkResult = await db.query(checkQuery, [id, userId, accountId, ...sectorParams]);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Campanha de ativação não encontrada');
    }

    const campaign = checkResult.rows[0];

    // Não permitir atualização de campanhas ativas
    if (campaign.status === 'active') {
      throw new ValidationError('Não é possível atualizar campanha ativa. Pause a campanha primeiro.');
    }

    // Construir query de atualização
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      if (!name || name.trim() === '') {
        throw new ValidationError('Nome da campanha não pode ser vazio');
      }
      updates.push(`name = $${paramIndex}`);
      values.push(name.trim());
      paramIndex++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(description?.trim() || null);
      paramIndex++;
    }

    if (daily_limit !== undefined) {
      if (daily_limit < 1 || daily_limit > 1000) {
        throw new ValidationError('Limite diário deve estar entre 1 e 1000');
      }
      updates.push(`daily_limit = $${paramIndex}`);
      values.push(daily_limit);
      paramIndex++;
    }

    if (linkedin_account_id !== undefined) {
      if (linkedin_account_id) {
        const linkedinCheck = await db.query(
          'SELECT id FROM linkedin_accounts WHERE id = $1 AND account_id = $2',
          [linkedin_account_id, accountId]
        );

        if (linkedinCheck.rows.length === 0) {
          throw new ValidationError('Conta LinkedIn não encontrada');
        }
      }
      updates.push(`linkedin_account_id = $${paramIndex}`);
      values.push(linkedin_account_id);
      paramIndex++;
    }

    if (whatsapp_account_id !== undefined) {
      updates.push(`whatsapp_account_id = $${paramIndex}`);
      values.push(whatsapp_account_id);
      paramIndex++;
    }

    if (email_account_id !== undefined) {
      updates.push(`email_account_id = $${paramIndex}`);
      values.push(email_account_id);
      paramIndex++;
    }

    if (sector_id !== undefined) {
      if (sector_id) {
        const sectorCheck = await db.query(
          'SELECT id FROM sectors WHERE id = $1 AND account_id = $2',
          [sector_id, accountId]
        );

        if (sectorCheck.rows.length === 0) {
          throw new ValidationError('Setor inválido');
        }
      }
      updates.push(`sector_id = $${paramIndex}`);
      values.push(sector_id);
      paramIndex++;
    }

    if (start_date !== undefined) {
      updates.push(`start_date = $${paramIndex}`);
      values.push(start_date);
      paramIndex++;
    }

    if (updates.length === 0) {
      throw new ValidationError('Nenhum campo para atualizar');
    }

    // Adicionar updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // Adicionar ID e account_id aos valores
    values.push(id, accountId, userId);

    const updateQuery = `
      UPDATE activation_campaigns
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND account_id = $${paramIndex + 1} AND user_id = $${paramIndex + 2}
      RETURNING *
    `;

    const result = await db.query(updateQuery, values);

    console.log(`✅ Campanha de ativação atualizada com sucesso`);

    sendSuccess(res, { campaign: result.rows[0] });

  } catch (error) {
    console.error('❌ Erro ao atualizar campanha de ativação:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 5. DELETAR CAMPANHA DE ATIVAÇÃO
// ================================
const deleteActivationCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`🗑️ Deletando campanha de ativação ${id}`);

    // Verificar se a campanha existe e pertence ao usuário
    const { filter: sectorFilter, params: sectorParams } = await buildActivationCampaignSectorFilter(userId, accountId, 4);

    const checkQuery = `
      SELECT * FROM activation_campaigns
      WHERE id = $1 AND account_id = $3 AND user_id = $2 ${sectorFilter}
    `;

    const checkResult = await db.query(checkQuery, [id, userId, accountId, ...sectorParams]);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Campanha de ativação não encontrada');
    }

    const campaign = checkResult.rows[0];

    // Não permitir deletar campanhas ativas
    if (campaign.status === 'active') {
      throw new ValidationError('Não é possível deletar campanha ativa. Pare a campanha primeiro.');
    }

    // Deletar campanha (contatos serão deletados em cascata)
    await db.query(
      'DELETE FROM activation_campaigns WHERE id = $1 AND account_id = $2 AND user_id = $3',
      [id, accountId, userId]
    );

    console.log(`✅ Campanha de ativação deletada com sucesso`);

    sendSuccess(res, { message: 'Campanha de ativação deletada com sucesso' });

  } catch (error) {
    console.error('❌ Erro ao deletar campanha de ativação:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 6. INICIAR CAMPANHA
// ================================
const startCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`▶️ Iniciando campanha de ativação ${id}`);

    // Verificar se a campanha existe
    const { filter: sectorFilter, params: sectorParams } = await buildActivationCampaignSectorFilter(userId, accountId, 4);

    const checkQuery = `
      SELECT
        ac.*,
        email_agent.is_active as email_agent_active,
        whatsapp_agent.is_active as whatsapp_agent_active,
        linkedin_agent.is_active as linkedin_agent_active
      FROM activation_campaigns ac
      LEFT JOIN activation_agents email_agent ON ac.email_agent_id = email_agent.id
      LEFT JOIN activation_agents whatsapp_agent ON ac.whatsapp_agent_id = whatsapp_agent.id
      LEFT JOIN activation_agents linkedin_agent ON ac.linkedin_agent_id = linkedin_agent.id
      WHERE ac.id = $1 AND ac.account_id = $3 AND ac.user_id = $2 ${sectorFilter}
    `;

    const checkResult = await db.query(checkQuery, [id, userId, accountId, ...sectorParams]);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Campanha de ativação não encontrada');
    }

    const campaign = checkResult.rows[0];

    // Validações
    if (campaign.status === 'active') {
      throw new ValidationError('Campanha já está ativa');
    }

    // Validar que pelo menos um agente ativo está configurado
    const hasActiveAgent =
      (campaign.activate_email && campaign.email_agent_active) ||
      (campaign.activate_whatsapp && campaign.whatsapp_agent_active) ||
      (campaign.activate_linkedin && campaign.linkedin_agent_active);

    if (!hasActiveAgent) {
      throw new ValidationError('Nenhum agente de ativação ativo está configurado');
    }

    if (campaign.total_contacts === 0) {
      throw new ValidationError('A lista não contém contatos para ativar');
    }

    // Atualizar status para active
    await db.query(
      `UPDATE activation_campaigns
       SET status = 'active', start_date = COALESCE(start_date, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    // Iniciar processo de envio de convites via worker (LinkedIn)
    let invitesScheduled = 0;
    if (campaign.activate_linkedin && campaign.linkedin_agent_active) {
      try {
        console.log('🚀 Iniciando envio de convites do LinkedIn via worker...');
        const result = await startCampaignInvites(id, {
          dailyLimit: campaign.daily_limit || 100
        });
        invitesScheduled = result.scheduled || 0;
        console.log(`✅ ${invitesScheduled} convites do LinkedIn agendados`);
      } catch (workerError) {
        console.error('⚠️ Erro ao iniciar worker de convites:', workerError);
        // Não falhar a ativação da campanha se worker der erro
      }
    }

    console.log(`✅ Campanha de ativação iniciada com sucesso`);

    sendSuccess(res, {
      message: 'Campanha iniciada com sucesso',
      campaign_id: id,
      linkedin_invites_scheduled: invitesScheduled
    });

  } catch (error) {
    console.error('❌ Erro ao iniciar campanha:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 7. PAUSAR CAMPANHA
// ================================
const pauseCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`⏸️ Pausando campanha de ativação ${id}`);

    // Verificar se a campanha existe
    const { filter: sectorFilter, params: sectorParams } = await buildActivationCampaignSectorFilter(userId, accountId, 4);

    const checkQuery = `
      SELECT * FROM activation_campaigns
      WHERE id = $1 AND account_id = $3 AND user_id = $2 ${sectorFilter}
    `;

    const checkResult = await db.query(checkQuery, [id, userId, accountId, ...sectorParams]);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Campanha de ativação não encontrada');
    }

    const campaign = checkResult.rows[0];

    if (campaign.status !== 'active') {
      throw new ValidationError('Apenas campanhas ativas podem ser pausadas');
    }

    // Atualizar status para paused
    await db.query(
      `UPDATE activation_campaigns
       SET status = 'paused', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    // Cancelar convites pendentes do LinkedIn
    let invitesCanceled = 0;
    try {
      console.log('🛑 Cancelando convites pendentes do LinkedIn...');
      const result = await cancelCampaignInvites(id);
      invitesCanceled = result.canceled || 0;
      console.log(`✅ ${invitesCanceled} convites cancelados`);
    } catch (cancelError) {
      console.error('⚠️ Erro ao cancelar convites:', cancelError);
      // Não falhar a pausa da campanha se cancelamento der erro
    }

    console.log(`✅ Campanha pausada com sucesso`);

    sendSuccess(res, {
      message: 'Campanha pausada com sucesso',
      linkedin_invites_canceled: invitesCanceled
    });

  } catch (error) {
    console.error('❌ Erro ao pausar campanha:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 8. RETOMAR CAMPANHA
// ================================
const resumeCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`▶️ Retomando campanha de ativação ${id}`);

    // Verificar se a campanha existe
    const { filter: sectorFilter, params: sectorParams } = await buildActivationCampaignSectorFilter(userId, accountId, 4);

    const checkQuery = `
      SELECT * FROM activation_campaigns
      WHERE id = $1 AND account_id = $3 AND user_id = $2 ${sectorFilter}
    `;

    const checkResult = await db.query(checkQuery, [id, userId, accountId, ...sectorParams]);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Campanha de ativação não encontrada');
    }

    const campaign = checkResult.rows[0];

    if (campaign.status !== 'paused') {
      throw new ValidationError('Apenas campanhas pausadas podem ser retomadas');
    }

    // Atualizar status para active
    await db.query(
      `UPDATE activation_campaigns
       SET status = 'active', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    console.log(`✅ Campanha retomada com sucesso`);

    sendSuccess(res, { message: 'Campanha retomada com sucesso' });

  } catch (error) {
    console.error('❌ Erro ao retomar campanha:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 9. PARAR CAMPANHA
// ================================
const stopCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`⏹️ Parando campanha de ativação ${id}`);

    // Verificar se a campanha existe
    const { filter: sectorFilter, params: sectorParams } = await buildActivationCampaignSectorFilter(userId, accountId, 4);

    const checkQuery = `
      SELECT * FROM activation_campaigns
      WHERE id = $1 AND account_id = $3 AND user_id = $2 ${sectorFilter}
    `;

    const checkResult = await db.query(checkQuery, [id, userId, accountId, ...sectorParams]);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Campanha de ativação não encontrada');
    }

    const campaign = checkResult.rows[0];

    if (campaign.status === 'stopped' || campaign.status === 'completed') {
      throw new ValidationError('Campanha já está parada ou completa');
    }

    // Atualizar status para stopped
    await db.query(
      `UPDATE activation_campaigns
       SET status = 'stopped', end_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    console.log(`✅ Campanha parada com sucesso`);

    sendSuccess(res, { message: 'Campanha parada com sucesso' });

  } catch (error) {
    console.error('❌ Erro ao parar campanha:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 10. OBTER ESTATÍSTICAS DA CAMPANHA
// ================================
const getCampaignStats = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`📊 Obtendo estatísticas da campanha ${id}`);

    // Verificar se a campanha existe
    const { filter: sectorFilter, params: sectorParams } = await buildActivationCampaignSectorFilter(userId, accountId, 4);

    const campaignQuery = `
      SELECT * FROM activation_campaigns
      WHERE id = $1 AND account_id = $3 AND user_id = $2 ${sectorFilter}
    `;

    const campaignResult = await db.query(campaignQuery, [id, userId, accountId, ...sectorParams]);

    if (campaignResult.rows.length === 0) {
      throw new NotFoundError('Campanha de ativação não encontrada');
    }

    const campaign = campaignResult.rows[0];

    // Buscar estatísticas detalhadas dos contatos
    const statsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'responded' THEN 1 END) as responded,
        COUNT(CASE WHEN status = 'skipped' THEN 1 END) as skipped
      FROM activation_campaign_contacts
      WHERE campaign_id = $1
    `;

    const statsResult = await db.query(statsQuery, [id]);

    const stats = {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        // Multi-channel activation flags
        activate_email: campaign.activate_email,
        activate_whatsapp: campaign.activate_whatsapp,
        activate_linkedin: campaign.activate_linkedin,
        daily_limit: campaign.daily_limit,
        start_date: campaign.start_date,
        end_date: campaign.end_date,
        last_activation_at: campaign.last_activation_at
      },
      contacts: {
        total: parseInt(statsResult.rows[0].total) || 0,
        pending: parseInt(statsResult.rows[0].pending) || 0,
        scheduled: parseInt(statsResult.rows[0].scheduled) || 0,
        sent: parseInt(statsResult.rows[0].sent) || 0,
        delivered: parseInt(statsResult.rows[0].delivered) || 0,
        failed: parseInt(statsResult.rows[0].failed) || 0,
        responded: parseInt(statsResult.rows[0].responded) || 0,
        skipped: parseInt(statsResult.rows[0].skipped) || 0
      },
      progress: {
        percentage: campaign.total_contacts > 0
          ? Math.round((campaign.contacts_activated / campaign.total_contacts) * 100)
          : 0,
        remaining: campaign.total_contacts - campaign.contacts_activated
      }
    };

    console.log(`✅ Estatísticas obtidas com sucesso`);

    sendSuccess(res, { stats });

  } catch (error) {
    console.error('❌ Erro ao obter estatísticas:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// EXPORTS
// ================================
module.exports = {
  getActivationCampaigns,
  getActivationCampaign,
  createActivationCampaign,
  updateActivationCampaign,
  deleteActivationCampaign,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  stopCampaign,
  getCampaignStats
};
