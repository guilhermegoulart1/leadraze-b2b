// backend/src/controllers/opportunityCommentController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const {
  ValidationError,
  NotFoundError,
  ForbiddenError
} = require('../utils/errors');

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
  }

  return opportunity;
}

// ================================
// 1. LISTAR COMENTÁRIOS
// ================================
const getComments = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { opportunityId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Verificar acesso
    await checkOpportunityAccess(userId, opportunityId, accountId);

    const offset = (page - 1) * limit;

    const query = `
      SELECT
        oc.*,
        u.name as user_name,
        u.email as user_email,
        u.avatar_url as user_avatar
      FROM opportunity_comments oc
      JOIN users u ON oc.user_id = u.id
      WHERE oc.opportunity_id = $1
        AND oc.deleted_at IS NULL
      ORDER BY oc.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [opportunityId, limit, offset]);

    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) FROM opportunity_comments WHERE opportunity_id = $1 AND deleted_at IS NULL',
      [opportunityId]
    );

    sendSuccess(res, {
      comments: result.rows.map(row => ({
        id: row.id,
        opportunityId: row.opportunity_id,
        content: row.content,
        mentions: row.mentions || [],
        attachments: row.attachments,
        user: {
          id: row.user_id,
          name: row.user_name,
          email: row.user_email,
          avatar: row.user_avatar
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Erro ao listar comentários:', error);
    sendError(res, error);
  }
};

// ================================
// 2. CRIAR COMENTÁRIO
// ================================
const createComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { opportunityId } = req.params;
    const { content, mentions, attachments } = req.body;

    if (!content || !content.trim()) {
      throw new ValidationError('Conteúdo do comentário é obrigatório');
    }

    // Verificar acesso
    await checkOpportunityAccess(userId, opportunityId, accountId);

    const result = await db.query(
      `INSERT INTO opportunity_comments (opportunity_id, user_id, account_id, content, mentions, attachments)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        opportunityId,
        userId,
        accountId,
        content.trim(),
        mentions || [],
        attachments ? JSON.stringify(attachments) : null
      ]
    );

    // Get user info for response
    const userResult = await db.query(
      'SELECT name, email, avatar_url FROM users WHERE id = $1',
      [userId]
    );

    const row = result.rows[0];
    const comment = {
      id: row.id,
      opportunityId: row.opportunity_id,
      content: row.content,
      mentions: row.mentions || [],
      attachments: row.attachments,
      user: {
        id: row.user_id,
        name: userResult.rows[0].name,
        email: userResult.rows[0].email,
        avatar: userResult.rows[0].avatar_url
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    console.log(`💬 Comentário criado na oportunidade ${opportunityId}`);

    sendSuccess(res, {
      comment,
      message: 'Comentário criado com sucesso'
    }, 201);
  } catch (error) {
    console.error('Erro ao criar comentário:', error);
    sendError(res, error);
  }
};

// ================================
// 3. ATUALIZAR COMENTÁRIO
// ================================
const updateComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { opportunityId, commentId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      throw new ValidationError('Conteúdo do comentário é obrigatório');
    }

    // Verificar se comentário existe e pertence ao usuário
    const commentResult = await db.query(
      'SELECT * FROM opportunity_comments WHERE id = $1 AND opportunity_id = $2 AND deleted_at IS NULL',
      [commentId, opportunityId]
    );

    if (commentResult.rows.length === 0) {
      throw new NotFoundError('Comentário não encontrado');
    }

    const comment = commentResult.rows[0];

    // Only owner can edit
    if (comment.user_id !== userId) {
      throw new ForbiddenError('Você não pode editar este comentário');
    }

    const result = await db.query(
      'UPDATE opportunity_comments SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [content.trim(), commentId]
    );

    sendSuccess(res, {
      comment: result.rows[0],
      message: 'Comentário atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar comentário:', error);
    sendError(res, error);
  }
};

// ================================
// 4. DELETAR COMENTÁRIO (soft delete)
// ================================
const deleteComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { opportunityId, commentId } = req.params;

    // Verificar se comentário existe
    const commentResult = await db.query(
      'SELECT * FROM opportunity_comments WHERE id = $1 AND opportunity_id = $2 AND deleted_at IS NULL',
      [commentId, opportunityId]
    );

    if (commentResult.rows.length === 0) {
      throw new NotFoundError('Comentário não encontrado');
    }

    const comment = commentResult.rows[0];

    // Only owner can delete
    if (comment.user_id !== userId) {
      throw new ForbiddenError('Você não pode deletar este comentário');
    }

    await db.query(
      'UPDATE opportunity_comments SET deleted_at = NOW() WHERE id = $1',
      [commentId]
    );

    console.log(`🗑️ Comentário ${commentId} deletado`);

    sendSuccess(res, {
      message: 'Comentário deletado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar comentário:', error);
    sendError(res, error);
  }
};

// ================================
// 5. BUSCAR USUÁRIOS PARA MENÇÕES
// ================================
const searchUsersForMentions = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { query } = req.query;

    if (!query || query.length < 2) {
      return sendSuccess(res, { users: [] });
    }

    const result = await db.query(
      `SELECT id, name, email, avatar_url
       FROM users
       WHERE account_id = $1
         AND is_active = true
         AND (LOWER(name) LIKE $2 OR LOWER(email) LIKE $2)
       ORDER BY name
       LIMIT 10`,
      [accountId, `%${query.toLowerCase()}%`]
    );

    sendSuccess(res, { users: result.rows });
  } catch (error) {
    console.error('Erro ao buscar usuários para menções:', error);
    sendError(res, error);
  }
};

module.exports = {
  getComments,
  createComment,
  updateComment,
  deleteComment,
  searchUsersForMentions
};
