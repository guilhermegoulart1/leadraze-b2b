// backend/src/controllers/quickRepliesController.js
const db = require('../config/database');

// Get all quick replies for the current user (own + global)
const getQuickReplies = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;

    const result = await db.query(
      `SELECT qr.*, u.name as user_name
       FROM quick_replies qr
       LEFT JOIN users u ON qr.user_id = u.id
       WHERE qr.account_id = $1
         AND qr.is_active = true
         AND (qr.user_id = $2 OR qr.is_global = true)
       ORDER BY qr.is_global DESC, qr.title ASC`,
      [accountId, userId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching quick replies:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar respostas rápidas'
    });
  }
};

// Get a single quick reply
const getQuickReply = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    const result = await db.query(
      `SELECT * FROM quick_replies
       WHERE id = $1 AND account_id = $2
         AND (user_id = $3 OR is_global = true)`,
      [id, accountId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Resposta rápida não encontrada'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching quick reply:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar resposta rápida'
    });
  }
};

// Create a new quick reply
const createQuickReply = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { title, content, shortcut, is_global } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Título e conteúdo são obrigatórios'
      });
    }

    // Only admins can create global replies
    const isAdmin = req.user.role === 'admin';
    const globalValue = isAdmin ? (is_global || false) : false;

    const result = await db.query(
      `INSERT INTO quick_replies (account_id, user_id, title, content, shortcut, is_global)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [accountId, userId, title.trim(), content, shortcut?.trim() || null, globalValue]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating quick reply:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao criar resposta rápida'
    });
  }
};

// Update a quick reply
const updateQuickReply = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { title, content, shortcut, is_global, is_active } = req.body;

    // Check if user owns the quick reply or is admin
    const existing = await db.query(
      `SELECT * FROM quick_replies WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Resposta rápida não encontrada'
      });
    }

    const reply = existing.rows[0];
    const isAdmin = req.user.role === 'admin';

    // Only owner or admin can update
    if (reply.user_id !== userId && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Sem permissão para editar esta resposta rápida'
      });
    }

    // Only admins can change is_global
    const globalValue = isAdmin ? (is_global !== undefined ? is_global : reply.is_global) : reply.is_global;

    const result = await db.query(
      `UPDATE quick_replies
       SET title = COALESCE($1, title),
           content = COALESCE($2, content),
           shortcut = COALESCE($3, shortcut),
           is_global = $4,
           is_active = COALESCE($5, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND account_id = $7
       RETURNING *`,
      [
        title?.trim(),
        content,
        shortcut?.trim(),
        globalValue,
        is_active,
        id,
        accountId
      ]
    );

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating quick reply:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar resposta rápida'
    });
  }
};

// Delete a quick reply
const deleteQuickReply = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // Check if user owns the quick reply or is admin
    const existing = await db.query(
      `SELECT * FROM quick_replies WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Resposta rápida não encontrada'
      });
    }

    const reply = existing.rows[0];
    const isAdmin = req.user.role === 'admin';

    // Only owner or admin can delete
    if (reply.user_id !== userId && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Sem permissão para excluir esta resposta rápida'
      });
    }

    await db.query(
      `DELETE FROM quick_replies WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    res.json({
      success: true,
      message: 'Resposta rápida excluída com sucesso'
    });
  } catch (error) {
    console.error('Error deleting quick reply:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao excluir resposta rápida'
    });
  }
};

module.exports = {
  getQuickReplies,
  getQuickReply,
  createQuickReply,
  updateQuickReply,
  deleteQuickReply
};
