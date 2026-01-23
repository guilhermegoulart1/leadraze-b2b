// backend/src/services/pipelineService.js
const db = require('../config/database');

/**
 * Serviço para gerenciamento de pipelines
 */
const pipelineService = {
  /**
   * Criar pipeline default para uma conta
   */
  async createDefaultPipeline(accountId, userId = null) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Verificar se já existe pipeline default
      const existingDefault = await client.query(
        'SELECT id FROM pipelines WHERE account_id = $1 AND is_default = true',
        [accountId]
      );

      if (existingDefault.rows.length > 0) {
        await client.query('ROLLBACK');
        return existingDefault.rows[0];
      }

      // Criar pipeline default
      const pipelineResult = await client.query(
        `INSERT INTO pipelines (account_id, name, description, color, is_default, is_active, created_by)
         VALUES ($1, 'Pipeline Principal', 'Pipeline padrão para gerenciamento de oportunidades', 'blue', true, true, $2)
         RETURNING *`,
        [accountId, userId]
      );

      const pipeline = pipelineResult.rows[0];

      // Criar etapas padrão
      const defaultStages = [
        { name: 'Novos', color: 'slate', position: 0 },
        { name: 'Contato Inicial', color: 'blue', position: 1 },
        { name: 'Qualificação', color: 'purple', position: 2 },
        { name: 'Proposta', color: 'amber', position: 3 },
        { name: 'Negociação', color: 'orange', position: 4 },
        { name: 'Fechado (Ganho)', color: 'emerald', position: 5, is_win_stage: true },
        { name: 'Fechado (Perdido)', color: 'red', position: 6, is_loss_stage: true }
      ];

      for (const stage of defaultStages) {
        await client.query(
          `INSERT INTO pipeline_stages (pipeline_id, name, color, position, is_win_stage, is_loss_stage)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [pipeline.id, stage.name, stage.color, stage.position, stage.is_win_stage || false, stage.is_loss_stage || false]
        );
      }

      await client.query('COMMIT');

      console.log(`✅ Pipeline default criada para conta ${accountId}`);

      return pipeline;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Erro ao criar pipeline default:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Verificar se usuário tem acesso a uma pipeline
   */
  async canUserAccessPipeline(userId, pipelineId, accountId) {
    // Buscar pipeline
    const pipelineResult = await db.query(
      'SELECT * FROM pipelines WHERE id = $1 AND account_id = $2',
      [pipelineId, accountId]
    );

    if (pipelineResult.rows.length === 0) {
      return { hasAccess: false, reason: 'pipeline_not_found' };
    }

    const pipeline = pipelineResult.rows[0];

    // Se pipeline não é restrita, todos da conta têm acesso
    if (!pipeline.is_restricted) {
      return { hasAccess: true, pipeline, role: 'member' };
    }

    // Verificar se usuário está em pipeline_users
    const accessResult = await db.query(
      'SELECT role FROM pipeline_users WHERE pipeline_id = $1 AND user_id = $2',
      [pipelineId, userId]
    );

    if (accessResult.rows.length > 0) {
      return { hasAccess: true, pipeline, role: accessResult.rows[0].role };
    }

    return { hasAccess: false, reason: 'no_permission', pipeline };
  },

  /**
   * Obter pipelines acessíveis por um usuário
   */
  async getPipelinesForUser(userId, accountId, options = {}) {
    const { includeInactive = false, projectId = null } = options;

    let whereConditions = ['p.account_id = $1'];
    let queryParams = [accountId];
    let paramIndex = 2;

    if (!includeInactive) {
      whereConditions.push('p.is_active = true');
    }

    if (projectId !== null) {
      if (projectId === 'null' || projectId === '') {
        whereConditions.push('p.project_id IS NULL');
      } else {
        whereConditions.push(`p.project_id = $${paramIndex}`);
        queryParams.push(projectId);
        paramIndex++;
      }
    }

    // Subquery para verificar acesso em pipelines restritas
    whereConditions.push(`
      (p.is_restricted = false OR EXISTS (
        SELECT 1 FROM pipeline_users pu WHERE pu.pipeline_id = p.id AND pu.user_id = $${paramIndex}
      ))
    `);
    queryParams.push(userId);

    const query = `
      SELECT
        p.*,
        proj.name as project_name,
        proj.color as project_color,
        (SELECT COUNT(*) FROM pipeline_stages WHERE pipeline_id = p.id) as stages_count,
        (SELECT COUNT(*) FROM opportunities WHERE pipeline_id = p.id) as opportunities_count,
        (SELECT SUM(value) FROM opportunities WHERE pipeline_id = p.id) as total_value
      FROM pipelines p
      LEFT JOIN crm_projects proj ON p.project_id = proj.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY proj.display_order ASC NULLS LAST, proj.name ASC NULLS LAST, p.name ASC
    `;

    const result = await db.query(query, queryParams);
    const pipelines = result.rows;

    // Load stages for each pipeline
    for (const pipeline of pipelines) {
      const stagesResult = await db.query(
        `SELECT id, name, color, position, is_win_stage, is_loss_stage
         FROM pipeline_stages
         WHERE pipeline_id = $1
         ORDER BY position ASC`,
        [pipeline.id]
      );
      pipeline.stages = stagesResult.rows;
    }

    return pipelines;
  },

  /**
   * Obter estatísticas de uma pipeline
   */
  async getPipelineStats(pipelineId, accountId) {
    // Verificar se pipeline existe e pertence à conta
    const pipelineCheck = await db.query(
      'SELECT id FROM pipelines WHERE id = $1 AND account_id = $2',
      [pipelineId, accountId]
    );

    if (pipelineCheck.rows.length === 0) {
      return null;
    }

    // Estatísticas gerais
    const statsQuery = `
      SELECT
        COUNT(*) as total_opportunities,
        COUNT(CASE WHEN o.won_at IS NOT NULL THEN 1 END) as won_count,
        COUNT(CASE WHEN o.lost_at IS NOT NULL THEN 1 END) as lost_count,
        COUNT(CASE WHEN o.won_at IS NULL AND o.lost_at IS NULL THEN 1 END) as open_count,
        COALESCE(SUM(o.value), 0) as total_value,
        COALESCE(SUM(CASE WHEN o.won_at IS NOT NULL THEN o.value ELSE 0 END), 0) as won_value,
        COALESCE(SUM(CASE WHEN o.won_at IS NULL AND o.lost_at IS NULL THEN o.value ELSE 0 END), 0) as open_value,
        COALESCE(AVG(CASE WHEN o.won_at IS NOT NULL THEN o.value END), 0) as avg_won_value,
        COALESCE(AVG(o.probability), 0) as avg_probability
      FROM opportunities o
      WHERE o.pipeline_id = $1
    `;

    const statsResult = await db.query(statsQuery, [pipelineId]);

    // Estatísticas por etapa
    const stageStatsQuery = `
      SELECT
        ps.id as stage_id,
        ps.name as stage_name,
        ps.color as stage_color,
        ps.position,
        ps.is_win_stage,
        ps.is_loss_stage,
        COUNT(o.id) as count,
        COALESCE(SUM(o.value), 0) as total_value
      FROM pipeline_stages ps
      LEFT JOIN opportunities o ON o.stage_id = ps.id
      WHERE ps.pipeline_id = $1
      GROUP BY ps.id, ps.name, ps.color, ps.position, ps.is_win_stage, ps.is_loss_stage
      ORDER BY ps.position ASC
    `;

    const stageStatsResult = await db.query(stageStatsQuery, [pipelineId]);

    // Taxa de conversão
    const stats = statsResult.rows[0];
    const totalClosed = parseInt(stats.won_count) + parseInt(stats.lost_count);
    const conversionRate = totalClosed > 0 ? (parseInt(stats.won_count) / totalClosed * 100).toFixed(1) : 0;

    return {
      ...stats,
      conversion_rate: parseFloat(conversionRate),
      stages: stageStatsResult.rows
    };
  },

  /**
   * Criar oportunidade a partir de contato
   */
  async createOpportunityFromContact(contactId, pipelineId, stageId, data, accountId, userId) {
    // Verificar se contato existe
    const contactCheck = await db.query(
      'SELECT id, name, company FROM contacts WHERE id = $1 AND account_id = $2',
      [contactId, accountId]
    );

    if (contactCheck.rows.length === 0) {
      throw new Error('Contato não encontrado');
    }

    const contact = contactCheck.rows[0];

    // Verificar pipeline e stage
    const stageCheck = await db.query(
      `SELECT ps.id, ps.name, p.id as pipeline_id
       FROM pipeline_stages ps
       JOIN pipelines p ON ps.pipeline_id = p.id
       WHERE ps.id = $1 AND p.id = $2 AND p.account_id = $3`,
      [stageId, pipelineId, accountId]
    );

    if (stageCheck.rows.length === 0) {
      throw new Error('Pipeline ou etapa não encontrada');
    }

    // Criar oportunidade
    const title = data.title || `${contact.name}${contact.company ? ` - ${contact.company}` : ''}`;

    const result = await db.query(
      `INSERT INTO opportunities (
        account_id, contact_id, pipeline_id, stage_id, title, value, currency,
        probability, expected_close_date, owner_user_id, source_lead_id, source,
        custom_fields, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        accountId,
        contactId,
        pipelineId,
        stageId,
        title,
        data.value || 0,
        data.currency || 'BRL',
        data.probability || 0,
        data.expected_close_date || null,
        data.owner_user_id || userId,
        data.source_lead_id || null,
        data.source || 'manual',
        data.custom_fields ? JSON.stringify(data.custom_fields) : '{}',
        userId
      ]
    );

    // Registrar no histórico
    await db.query(
      `INSERT INTO opportunity_history (opportunity_id, user_id, action, to_stage_id, to_value, notes, metadata)
       VALUES ($1, $2, 'created', $3, $4, $5, $6)`,
      [result.rows[0].id, userId, stageId, data.value || 0, 'Oportunidade criada', JSON.stringify({ source: data.source || 'manual' })]
    );

    return result.rows[0];
  },

  /**
   * Mover oportunidade para outra etapa
   */
  async moveOpportunityToStage(opportunityId, newStageId, accountId, userId, notes = null) {
    // Buscar oportunidade atual
    const oppResult = await db.query(
      `SELECT o.*, ps.name as current_stage_name
       FROM opportunities o
       JOIN pipeline_stages ps ON o.stage_id = ps.id
       WHERE o.id = $1 AND o.account_id = $2`,
      [opportunityId, accountId]
    );

    if (oppResult.rows.length === 0) {
      throw new Error('Oportunidade não encontrada');
    }

    const opportunity = oppResult.rows[0];

    // Verificar se nova etapa pertence à mesma pipeline
    const newStageResult = await db.query(
      `SELECT * FROM pipeline_stages WHERE id = $1 AND pipeline_id = $2`,
      [newStageId, opportunity.pipeline_id]
    );

    if (newStageResult.rows.length === 0) {
      throw new Error('Etapa não pertence a esta pipeline');
    }

    const newStage = newStageResult.rows[0];

    // Atualizar oportunidade
    const updates = { stage_id: newStageId };

    // Se movendo para etapa de ganho
    if (newStage.is_win_stage && !opportunity.won_at) {
      updates.won_at = new Date();
      updates.lost_at = null;
    }
    // Se movendo para etapa de perda
    else if (newStage.is_loss_stage && !opportunity.lost_at) {
      updates.lost_at = new Date();
      updates.won_at = null;
    }
    // Se movendo de etapa final para etapa normal
    else if (!newStage.is_win_stage && !newStage.is_loss_stage) {
      updates.won_at = null;
      updates.lost_at = null;
    }

    const updateFields = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ');
    const updateValues = Object.values(updates);

    await db.query(
      `UPDATE opportunities SET ${updateFields} WHERE id = $${updateValues.length + 1}`,
      [...updateValues, opportunityId]
    );

    // Registrar no histórico
    await db.query(
      `INSERT INTO opportunity_history (opportunity_id, user_id, action, from_stage_id, to_stage_id, notes)
       VALUES ($1, $2, 'stage_changed', $3, $4, $5)`,
      [opportunityId, userId, opportunity.stage_id, newStageId, notes || `Movido para ${newStage.name}`]
    );

    return { ...opportunity, ...updates };
  },

  /**
   * Obter oportunidades de um contato
   */
  async getContactOpportunities(contactId, accountId) {
    const query = `
      SELECT
        o.*,
        p.name as pipeline_name,
        p.color as pipeline_color,
        ps.name as stage_name,
        ps.color as stage_color,
        ps.is_win_stage,
        ps.is_loss_stage,
        u.name as owner_name
      FROM opportunities o
      JOIN pipelines p ON o.pipeline_id = p.id
      JOIN pipeline_stages ps ON o.stage_id = ps.id
      LEFT JOIN users u ON o.owner_user_id = u.id
      WHERE o.contact_id = $1 AND o.account_id = $2
      ORDER BY o.created_at DESC
    `;

    const result = await db.query(query, [contactId, accountId]);
    return result.rows;
  }
};

module.exports = pipelineService;
