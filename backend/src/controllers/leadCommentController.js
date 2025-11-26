// backend/src/controllers/leadCommentController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');
const { v4: uuidv4 } = require('uuid');

/**
 * Get comments for a lead
 * GET /api/leads/:leadId/comments
 */
const getComments = async (req, res) => {
  try {
    const { leadId } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // Verify access to lead
    const lead = await db.findOne('leads', { id: leadId, account_id: accountId });
    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    // Get comments with user info
    const query = `
      SELECT
        lc.*,
        u.name as user_name,
        u.email as user_email,
        u.profile_picture as user_avatar,
        ARRAY_AGG(DISTINCT mu.name) FILTER (WHERE mu.id IS NOT NULL) as mentioned_user_names
      FROM lead_comments lc
      INNER JOIN users u ON lc.user_id = u.id
      LEFT JOIN LATERAL unnest(lc.mentions) WITH ORDINALITY AS m(user_id, ord) ON TRUE
      LEFT JOIN users mu ON mu.id = m.user_id
      WHERE lc.lead_id = $1
        AND lc.account_id = $2
        AND lc.deleted_at IS NULL
      GROUP BY lc.id, u.id, u.name, u.email, u.profile_picture
      ORDER BY lc.created_at DESC
    `;

    const result = await db.query(query, [leadId, accountId]);

    return sendSuccess(res, {
      comments: result.rows.map(row => ({
        id: row.id,
        content: row.content,
        user: {
          id: row.user_id,
          name: row.user_name,
          email: row.user_email,
          avatar: row.user_avatar
        },
        mentions: row.mentions || [],
        mentionedUserNames: row.mentioned_user_names || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Create a new comment
 * POST /api/leads/:leadId/comments
 */
const createComment = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { content, mentions = [] } = req.body;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // Validate
    if (!content || content.trim().length === 0) {
      throw new ValidationError('Comment content is required');
    }

    if (content.length > 5000) {
      throw new ValidationError('Comment is too long (max 5000 characters)');
    }

    // Verify access to lead
    const lead = await db.findOne('leads', { id: leadId, account_id: accountId });
    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    // Validate mentioned users exist and belong to same account
    if (mentions.length > 0) {
      const mentionedUsers = await db.query(
        'SELECT id FROM users WHERE id = ANY($1) AND account_id = $2',
        [mentions, accountId]
      );

      if (mentionedUsers.rows.length !== mentions.length) {
        throw new ValidationError('Some mentioned users do not exist or do not belong to your account');
      }
    }

    // Create comment
    const commentId = uuidv4();
    const comment = {
      id: commentId,
      lead_id: leadId,
      user_id: userId,
      account_id: accountId,
      content: content.trim(),
      mentions: mentions,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db.insert('lead_comments', comment);

    // Create mention records for notifications
    if (mentions.length > 0) {
      for (const mentionedUserId of mentions) {
        await db.insert('lead_comment_mentions', {
          id: uuidv4(),
          comment_id: commentId,
          user_id: mentionedUserId,
          created_at: new Date()
        });
      }
    }

    // Get user info
    const user = await db.findOne('users', { id: userId });

    return sendSuccess(res, {
      comment: {
        id: comment.id,
        content: comment.content,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.profile_picture
        },
        mentions: comment.mentions,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at
      }
    }, 'Comment created successfully', 201);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Update a comment
 * PUT /api/leads/:leadId/comments/:commentId
 */
const updateComment = async (req, res) => {
  try {
    const { leadId, commentId } = req.params;
    const { content, mentions = [] } = req.body;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // Validate
    if (!content || content.trim().length === 0) {
      throw new ValidationError('Comment content is required');
    }

    if (content.length > 5000) {
      throw new ValidationError('Comment is too long (max 5000 characters)');
    }

    // Get comment and verify ownership
    const comment = await db.findOne('lead_comments', {
      id: commentId,
      lead_id: leadId,
      account_id: accountId
    });

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    if (comment.user_id !== userId) {
      throw new ForbiddenError('You can only edit your own comments');
    }

    // Validate mentioned users
    if (mentions.length > 0) {
      const mentionedUsers = await db.query(
        'SELECT id FROM users WHERE id = ANY($1) AND account_id = $2',
        [mentions, accountId]
      );

      if (mentionedUsers.rows.length !== mentions.length) {
        throw new ValidationError('Some mentioned users do not exist');
      }
    }

    // Update comment
    await db.update('lead_comments', {
      content: content.trim(),
      mentions: mentions,
      updated_at: new Date()
    }, { id: commentId });

    // Update mention records
    // Delete old mentions
    await db.query('DELETE FROM lead_comment_mentions WHERE comment_id = $1', [commentId]);

    // Create new mentions
    if (mentions.length > 0) {
      for (const mentionedUserId of mentions) {
        await db.insert('lead_comment_mentions', {
          id: uuidv4(),
          comment_id: commentId,
          user_id: mentionedUserId,
          created_at: new Date()
        });
      }
    }

    // Get updated comment
    const updatedComment = await db.findOne('lead_comments', { id: commentId });
    const user = await db.findOne('users', { id: userId });

    return sendSuccess(res, {
      comment: {
        id: updatedComment.id,
        content: updatedComment.content,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.profile_picture
        },
        mentions: updatedComment.mentions,
        createdAt: updatedComment.created_at,
        updatedAt: updatedComment.updated_at
      }
    }, 'Comment updated successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Delete a comment (soft delete)
 * DELETE /api/leads/:leadId/comments/:commentId
 */
const deleteComment = async (req, res) => {
  try {
    const { leadId, commentId } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // Get comment and verify ownership
    const comment = await db.findOne('lead_comments', {
      id: commentId,
      lead_id: leadId,
      account_id: accountId
    });

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    if (comment.user_id !== userId) {
      throw new ForbiddenError('You can only delete your own comments');
    }

    // Soft delete
    await db.update('lead_comments', {
      deleted_at: new Date()
    }, { id: commentId });

    return sendSuccess(res, null, 'Comment deleted successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Search users for mentions
 * GET /api/leads/:leadId/comments/search-users?query=...
 */
const searchUsersForMentions = async (req, res) => {
  try {
    const { query = '' } = req.query;
    const accountId = req.user.account_id;

    if (!query || query.trim().length < 2) {
      return sendSuccess(res, { users: [] });
    }

    // Search users in same account
    const result = await db.query(`
      SELECT
        id,
        name,
        email,
        profile_picture as avatar,
        role
      FROM users
      WHERE account_id = $1
        AND (
          name ILIKE $2
          OR email ILIKE $2
        )
      LIMIT 10
    `, [accountId, `%${query}%`]);

    return sendSuccess(res, {
      users: result.rows.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role
      }))
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  getComments,
  createComment,
  updateComment,
  deleteComment,
  searchUsersForMentions
};
