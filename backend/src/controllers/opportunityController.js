// backend/src/controllers/opportunityController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const {
  ValidationError,
  NotFoundError,
  ForbiddenError
} = require('../utils/errors');
const pipelineService = require('../services/pipelineService');

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

    // Buscar dados completos
    const query = `
      SELECT
        o.*,
        c.id as contact_id,
        c.name as contact_name,
        c.email as contact_email,
        c.phone as contact_phone,
        c.company as contact_company,
        c.title as contact_title,
        c.profile_picture as contact_picture,
        p.id as pipeline_id,
        p.name as pipeline_name,
        p.color as pipeline_color,
        ps.id as stage_id,
        ps.name as stage_name,
        ps.color as stage_color,
        ps.is_win_stage,
        ps.is_loss_stage,
        u.name as owner_name,
        u.email as owner_email,
        u.avatar_url as owner_avatar,
        cb.name as created_by_name,
        dr.name as loss_reason_name
      FROM opportunities o
      JOIN contacts c ON o.contact_id = c.id
      JOIN pipelines p ON o.pipeline_id = p.id
      JOIN pipeline_stages ps ON o.stage_id = ps.id
      LEFT JOIN users u ON o.owner_user_id = u.id
      LEFT JOIN users cb ON o.created_by = cb.id
      LEFT JOIN discard_reasons dr ON o.loss_reason_id = dr.id
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

    if (!contact_id) {
      throw new ValidationError('ID do contato é obrigatório');
    }

    // Verificar acesso à pipeline
    const { hasAccess, reason } = await pipelineService.canUserAccessPipeline(userId, pipelineId, accountId);

    if (!hasAccess) {
      if (reason === 'pipeline_not_found') {
        throw new NotFoundError('Pipeline não encontrada');
      }
      throw new ForbiddenError('Você não tem acesso a esta pipeline');
    }

    // Verificar contato
    const contactCheck = await db.query(
      'SELECT id, name, company FROM contacts WHERE id = $1 AND account_id = $2',
      [contact_id, accountId]
    );

    if (contactCheck.rows.length === 0) {
      throw new NotFoundError('Contato não encontrado');
    }

    const contact = contactCheck.rows[0];

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
          contact_id,
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
        opportunity,
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

module.exports = {
  getOpportunities,
  getOpportunitiesKanban,
  getOpportunity,
  createOpportunity,
  updateOpportunity,
  moveOpportunity,
  deleteOpportunity,
  getContactOpportunities,
  reorderOpportunities
};
