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
const roundRobinService = require('../services/roundRobinService');
const checklistService = require('../services/checklistService');

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
      sort_field = 'created_at',
      sort_direction = 'desc',
      page = 1,
      limit = 50 // Limite otimizado para performance
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

    // Validar campos de ordenação para evitar SQL injection
    const validSortFields = ['created_at', 'updated_at', 'name', 'company', 'status', 'score'];
    const safeSortField = validSortFields.includes(sort_field) ? sort_field : 'created_at';
    const safeSortDirection = sort_direction === 'asc' ? 'ASC' : 'DESC';

    // Query principal com COUNT(*) OVER() para evitar query separada
    const query = `
      SELECT
        l.*,
        c.name as campaign_name,
        c.status as campaign_status,
        CASE
          WHEN l.status = 'invite_sent' AND l.sent_at IS NOT NULL
          THEN EXTRACT(DAY FROM NOW() - l.sent_at)::INTEGER
          ELSE 0
        END as days_since_invite,
        ru.id as responsible_id,
        ru.name as responsible_name,
        ru.email as responsible_email,
        ru.avatar_url as responsible_avatar,
        -- Contact details from contacts table (apenas campos essenciais para listagem)
        ct.phone,
        ct.email,
        COALESCE(l.title, ct.title) as title,
        -- Total count usando window function (elimina query separada)
        COUNT(*) OVER() as total_count
      FROM leads l
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      LEFT JOIN users ru ON l.responsible_user_id = ru.id
      LEFT JOIN contact_leads cl ON cl.lead_id = l.id
      LEFT JOIN contacts ct ON ct.id = cl.contact_id
      WHERE ${whereClause}
      ORDER BY l.${safeSortField} ${safeSortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const leads = await db.query(query, queryParams);

    // Buscar tags para todos os leads via contato vinculado (contact_tags)
    if (leads.rows.length > 0) {
      const leadIds = leads.rows.map(l => l.id);
      const tagsQuery = `
        SELECT cl.lead_id, t.id, t.name, t.color, t.created_at
        FROM tags t
        JOIN contact_tags ct ON ct.tag_id = t.id
        JOIN contact_leads cl ON cl.contact_id = ct.contact_id
        WHERE cl.lead_id = ANY($1)
        ORDER BY t.name ASC
      `;
      const tagsResult = await db.query(tagsQuery, [leadIds]);

      // Mapear tags para os leads
      const tagsByLead = {};
      tagsResult.rows.forEach(tag => {
        if (!tagsByLead[tag.lead_id]) {
          tagsByLead[tag.lead_id] = [];
        }
        tagsByLead[tag.lead_id].push({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          created_at: tag.created_at
        });
      });

      // Adicionar tags aos leads
      leads.rows.forEach(lead => {
        lead.tags = tagsByLead[lead.id] || [];
      });
    }

    // Total vem da window function (sem query separada)
    const total = leads.rows.length > 0 ? parseInt(leads.rows[0].total_count) : 0;

    console.log(`✅ Encontrados ${leads.rows.length} leads (total: ${total})`);

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
        END as days_since_invite,
        -- Responsible user
        ru.id as responsible_id,
        ru.name as responsible_name,
        ru.email as responsible_email,
        ru.avatar_url as responsible_avatar,
        -- Contact details from contacts table
        ct.phone as contact_phone,
        ct.email as contact_email,
        COALESCE(l.title, ct.title) as title,
        ct.emails as contact_emails,
        ct.phones as contact_phones,
        ct.social_links as contact_social_links,
        ct.team_members as contact_team_members,
        ct.company_description,
        ct.company_services,
        ct.pain_points,
        ct.photos,
        ct.website
      FROM leads l
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      LEFT JOIN users ru ON l.responsible_user_id = ru.id
      LEFT JOIN contact_leads cl ON cl.lead_id = l.id
      LEFT JOIN contacts ct ON ct.id = cl.contact_id
      WHERE l.id = $1 AND (l.account_id = $2 OR c.account_id = $2) ${sectorFilter}
    `;

    const queryParams = [id, accountId, ...sectorParams];
    const result = await db.query(query, queryParams);

    if (result.rows.length === 0) {
      throw new NotFoundError('Lead not found');
    }

    const lead = result.rows[0];

    // Access control: The sector filter already handles permissions
    // Additional check: user must be campaign owner OR lead responsible OR have sector access
    // Note: sector filter in WHERE clause already enforces sector-based access
    // This check is redundant but kept for explicit verification of campaign-based access
    // Leads without campaigns (e.g., Google Maps) pass if sector filter allows
    if (lead.campaign_user_id && lead.campaign_user_id !== userId && lead.responsible_id !== userId) {
      // Campaign exists but user is neither owner nor responsible
      // Sector filter already passed, so user has sector access - allow
      console.log(`📋 Lead ${id} access via sector permissions for user ${userId}`);
    }

    // Buscar tags do lead via contato vinculado (contact_tags)
    const tagsQuery = `
      SELECT t.id, t.name, t.color, t.created_at
      FROM tags t
      JOIN contact_tags ct ON ct.tag_id = t.id
      JOIN contact_leads cl ON cl.contact_id = ct.contact_id
      WHERE cl.lead_id = $1
      ORDER BY t.name ASC
    `;
    const tagsResult = await db.query(tagsQuery, [id]);
    lead.tags = tagsResult.rows || [];

    console.log(`✅ Lead encontrado: ${lead.name} com ${lead.tags.length} tags`);

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
      headline,
      source // linkedin, google_maps, list, paid_traffic, other
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
      score: 0,
      source: source || 'linkedin' // Default to linkedin for campaign leads
    };

    const lead = await db.insert('leads', leadData);

    // Manual lead creation: assign to the creating user (not round-robin)
    // Salespeople do active prospecting, so manual leads belong to them
    try {
      await db.query(
        `UPDATE leads SET responsible_user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [userId, lead.id]
      );
      lead.responsible_user_id = userId;
      console.log(`👤 Lead manual atribuído ao criador: ${req.user.name || userId}`);
    } catch (assignError) {
      console.log(`⚠️ Auto-atribuição ao criador falhou: ${assignError.message}`);
    }

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
        const sectorId = campaign.rows[0].sector_id || null;
        const newLead = await db.insert('leads', {
          campaign_id,
          sector_id: sectorId,
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
          score: 0,
          source: leadData.source || 'list' // Default to 'list' for bulk imports
        });

        // Manual bulk import: assign to the creating user (not round-robin)
        // User doing the import owns these leads
        try {
          await db.query(
            `UPDATE leads SET responsible_user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [userId, newLead.id]
          );
          newLead.responsible_user_id = userId;
        } catch (assignError) {
          // Don't fail the lead creation if assignment fails
          console.log(`⚠️ Auto-atribuição ao criador falhou para lead ${newLead.id}: ${assignError.message}`);
        }

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
      phone,
      source
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

    // Se o lead foi encontrado pela query (que já inclui sectorFilter), o usuário tem acesso
    // Não verificamos user_id porque nem todo lead vem de campanha

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

    // 🏷️ Atualizar fonte do lead
    if (source !== undefined) updateData.source = source;

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

      // Criar tarefas automáticas do checklist da nova etapa
      try {
        const taskResult = await checklistService.onLeadStageChange({
          leadId: id,
          oldStage: lead.status,
          newStage: status,
          accountId: lead.account_id || accountId,
          userId
        });

        if (taskResult.created > 0) {
          console.log(`📋 ${taskResult.created} tarefas criadas do template "${taskResult.templateName}"`);
        }
      } catch (taskError) {
        // Don't fail the lead update if task creation fails
        console.error(`⚠️ Erro ao criar tarefas do checklist: ${taskError.message}`);
      }
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
    const { status, page = 1, limit = 50 } = req.query; // Limite otimizado para performance

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

// ================================
// 8. ATRIBUIR RESPONSÁVEL AO LEAD
// ================================
const assignLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`👤 Atribuindo lead ${id} ao usuário ${user_id}`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildLeadSectorFilter(userId, accountId, 3);

    // Verificar se lead existe e pertence à conta
    const leadCheck = await db.query(
      `SELECT l.*, c.account_id as campaign_account_id
       FROM leads l
       LEFT JOIN campaigns c ON l.campaign_id = c.id
       WHERE l.id = $1 AND (l.account_id = $2 OR c.account_id = $2) ${sectorFilter}`,
      [id, accountId, ...sectorParams]
    );

    if (leadCheck.rows.length === 0) {
      throw new NotFoundError('Lead not found');
    }

    const lead = leadCheck.rows[0];

    // Se user_id for null, estamos removendo o responsável
    if (user_id === null) {
      await db.query(
        `UPDATE leads SET responsible_user_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id]
      );

      console.log(`✅ Responsável removido do lead`);

      return sendSuccess(res, { id, responsible_user_id: null }, 'Responsible removed');
    }

    // Verificar se o usuário existe e pertence à mesma conta
    const userCheck = await db.query(
      `SELECT id, name, email, avatar_url FROM users WHERE id = $1 AND account_id = $2 AND is_active = true`,
      [user_id, accountId]
    );

    if (userCheck.rows.length === 0) {
      throw new NotFoundError('User not found or not in this account');
    }

    const assignedUser = userCheck.rows[0];

    // Atribuir o lead
    await roundRobinService.assignLeadToUser(id, user_id, lead.sector_id, accountId);

    console.log(`✅ Lead atribuído ao usuário ${assignedUser.name}`);

    sendSuccess(res, {
      id,
      responsible_user_id: user_id,
      responsible: {
        id: assignedUser.id,
        name: assignedUser.name,
        email: assignedUser.email,
        avatar_url: assignedUser.avatar_url
      }
    }, 'Lead assigned successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 9. ATRIBUIÇÃO AUTOMÁTICA (ROUND-ROBIN)
// ================================
const autoAssignLead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`🔄 Atribuição automática do lead ${id}`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildLeadSectorFilter(userId, accountId, 3);

    // Verificar se lead existe e pertence à conta
    const leadCheck = await db.query(
      `SELECT l.*, c.account_id as campaign_account_id
       FROM leads l
       LEFT JOIN campaigns c ON l.campaign_id = c.id
       WHERE l.id = $1 AND (l.account_id = $2 OR c.account_id = $2) ${sectorFilter}`,
      [id, accountId, ...sectorParams]
    );

    if (leadCheck.rows.length === 0) {
      throw new NotFoundError('Lead not found');
    }

    const lead = leadCheck.rows[0];

    if (!lead.sector_id) {
      throw new ValidationError('Lead must be in a sector to use auto-assignment');
    }

    // Tentar atribuição automática
    const assignedUser = await roundRobinService.autoAssignLead(id, lead.sector_id, accountId);

    if (!assignedUser) {
      throw new ValidationError('Round-robin not enabled for this sector or no users available');
    }

    console.log(`✅ Lead auto-atribuído ao usuário ${assignedUser.name}`);

    sendSuccess(res, {
      id,
      responsible_user_id: assignedUser.user_id,
      responsible: {
        id: assignedUser.user_id,
        name: assignedUser.name,
        email: assignedUser.email,
        avatar_url: assignedUser.avatar_url
      }
    }, 'Lead auto-assigned successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 10. LISTAR USUÁRIOS PARA ATRIBUIÇÃO
// ================================
const getAssignableUsers = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { sector_id } = req.query;

    console.log(`👥 Listando usuários atribuíveis`);

    let users;

    if (sector_id) {
      // Se setor especificado, listar usuários do setor
      users = await roundRobinService.getSectorUsers(sector_id);
    } else {
      // Senão, listar todos os usuários ativos da conta
      const result = await db.query(
        `SELECT id, name, email, avatar_url
         FROM users
         WHERE account_id = $1 AND is_active = true
         ORDER BY name`,
        [accountId]
      );
      users = result.rows;
    }

    sendSuccess(res, { users });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 11. CRIAR LEAD MANUAL (sem campanha)
// ================================
const createManualLead = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      name,
      company,
      title,
      email,
      phone,
      location,
      profile_url,
      source = 'manual',
      status = 'leads',
      notes,
      contact_id,
      new_contact
    } = req.body;

    console.log(`📝 Criando lead manual: ${name}`);

    // Validations
    if (!name) {
      throw new ValidationError('Nome e obrigatorio');
    }

    let contactId = contact_id;

    // If creating a new contact
    if (new_contact && !contact_id) {
      if (!new_contact.name) {
        throw new ValidationError('Nome do contato e obrigatorio');
      }

      // Create the contact first
      const contactData = {
        user_id: userId,
        account_id: accountId,
        name: new_contact.name,
        email: new_contact.email || null,
        phone: new_contact.phone || null,
        company: new_contact.company || null,
        title: new_contact.title || null,
        location: new_contact.location || null,
        profile_url: new_contact.profile_url || null,
        source: 'manual'
      };

      const contact = await db.insert('contacts', contactData);
      contactId = contact.id;
      console.log(`👤 Contato criado: ${contact.id}`);
    }

    // Create the lead without campaign
    const leadData = {
      account_id: accountId,
      campaign_id: null, // No campaign
      sector_id: null,
      linkedin_profile_id: `manual_${Date.now()}`,
      name,
      title: title || null,
      company: company || null,
      location: location || null,
      profile_url: profile_url || null,
      profile_picture: null,
      headline: null,
      status: status,
      score: 0,
      source: source,
      notes: notes || null,
      responsible_user_id: userId // Assign to creator
    };

    const lead = await db.insert('leads', leadData);
    console.log(`✅ Lead manual criado: ${lead.id}`);

    // Link lead to contact if we have a contact
    if (contactId) {
      await db.query(
        `INSERT INTO contact_leads (contact_id, lead_id, role) VALUES ($1, $2, 'primary') ON CONFLICT DO NOTHING`,
        [contactId, lead.id]
      );
      console.log(`🔗 Lead vinculado ao contato: ${contactId}`);

      // Update contact email/phone if provided and contact doesn't have them
      if (email || phone) {
        const updates = [];
        const params = [contactId];
        let paramIndex = 2;

        if (email) {
          updates.push(`email = COALESCE(email, $${paramIndex})`);
          params.push(email);
          paramIndex++;
        }
        if (phone) {
          updates.push(`phone = COALESCE(phone, $${paramIndex})`);
          params.push(phone);
          paramIndex++;
        }

        if (updates.length > 0) {
          await db.query(
            `UPDATE contacts SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            params
          );
        }
      }
    }

    // Return lead with contact info
    const result = await db.query(
      `SELECT l.*, ct.id as contact_id, ct.name as contact_name
       FROM leads l
       LEFT JOIN contact_leads cl ON cl.lead_id = l.id
       LEFT JOIN contacts ct ON ct.id = cl.contact_id
       WHERE l.id = $1`,
      [lead.id]
    );

    sendSuccess(res, result.rows[0] || lead, 'Lead criado com sucesso', 201);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 11. DESCARTAR LEAD
// ================================
const discardLead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { reason_id, notes, previous_status } = req.body;

    console.log(`❌ Descartando lead ${id}`);

    if (!reason_id) {
      throw new ValidationError('Motivo de descarte é obrigatório');
    }

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildLeadSectorFilter(userId, accountId, 3);

    // Verificar se lead pertence à conta
    const leadCheck = await db.query(
      `SELECT l.*, c.account_id as campaign_account_id
       FROM leads l
       LEFT JOIN campaigns c ON l.campaign_id = c.id
       WHERE l.id = $1 AND (l.account_id = $2 OR c.account_id = $2) ${sectorFilter}`,
      [id, accountId, ...sectorParams]
    );

    if (leadCheck.rows.length === 0) {
      throw new NotFoundError('Lead not found');
    }

    const lead = leadCheck.rows[0];

    // Verificar se motivo de descarte existe e pertence à conta
    const reasonCheck = await db.query(
      `SELECT * FROM discard_reasons WHERE id = $1 AND account_id = $2`,
      [reason_id, accountId]
    );

    if (reasonCheck.rows.length === 0) {
      throw new NotFoundError('Discard reason not found');
    }

    const reason = reasonCheck.rows[0];

    // Atualizar lead
    const updateData = {
      status: LEAD_STATUS.DISCARDED,
      discard_reason_id: reason_id,
      discard_notes: notes || null,
      previous_status: previous_status || lead.status,
      discarded_at: new Date()
    };

    const updatedLead = await db.update('leads', updateData, { id });

    // Atualizar contadores da campanha
    if (lead.campaign_id && lead.status !== LEAD_STATUS.DISCARDED) {
      await updateCampaignCounters(lead.campaign_id, lead.status, LEAD_STATUS.DISCARDED);
    }

    // Log na conversa se existir
    const conversationCheck = await db.query(
      `SELECT id FROM conversations WHERE lead_id = $1`,
      [id]
    );

    if (conversationCheck.rows.length > 0) {
      const conversationId = conversationCheck.rows[0].id;
      const message = notes
        ? `📋 Lead descartado. Motivo: ${reason.name}. Obs: ${notes}`
        : `📋 Lead descartado. Motivo: ${reason.name}`;

      await db.query(
        `INSERT INTO messages (conversation_id, sender_type, content, sent_at)
         VALUES ($1, 'system', $2, NOW())`,
        [conversationId, message]
      );
      console.log(`📝 Log adicionado à conversa ${conversationId}`);
    }

    console.log(`✅ Lead descartado`);

    sendSuccess(res, updatedLead, 'Lead discarded successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 12. REATIVAR LEAD
// ================================
const reactivateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { target_status } = req.body; // Opcionalmente especificar status alvo

    console.log(`🔄 Reativando lead ${id}`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildLeadSectorFilter(userId, accountId, 3);

    // Verificar se lead pertence à conta
    const leadCheck = await db.query(
      `SELECT l.*, c.account_id as campaign_account_id, dr.name as discard_reason_name
       FROM leads l
       LEFT JOIN campaigns c ON l.campaign_id = c.id
       LEFT JOIN discard_reasons dr ON l.discard_reason_id = dr.id
       WHERE l.id = $1 AND (l.account_id = $2 OR c.account_id = $2) ${sectorFilter}`,
      [id, accountId, ...sectorParams]
    );

    if (leadCheck.rows.length === 0) {
      throw new NotFoundError('Lead not found');
    }

    const lead = leadCheck.rows[0];

    if (lead.status !== LEAD_STATUS.DISCARDED) {
      throw new ValidationError('Lead não está descartado');
    }

    // Determinar status de destino
    const newStatus = target_status || lead.previous_status || LEAD_STATUS.LEADS;

    // Atualizar lead
    const updateData = {
      status: newStatus,
      discard_reason_id: null,
      discard_notes: null,
      previous_status: null,
      discarded_at: null
    };

    const updatedLead = await db.update('leads', updateData, { id });

    // Atualizar contadores da campanha
    if (lead.campaign_id) {
      await updateCampaignCounters(lead.campaign_id, LEAD_STATUS.DISCARDED, newStatus);
    }

    // Log na conversa se existir
    const conversationCheck = await db.query(
      `SELECT id FROM conversations WHERE lead_id = $1`,
      [id]
    );

    if (conversationCheck.rows.length > 0) {
      const conversationId = conversationCheck.rows[0].id;
      const previousReason = lead.discard_reason_name ? ` (estava: ${lead.discard_reason_name})` : '';
      const message = `🔄 Lead reativado${previousReason}`;

      await db.query(
        `INSERT INTO messages (conversation_id, sender_type, content, sent_at)
         VALUES ($1, 'system', $2, NOW())`,
        [conversationId, message]
      );
      console.log(`📝 Log de reativação adicionado à conversa ${conversationId}`);
    }

    console.log(`✅ Lead reativado para status: ${newStatus}`);

    sendSuccess(res, updatedLead, 'Lead reactivated successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  getLeads,
  getLead,
  createLead,
  createLeadsBulk,
  createManualLead,
  updateLead,
  deleteLead,
  getCampaignLeads,
  assignLead,
  autoAssignLead,
  getAssignableUsers,
  discardLead,
  reactivateLead
};