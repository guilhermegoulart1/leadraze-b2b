// backend/src/controllers/campaignController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { 
  ValidationError,
  NotFoundError,
  ForbiddenError 
} = require('../utils/errors');
const { CAMPAIGN_STATUS } = require('../utils/helpers');

// ================================
// 1. LISTAR CAMPANHAS DO USUÁRIO
// ================================
const getCampaigns = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;

    console.log(`📋 Listando campanhas do usuário ${userId}`);

    // Construir query
    let whereConditions = ['c.user_id = $1'];
    let queryParams = [userId];
    let paramIndex = 2;

    // Filtro por status
    if (status) {
      whereConditions.push(`c.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.join(' AND ');

    // Query com JOIN para pegar dados da conta LinkedIn
    const query = `
      SELECT 
        c.*,
        la.linkedin_username,
        la.profile_name as linkedin_profile_name,
        la.status as linkedin_account_status,
        aa.name as ai_agent_name
      FROM campaigns c
      LEFT JOIN linkedin_accounts la ON c.linkedin_account_id = la.id
      LEFT JOIN ai_agents aa ON c.ai_agent_id = aa.id
      WHERE ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const campaigns = await db.query(query, queryParams);

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

    console.log(`🔍 Buscando campanha ${id}`);

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
      LEFT JOIN linkedin_accounts la ON c.linkedin_account_id = la.id
      LEFT JOIN ai_agents aa ON c.ai_agent_id = aa.id
      WHERE c.id = $1 AND c.user_id = $2
    `;

    const result = await db.query(query, [id, userId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Campaign not found');
    }

    const campaign = result.rows[0];

    console.log(`✅ Campanha encontrada: ${campaign.name}`);

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
    const {
      name,
      linkedin_account_id,
      ai_agent_id,
      industry,
      location,
      target_titles,
      target_keywords,
      template_message,
      daily_limit
    } = req.body;

    console.log(`📝 Criando nova campanha: ${name}`);

    // Validações básicas
    if (!name) {
      throw new ValidationError('Campaign name is required');
    }

    if (!linkedin_account_id) {
      throw new ValidationError('LinkedIn account is required');
    }

    // Verificar se a conta LinkedIn pertence ao usuário
    const linkedinAccount = await db.findOne('linkedin_accounts', {
      id: linkedin_account_id,
      user_id: userId
    });

    if (!linkedinAccount) {
      throw new NotFoundError('LinkedIn account not found');
    }

    // Se AI agent foi especificado, verificar se pertence ao usuário
    if (ai_agent_id) {
      const aiAgent = await db.findOne('ai_agents', {
        id: ai_agent_id,
        user_id: userId
      });

      if (!aiAgent) {
        throw new NotFoundError('AI Agent not found');
      }
    }

    // Criar campanha
    const campaignData = {
      user_id: userId,
      name,
      linkedin_account_id,
      ai_agent_id: ai_agent_id || null,
      status: CAMPAIGN_STATUS.DRAFT,
      automation_active: false,
      industry: industry || null,
      location: location || null,
      target_titles: target_titles ? JSON.stringify(target_titles) : null,
      target_keywords: target_keywords ? JSON.stringify(target_keywords) : null,
      template_message: template_message || null,
      daily_limit: daily_limit || 50
    };

    const campaign = await db.insert('campaigns', campaignData);

    console.log(`✅ Campanha criada: ${campaign.id}`);

    sendSuccess(res, campaign, 'Campaign created successfully', 201);

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

    console.log(`📝 Atualizando campanha ${id}`);

    // Verificar se campanha pertence ao usuário
    const campaign = await db.findOne('campaigns', { id, user_id: userId });

    if (!campaign) {
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

    console.log(`🗑️ Deletando campanha ${id}`);

    // Verificar se campanha pertence ao usuário
    const campaign = await db.findOne('campaigns', { id, user_id: userId });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    // Não permitir deletar campanhas ativas
    if (campaign.automation_active) {
      throw new ForbiddenError('Cannot delete active campaign. Pause it first.');
    }

    // Deletar (CASCADE vai deletar leads automaticamente)
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

    console.log(`▶️ Iniciando campanha ${id}`);

    // Verificar se campanha pertence ao usuário
    const campaign = await db.findOne('campaigns', { id, user_id: userId });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    // Verificar se já está ativa
    if (campaign.automation_active) {
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

    console.log(`⏸️ Pausando campanha ${id}`);

    // Verificar se campanha pertence ao usuário
    const campaign = await db.findOne('campaigns', { id, user_id: userId });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

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
// 8. OBTER ESTATÍSTICAS DA CAMPANHA
// ================================
const getCampaignStats = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`📊 Buscando estatísticas da campanha ${id}`);

    // Verificar se campanha pertence ao usuário
    const campaign = await db.findOne('campaigns', { id, user_id: userId });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

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

module.exports = {
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  startCampaign,
  pauseCampaign,
  getCampaignStats
};