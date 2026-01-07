// backend/src/controllers/pipelineStageController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const {
  ValidationError,
  NotFoundError,
  ForbiddenError
} = require('../utils/errors');
const pipelineService = require('../services/pipelineService');

// ================================
// Helper: Verificar acesso à pipeline
// ================================
async function checkPipelineEditAccess(userId, pipelineId, accountId) {
  const { hasAccess, pipeline, role, reason } = await pipelineService.canUserAccessPipeline(userId, pipelineId, accountId);

  if (!hasAccess) {
    if (reason === 'pipeline_not_found') {
      throw new NotFoundError('Pipeline não encontrada');
    }
    throw new ForbiddenError('Você não tem acesso a esta pipeline');
  }

  if (pipeline.is_restricted && !['owner', 'admin'].includes(role)) {
    throw new ForbiddenError('Você não tem permissão para editar esta pipeline');
  }

  return { pipeline, role };
}

// ================================
// 1. LISTAR ETAPAS
// ================================
const getStages = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { pipelineId } = req.params;

    // Verificar acesso (apenas leitura)
    const { hasAccess, reason } = await pipelineService.canUserAccessPipeline(userId, pipelineId, accountId);

    if (!hasAccess) {
      if (reason === 'pipeline_not_found') {
        throw new NotFoundError('Pipeline não encontrada');
      }
      throw new ForbiddenError('Você não tem acesso a esta pipeline');
    }

    const query = `
      SELECT
        ps.*,
        (SELECT COUNT(*) FROM opportunities WHERE stage_id = ps.id) as opportunities_count,
        (SELECT COALESCE(SUM(value), 0) FROM opportunities WHERE stage_id = ps.id) as total_value
      FROM pipeline_stages ps
      WHERE ps.pipeline_id = $1
      ORDER BY ps.position ASC
    `;

    const result = await db.query(query, [pipelineId]);

    sendSuccess(res, {
      stages: result.rows
    });
  } catch (error) {
    console.error('Erro ao listar etapas:', error);
    sendError(res, error);
  }
};

// ================================
// 2. CRIAR ETAPA
// ================================
const createStage = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { pipelineId } = req.params;
    const { name, color, is_win_stage, is_loss_stage, position } = req.body;

    if (!name || name.trim().length === 0) {
      throw new ValidationError('Nome da etapa é obrigatório');
    }

    // Verificar acesso de edição
    await checkPipelineEditAccess(userId, pipelineId, accountId);

    // Verificar duplicidade de nome
    const existingCheck = await db.query(
      'SELECT id FROM pipeline_stages WHERE pipeline_id = $1 AND LOWER(name) = LOWER($2)',
      [pipelineId, name.trim()]
    );

    if (existingCheck.rows.length > 0) {
      throw new ValidationError('Já existe uma etapa com esse nome nesta pipeline');
    }

    // Determinar posição
    let stagePosition = position;
    if (stagePosition === undefined || stagePosition === null) {
      const maxPosition = await db.query(
        'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM pipeline_stages WHERE pipeline_id = $1',
        [pipelineId]
      );
      stagePosition = maxPosition.rows[0].next_pos;
    } else {
      // Deslocar etapas existentes
      await db.query(
        'UPDATE pipeline_stages SET position = position + 1 WHERE pipeline_id = $1 AND position >= $2',
        [pipelineId, stagePosition]
      );
    }

    // Criar etapa
    const result = await db.query(
      `INSERT INTO pipeline_stages (pipeline_id, name, color, position, is_win_stage, is_loss_stage)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        pipelineId,
        name.trim(),
        color || 'gray',
        stagePosition,
        is_win_stage || false,
        is_loss_stage || false
      ]
    );

    console.log(`✅ Etapa "${name}" criada na pipeline ${pipelineId}`);

    sendSuccess(res, {
      stage: result.rows[0],
      message: 'Etapa criada com sucesso'
    }, 201);
  } catch (error) {
    console.error('Erro ao criar etapa:', error);
    sendError(res, error);
  }
};

// ================================
// 3. ATUALIZAR ETAPA
// ================================
const updateStage = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { pipelineId, stageId } = req.params;
    const { name, color, is_win_stage, is_loss_stage, automations } = req.body;

    // Verificar acesso de edição
    await checkPipelineEditAccess(userId, pipelineId, accountId);

    // Verificar se etapa existe
    const existingStage = await db.query(
      'SELECT * FROM pipeline_stages WHERE id = $1 AND pipeline_id = $2',
      [stageId, pipelineId]
    );

    if (existingStage.rows.length === 0) {
      throw new NotFoundError('Etapa não encontrada');
    }

    // Se mudou o nome, verificar duplicidade
    if (name && name.trim().toLowerCase() !== existingStage.rows[0].name.toLowerCase()) {
      const duplicateCheck = await db.query(
        'SELECT id FROM pipeline_stages WHERE pipeline_id = $1 AND LOWER(name) = LOWER($2) AND id != $3',
        [pipelineId, name.trim(), stageId]
      );

      if (duplicateCheck.rows.length > 0) {
        throw new ValidationError('Já existe uma etapa com esse nome nesta pipeline');
      }
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name.trim());
      paramIndex++;
    }

    if (color !== undefined) {
      updates.push(`color = $${paramIndex}`);
      values.push(color);
      paramIndex++;
    }

    if (is_win_stage !== undefined) {
      updates.push(`is_win_stage = $${paramIndex}`);
      values.push(is_win_stage);
      paramIndex++;
    }

    if (is_loss_stage !== undefined) {
      updates.push(`is_loss_stage = $${paramIndex}`);
      values.push(is_loss_stage);
      paramIndex++;
    }

    if (automations !== undefined) {
      updates.push(`automations = $${paramIndex}`);
      values.push(JSON.stringify(automations));
      paramIndex++;
    }

    if (updates.length === 0) {
      throw new ValidationError('Nenhum campo para atualizar');
    }

    values.push(stageId, pipelineId);

    const query = `
      UPDATE pipeline_stages
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND pipeline_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await db.query(query, values);

    sendSuccess(res, {
      stage: result.rows[0],
      message: 'Etapa atualizada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar etapa:', error);
    sendError(res, error);
  }
};

// ================================
// 4. DELETAR ETAPA
// ================================
const deleteStage = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { pipelineId, stageId } = req.params;
    const { move_to_stage_id } = req.query;

    // Verificar acesso de edição
    await checkPipelineEditAccess(userId, pipelineId, accountId);

    // Verificar se etapa existe
    const existingStage = await db.query(
      'SELECT * FROM pipeline_stages WHERE id = $1 AND pipeline_id = $2',
      [stageId, pipelineId]
    );

    if (existingStage.rows.length === 0) {
      throw new NotFoundError('Etapa não encontrada');
    }

    // Contar etapas da pipeline
    const stageCount = await db.query(
      'SELECT COUNT(*) as count FROM pipeline_stages WHERE pipeline_id = $1',
      [pipelineId]
    );

    if (parseInt(stageCount.rows[0].count) <= 1) {
      throw new ValidationError('Não é possível deletar a última etapa da pipeline');
    }

    // Verificar se tem oportunidades
    const oppsCheck = await db.query(
      'SELECT COUNT(*) as count FROM opportunities WHERE stage_id = $1',
      [stageId]
    );

    const oppsCount = parseInt(oppsCheck.rows[0].count);

    if (oppsCount > 0) {
      if (!move_to_stage_id) {
        throw new ValidationError(
          `Esta etapa contém ${oppsCount} oportunidade(s). Forneça move_to_stage_id para mover as oportunidades.`
        );
      }

      // Verificar se stage de destino existe e é diferente
      const targetStage = await db.query(
        'SELECT id FROM pipeline_stages WHERE id = $1 AND pipeline_id = $2',
        [move_to_stage_id, pipelineId]
      );

      if (targetStage.rows.length === 0) {
        throw new ValidationError('Etapa de destino não encontrada');
      }

      if (move_to_stage_id === stageId) {
        throw new ValidationError('Etapa de destino não pode ser a mesma');
      }

      // Mover oportunidades
      await db.query(
        'UPDATE opportunities SET stage_id = $1 WHERE stage_id = $2',
        [move_to_stage_id, stageId]
      );
    }

    const deletedPosition = existingStage.rows[0].position;

    // Deletar etapa
    await db.query(
      'DELETE FROM pipeline_stages WHERE id = $1',
      [stageId]
    );

    // Reajustar posições
    await db.query(
      'UPDATE pipeline_stages SET position = position - 1 WHERE pipeline_id = $1 AND position > $2',
      [pipelineId, deletedPosition]
    );

    console.log(`🗑️ Etapa ${stageId} deletada da pipeline ${pipelineId}`);

    sendSuccess(res, {
      message: 'Etapa deletada com sucesso',
      moved_opportunities: oppsCount
    });
  } catch (error) {
    console.error('Erro ao deletar etapa:', error);
    sendError(res, error);
  }
};

// ================================
// 5. REORDENAR ETAPAS
// ================================
const reorderStages = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { pipelineId } = req.params;
    const { orders } = req.body;

    if (!Array.isArray(orders) || orders.length === 0) {
      throw new ValidationError('Lista de ordenação é obrigatória');
    }

    // Verificar acesso de edição
    await checkPipelineEditAccess(userId, pipelineId, accountId);

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Primeiro, definir todas as posições como negativas (temporário) para evitar conflitos de unique
      await client.query(
        'UPDATE pipeline_stages SET position = -position - 1000 WHERE pipeline_id = $1',
        [pipelineId]
      );

      // Agora aplicar as novas posições
      for (const item of orders) {
        await client.query(
          'UPDATE pipeline_stages SET position = $1 WHERE id = $2 AND pipeline_id = $3',
          [item.position, item.id, pipelineId]
        );
      }

      await client.query('COMMIT');

      // Buscar etapas atualizadas
      const result = await db.query(
        'SELECT * FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY position ASC',
        [pipelineId]
      );

      sendSuccess(res, {
        stages: result.rows,
        message: 'Ordem atualizada com sucesso'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Erro ao reordenar etapas:', error);
    sendError(res, error);
  }
};

module.exports = {
  getStages,
  createStage,
  updateStage,
  deleteStage,
  reorderStages
};
