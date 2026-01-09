// backend/src/controllers/opportunityController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const {
  ValidationError,
  NotFoundError,
  ForbiddenError
} = require('../utils/errors');
const pipelineService = require('../services/pipelineService');
const roundRobinService = require('../services/roundRobinService');

// ================================
// Helper: Verificar acesso à oportunidade
// ================================
async function checkOpportunityAccess(userId, opportunityId, accountId) {
  const oppResult = await db.query(
    `SELECT o.*, p.is_restricted
     FROM opportunities o
     JOIN pipelines p ON o.pipeline_id = p.id
     WHERE o.id = $1 AND o.account_id = $2`,
    [opportunityId, accountId]
  );

  if (oppResult.rows.length === 0) {
    throw new NotFoundError('Oportunidade não encontrada');
  }

  const opportunity = oppResult.rows[0];

  if (opportunity.is_restricted) {
    const accessCheck = await db.query(
      'SELECT role FROM pipeline_users WHERE pipeline_id = $1 AND user_id = $2',
      [opportunity.pipeline_id, userId]
    );

    if (accessCheck.rows.length === 0) {
      throw new ForbiddenError('Você não tem acesso a esta oportunidade');
    }

    return { opportunity, role: accessCheck.rows[0].role };
  }

  return { opportunity, role: 'member' };
}

// ================================
// 1. LISTAR OPORTUNIDADES POR PIPELINE
// ================================
const getOpportunities = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { pipelineId } = req.params;
    const {
      stage_id,
      owner_user_id,
      search,
      sort_field = 'created_at',
      sort_direction = 'desc',
      page = 1,
      limit = 50
    } = req.query;

    // Verificar acesso à pipeline
    const { hasAccess, reason } = await pipelineService.canUserAccessPipeline(userId, pipelineId, accountId);

    if (!hasAccess) {
      if (reason === 'pipeline_not_found') {
        throw new NotFoundError('Pipeline não encontrada');
      }
      throw new ForbiddenError('Você não tem acesso a esta pipeline');
    }

    let whereConditions = ['o.pipeline_id = $1', 'o.account_id = $2'];
    let queryParams = [pipelineId, accountId];
    let paramIndex = 3;

    if (stage_id) {
      whereConditions.push(`o.stage_id = $${paramIndex}`);
      queryParams.push(stage_id);
      paramIndex++;
    }

    if (owner_user_id) {
      whereConditions.push(`o.owner_user_id = $${paramIndex}`);
      queryParams.push(owner_user_id);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(o.title ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex} OR c.company ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.join(' AND ');

    // Validar campos de ordenação
    const validSortFields = ['created_at', 'updated_at', 'title', 'value', 'expected_close_date', 'probability', 'display_order', 'contact_name', 'owner_name', 'stage_id'];
    const safeSortField = validSortFields.includes(sort_field) ? sort_field : 'created_at';
    const safeSortDirection = sort_direction === 'asc' ? 'ASC' : 'DESC';

    // Map sort fields to actual column references
    const sortFieldMap = {
      'contact_name': 'COALESCE(c.name, o.title)',
      'owner_name': 'u.name',
      'stage_id': 'ps.position'
    };
    const actualSortField = sortFieldMap[safeSortField] || `o.${safeSortField}`;

    // Use kanban ordering when filtering by stage (for infinite scroll consistency)
    const orderClause = stage_id
      ? 'o.display_order ASC, o.created_at DESC'
      : `${actualSortField} ${safeSortDirection}`;

    const query = `
      SELECT
        o.*,
        COALESCE(c.name, o.title) as contact_name,
        c.title as contact_title,
        c.email as contact_email,
        c.phone as contact_phone,
        c.company as contact_company,
        c.location as contact_location,
        c.profile_picture as contact_picture,
        c.linkedin_profile_id as contact_linkedin_id,
        ps.name as stage_name,
        ps.color as stage_color,
        ps.position as stage_position,
        ps.is_win_stage,
        ps.is_loss_stage,
        u.name as owner_name,
        u.email as owner_email,
        u.avatar_url as owner_avatar,
        COUNT(*) OVER() as total_count
      FROM opportunities o
      LEFT JOIN contacts c ON o.contact_id = c.id
      JOIN pipeline_stages ps ON o.stage_id = ps.id
      LEFT JOIN users u ON o.owner_user_id = u.id
      WHERE ${whereClause}
      ORDER BY ${orderClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);

    // Buscar tags das oportunidades
    if (result.rows.length > 0) {
      const oppIds = result.rows.map(o => o.id);
      const tagsQuery = `
        SELECT ot.opportunity_id, t.id, t.name, t.color
        FROM opportunity_tags ot
        JOIN tags t ON ot.tag_id = t.id
        WHERE ot.opportunity_id = ANY($1)
      `;
      const tagsResult = await db.query(tagsQuery, [oppIds]);

      const tagsByOpp = {};
      tagsResult.rows.forEach(tag => {
        if (!tagsByOpp[tag.opportunity_id]) {
          tagsByOpp[tag.opportunity_id] = [];
        }
        tagsByOpp[tag.opportunity_id].push(tag);
      });

      result.rows.forEach(opp => {
        opp.tags = tagsByOpp[opp.id] || [];
      });
    }

    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

    sendSuccess(res, {
      opportunities: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        total_pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar oportunidades:', error);
    sendError(res, error);
  }
};

// ================================
// 2. OBTER OPORTUNIDADES AGRUPADAS POR STAGE (KANBAN)
// ================================
const getOpportunitiesKanban = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { pipelineId } = req.params;
    const { search, owner_user_id, limit_per_stage = 20 } = req.query;

    // Verificar acesso à pipeline
    const { hasAccess, reason } = await pipelineService.canUserAccessPipeline(userId, pipelineId, accountId);

    if (!hasAccess) {
      if (reason === 'pipeline_not_found') {
        throw new NotFoundError('Pipeline não encontrada');
      }
      throw new ForbiddenError('Você não tem acesso a esta pipeline');
    }

    // Buscar etapas
    const stagesQuery = `
      SELECT * FROM pipeline_stages
      WHERE pipeline_id = $1
      ORDER BY position ASC
    `;
    const stagesResult = await db.query(stagesQuery, [pipelineId]);

    // Para cada etapa, buscar oportunidades
    const stages = [];

    for (const stage of stagesResult.rows) {
      let whereConditions = ['o.stage_id = $1', 'o.account_id = $2'];
      let queryParams = [stage.id, accountId];
      let paramIndex = 3;

      if (search && search !== 'undefined' && search.trim() !== '') {
        whereConditions.push(`(o.title ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (owner_user_id) {
        whereConditions.push(`o.owner_user_id = $${paramIndex}`);
        queryParams.push(owner_user_id);
        paramIndex++;
      }

      const oppsQuery = `
        SELECT
          o.*,
          COALESCE(c.name, o.title) as contact_name,
          c.title as contact_title,
          c.company as contact_company,
          c.location as contact_location,
          c.email as contact_email,
          c.phone as contact_phone,
          c.profile_picture as contact_picture,
          c.linkedin_profile_id as contact_linkedin_id,
          u.name as owner_name,
          u.avatar_url as owner_avatar,
          (SELECT COUNT(*) FROM opportunities WHERE stage_id = $1 AND account_id = $2) as stage_total
        FROM opportunities o
        LEFT JOIN contacts c ON o.contact_id = c.id
        LEFT JOIN users u ON o.owner_user_id = u.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY o.display_order ASC, o.created_at DESC
        LIMIT $${paramIndex}
      `;

      queryParams.push(parseInt(limit_per_stage));

      const oppsResult = await db.query(oppsQuery, queryParams);

      // Calcular total e valor do stage
      const statsQuery = `
        SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as total_value
        FROM opportunities
        WHERE stage_id = $1 AND account_id = $2
      `;
      const statsResult = await db.query(statsQuery, [stage.id, accountId]);

      // Buscar tags das oportunidades deste stage
      const oppIds = oppsResult.rows.map(o => o.id);
      if (oppIds.length > 0) {
        const tagsQuery = `
          SELECT ot.opportunity_id, t.id, t.name, t.color
          FROM opportunity_tags ot
          JOIN tags t ON ot.tag_id = t.id
          WHERE ot.opportunity_id = ANY($1)
        `;
        const tagsResult = await db.query(tagsQuery, [oppIds]);

        const tagsByOpp = {};
        tagsResult.rows.forEach(tag => {
          if (!tagsByOpp[tag.opportunity_id]) {
            tagsByOpp[tag.opportunity_id] = [];
          }
          tagsByOpp[tag.opportunity_id].push(tag);
        });

        oppsResult.rows.forEach(opp => {
          opp.tags = tagsByOpp[opp.id] || [];
        });
      }

      stages.push({
        ...stage,
        opportunities: oppsResult.rows,
        count: parseInt(statsResult.rows[0].count),
        total_value: parseFloat(statsResult.rows[0].total_value)
      });
    }

    sendSuccess(res, {
      stages
    });
  } catch (error) {
    console.error('Erro ao obter kanban:', error);
    sendError(res, error);
  }
};

// ================================
// 3. OBTER OPORTUNIDADE POR ID
// ================================
const getOpportunity = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { id } = req.params;

    const { opportunity } = await checkOpportunityAccess(userId, id, accountId);

    // Buscar dados completos (incluindo todos os campos do contato para exibição completa)
    const query = `
      SELECT
        o.*,
        -- Contact basic info
        c.id as contact_id,
        c.name as contact_name,
        c.email as contact_email,
        c.phone as contact_phone,
        c.company as contact_company,
        c.title as contact_title,
        c.profile_picture as contact_picture,
        c.location as contact_location,
        c.linkedin_profile_id as contact_linkedin_id,
        c.profile_url as contact_profile_url,
        -- Contact AI/scraped data
        c.headline as contact_headline,
        c.about as contact_about,
        c.website as contact_website,
        c.company_description as contact_company_description,
        c.company_services as contact_company_services,
        c.pain_points as contact_pain_points,
        -- Contact additional fields
        c.industry as contact_industry,
        c.city as contact_city,
        c.state as contact_state,
        c.country as contact_country,
        c.connections_count as contact_connections,
        c.emails as contact_emails,
        c.phones as contact_phones,
        c.social_links as contact_social_links,
        c.team_members as contact_team_members,
        c.rating as contact_rating,
        c.review_count as contact_review_count,
        c.business_category as contact_business_category,
        -- Pipeline info
        p.id as pipeline_id,
        p.name as pipeline_name,
        p.color as pipeline_color,
        -- Stage info
        ps.id as stage_id,
        ps.name as stage_name,
        ps.color as stage_color,
        ps.is_win_stage,
        ps.is_loss_stage,
        -- Owner info
        u.name as owner_name,
        u.email as owner_email,
        u.avatar_url as owner_avatar,
        -- Creator info
        cb.name as created_by_name,
        -- Loss reason
        dr.name as loss_reason_name,
        -- Discard reason (also for opportunities)
        dr2.name as discard_reason_name
      FROM opportunities o
      LEFT JOIN contacts c ON o.contact_id = c.id
      JOIN pipelines p ON o.pipeline_id = p.id
      JOIN pipeline_stages ps ON o.stage_id = ps.id
      LEFT JOIN users u ON o.owner_user_id = u.id
      LEFT JOIN users cb ON o.created_by = cb.id
      LEFT JOIN discard_reasons dr ON o.loss_reason_id = dr.id
      LEFT JOIN discard_reasons dr2 ON o.discard_reason_id = dr2.id
      WHERE o.id = $1
    `;

    const result = await db.query(query, [id]);

    // Buscar tags
    const tagsQuery = `
      SELECT t.id, t.name, t.color
      FROM opportunity_tags ot
      JOIN tags t ON ot.tag_id = t.id
      WHERE ot.opportunity_id = $1
    `;
    const tagsResult = await db.query(tagsQuery, [id]);

    // Buscar histórico
    const historyQuery = `
      SELECT
        oh.*,
        u.name as user_name,
        fs.name as from_stage_name,
        ts.name as to_stage_name
      FROM opportunity_history oh
      LEFT JOIN users u ON oh.user_id = u.id
      LEFT JOIN pipeline_stages fs ON oh.from_stage_id = fs.id
      LEFT JOIN pipeline_stages ts ON oh.to_stage_id = ts.id
      WHERE oh.opportunity_id = $1
      ORDER BY oh.created_at DESC
      LIMIT 50
    `;
    const historyResult = await db.query(historyQuery, [id]);

    sendSuccess(res, {
      opportunity: {
        ...result.rows[0],
        tags: tagsResult.rows,
        history: historyResult.rows
      }
    });
  } catch (error) {
    console.error('Erro ao obter oportunidade:', error);
    sendError(res, error);
  }
};

// ================================
// 4. CRIAR OPORTUNIDADE
// ================================
const createOpportunity = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { pipelineId } = req.params;
    const {
      contact_id,
      new_contact,  // Optional: create a new contact inline
      stage_id,
      title,
      value,
      currency,
      probability,
      expected_close_date,
      owner_user_id,
      source,
      custom_fields,
      tags
    } = req.body;

    if (!contact_id && !new_contact) {
      throw new ValidationError('ID do contato ou dados de novo contato são obrigatórios');
    }

    // Verificar acesso à pipeline
    const { hasAccess, reason } = await pipelineService.canUserAccessPipeline(userId, pipelineId, accountId);

    if (!hasAccess) {
      if (reason === 'pipeline_not_found') {
        throw new NotFoundError('Pipeline não encontrada');
      }
      throw new ForbiddenError('Você não tem acesso a esta pipeline');
    }

    let contact;

    // If new_contact is provided, create the contact first
    if (new_contact) {
      const { name, email, phone, company, title: contactTitle, location, website, notes } = new_contact;

      if (!name) {
        throw new ValidationError('Nome do contato é obrigatório');
      }

      // Check if contact with same email already exists
      if (email) {
        const existingContact = await db.query(
          'SELECT id, name, company FROM contacts WHERE email = $1 AND account_id = $2',
          [email.toLowerCase(), accountId]
        );

        if (existingContact.rows.length > 0) {
          // Use existing contact instead of creating duplicate
          contact = existingContact.rows[0];
          console.log(`📋 Usando contato existente ${contact.name} (email: ${email})`);
        }
      }

      // Create new contact if not found
      if (!contact) {
        const contactResult = await db.query(
          `INSERT INTO contacts (
            account_id, user_id, name, email, phone, company, title, location, website, notes, source
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id, name, company`,
          [
            accountId,
            userId,
            name,
            email ? email.toLowerCase() : null,
            phone || null,
            company || null,
            contactTitle || null,
            location || null,
            website || null,
            notes || null,
            'manual'
          ]
        );
        contact = contactResult.rows[0];
        console.log(`✅ Novo contato criado: ${contact.name}`);
      }
    } else {
      // Verificar contato existente
      const contactCheck = await db.query(
        'SELECT id, name, company FROM contacts WHERE id = $1 AND account_id = $2',
        [contact_id, accountId]
      );

      if (contactCheck.rows.length === 0) {
        throw new NotFoundError('Contato não encontrado');
      }

      contact = contactCheck.rows[0];
    }

    // Determinar stage inicial
    let targetStageId = stage_id;
    if (!targetStageId) {
      const firstStage = await db.query(
        'SELECT id FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY position ASC LIMIT 1',
        [pipelineId]
      );
      if (firstStage.rows.length === 0) {
        throw new ValidationError('Pipeline não possui etapas');
      }
      targetStageId = firstStage.rows[0].id;
    } else {
      // Verificar se stage pertence à pipeline
      const stageCheck = await db.query(
        'SELECT id FROM pipeline_stages WHERE id = $1 AND pipeline_id = $2',
        [stage_id, pipelineId]
      );
      if (stageCheck.rows.length === 0) {
        throw new ValidationError('Etapa não pertence a esta pipeline');
      }
    }

    // Título default
    const oppTitle = title || `${contact.name}${contact.company ? ` - ${contact.company}` : ''}`;

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Criar oportunidade
      const result = await client.query(
        `INSERT INTO opportunities (
          account_id, contact_id, pipeline_id, stage_id, title, value, currency,
          probability, expected_close_date, owner_user_id, source, custom_fields, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          accountId,
          contact.id,  // Use contact.id (supports both existing and new contacts)
          pipelineId,
          targetStageId,
          oppTitle,
          value || 0,
          currency || 'BRL',
          probability || 0,
          expected_close_date || null,
          owner_user_id || userId,
          source || 'manual',
          custom_fields ? JSON.stringify(custom_fields) : '{}',
          userId
        ]
      );

      const opportunity = result.rows[0];

      // Adicionar tags se fornecidas
      if (tags && tags.length > 0) {
        for (const tagId of tags) {
          await client.query(
            'INSERT INTO opportunity_tags (opportunity_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [opportunity.id, tagId]
          );
        }
      }

      // Registrar no histórico
      await client.query(
        `INSERT INTO opportunity_history (opportunity_id, user_id, action, to_stage_id, to_value, notes)
         VALUES ($1, $2, 'created', $3, $4, 'Oportunidade criada')`,
        [opportunity.id, userId, targetStageId, value || 0]
      );

      await client.query('COMMIT');

      console.log(`✅ Oportunidade "${oppTitle}" criada na pipeline ${pipelineId}`);

      sendSuccess(res, {
        opportunity: {
          ...opportunity,
          contact_name: contact.name,
          contact_company: contact.company
        },
        contact: new_contact ? contact : undefined,  // Include created contact info if new_contact was used
        message: 'Oportunidade criada com sucesso'
      }, 201);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Erro ao criar oportunidade:', error);
    sendError(res, error);
  }
};

// ================================
// 5. ATUALIZAR OPORTUNIDADE
// ================================
const updateOpportunity = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { id } = req.params;
    const {
      title,
      value,
      currency,
      probability,
      expected_close_date,
      owner_user_id,
      loss_reason_id,
      loss_notes,
      custom_fields,
      tags
    } = req.body;

    const { opportunity } = await checkOpportunityAccess(userId, id, accountId);

    const updates = [];
    const values = [];
    let paramIndex = 1;
    const changes = [];

    if (title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      values.push(title);
      paramIndex++;
    }

    if (value !== undefined) {
      updates.push(`value = $${paramIndex}`);
      values.push(value);
      paramIndex++;
      if (value !== opportunity.value) {
        changes.push({ field: 'value', from: opportunity.value, to: value });
      }
    }

    if (currency !== undefined) {
      updates.push(`currency = $${paramIndex}`);
      values.push(currency);
      paramIndex++;
    }

    if (probability !== undefined) {
      updates.push(`probability = $${paramIndex}`);
      values.push(probability);
      paramIndex++;
    }

    if (expected_close_date !== undefined) {
      updates.push(`expected_close_date = $${paramIndex}`);
      values.push(expected_close_date);
      paramIndex++;
    }

    if (owner_user_id !== undefined) {
      updates.push(`owner_user_id = $${paramIndex}`);
      values.push(owner_user_id);
      paramIndex++;
      if (owner_user_id !== opportunity.owner_user_id) {
        changes.push({ field: 'owner', from: opportunity.owner_user_id, to: owner_user_id });
      }
    }

    if (loss_reason_id !== undefined) {
      updates.push(`loss_reason_id = $${paramIndex}`);
      values.push(loss_reason_id);
      paramIndex++;
    }

    if (loss_notes !== undefined) {
      updates.push(`loss_notes = $${paramIndex}`);
      values.push(loss_notes);
      paramIndex++;
    }

    if (custom_fields !== undefined) {
      updates.push(`custom_fields = $${paramIndex}`);
      values.push(JSON.stringify(custom_fields));
      paramIndex++;
    }

    if (updates.length === 0 && !tags) {
      throw new ValidationError('Nenhum campo para atualizar');
    }

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      if (updates.length > 0) {
        values.push(id);

        const query = `
          UPDATE opportunities
          SET ${updates.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING *
        `;

        await client.query(query, values);
      }

      // Atualizar tags se fornecidas
      if (tags !== undefined) {
        // Remover tags existentes
        await client.query('DELETE FROM opportunity_tags WHERE opportunity_id = $1', [id]);

        // Adicionar novas tags
        for (const tagId of tags) {
          await client.query(
            'INSERT INTO opportunity_tags (opportunity_id, tag_id) VALUES ($1, $2)',
            [id, tagId]
          );
        }
      }

      // Registrar mudanças no histórico
      if (changes.length > 0) {
        await client.query(
          `INSERT INTO opportunity_history (opportunity_id, user_id, action, from_value, to_value, metadata)
           VALUES ($1, $2, 'updated', $3, $4, $5)`,
          [id, userId, opportunity.value, value || opportunity.value, JSON.stringify({ changes })]
        );
      }

      await client.query('COMMIT');

      // Buscar oportunidade atualizada
      const updatedResult = await db.query('SELECT * FROM opportunities WHERE id = $1', [id]);

      sendSuccess(res, {
        opportunity: updatedResult.rows[0],
        message: 'Oportunidade atualizada com sucesso'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Erro ao atualizar oportunidade:', error);
    sendError(res, error);
  }
};

// ================================
// 6. MOVER OPORTUNIDADE (MUDAR STAGE)
// ================================
const moveOpportunity = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { id } = req.params;
    const { stage_id, notes, loss_reason_id, loss_notes, value } = req.body;

    if (!stage_id) {
      throw new ValidationError('ID da etapa é obrigatório');
    }

    const { opportunity } = await checkOpportunityAccess(userId, id, accountId);

    // Verificar se nova etapa pertence à mesma pipeline
    const stageResult = await db.query(
      'SELECT * FROM pipeline_stages WHERE id = $1 AND pipeline_id = $2',
      [stage_id, opportunity.pipeline_id]
    );

    if (stageResult.rows.length === 0) {
      throw new ValidationError('Etapa não pertence a esta pipeline');
    }

    const newStage = stageResult.rows[0];

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const updates = ['stage_id = $1'];
      const values = [stage_id];
      let paramIndex = 2;

      // Se movendo para etapa de ganho
      if (newStage.is_win_stage && !opportunity.won_at) {
        updates.push(`won_at = NOW()`);
        updates.push(`lost_at = NULL`);

        // Update value if provided (from win modal)
        if (value !== undefined && value !== null) {
          updates.push(`value = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }
      // Se movendo para etapa de perda
      else if (newStage.is_loss_stage && !opportunity.lost_at) {
        updates.push(`lost_at = NOW()`);
        updates.push(`won_at = NULL`);

        if (loss_reason_id) {
          updates.push(`loss_reason_id = $${paramIndex}`);
          values.push(loss_reason_id);
          paramIndex++;
        }

        if (loss_notes) {
          updates.push(`loss_notes = $${paramIndex}`);
          values.push(loss_notes);
          paramIndex++;
        }
      }
      // Se movendo de etapa final para etapa normal
      else if (!newStage.is_win_stage && !newStage.is_loss_stage) {
        updates.push(`won_at = NULL`);
        updates.push(`lost_at = NULL`);
      }

      values.push(id);

      const updateQuery = `
        UPDATE opportunities
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);

      // Registrar no histórico
      await client.query(
        `INSERT INTO opportunity_history (opportunity_id, user_id, action, from_stage_id, to_stage_id, from_value, to_value, notes)
         VALUES ($1, $2, 'stage_changed', $3, $4, $5, $6, $7)`,
        [
          id,
          userId,
          opportunity.stage_id,
          stage_id,
          opportunity.value,
          value !== undefined ? value : opportunity.value,
          notes || `Movido para ${newStage.name}`
        ]
      );

      await client.query('COMMIT');

      console.log(`➡️ Oportunidade ${id} movida para etapa ${newStage.name}`);

      sendSuccess(res, {
        opportunity: result.rows[0],
        message: 'Oportunidade movida com sucesso'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Erro ao mover oportunidade:', error);
    sendError(res, error);
  }
};

// ================================
// 7. DELETAR OPORTUNIDADE
// ================================
const deleteOpportunity = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { id } = req.params;

    await checkOpportunityAccess(userId, id, accountId);

    await db.query('DELETE FROM opportunities WHERE id = $1 AND account_id = $2', [id, accountId]);

    console.log(`🗑️ Oportunidade ${id} deletada por usuário ${userId}`);

    sendSuccess(res, {
      message: 'Oportunidade deletada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar oportunidade:', error);
    sendError(res, error);
  }
};

// ================================
// 8. OBTER OPORTUNIDADES DE UM CONTATO
// ================================
const getContactOpportunities = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { contactId } = req.params;

    // Verificar se contato existe
    const contactCheck = await db.query(
      'SELECT id FROM contacts WHERE id = $1 AND account_id = $2',
      [contactId, accountId]
    );

    if (contactCheck.rows.length === 0) {
      throw new NotFoundError('Contato não encontrado');
    }

    const opportunities = await pipelineService.getContactOpportunities(contactId, accountId);

    sendSuccess(res, {
      opportunities
    });
  } catch (error) {
    console.error('Erro ao obter oportunidades do contato:', error);
    sendError(res, error);
  }
};

// ================================
// 9. REORDENAR OPORTUNIDADES NO KANBAN
// ================================
const reorderOpportunities = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { orders } = req.body;

    if (!Array.isArray(orders) || orders.length === 0) {
      throw new ValidationError('Lista de ordenação é obrigatória');
    }

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      for (const item of orders) {
        // Verificar acesso à oportunidade
        const oppCheck = await client.query(
          'SELECT id FROM opportunities WHERE id = $1 AND account_id = $2',
          [item.id, accountId]
        );

        if (oppCheck.rows.length > 0) {
          await client.query(
            'UPDATE opportunities SET display_order = $1 WHERE id = $2',
            [item.order, item.id]
          );
        }
      }

      await client.query('COMMIT');

      sendSuccess(res, {
        message: 'Ordem atualizada com sucesso'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Erro ao reordenar oportunidades:', error);
    sendError(res, error);
  }
};

// ================================
// 10. OBTER OPORTUNIDADES DE UMA CAMPANHA
// ================================
const getCampaignOpportunities = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { status, page = 1, limit = 50 } = req.query;

    console.log(`📋 Buscando oportunidades da campanha ${campaignId}`);

    // Verificar se campanha pertence ao usuário E à conta
    const campaign = await db.query(
      `SELECT * FROM campaigns WHERE id = $1 AND user_id = $2 AND account_id = $3`,
      [campaignId, userId, accountId]
    );

    if (campaign.rows.length === 0) {
      throw new NotFoundError('Campaign not found');
    }

    // Construir query - derive status from date fields
    let whereConditions = ['o.campaign_id = $1'];
    let queryParams = [campaignId];
    let paramIndex = 2;

    // Filter by derived status using date fields
    if (status) {
      switch (status) {
        case 'leads':
          whereConditions.push('o.sent_at IS NULL AND o.discarded_at IS NULL');
          break;
        case 'invite_sent':
          whereConditions.push('o.sent_at IS NOT NULL AND o.accepted_at IS NULL AND o.discarded_at IS NULL');
          break;
        case 'accepted':
          whereConditions.push('o.accepted_at IS NOT NULL AND o.qualifying_started_at IS NULL AND o.discarded_at IS NULL');
          break;
        case 'qualifying':
          whereConditions.push('o.qualifying_started_at IS NOT NULL AND o.qualified_at IS NULL AND o.discarded_at IS NULL');
          break;
        case 'qualified':
          whereConditions.push('o.qualified_at IS NOT NULL AND o.scheduled_at IS NULL AND o.discarded_at IS NULL');
          break;
        case 'scheduled':
          whereConditions.push('o.scheduled_at IS NOT NULL AND o.won_at IS NULL AND o.lost_at IS NULL AND o.discarded_at IS NULL');
          break;
        case 'won':
          whereConditions.push('o.won_at IS NOT NULL');
          break;
        case 'lost':
          whereConditions.push('o.lost_at IS NOT NULL');
          break;
        case 'discarded':
          whereConditions.push('o.discarded_at IS NOT NULL');
          break;
      }
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.join(' AND ');

    const query = `
      SELECT
        o.*,
        c.name as contact_name,
        c.email as contact_email,
        c.phone as contact_phone,
        c.company as contact_company,
        c.title as contact_title,
        c.profile_url as contact_profile_url,
        c.profile_picture as contact_profile_picture,
        CASE
          WHEN o.discarded_at IS NOT NULL THEN 'discarded'
          WHEN o.won_at IS NOT NULL THEN 'won'
          WHEN o.lost_at IS NOT NULL THEN 'lost'
          WHEN o.scheduled_at IS NOT NULL THEN 'scheduled'
          WHEN o.qualified_at IS NOT NULL THEN 'qualified'
          WHEN o.qualifying_started_at IS NOT NULL THEN 'qualifying'
          WHEN o.accepted_at IS NOT NULL THEN 'accepted'
          WHEN o.sent_at IS NOT NULL THEN 'invite_sent'
          ELSE 'leads'
        END as status,
        CASE
          WHEN o.sent_at IS NOT NULL AND o.accepted_at IS NULL
          THEN EXTRACT(DAY FROM NOW() - o.sent_at)::INTEGER
          ELSE 0
        END as days_since_invite
      FROM opportunities o
      LEFT JOIN contacts c ON o.contact_id = c.id
      WHERE ${whereClause}
      ORDER BY
        CASE
          WHEN o.qualified_at IS NOT NULL THEN 1
          WHEN o.qualifying_started_at IS NOT NULL THEN 2
          WHEN o.accepted_at IS NOT NULL THEN 3
          WHEN o.sent_at IS NOT NULL THEN 4
          ELSE 5
        END,
        o.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const opportunities = await db.query(query, queryParams);

    // Contar total
    const countQuery = `SELECT COUNT(*) FROM opportunities o WHERE ${whereClause}`;
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    console.log(`✅ Encontradas ${opportunities.rows.length} oportunidades`);

    sendSuccess(res, {
      campaign_id: campaignId,
      campaign_name: campaign.rows[0].name,
      opportunities: opportunities.rows,
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
// 11. LISTAR USUÁRIOS PARA ATRIBUIÇÃO
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
// 12. ATRIBUIR RESPONSÁVEL À OPORTUNIDADE
// ================================
const assignOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    const accountId = req.user.account_id;

    console.log(`👤 Atribuindo oportunidade ${id} ao usuário ${user_id}`);

    // Verificar se oportunidade existe e pertence à conta
    const oppCheck = await db.query(
      `SELECT o.* FROM opportunities o WHERE o.id = $1 AND o.account_id = $2`,
      [id, accountId]
    );

    if (oppCheck.rows.length === 0) {
      throw new NotFoundError('Opportunity not found');
    }

    // Se user_id for null, estamos removendo o responsável
    if (user_id === null) {
      await db.query(
        `UPDATE opportunities SET owner_user_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id]
      );

      console.log(`✅ Responsável removido da oportunidade`);
      return sendSuccess(res, { id, owner_user_id: null }, 'Responsible removed');
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

    // Atribuir a oportunidade
    await db.query(
      `UPDATE opportunities SET owner_user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [user_id, id]
    );

    console.log(`✅ Oportunidade atribuída ao usuário ${assignedUser.name}`);

    sendSuccess(res, {
      id,
      owner_user_id: user_id,
      responsible: {
        id: assignedUser.id,
        name: assignedUser.name,
        email: assignedUser.email,
        avatar_url: assignedUser.avatar_url
      }
    }, 'Opportunity assigned successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 13. ATRIBUIÇÃO AUTOMÁTICA (ROUND-ROBIN)
// ================================
const autoAssignOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    console.log(`🔄 Atribuição automática da oportunidade ${id}`);

    // Verificar se oportunidade existe e pertence à conta
    const oppCheck = await db.query(
      `SELECT o.*, p.sector_id
       FROM opportunities o
       LEFT JOIN pipelines p ON o.pipeline_id = p.id
       WHERE o.id = $1 AND o.account_id = $2`,
      [id, accountId]
    );

    if (oppCheck.rows.length === 0) {
      throw new NotFoundError('Opportunity not found');
    }

    const opportunity = oppCheck.rows[0];
    const sectorId = opportunity.sector_id;

    if (!sectorId) {
      throw new ValidationError('Opportunity must be in a sector to use auto-assignment');
    }

    // Tentar atribuição automática usando o roundRobinService
    const assignedUser = await roundRobinService.autoAssignOpportunity(id, sectorId, accountId);

    if (!assignedUser) {
      throw new ValidationError('Round-robin not enabled for this sector or no users available');
    }

    console.log(`✅ Oportunidade auto-atribuída ao usuário ${assignedUser.name}`);

    sendSuccess(res, {
      id,
      owner_user_id: assignedUser.user_id,
      responsible: {
        id: assignedUser.user_id,
        name: assignedUser.name,
        email: assignedUser.email,
        avatar_url: assignedUser.avatar_url
      }
    }, 'Opportunity auto-assigned successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 14. CRIAR OPORTUNIDADES EM LOTE
// ================================
const createOpportunitiesBulk = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { campaign_id, opportunities: oppsData, pipeline_id } = req.body;

    console.log(`📦 Criando ${oppsData?.length || 0} oportunidades em lote`);

    // Validações
    if (!oppsData || !Array.isArray(oppsData) || oppsData.length === 0) {
      throw new ValidationError('opportunities array is required');
    }

    if (oppsData.length > 100) {
      throw new ValidationError('Maximum 100 opportunities per batch');
    }

    // Verificar campanha se especificada
    let campaign = null;
    if (campaign_id) {
      const campaignCheck = await db.query(
        `SELECT * FROM campaigns WHERE id = $1 AND user_id = $2 AND account_id = $3`,
        [campaign_id, userId, accountId]
      );

      if (campaignCheck.rows.length === 0) {
        throw new NotFoundError('Campaign not found');
      }
      campaign = campaignCheck.rows[0];
    }

    // Verificar pipeline
    let targetPipelineId = pipeline_id;
    if (!targetPipelineId) {
      // Get default pipeline
      const defaultPipeline = await db.query(
        `SELECT id FROM pipelines WHERE account_id = $1 AND is_default = true LIMIT 1`,
        [accountId]
      );
      if (defaultPipeline.rows.length === 0) {
        throw new ValidationError('No default pipeline found');
      }
      targetPipelineId = defaultPipeline.rows[0].id;
    }

    // Get first stage of pipeline
    const firstStage = await db.query(
      `SELECT id FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY position ASC LIMIT 1`,
      [targetPipelineId]
    );
    if (firstStage.rows.length === 0) {
      throw new ValidationError('Pipeline has no stages');
    }
    const stageId = firstStage.rows[0].id;

    const createdOpportunities = [];
    const errors = [];

    // Processar cada oportunidade
    for (let i = 0; i < oppsData.length; i++) {
      const oppData = oppsData[i];

      try {
        // Validação básica
        if (!oppData.name && !oppData.contact_id) {
          throw new Error('name or contact_id is required');
        }

        // Criar ou encontrar contato
        let contactId = oppData.contact_id;
        if (!contactId && oppData.name) {
          // Verificar duplicatas por linkedin_profile_id
          if (oppData.linkedin_profile_id) {
            const existingContact = await db.query(
              'SELECT id FROM contacts WHERE account_id = $1 AND linkedin_profile_id = $2',
              [accountId, oppData.linkedin_profile_id]
            );
            if (existingContact.rows.length > 0) {
              contactId = existingContact.rows[0].id;
            }
          }

          // Criar contato se não existe
          if (!contactId) {
            const contactResult = await db.query(
              `INSERT INTO contacts (account_id, name, email, phone, company, title, location, profile_url, profile_picture, linkedin_profile_id, source)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               RETURNING id`,
              [accountId, oppData.name, oppData.email || null, oppData.phone || null,
               oppData.company || null, oppData.title || null, oppData.location || null,
               oppData.profile_url || null, oppData.profile_picture || null,
               oppData.linkedin_profile_id || null, oppData.source || 'list']
            );
            contactId = contactResult.rows[0].id;
          }
        }

        // Criar oportunidade
        const oppResult = await db.query(
          `INSERT INTO opportunities (account_id, contact_id, pipeline_id, stage_id, campaign_id,
           title, source, owner_user_id, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [accountId, contactId, targetPipelineId, stageId, campaign_id || null,
           oppData.name || 'New Opportunity', oppData.source || 'list', userId, userId]
        );

        createdOpportunities.push(oppResult.rows[0]);

      } catch (error) {
        errors.push({
          index: i,
          opportunity: oppData.name || 'Unknown',
          error: error.message
        });
      }
    }

    // Atualizar contadores da campanha
    if (campaign_id && createdOpportunities.length > 0) {
      await db.query(
        'UPDATE campaigns SET total_leads = total_leads + $1, leads_pending = leads_pending + $1 WHERE id = $2',
        [createdOpportunities.length, campaign_id]
      );
    }

    console.log(`✅ ${createdOpportunities.length} oportunidades criadas, ${errors.length} erros`);

    sendSuccess(res, {
      created: createdOpportunities.length,
      failed: errors.length,
      opportunities: createdOpportunities,
      errors: errors.length > 0 ? errors : undefined
    }, 'Bulk opportunity creation completed', 201);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 15. CRIAR OPORTUNIDADE MANUAL
// ================================
const createManualOpportunity = async (req, res) => {
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
      notes,
      contact_id,
      new_contact,
      pipeline_id,
      stage_id,
      value
    } = req.body;

    console.log(`📝 Criando oportunidade manual: ${name}`);

    // Validations
    if (!name && !contact_id) {
      throw new ValidationError('Nome ou contact_id é obrigatório');
    }

    let contactId = contact_id;

    // If creating a new contact
    if (new_contact && !contact_id) {
      if (!new_contact.name) {
        throw new ValidationError('Nome do contato é obrigatório');
      }

      // Create the contact first
      const contactResult = await db.query(
        `INSERT INTO contacts (account_id, name, email, phone, company, title, location, profile_url, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'manual')
         RETURNING id`,
        [accountId, new_contact.name, new_contact.email || email || null,
         new_contact.phone || phone || null, new_contact.company || company || null,
         new_contact.title || title || null, new_contact.location || location || null,
         new_contact.profile_url || profile_url || null]
      );
      contactId = contactResult.rows[0].id;
      console.log(`✅ Contato criado: ${contactId}`);
    }

    // Verificar pipeline
    let targetPipelineId = pipeline_id;
    let targetStageId = stage_id;

    if (!targetPipelineId) {
      // Get default pipeline
      const defaultPipeline = await db.query(
        `SELECT id FROM pipelines WHERE account_id = $1 AND is_default = true LIMIT 1`,
        [accountId]
      );
      if (defaultPipeline.rows.length === 0) {
        throw new ValidationError('No default pipeline found');
      }
      targetPipelineId = defaultPipeline.rows[0].id;
    }

    if (!targetStageId) {
      // Get first stage of pipeline
      const firstStage = await db.query(
        `SELECT id FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY position ASC LIMIT 1`,
        [targetPipelineId]
      );
      if (firstStage.rows.length === 0) {
        throw new ValidationError('Pipeline has no stages');
      }
      targetStageId = firstStage.rows[0].id;
    }

    // Create opportunity
    const oppResult = await db.query(
      `INSERT INTO opportunities (account_id, contact_id, pipeline_id, stage_id, title, value, source, notes, owner_user_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [accountId, contactId, targetPipelineId, targetStageId, name, value || null, source, notes || null, userId, userId]
    );

    const opportunity = oppResult.rows[0];

    // Get contact info for response
    if (contactId) {
      const contactInfo = await db.query(
        `SELECT name, email, phone, company, title FROM contacts WHERE id = $1`,
        [contactId]
      );
      if (contactInfo.rows.length > 0) {
        opportunity.contact = contactInfo.rows[0];
      }
    }

    console.log(`✅ Oportunidade manual criada: ${opportunity.id}`);

    sendSuccess(res, opportunity, 'Opportunity created successfully', 201);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 16. REATIVAR OPORTUNIDADE DESCARTADA
// ================================
const reactivateOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;
    const { target_stage_id } = req.body;

    console.log(`🔄 Reativando oportunidade ${id}`);

    // Verificar se oportunidade pertence à conta
    const oppCheck = await db.query(
      `SELECT o.*, dr.name as discard_reason_name
       FROM opportunities o
       LEFT JOIN discard_reasons dr ON o.discard_reason_id = dr.id
       WHERE o.id = $1 AND o.account_id = $2`,
      [id, accountId]
    );

    if (oppCheck.rows.length === 0) {
      throw new NotFoundError('Opportunity not found');
    }

    const opportunity = oppCheck.rows[0];

    if (!opportunity.discarded_at) {
      throw new ValidationError('Opportunity is not discarded');
    }

    // Determinar stage de destino
    let newStageId = target_stage_id || opportunity.previous_stage_id;

    if (!newStageId) {
      // Get first stage of pipeline
      const firstStage = await db.query(
        `SELECT id FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY position ASC LIMIT 1`,
        [opportunity.pipeline_id]
      );
      if (firstStage.rows.length > 0) {
        newStageId = firstStage.rows[0].id;
      }
    }

    // Atualizar oportunidade
    await db.query(
      `UPDATE opportunities SET
         stage_id = $1,
         discard_reason_id = NULL,
         discard_notes = NULL,
         previous_stage_id = NULL,
         discarded_at = NULL,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newStageId, id]
    );

    // Atualizar contadores da campanha se houver
    if (opportunity.campaign_id) {
      await db.query(
        `UPDATE campaigns SET leads_discarded = GREATEST(0, leads_discarded - 1) WHERE id = $1`,
        [opportunity.campaign_id]
      );
    }

    // Log na conversa se existir
    const conversationCheck = await db.query(
      `SELECT id FROM conversations WHERE opportunity_id = $1`,
      [id]
    );

    if (conversationCheck.rows.length > 0) {
      const conversationId = conversationCheck.rows[0].id;
      const previousReason = opportunity.discard_reason_name ? ` (estava: ${opportunity.discard_reason_name})` : '';
      const message = `🔄 Oportunidade reativada${previousReason}`;

      await db.query(
        `INSERT INTO messages (conversation_id, sender_type, content, sent_at)
         VALUES ($1, 'system', $2, NOW())`,
        [conversationId, message]
      );
    }

    console.log(`✅ Oportunidade reativada`);

    // Return updated opportunity
    const updatedOpp = await db.query(
      `SELECT o.*, ps.name as stage_name
       FROM opportunities o
       LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
       WHERE o.id = $1`,
      [id]
    );

    sendSuccess(res, updatedOpp.rows[0], 'Opportunity reactivated successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  getOpportunities,
  getOpportunitiesKanban,
  getOpportunity,
  createOpportunity,
  updateOpportunity,
  moveOpportunity,
  deleteOpportunity,
  getContactOpportunities,
  reorderOpportunities,
  getCampaignOpportunities,
  getAssignableUsers,
  assignOpportunity,
  autoAssignOpportunity,
  createOpportunitiesBulk,
  createManualOpportunity,
  reactivateOpportunity
};
