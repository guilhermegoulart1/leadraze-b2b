// backend/src/controllers/taskCommentController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');
const { v4: uuidv4 } = require('uuid');

/**
 * Get comments for a task (checklist item)
 * GET /api/tasks/:taskId/comments
 */
const getComments = async (req, res) => {
  try {
    const { taskId } = req.params;
    const accountId = req.user.account_id;

    // Verify task exists and user has access
    const taskQuery = `
      SELECT ci.id, lc.account_id
      FROM checklist_items ci
      JOIN lead_checklists lc ON lc.id = ci.checklist_id
      WHERE ci.id = $1 AND lc.account_id = $2
    `;
    const taskResult = await db.query(taskQuery, [taskId, accountId]);

    if (taskResult.rows.length === 0) {
      throw new NotFoundError('Task not found');
    }

    // Get comments with user info
    const query = `
      SELECT
        tc.*,
        u.name as user_name,
        u.email as user_email,
        u.profile_picture as user_avatar,
        ARRAY_AGG(DISTINCT mu.name) FILTER (WHERE mu.id IS NOT NULL) as mentioned_user_names
      FROM task_comments tc
      INNER JOIN users u ON tc.user_id = u.id
      LEFT JOIN LATERAL unnest(tc.mentions) WITH ORDINALITY AS m(user_id, ord) ON TRUE
      LEFT JOIN users mu ON mu.id = m.user_id
      WHERE tc.task_id = $1
        AND tc.account_id = $2
        AND tc.deleted_at IS NULL
      GROUP BY tc.id, u.id, u.name, u.email, u.profile_picture
      ORDER BY tc.created_at ASC
    `;

    const result = await db.query(query, [taskId, accountId]);

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
 * Create a new comment on a task
 * POST /api/tasks/:taskId/comments
 */
const createComment = async (req, res) => {
  try {
    const { taskId } = req.params;
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

    // Verify task exists and user has access
    const taskQuery = `
      SELECT ci.id, lc.account_id
      FROM checklist_items ci
      JOIN lead_checklists lc ON lc.id = ci.checklist_id
      WHERE ci.id = $1 AND lc.account_id = $2
    `;
    const taskResult = await db.query(taskQuery, [taskId, accountId]);

    if (taskResult.rows.length === 0) {
      throw new NotFoundError('Task not found');
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
      task_id: taskId,
      user_id: userId,
      account_id: accountId,
      content: content.trim(),
      mentions: mentions,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db.insert('task_comments', comment);

    // Create mention records for notifications
    if (mentions.length > 0) {
      for (const mentionedUserId of mentions) {
        await db.insert('task_comment_mentions', {
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
        mentionedUserNames: [],
        createdAt: comment.created_at,
        updatedAt: comment.updated_at
      }
    }, 'Comment created successfully', 201);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Delete a comment (soft delete)
 * DELETE /api/tasks/:taskId/comments/:commentId
 */
const deleteComment = async (req, res) => {
  try {
    const { taskId, commentId } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // Get comment and verify ownership
    const comment = await db.findOne('task_comments', {
      id: commentId,
      task_id: taskId,
      account_id: accountId
    });

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    if (comment.user_id !== userId) {
      throw new ForbiddenError('You can only delete your own comments');
    }

    // Soft delete
    await db.update('task_comments', {
      deleted_at: new Date()
    }, { id: commentId });

    return sendSuccess(res, null, 'Comment deleted successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  getComments,
  createComment,
  deleteComment
};
