// backend/src/controllers/crmProjectController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const {
  ValidationError,
  NotFoundError,
  ForbiddenError
} = require('../utils/errors');

// ================================
// 1. LISTAR PROJETOS
// ================================
const getProjects = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { is_active, search } = req.query;

    let whereConditions = ['p.account_id = $1'];
    let queryParams = [accountId];
    let paramIndex = 2;

    if (is_active !== undefined) {
      whereConditions.push(`p.is_active = $${paramIndex}`);
      queryParams.push(is_active === 'true');
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`p.name ILIKE $${paramIndex}`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    const query = `
      SELECT
        p.*,
        u.name as created_by_name,
        (SELECT COUNT(*) FROM pipelines WHERE project_id = p.id) as pipelines_count
      FROM crm_projects p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE ${whereClause}
      ORDER BY p.display_order ASC, p.name ASC
    `;

    const result = await db.query(query, queryParams);

    sendSuccess(res, {
      projects: result.rows
    });
  } catch (error) {
    console.error('Erro ao listar projetos:', error);
    sendError(res, error);
  }
};

// ================================
// 2. OBTER PROJETO POR ID
// ================================
const getProject = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { id } = req.params;

    const query = `
      SELECT
        p.*,
        u.name as created_by_name,
        (SELECT COUNT(*) FROM pipelines WHERE project_id = p.id) as pipelines_count
      FROM crm_projects p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = $1 AND p.account_id = $2
    `;

    const result = await db.query(query, [id, accountId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Projeto não encontrado');
    }

    // Buscar pipelines do projeto
    const pipelinesQuery = `
      SELECT
        pl.*,
        (SELECT COUNT(*) FROM pipeline_stages WHERE pipeline_id = pl.id) as stages_count,
        (SELECT COUNT(*) FROM opportunities WHERE pipeline_id = pl.id) as opportunities_count
      FROM pipelines pl
      WHERE pl.project_id = $1 AND pl.account_id = $2
      ORDER BY pl.name ASC
    `;

    const pipelinesResult = await db.query(pipelinesQuery, [id, accountId]);

    sendSuccess(res, {
      project: result.rows[0],
      pipelines: pipelinesResult.rows
    });
  } catch (error) {
    console.error('Erro ao obter projeto:', error);
    sendError(res, error);
  }
};

// ================================
// 3. CRIAR PROJETO
// ================================
const createProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { name, description, color } = req.body;

    if (!name || name.trim().length === 0) {
      throw new ValidationError('Nome do projeto é obrigatório');
    }

    // Verificar se já existe um projeto com esse nome
    const existingCheck = await db.query(
      'SELECT id FROM crm_projects WHERE account_id = $1 AND LOWER(name) = LOWER($2)',
      [accountId, name.trim()]
    );

    if (existingCheck.rows.length > 0) {
      throw new ValidationError('Já existe um projeto com esse nome');
    }

    // Obter próximo display_order
    const orderResult = await db.query(
      'SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM crm_projects WHERE account_id = $1',
      [accountId]
    );

    const query = `
      INSERT INTO crm_projects (account_id, name, description, color, display_order, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await db.query(query, [
      accountId,
      name.trim(),
      description || null,
      color || 'blue',
      orderResult.rows[0].next_order,
      userId
    ]);

    console.log(`✅ Projeto "${name}" criado por usuário ${userId}`);

    sendSuccess(res, {
      project: result.rows[0],
      message: 'Projeto criado com sucesso'
    }, 201);
  } catch (error) {
    console.error('Erro ao criar projeto:', error);
    sendError(res, error);
  }
};

// ================================
// 4. ATUALIZAR PROJETO
// ================================
const updateProject = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { id } = req.params;
    const { name, description, color, is_active, display_order } = req.body;

    // Verificar se projeto existe
    const existingProject = await db.query(
      'SELECT * FROM crm_projects WHERE id = $1 AND account_id = $2',
      [id, accountId]
    );

    if (existingProject.rows.length === 0) {
      throw new NotFoundError('Projeto não encontrado');
    }

    // Se mudou o nome, verificar duplicidade
    if (name && name.trim().toLowerCase() !== existingProject.rows[0].name.toLowerCase()) {
      const duplicateCheck = await db.query(
        'SELECT id FROM crm_projects WHERE account_id = $1 AND LOWER(name) = LOWER($2) AND id != $3',
        [accountId, name.trim(), id]
      );

      if (duplicateCheck.rows.length > 0) {
        throw new ValidationError('Já existe um projeto com esse nome');
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

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      values.push(is_active);
      paramIndex++;
    }

    if (display_order !== undefined) {
      updates.push(`display_order = $${paramIndex}`);
      values.push(display_order);
      paramIndex++;
    }

    if (updates.length === 0) {
      throw new ValidationError('Nenhum campo para atualizar');
    }

    values.push(id, accountId);

    const query = `
      UPDATE crm_projects
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND account_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await db.query(query, values);

    sendSuccess(res, {
      project: result.rows[0],
      message: 'Projeto atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar projeto:', error);
    sendError(res, error);
  }
};

// ================================
// 5. DELETAR PROJETO
// ================================
const deleteProject = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { id } = req.params;
    const { force } = req.query;

    // Verificar se projeto existe
    const existingProject = await db.query(
      'SELECT * FROM crm_projects WHERE id = $1 AND account_id = $2',
      [id, accountId]
    );

    if (existingProject.rows.length === 0) {
      throw new NotFoundError('Projeto não encontrado');
    }

    // Verificar se tem pipelines e contar dados relacionados
    const statsQuery = `
      SELECT
        (SELECT COUNT(*) FROM pipelines WHERE project_id = $1) as pipelines_count,
        (SELECT COUNT(*) FROM opportunities o
         JOIN pipelines p ON o.pipeline_id = p.id
         WHERE p.project_id = $1) as opportunities_count
    `;
    const stats = await db.query(statsQuery, [id]);
    const pipelinesCount = parseInt(stats.rows[0].pipelines_count);
    const opportunitiesCount = parseInt(stats.rows[0].opportunities_count);

    if (pipelinesCount > 0) {
      if (force !== 'true') {
        // Retorna erro com informações para o frontend exibir
        return sendSuccess(res, {
          requires_confirmation: true,
          pipelines_count: pipelinesCount,
          opportunities_count: opportunitiesCount,
          message: `Este projeto contém ${pipelinesCount} pipeline(s) e ${opportunitiesCount} oportunidade(s). Deseja excluir tudo?`
        });
      }

      // force=true: Deletar tudo em cascata
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');

        // Obter IDs das pipelines do projeto
        const pipelineIds = await client.query(
          'SELECT id FROM pipelines WHERE project_id = $1',
          [id]
        );

        for (const row of pipelineIds.rows) {
          const pipelineId = row.id;

          // Deletar oportunidades da pipeline (cascata cuida dos relacionamentos)
          await client.query('DELETE FROM opportunities WHERE pipeline_id = $1', [pipelineId]);

          // Deletar stages da pipeline
          await client.query('DELETE FROM pipeline_stages WHERE pipeline_id = $1', [pipelineId]);

          // Deletar pipeline_users
          await client.query('DELETE FROM pipeline_users WHERE pipeline_id = $1', [pipelineId]);
        }

        // Deletar todas as pipelines do projeto
        await client.query('DELETE FROM pipelines WHERE project_id = $1', [id]);

        // Deletar o projeto
        await client.query('DELETE FROM crm_projects WHERE id = $1 AND account_id = $2', [id, accountId]);

        await client.query('COMMIT');

        console.log(`🗑️ Projeto ${id} deletado com ${pipelinesCount} pipelines e ${opportunitiesCount} oportunidades`);

        sendSuccess(res, {
          message: 'Projeto e todos os dados relacionados foram excluídos com sucesso',
          deleted: {
            pipelines: pipelinesCount,
            opportunities: opportunitiesCount
          }
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } else {
      // Projeto vazio, pode deletar diretamente
      await db.query(
        'DELETE FROM crm_projects WHERE id = $1 AND account_id = $2',
        [id, accountId]
      );

      console.log(`🗑️ Projeto ${id} deletado (vazio)`);

      sendSuccess(res, {
        message: 'Projeto deletado com sucesso'
      });
    }
  } catch (error) {
    console.error('Erro ao deletar projeto:', error);
    sendError(res, error);
  }
};

// ================================
// 6. REORDENAR PROJETOS
// ================================
const reorderProjects = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { orders } = req.body;

    if (!Array.isArray(orders) || orders.length === 0) {
      throw new ValidationError('Lista de ordenação é obrigatória');
    }

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      for (const item of orders) {
        await client.query(
          'UPDATE crm_projects SET display_order = $1 WHERE id = $2 AND account_id = $3',
          [item.order, item.id, accountId]
        );
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
    console.error('Erro ao reordenar projetos:', error);
    sendError(res, error);
  }
};

module.exports = {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  reorderProjects
};
