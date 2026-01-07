// backend/src/controllers/pipelineController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const {
  ValidationError,
  NotFoundError,
  ForbiddenError
} = require('../utils/errors');
const pipelineService = require('../services/pipelineService');

// ================================
// 1. LISTAR PIPELINES
// ================================
const getPipelines = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { project_id, is_active, include_stats } = req.query;

    const options = {
      projectId: project_id,
      includeInactive: is_active === 'false'
    };

    const pipelines = await pipelineService.getPipelinesForUser(userId, accountId, options);

    // Se solicitado, incluir estatísticas básicas
    if (include_stats === 'true') {
      for (const pipeline of pipelines) {
        const stats = await pipelineService.getPipelineStats(pipeline.id, accountId);
        pipeline.stats = stats;
      }
    }

    sendSuccess(res, {
      pipelines
    });
  } catch (error) {
    console.error('Erro ao listar pipelines:', error);
    sendError(res, error);
  }
};

// ================================
// 2. OBTER PIPELINE POR ID
// ================================
const getPipeline = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { id } = req.params;

    // Verificar acesso
    const { hasAccess, pipeline, role, reason } = await pipelineService.canUserAccessPipeline(userId, id, accountId);

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
    const stagesResult = await db.query(stagesQuery, [id]);

    // Buscar usuários com acesso (se restrita)
    let users = [];
    if (pipeline.is_restricted) {
      const usersQuery = `
        SELECT pu.*, u.name, u.email, u.avatar_url
        FROM pipeline_users pu
        JOIN users u ON pu.user_id = u.id
        WHERE pu.pipeline_id = $1
        ORDER BY u.name ASC
      `;
      const usersResult = await db.query(usersQuery, [id]);
      users = usersResult.rows;
    }

    // Buscar estatísticas
    const stats = await pipelineService.getPipelineStats(id, accountId);

    sendSuccess(res, {
      pipeline: {
        ...pipeline,
        stages: stagesResult.rows,
        users,
        stats,
        user_role: role
      }
    });
  } catch (error) {
    console.error('Erro ao obter pipeline:', error);
    sendError(res, error);
  }
};

// ================================
// 3. CRIAR PIPELINE
// ================================
const createPipeline = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      name,
      description,
      color,
      icon,
      project_id,
      is_default,
      is_restricted,
      stages
    } = req.body;

    if (!name || name.trim().length === 0) {
      throw new ValidationError('Nome da pipeline é obrigatório');
    }

    // Verificar duplicidade de nome
    const existingCheck = await db.query(
      'SELECT id FROM pipelines WHERE account_id = $1 AND LOWER(name) = LOWER($2)',
      [accountId, name.trim()]
    );

    if (existingCheck.rows.length > 0) {
      throw new ValidationError('Já existe uma pipeline com esse nome');
    }

    // Se project_id fornecido, verificar se pertence à conta
    if (project_id) {
      const projectCheck = await db.query(
        'SELECT id FROM crm_projects WHERE id = $1 AND account_id = $2',
        [project_id, accountId]
      );
      if (projectCheck.rows.length === 0) {
        throw new ValidationError('Projeto não encontrado');
      }
    }

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Se for default, remover default de outras pipelines
      if (is_default) {
        await client.query(
          'UPDATE pipelines SET is_default = false WHERE account_id = $1 AND is_default = true',
          [accountId]
        );
      }

      // Criar pipeline
      const pipelineResult = await client.query(
        `INSERT INTO pipelines (account_id, project_id, name, description, color, icon, is_default, is_restricted, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          accountId,
          project_id || null,
          name.trim(),
          description || null,
          color || 'blue',
          icon || 'target',
          is_default || false,
          is_restricted || false,
          userId
        ]
      );

      const pipeline = pipelineResult.rows[0];

      // Criar etapas
      const stagesToCreate = stages && stages.length > 0 ? stages : [
        { name: 'Novos', color: 'slate' },
        { name: 'Em Progresso', color: 'blue' },
        { name: 'Qualificado', color: 'emerald', is_win_stage: true },
        { name: 'Perdido', color: 'red', is_loss_stage: true }
      ];

      const createdStages = [];
      for (let i = 0; i < stagesToCreate.length; i++) {
        const stage = stagesToCreate[i];
        const stageResult = await client.query(
          `INSERT INTO pipeline_stages (pipeline_id, name, color, position, is_win_stage, is_loss_stage)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            pipeline.id,
            stage.name,
            stage.color || 'gray',
            i,
            stage.is_win_stage || false,
            stage.is_loss_stage || false
          ]
        );
        createdStages.push(stageResult.rows[0]);
      }

      // Se restrita, adicionar criador como owner
      if (is_restricted) {
        await client.query(
          'INSERT INTO pipeline_users (pipeline_id, user_id, role) VALUES ($1, $2, $3)',
          [pipeline.id, userId, 'owner']
        );
      }

      await client.query('COMMIT');

      console.log(`✅ Pipeline "${name}" criada por usuário ${userId}`);

      sendSuccess(res, {
        pipeline: {
          ...pipeline,
          stages: createdStages
        },
        message: 'Pipeline criada com sucesso'
      }, 201);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Erro ao criar pipeline:', error);
    sendError(res, error);
  }
};

// ================================
// 4. ATUALIZAR PIPELINE
// ================================
const updatePipeline = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { id } = req.params;
    const {
      name,
      description,
      color,
      icon,
      project_id,
      is_default,
      is_active,
      is_restricted,
      settings,
      stages
    } = req.body;

    // Verificar acesso
    const { hasAccess, pipeline, role, reason } = await pipelineService.canUserAccessPipeline(userId, id, accountId);

    if (!hasAccess) {
      if (reason === 'pipeline_not_found') {
        throw new NotFoundError('Pipeline não encontrada');
      }
      throw new ForbiddenError('Você não tem acesso a esta pipeline');
    }

    // Verificar se tem permissão de edição (owner ou admin)
    if (pipeline.is_restricted && !['owner', 'admin'].includes(role)) {
      throw new ForbiddenError('Você não tem permissão para editar esta pipeline');
    }

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Se mudou o nome, verificar duplicidade
      if (name && name.trim().toLowerCase() !== pipeline.name.toLowerCase()) {
        const duplicateCheck = await client.query(
          'SELECT id FROM pipelines WHERE account_id = $1 AND LOWER(name) = LOWER($2) AND id != $3',
          [accountId, name.trim(), id]
        );

        if (duplicateCheck.rows.length > 0) {
          throw new ValidationError('Já existe uma pipeline com esse nome');
        }
      }

      // Se for default, remover default de outras
      if (is_default === true) {
        await client.query(
          'UPDATE pipelines SET is_default = false WHERE account_id = $1 AND is_default = true AND id != $2',
          [accountId, id]
        );
      }

      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        values.push(name.trim());
        paramIndex++;
      }

      if (description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        values.push(description);
        paramIndex++;
      }

      if (color !== undefined) {
        updates.push(`color = $${paramIndex}`);
        values.push(color);
        paramIndex++;
      }

      if (icon !== undefined) {
        updates.push(`icon = $${paramIndex}`);
        values.push(icon);
        paramIndex++;
      }

      if (project_id !== undefined) {
        updates.push(`project_id = $${paramIndex}`);
        values.push(project_id || null);
        paramIndex++;
      }

      if (is_default !== undefined) {
        updates.push(`is_default = $${paramIndex}`);
        values.push(is_default);
        paramIndex++;
      }

      if (is_active !== undefined) {
        updates.push(`is_active = $${paramIndex}`);
        values.push(is_active);
        paramIndex++;
      }

      if (is_restricted !== undefined) {
        updates.push(`is_restricted = $${paramIndex}`);
        values.push(is_restricted);
        paramIndex++;

        // Se tornando restrita, adicionar criador como owner se não existir
        if (is_restricted && !pipeline.is_restricted) {
          const existingAccess = await client.query(
            'SELECT id FROM pipeline_users WHERE pipeline_id = $1 AND user_id = $2',
            [id, userId]
          );
          if (existingAccess.rows.length === 0) {
            await client.query(
              'INSERT INTO pipeline_users (pipeline_id, user_id, role) VALUES ($1, $2, $3)',
              [id, userId, 'owner']
            );
          }
        }
      }

      if (settings !== undefined) {
        updates.push(`settings = $${paramIndex}`);
        values.push(JSON.stringify(settings));
        paramIndex++;
      }

      // Atualizar pipeline se há campos para atualizar
      let updatedPipeline = pipeline;
      if (updates.length > 0) {
        values.push(id, accountId);

        const query = `
          UPDATE pipelines
          SET ${updates.join(', ')}
          WHERE id = $${paramIndex} AND account_id = $${paramIndex + 1}
          RETURNING *
        `;

        const result = await client.query(query, values);
        updatedPipeline = result.rows[0];
      }

      // Atualizar etapas se fornecidas
      if (stages && Array.isArray(stages)) {
        // Buscar etapas existentes
        const existingStagesResult = await client.query(
          'SELECT id FROM pipeline_stages WHERE pipeline_id = $1',
          [id]
        );
        const existingStageIds = existingStagesResult.rows.map(s => s.id);

        // IDs das etapas que vieram do frontend (excluindo temporários)
        const incomingStageIds = stages
          .filter(s => s.id && !s.id.startsWith('temp-'))
          .map(s => s.id);

        // Deletar etapas que não estão mais na lista
        const stagesToDelete = existingStageIds.filter(sid => !incomingStageIds.includes(sid));
        for (const stageId of stagesToDelete) {
          // Verificar se tem oportunidades
          const oppCheck = await client.query(
            'SELECT COUNT(*) as count FROM opportunities WHERE stage_id = $1',
            [stageId]
          );
          if (parseInt(oppCheck.rows[0].count) > 0) {
            throw new ValidationError('Não é possível remover etapa que contém oportunidades');
          }
          await client.query('DELETE FROM pipeline_stages WHERE id = $1', [stageId]);
        }

        // Primeiro, definir todas as posições existentes como negativas para evitar conflitos de unique
        await client.query(
          'UPDATE pipeline_stages SET position = -position - 1000 WHERE pipeline_id = $1',
          [id]
        );

        // Atualizar ou criar etapas
        for (let i = 0; i < stages.length; i++) {
          const stage = stages[i];

          if (stage.id && !stage.id.startsWith('temp-')) {
            // Atualizar etapa existente
            await client.query(
              `UPDATE pipeline_stages
               SET name = $1, color = $2, position = $3, is_win_stage = $4, is_loss_stage = $5
               WHERE id = $6 AND pipeline_id = $7`,
              [
                stage.name,
                stage.color || 'gray',
                i,
                stage.is_win_stage || false,
                stage.is_loss_stage || false,
                stage.id,
                id
              ]
            );
          } else {
            // Criar nova etapa
            await client.query(
              `INSERT INTO pipeline_stages (pipeline_id, name, color, position, is_win_stage, is_loss_stage)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                id,
                stage.name,
                stage.color || 'gray',
                i,
                stage.is_win_stage || false,
                stage.is_loss_stage || false
              ]
            );
          }
        }
      }

      await client.query('COMMIT');

      // Buscar pipeline atualizada com etapas
      const finalStagesResult = await db.query(
        'SELECT * FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY position ASC',
        [id]
      );

      sendSuccess(res, {
        pipeline: {
          ...updatedPipeline,
          stages: finalStagesResult.rows
        },
        message: 'Pipeline atualizada com sucesso'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Erro ao atualizar pipeline:', error);
    sendError(res, error);
  }
};

// ================================
// 5. DELETAR PIPELINE
// ================================
const deletePipeline = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { id } = req.params;
    const { force } = req.query;

    // Verificar acesso
    const { hasAccess, pipeline, role, reason } = await pipelineService.canUserAccessPipeline(userId, id, accountId);

    if (!hasAccess) {
      if (reason === 'pipeline_not_found') {
        throw new NotFoundError('Pipeline não encontrada');
      }
      throw new ForbiddenError('Você não tem acesso a esta pipeline');
    }

    // Verificar permissão de delete (owner)
    if (pipeline.is_restricted && role !== 'owner') {
      throw new ForbiddenError('Apenas o owner pode deletar esta pipeline');
    }

    // Não permitir deletar pipeline default
    if (pipeline.is_default) {
      throw new ValidationError('Não é possível deletar a pipeline padrão. Defina outra pipeline como padrão primeiro.');
    }

    // Verificar se tem oportunidades
    const oppsCheck = await db.query(
      'SELECT COUNT(*) as count FROM opportunities WHERE pipeline_id = $1',
      [id]
    );

    if (parseInt(oppsCheck.rows[0].count) > 0) {
      if (force !== 'true') {
        throw new ValidationError(
          `Esta pipeline contém ${oppsCheck.rows[0].count} oportunidade(s). Use force=true para deletar junto com as oportunidades.`
        );
      }
    }

    // Deletar (CASCADE vai remover stages, users e opportunities)
    await db.query(
      'DELETE FROM pipelines WHERE id = $1 AND account_id = $2',
      [id, accountId]
    );

    console.log(`🗑️ Pipeline ${id} deletada por usuário ${userId}`);

    sendSuccess(res, {
      message: 'Pipeline deletada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar pipeline:', error);
    sendError(res, error);
  }
};

// ================================
// 6. OBTER ESTATÍSTICAS
// ================================
const getPipelineStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { id } = req.params;

    // Verificar acesso
    const { hasAccess, reason } = await pipelineService.canUserAccessPipeline(userId, id, accountId);

    if (!hasAccess) {
      if (reason === 'pipeline_not_found') {
        throw new NotFoundError('Pipeline não encontrada');
      }
      throw new ForbiddenError('Você não tem acesso a esta pipeline');
    }

    const stats = await pipelineService.getPipelineStats(id, accountId);

    sendSuccess(res, {
      stats
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    sendError(res, error);
  }
};

// ================================
// 7. MOVER PIPELINE PARA PROJETO
// ================================
const movePipelineToProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { id } = req.params;
    const { project_id } = req.body;

    // Verificar acesso à pipeline
    const { hasAccess, pipeline, role, reason } = await pipelineService.canUserAccessPipeline(userId, id, accountId);

    if (!hasAccess) {
      if (reason === 'pipeline_not_found') {
        throw new NotFoundError('Pipeline não encontrada');
      }
      throw new ForbiddenError('Você não tem acesso a esta pipeline');
    }

    // Verificar permissão de edição
    if (pipeline.is_restricted && !['owner', 'admin'].includes(role)) {
      throw new ForbiddenError('Você não tem permissão para mover esta pipeline');
    }

    // Se project_id fornecido, verificar se existe
    if (project_id) {
      const projectCheck = await db.query(
        'SELECT id FROM crm_projects WHERE id = $1 AND account_id = $2',
        [project_id, accountId]
      );
      if (projectCheck.rows.length === 0) {
        throw new NotFoundError('Projeto não encontrado');
      }
    }

    // Atualizar
    const result = await db.query(
      'UPDATE pipelines SET project_id = $1 WHERE id = $2 AND account_id = $3 RETURNING *',
      [project_id || null, id, accountId]
    );

    sendSuccess(res, {
      pipeline: result.rows[0],
      message: 'Pipeline movida com sucesso'
    });
  } catch (error) {
    console.error('Erro ao mover pipeline:', error);
    sendError(res, error);
  }
};

// ================================
// 8. GERENCIAR USUÁRIOS DA PIPELINE
// ================================
const addPipelineUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { id } = req.params;
    const { user_id, role } = req.body;

    if (!user_id) {
      throw new ValidationError('ID do usuário é obrigatório');
    }

    // Verificar acesso
    const { hasAccess, pipeline, role: currentUserRole, reason } = await pipelineService.canUserAccessPipeline(userId, id, accountId);

    if (!hasAccess) {
      if (reason === 'pipeline_not_found') {
        throw new NotFoundError('Pipeline não encontrada');
      }
      throw new ForbiddenError('Você não tem acesso a esta pipeline');
    }

    // Apenas owner/admin podem adicionar usuários
    if (!['owner', 'admin'].includes(currentUserRole)) {
      throw new ForbiddenError('Você não tem permissão para adicionar usuários');
    }

    // Verificar se usuário pertence à conta
    const userCheck = await db.query(
      'SELECT id FROM users WHERE id = $1 AND account_id = $2',
      [user_id, accountId]
    );

    if (userCheck.rows.length === 0) {
      throw new NotFoundError('Usuário não encontrado');
    }

    // Inserir ou atualizar
    const result = await db.query(
      `INSERT INTO pipeline_users (pipeline_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (pipeline_id, user_id)
       DO UPDATE SET role = $3
       RETURNING *`,
      [id, user_id, role || 'member']
    );

    sendSuccess(res, {
      pipeline_user: result.rows[0],
      message: 'Usuário adicionado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao adicionar usuário:', error);
    sendError(res, error);
  }
};

const removePipelineUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { id, userId: targetUserId } = req.params;

    // Verificar acesso
    const { hasAccess, pipeline, role: currentUserRole, reason } = await pipelineService.canUserAccessPipeline(userId, id, accountId);

    if (!hasAccess) {
      if (reason === 'pipeline_not_found') {
        throw new NotFoundError('Pipeline não encontrada');
      }
      throw new ForbiddenError('Você não tem acesso a esta pipeline');
    }

    // Apenas owner pode remover usuários (ou admin removendo members)
    if (currentUserRole !== 'owner') {
      // Admin pode remover members
      if (currentUserRole === 'admin') {
        const targetRole = await db.query(
          'SELECT role FROM pipeline_users WHERE pipeline_id = $1 AND user_id = $2',
          [id, targetUserId]
        );
        if (targetRole.rows.length > 0 && targetRole.rows[0].role !== 'member') {
          throw new ForbiddenError('Você só pode remover membros');
        }
      } else {
        throw new ForbiddenError('Você não tem permissão para remover usuários');
      }
    }

    // Não permitir remover o próprio owner
    const targetCheck = await db.query(
      'SELECT role FROM pipeline_users WHERE pipeline_id = $1 AND user_id = $2',
      [id, targetUserId]
    );

    if (targetCheck.rows.length > 0 && targetCheck.rows[0].role === 'owner') {
      throw new ValidationError('Não é possível remover o owner da pipeline');
    }

    await db.query(
      'DELETE FROM pipeline_users WHERE pipeline_id = $1 AND user_id = $2',
      [id, targetUserId]
    );

    sendSuccess(res, {
      message: 'Usuário removido com sucesso'
    });
  } catch (error) {
    console.error('Erro ao remover usuário:', error);
    sendError(res, error);
  }
};

module.exports = {
  getPipelines,
  getPipeline,
  createPipeline,
  updatePipeline,
  deletePipeline,
  getPipelineStats,
  movePipelineToProject,
  addPipelineUser,
  removePipelineUser
};
