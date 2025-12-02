// backend/src/controllers/feedbackController.js
// Sistema de Feedback & Roadmap (GetRaze Next)

const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { NotFoundError, ValidationError } = require('../utils/errors');

// Status válidos
const VALID_STATUSES = ['suggestion', 'backlog', 'in_progress', 'done'];

/**
 * GET /api/feedback
 * Lista todos os feedbacks (com filtro opcional por status)
 */
const getFeedback = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, sort = 'votes' } = req.query;

    let query = `
      SELECT
        f.*,
        u.name as author_name,
        EXISTS(
          SELECT 1 FROM feedback_votes fv
          WHERE fv.feedback_id = f.id AND fv.user_id = $1
        ) as user_voted
      FROM feedback f
      LEFT JOIN users u ON u.id = f.created_by
    `;

    const params = [userId];
    let paramIndex = 2;

    if (status && VALID_STATUSES.includes(status)) {
      query += ` WHERE f.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Ordenação
    if (sort === 'votes') {
      query += ' ORDER BY f.vote_count DESC, f.created_at DESC';
    } else if (sort === 'newest') {
      query += ' ORDER BY f.created_at DESC';
    } else if (sort === 'oldest') {
      query += ' ORDER BY f.created_at ASC';
    } else {
      query += ' ORDER BY f.vote_count DESC, f.created_at DESC';
    }

    const result = await db.query(query, params);

    sendSuccess(res, result.rows);
  } catch (error) {
    sendError(res, error);
  }
};

/**
 * GET /api/feedback/:id
 * Obtém um feedback específico com comentários
 */
const getFeedbackById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        f.*,
        u.name as author_name,
        EXISTS(
          SELECT 1 FROM feedback_votes fv
          WHERE fv.feedback_id = f.id AND fv.user_id = $2
        ) as user_voted
      FROM feedback f
      LEFT JOIN users u ON u.id = f.created_by
      WHERE f.id = $1`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Feedback not found');
    }

    sendSuccess(res, result.rows[0]);
  } catch (error) {
    sendError(res, error);
  }
};

/**
 * POST /api/feedback
 * Cria uma nova sugestão (admin pode criar direto em qualquer status)
 */
const createFeedback = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { title, description, status } = req.body;

    if (!title || title.trim().length === 0) {
      throw new ValidationError('Title is required');
    }

    if (title.length > 255) {
      throw new ValidationError('Title must be at most 255 characters');
    }

    // Admin pode criar em qualquer status, outros apenas como suggestion
    let finalStatus = 'suggestion';
    if (userRole === 'admin' && status && VALID_STATUSES.includes(status)) {
      finalStatus = status;
    }

    const feedback = await db.insert('feedback', {
      title: title.trim(),
      description: description?.trim() || null,
      status: finalStatus,
      vote_count: 1, // Autor automaticamente vota na própria sugestão
      created_by: userId
    });

    // Criar voto automático do autor
    await db.insert('feedback_votes', {
      feedback_id: feedback.id,
      user_id: userId
    });

    sendSuccess(res, { ...feedback, user_voted: true }, 'Suggestion created successfully', 201);
  } catch (error) {
    sendError(res, error);
  }
};

/**
 * PUT /api/feedback/:id
 * Atualiza um feedback (admin pode mudar status, autor pode editar título/descrição)
 */
const updateFeedback = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { id } = req.params;
    const { title, description, status } = req.body;

    // Verificar se feedback existe
    const feedbackCheck = await db.query(
      'SELECT * FROM feedback WHERE id = $1',
      [id]
    );

    if (feedbackCheck.rows.length === 0) {
      throw new NotFoundError('Feedback not found');
    }

    const feedback = feedbackCheck.rows[0];
    const isAuthor = feedback.created_by === userId;
    const isAdmin = userRole === 'admin';

    // Montar objeto de atualização baseado nas permissões
    const updateData = {};

    // Admin pode editar tudo
    if (isAdmin) {
      if (title !== undefined) {
        if (title.trim().length === 0) {
          throw new ValidationError('Title is required');
        }
        if (title.length > 255) {
          throw new ValidationError('Title must be at most 255 characters');
        }
        updateData.title = title.trim();
      }
      if (description !== undefined) {
        updateData.description = description?.trim() || null;
      }
      if (status !== undefined) {
        if (!VALID_STATUSES.includes(status)) {
          throw new ValidationError(`Invalid status. Use: ${VALID_STATUSES.join(', ')}`);
        }
        updateData.status = status;
      }
    }
    // Autor pode editar título e descrição (apenas se status ainda é 'suggestion')
    else if (isAuthor && feedback.status === 'suggestion') {
      if (title !== undefined) {
        if (title.trim().length === 0) {
          throw new ValidationError('Title is required');
        }
        if (title.length > 255) {
          throw new ValidationError('Title must be at most 255 characters');
        }
        updateData.title = title.trim();
      }
      if (description !== undefined) {
        updateData.description = description?.trim() || null;
      }
    }

    // Se não tem nada para atualizar
    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No changes allowed');
    }

    updateData.updated_at = new Date();

    const updated = await db.update('feedback', updateData, { id });

    sendSuccess(res, updated, 'Feedback updated successfully');
  } catch (error) {
    sendError(res, error);
  }
};

/**
 * DELETE /api/feedback/:id
 * Deleta um feedback (apenas admin ou autor)
 */
const deleteFeedback = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { id } = req.params;

    const feedbackCheck = await db.query(
      'SELECT * FROM feedback WHERE id = $1',
      [id]
    );

    if (feedbackCheck.rows.length === 0) {
      throw new NotFoundError('Feedback not found');
    }

    const feedback = feedbackCheck.rows[0];
    const isAuthor = feedback.created_by === userId;
    const isAdmin = userRole === 'admin';

    if (!isAuthor && !isAdmin) {
      throw new ValidationError('You do not have permission to delete this feedback');
    }

    await db.delete('feedback', { id });

    sendSuccess(res, null, 'Feedback deleted successfully');
  } catch (error) {
    sendError(res, error);
  }
};

/**
 * POST /api/feedback/:id/vote
 * Vota/desvota em um feedback (toggle)
 */
const toggleVote = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verificar se feedback existe
    const feedbackCheck = await db.query(
      'SELECT * FROM feedback WHERE id = $1',
      [id]
    );

    if (feedbackCheck.rows.length === 0) {
      throw new NotFoundError('Feedback not found');
    }

    // Verificar se já votou
    const voteCheck = await db.query(
      'SELECT * FROM feedback_votes WHERE feedback_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (voteCheck.rows.length > 0) {
      // Remover voto
      await db.query(
        'DELETE FROM feedback_votes WHERE feedback_id = $1 AND user_id = $2',
        [id, userId]
      );
      await db.query(
        'UPDATE feedback SET vote_count = vote_count - 1 WHERE id = $1',
        [id]
      );
      sendSuccess(res, { voted: false }, 'Vote removed');
    } else {
      // Adicionar voto
      await db.insert('feedback_votes', {
        feedback_id: id,
        user_id: userId
      });
      await db.query(
        'UPDATE feedback SET vote_count = vote_count + 1 WHERE id = $1',
        [id]
      );
      sendSuccess(res, { voted: true }, 'Vote registered');
    }
  } catch (error) {
    sendError(res, error);
  }
};

/**
 * GET /api/feedback/:id/comments
 * Lista comentários de um feedback (com anonimização)
 */
const getComments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verificar se feedback existe
    const feedbackCheck = await db.query(
      'SELECT id FROM feedback WHERE id = $1',
      [id]
    );

    if (feedbackCheck.rows.length === 0) {
      throw new NotFoundError('Feedback not found');
    }

    const result = await db.query(
      `SELECT
        fc.id,
        fc.content,
        fc.is_admin_reply,
        fc.created_at,
        fc.user_id,
        u.name as user_name,
        u.role as user_role
      FROM feedback_comments fc
      LEFT JOIN users u ON u.id = fc.user_id
      WHERE fc.feedback_id = $1
      ORDER BY fc.created_at ASC`,
      [id]
    );

    // Apply anonymization rules
    const comments = result.rows.map(comment => {
      let displayName;

      if (comment.user_id === userId) {
        displayName = 'You';
      } else if (comment.is_admin_reply || comment.user_role === 'admin') {
        displayName = 'GetRaze Team';
      } else {
        displayName = 'Customer';
      }

      return {
        id: comment.id,
        content: comment.content,
        is_admin_reply: comment.is_admin_reply,
        created_at: comment.created_at,
        author: displayName,
        is_own: comment.user_id === userId
      };
    });

    sendSuccess(res, comments);
  } catch (error) {
    sendError(res, error);
  }
};

/**
 * POST /api/feedback/:id/comments
 * Adiciona um comentário
 */
const addComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { id } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      throw new ValidationError('Comment cannot be empty');
    }

    if (content.length > 2000) {
      throw new ValidationError('Comment must be at most 2000 characters');
    }

    // Check if feedback exists
    const feedbackCheck = await db.query(
      'SELECT id FROM feedback WHERE id = $1',
      [id]
    );

    if (feedbackCheck.rows.length === 0) {
      throw new NotFoundError('Feedback not found');
    }

    const isAdmin = userRole === 'admin';

    const comment = await db.insert('feedback_comments', {
      feedback_id: id,
      user_id: userId,
      content: content.trim(),
      is_admin_reply: isAdmin
    });

    // Return with anonymous name
    sendSuccess(res, {
      id: comment.id,
      content: comment.content,
      is_admin_reply: comment.is_admin_reply,
      created_at: comment.created_at,
      author: isAdmin ? 'GetRaze Team' : 'You',
      is_own: true
    }, 'Comment added', 201);
  } catch (error) {
    sendError(res, error);
  }
};

/**
 * DELETE /api/feedback/:feedbackId/comments/:commentId
 * Deleta um comentário (apenas autor ou admin)
 */
const deleteComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { id, commentId } = req.params;

    const commentCheck = await db.query(
      'SELECT * FROM feedback_comments WHERE id = $1 AND feedback_id = $2',
      [commentId, id]
    );

    if (commentCheck.rows.length === 0) {
      throw new NotFoundError('Comment not found');
    }

    const comment = commentCheck.rows[0];
    const isAuthor = comment.user_id === userId;
    const isAdmin = userRole === 'admin';

    if (!isAuthor && !isAdmin) {
      throw new ValidationError('You do not have permission to delete this comment');
    }

    await db.delete('feedback_comments', { id: commentId });

    sendSuccess(res, null, 'Comment deleted successfully');
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  getFeedback,
  getFeedbackById,
  createFeedback,
  updateFeedback,
  deleteFeedback,
  toggleVote,
  getComments,
  addComment,
  deleteComment
};
