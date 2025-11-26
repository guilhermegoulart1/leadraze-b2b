// backend/src/controllers/leadController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const {
  ValidationError,
  NotFoundError,
  ForbiddenError
} = require('../utils/errors');
const { LEAD_STATUS } = require('../utils/helpers');
const { getAccessibleSectorIds } = require('../middleware/permissions');

// ================================
// HELPER: Build sector filter for lead queries
// ================================
async function buildLeadSectorFilter(userId, accountId, paramIndex = 3) {
  const accessibleSectorIds = await getAccessibleSectorIds(userId, accountId);

  if (accessibleSectorIds.length > 0) {
    return {
      filter: `AND (l.sector_id = ANY($${paramIndex}) OR l.sector_id IS NULL)`,
      params: [accessibleSectorIds]
    };
  } else {
    return {
      filter: 'AND l.sector_id IS NULL',
      params: []
    };
  }
}

// ================================
// 1. LISTAR LEADS
// ================================
const getLeads = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      campaign_id,
      status,
      search,
      page = 1,
      limit = 1000 // Aumentado de 50 para 1000 para mostrar todos os leads
    } = req.query;

    console.log(`📋 Listando leads do usuário ${userId}`);

    // Construir query - MULTI-TENANCY: Filter by account_id
    // Support both campaign leads AND Google Maps leads (without campaign)
    let whereConditions = ['(l.account_id = $1 OR c.account_id = $1)'];
    let queryParams = [accountId];
    let paramIndex = 2;

    // SECTOR FILTER: Add sector filtering
    const { filter: sectorFilter, params: sectorParams } = await buildLeadSectorFilter(userId, accountId, paramIndex);
    if (sectorParams.length > 0) {
      whereConditions.push(sectorFilter.replace(/^AND /, '')); // Remove AND prefix since we're using whereConditions.join
      queryParams.push(...sectorParams);
      paramIndex += sectorParams.length;
    } else if (sectorFilter) {
      whereConditions.push(sectorFilter.replace(/^AND /, ''));
    }

    // Filtro por campanha
    if (campaign_id) {
      whereConditions.push(`l.campaign_id = $${paramIndex}`);
      queryParams.push(campaign_id);
      paramIndex++;
    }

    // Filtro por status
    if (status) {
      whereConditions.push(`l.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    // Busca por nome ou empresa
    if (search) {
      whereConditions.push(`(l.name ILIKE $${paramIndex} OR l.company ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.join(' AND ');

    // Query principal
    const query = `
      SELECT
        l.*,
        c.name as campaign_name,
        c.status as campaign_status,
        CASE
          WHEN l.status = 'invite_sent' AND l.sent_at IS NOT NULL
          THEN EXTRACT(DAY FROM NOW() - l.sent_at)::INTEGER
          ELSE 0
        END as days_since_invite
      FROM leads l
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      WHERE ${whereClause}
      ORDER BY
        CASE l.status
          WHEN 'qualified' THEN 1
          WHEN 'qualifying' THEN 2
          WHEN 'accepted' THEN 3
          WHEN 'invite_sent' THEN 4
          WHEN 'leads' THEN 5
          WHEN 'discarded' THEN 6
        END,
        l.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const leads = await db.query(query, queryParams);

    // Contar total
    const countQuery = `
      SELECT COUNT(*)
      FROM leads l
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      WHERE ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    console.log(`✅ Encontrados ${leads.rows.length} leads`);

    sendSuccess(res, {
      leads: leads.rows,
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
// 2. OBTER LEAD ESPECÍFICO
// ================================
const getLead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`🔍 Buscando lead ${id}`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildLeadSectorFilter(userId, accountId, 3);

    const query = `
      SELECT
        l.*,
        c.name as campaign_name,
        c.status as campaign_status,
        c.user_id as campaign_user_id,
        c.account_id as campaign_account_id,
        CASE
          WHEN l.status = 'invite_sent' AND l.sent_at IS NOT NULL
          THEN EXTRACT(DAY FROM NOW() - l.sent_at)::INTEGER
          ELSE 0
        END as days_since_invite
      FROM leads l
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      WHERE l.id = $1 AND (l.account_id = $2 OR c.account_id = $2) ${sectorFilter}
    `;

    const queryParams = [id, accountId, ...sectorParams];
    const result = await db.query(query, queryParams);

    if (result.rows.length === 0) {
      throw new NotFoundError('Lead not found');
    }

    const lead = result.rows[0];

    // Verificar se o lead pertence ao usuário
    if (lead.campaign_user_id !== userId) {
      throw new ForbiddenError('Access denied to this lead');
    }

    console.log(`✅ Lead encontrado: ${lead.name}`);

    sendSuccess(res, lead);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 3. CRIAR LEAD
// ================================
const createLead = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      campaign_id,
      linkedin_profile_id,
      provider_id,
      name,
      title,
      company,
      location,
      profile_url,
      profile_picture,
      headline
    } = req.body;

    console.log(`📝 Criando novo lead: ${name}`);

    // Validações
    if (!campaign_id || !name) {
      throw new ValidationError('campaign_id and name are required');
    }

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildLeadSectorFilter(userId, accountId, 4);

    // Verificar se campanha pertence ao usuário E à conta (MULTI-TENANCY + SECTOR)
    const campaign = await db.query(
      `SELECT * FROM campaigns WHERE id = $1 AND user_id = $2 AND account_id = $3 ${sectorFilter}`,
      [campaign_id, userId, accountId, ...sectorParams]
    );

    if (campaign.rows.length === 0) {
      throw new NotFoundError('Campaign not found');
    }

    // Verificar se lead já existe na campanha
    if (linkedin_profile_id) {
      const existingLead = await db.query(
        'SELECT id FROM leads WHERE campaign_id = $1 AND linkedin_profile_id = $2',
        [campaign_id, linkedin_profile_id]
      );

      if (existingLead.rows.length > 0) {
        throw new ValidationError('Lead already exists in this campaign');
      }
    }

    // Criar lead (inherit sector_id from campaign)
    const leadData = {
      campaign_id,
      sector_id: campaign.rows[0].sector_id || null,
      linkedin_profile_id: linkedin_profile_id || `manual_${Date.now()}`,
      provider_id: provider_id || null,
      name,
      title: title || null,
      company: company || null,
      location: location || null,
      profile_url: profile_url || null,
      profile_picture: profile_picture || null,
      headline: headline || null,
      status: LEAD_STATUS.LEADS,
      score: 0
    };

    const lead = await db.insert('leads', leadData);

    // Atualizar contador da campanha
    await db.query(
      'UPDATE campaigns SET total_leads = total_leads + 1, leads_pending = leads_pending + 1 WHERE id = $1',
      [campaign_id]
    );

    console.log(`✅ Lead criado: ${lead.id}`);

    sendSuccess(res, lead, 'Lead created successfully', 201);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 4. CRIAR LEADS EM LOTE
// ================================
const createLeadsBulk = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { campaign_id, leads } = req.body;

    console.log(`📦 Criando ${leads?.length || 0} leads em lote`);

    // Validações
    if (!campaign_id || !leads || !Array.isArray(leads) || leads.length === 0) {
      throw new ValidationError('campaign_id and leads array are required');
    }

    if (leads.length > 100) {
      throw new ValidationError('Maximum 100 leads per batch');
    }

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildLeadSectorFilter(userId, accountId, 4);

    // Verificar se campanha pertence ao usuário E à conta (MULTI-TENANCY + SECTOR)
    const campaign = await db.query(
      `SELECT * FROM campaigns WHERE id = $1 AND user_id = $2 AND account_id = $3 ${sectorFilter}`,
      [campaign_id, userId, accountId, ...sectorParams]
    );

    if (campaign.rows.length === 0) {
      throw new NotFoundError('Campaign not found');
    }

    const createdLeads = [];
    const errors = [];

    // Processar cada lead
    for (let i = 0; i < leads.length; i++) {
      const leadData = leads[i];

      try {
        // Validação básica
        if (!leadData.name) {
          throw new Error('name is required');
        }

        // Verificar duplicatas
        if (leadData.linkedin_profile_id) {
          const existing = await db.query(
            'SELECT id FROM leads WHERE campaign_id = $1 AND linkedin_profile_id = $2',
            [campaign_id, leadData.linkedin_profile_id]
          );

          if (existing.rows.length > 0) {
            throw new Error('Lead already exists');
          }
        }

        // Criar lead (inherit sector_id from campaign)
        const newLead = await db.insert('leads', {
          campaign_id,
          sector_id: campaign.rows[0].sector_id || null,
          linkedin_profile_id: leadData.linkedin_profile_id || `manual_${Date.now()}_${i}`,
          provider_id: leadData.provider_id || null,
          name: leadData.name,
          title: leadData.title || null,
          company: leadData.company || null,
          location: leadData.location || null,
          profile_url: leadData.profile_url || null,
          profile_picture: leadData.profile_picture || null,
          headline: leadData.headline || null,
          status: LEAD_STATUS.LEADS,
          score: 0
        });

        createdLeads.push(newLead);

      } catch (error) {
        errors.push({
          index: i,
          lead: leadData.name || 'Unknown',
          error: error.message
        });
      }
    }

    // Atualizar contadores da campanha
    if (createdLeads.length > 0) {
      await db.query(
        'UPDATE campaigns SET total_leads = total_leads + $1, leads_pending = leads_pending + $1 WHERE id = $2',
        [createdLeads.length, campaign_id]
      );
    }

    console.log(`✅ ${createdLeads.length} leads criados, ${errors.length} erros`);

    sendSuccess(res, {
      created: createdLeads.length,
      failed: errors.length,
      leads: createdLeads,
      errors: errors.length > 0 ? errors : undefined
    }, 'Bulk lead creation completed', 201);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 5. ATUALIZAR LEAD
// ================================
const updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      status,
      score,
      title,
      company,
      location,
      discard_reason,
      email,
      phone
    } = req.body;

    console.log(`📝 Atualizando lead ${id}`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildLeadSectorFilter(userId, accountId, 3);

    // Verificar se lead pertence ao usuário E à conta (MULTI-TENANCY + SECTOR)
    const leadCheck = await db.query(
      `SELECT l.*, c.user_id, c.account_id FROM leads l LEFT JOIN campaigns c ON l.campaign_id = c.id WHERE l.id = $1 AND (l.account_id = $2 OR c.account_id = $2) ${sectorFilter}`,
      [id, accountId, ...sectorParams]
    );

    if (leadCheck.rows.length === 0) {
      throw new NotFoundError('Lead not found');
    }

    const lead = leadCheck.rows[0];

    if (lead.user_id !== userId) {
      throw new ForbiddenError('Access denied to this lead');
    }

    // Preparar dados para atualização
    const updateData = {};

    if (status !== undefined) updateData.status = status;
    if (score !== undefined) updateData.score = score;
    if (title !== undefined) updateData.title = title;
    if (company !== undefined) updateData.company = company;
    if (location !== undefined) updateData.location = location;
    if (discard_reason !== undefined) updateData.discard_reason = discard_reason;

    // 📧📞 Atualizar dados de contato
    if (email !== undefined) {
      updateData.email = email;
      if (email && !lead.email) {
        updateData.email_captured_at = new Date();
        updateData.email_source = 'manual';
      }
    }
    if (phone !== undefined) {
      updateData.phone = phone;
      if (phone && !lead.phone) {
        updateData.phone_captured_at = new Date();
        updateData.phone_source = 'manual';
      }
    }

    // Adicionar timestamps baseado no status
    if (status) {
      if (status === LEAD_STATUS.INVITE_SENT && !lead.sent_at) {
        updateData.sent_at = new Date();
      } else if (status === LEAD_STATUS.ACCEPTED && !lead.accepted_at) {
        updateData.accepted_at = new Date();
      } else if (status === LEAD_STATUS.QUALIFYING && !lead.qualifying_started_at) {
        updateData.qualifying_started_at = new Date();
      } else if (status === LEAD_STATUS.QUALIFIED && !lead.qualified_at) {
        updateData.qualified_at = new Date();
      } else if (status === LEAD_STATUS.DISCARDED && !lead.discarded_at) {
        updateData.discarded_at = new Date();
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No fields to update');
    }

    // Atualizar
    const updatedLead = await db.update('leads', updateData, { id });

    // Atualizar contadores da campanha se mudou o status
    if (status && status !== lead.status) {
      await updateCampaignCounters(lead.campaign_id, lead.status, status);
    }

    console.log(`✅ Lead atualizado`);

    sendSuccess(res, updatedLead, 'Lead updated successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 6. DELETAR LEAD
// ================================
const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`🗑️ Deletando lead ${id}`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildLeadSectorFilter(userId, accountId, 3);

    // Verificar se lead pertence ao usuário E à conta (MULTI-TENANCY + SECTOR)
    const leadCheck = await db.query(
      `SELECT l.*, c.user_id, c.account_id FROM leads l LEFT JOIN campaigns c ON l.campaign_id = c.id WHERE l.id = $1 AND (l.account_id = $2 OR c.account_id = $2) ${sectorFilter}`,
      [id, accountId, ...sectorParams]
    );

    if (leadCheck.rows.length === 0) {
      throw new NotFoundError('Lead not found');
    }

    const lead = leadCheck.rows[0];

    if (lead.user_id !== userId) {
      throw new ForbiddenError('Access denied to this lead');
    }

    // Não permitir deletar leads que já aceitaram
    if (lead.status === LEAD_STATUS.ACCEPTED || 
        lead.status === LEAD_STATUS.QUALIFYING || 
        lead.status === LEAD_STATUS.QUALIFIED) {
      throw new ForbiddenError('Cannot delete leads in active conversation. Discard instead.');
    }

    // Deletar
    await db.delete('leads', { id });

    // Atualizar contadores
    await db.query(
      `UPDATE campaigns 
       SET 
         total_leads = GREATEST(0, total_leads - 1),
         leads_pending = CASE WHEN $1 = 'leads' THEN GREATEST(0, leads_pending - 1) ELSE leads_pending END,
         leads_sent = CASE WHEN $1 = 'invite_sent' THEN GREATEST(0, leads_sent - 1) ELSE leads_sent END
       WHERE id = $2`,
      [lead.status, lead.campaign_id]
    );

    console.log(`✅ Lead deletado`);

    sendSuccess(res, null, 'Lead deleted successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 7. OBTER LEADS DE UMA CAMPANHA
// ================================
const getCampaignLeads = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { status, page = 1, limit = 1000 } = req.query; // Aumentado de 50 para 1000

    console.log(`📋 Buscando leads da campanha ${campaignId}`);

    // Verificar se campanha pertence ao usuário E à conta (MULTI-TENANCY)
    // Nota: sector filter é aplicado aos leads, não à campanha
    const campaign = await db.query(
      `SELECT * FROM campaigns WHERE id = $1 AND user_id = $2 AND account_id = $3`,
      [campaignId, userId, accountId]
    );

    if (campaign.rows.length === 0) {
      throw new NotFoundError('Campaign not found');
    }

    // Construir query
    let whereConditions = ['l.campaign_id = $1'];
    let queryParams = [campaignId];
    let paramIndex = 2;

    if (status) {
      whereConditions.push(`l.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.join(' AND ');

    const query = `
      SELECT 
        l.*,
        CASE 
          WHEN l.status = 'invite_sent' AND l.sent_at IS NOT NULL 
          THEN EXTRACT(DAY FROM NOW() - l.sent_at)::INTEGER
          ELSE 0
        END as days_since_invite
      FROM leads l
      WHERE ${whereClause}
      ORDER BY 
        CASE l.status
          WHEN 'qualified' THEN 1
          WHEN 'qualifying' THEN 2
          WHEN 'accepted' THEN 3
          WHEN 'invite_sent' THEN 4
          WHEN 'leads' THEN 5
          WHEN 'discarded' THEN 6
        END,
        l.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const leads = await db.query(query, queryParams);

    // Contar total
    const countQuery = `SELECT COUNT(*) FROM leads l WHERE ${whereClause}`;
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    console.log(`✅ Encontrados ${leads.rows.length} leads`);

    sendSuccess(res, {
      campaign_id: campaignId,
      campaign_name: campaign.rows[0].name,
      leads: leads.rows,
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
// HELPER: Atualizar Contadores
// ================================
async function updateCampaignCounters(campaignId, oldStatus, newStatus) {
  const decrementField = getCounterField(oldStatus);
  const incrementField = getCounterField(newStatus);

  const updates = [];
  
  if (decrementField) {
    updates.push(`${decrementField} = GREATEST(0, ${decrementField} - 1)`);
  }
  
  if (incrementField) {
    updates.push(`${incrementField} = ${incrementField} + 1`);
  }

  if (updates.length > 0) {
    await db.query(
      `UPDATE campaigns SET ${updates.join(', ')} WHERE id = $1`,
      [campaignId]
    );
  }
}

function getCounterField(status) {
  const mapping = {
    'leads': 'leads_pending',
    'invite_sent': 'leads_sent',
    'accepted': 'leads_accepted',
    'qualifying': 'leads_qualifying',
    'qualified': 'leads_qualified',
    'discarded': 'leads_discarded'
  };
  
  return mapping[status] || null;
}

module.exports = {
  getLeads,
  getLead,
  createLead,
  createLeadsBulk,
  updateLead,
  deleteLead,
  getCampaignLeads
};