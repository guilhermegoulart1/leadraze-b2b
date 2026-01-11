/**
 * Channel Permissions Controller
 *
 * Manages user permissions for accessing different channels (WhatsApp, LinkedIn, etc.)
 */

const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');

/**
 * Get all channel permissions for a user
 * GET /api/channel-permissions/user/:userId
 */
const getUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const accountId = req.user.account_id;

    // Verify user belongs to same account
    const userCheck = await db.query(
      'SELECT id FROM users WHERE id = $1 AND account_id = $2',
      [userId, accountId]
    );

    if (userCheck.rows.length === 0) {
      throw new NotFoundError('Usuário não encontrado');
    }

    // Get all channels for this account with user's permissions
    const query = `
      SELECT
        la.id as channel_id,
        COALESCE(la.channel_name, la.channel_identifier, la.provider_type) as channel_name,
        la.provider_type,
        la.status as channel_status,
        COALESCE(ucp.access_type, 'none') as access_type,
        ucp.id as permission_id
      FROM linkedin_accounts la
      LEFT JOIN user_channel_permissions ucp
        ON ucp.linkedin_account_id = la.id
        AND ucp.user_id = $1
      WHERE la.account_id = $2
      ORDER BY la.channel_name ASC NULLS LAST
    `;

    const result = await db.query(query, [userId, accountId]);

    sendSuccess(res, {
      user_id: userId,
      permissions: result.rows
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Get all users with their permissions for a channel
 * GET /api/channel-permissions/channel/:channelId
 */
const getChannelPermissions = async (req, res) => {
  try {
    const { channelId } = req.params;
    const accountId = req.user.account_id;

    // Verify channel belongs to same account
    const channelCheck = await db.query(
      'SELECT id, COALESCE(channel_name, channel_identifier, provider_type) as channel_name FROM linkedin_accounts WHERE id = $1 AND account_id = $2',
      [channelId, accountId]
    );

    if (channelCheck.rows.length === 0) {
      throw new NotFoundError('Canal não encontrado');
    }

    // Get all users for this account with their permissions for this channel
    const query = `
      SELECT
        u.id as user_id,
        u.name as user_name,
        u.email,
        u.role,
        COALESCE(ucp.access_type, 'none') as access_type,
        ucp.id as permission_id
      FROM users u
      LEFT JOIN user_channel_permissions ucp
        ON ucp.user_id = u.id
        AND ucp.linkedin_account_id = $1
      WHERE u.account_id = $2
      ORDER BY u.name ASC
    `;

    const result = await db.query(query, [channelId, accountId]);

    sendSuccess(res, {
      channel_id: channelId,
      channel_name: channelCheck.rows[0].channel_name,
      users: result.rows
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Set permission for a user on a channel
 * PUT /api/channel-permissions
 */
const setPermission = async (req, res) => {
  try {
    const { user_id, channel_id, access_type } = req.body;
    const accountId = req.user.account_id;

    // Validate access_type
    if (!['all', 'assigned_only', 'none'].includes(access_type)) {
      throw new ValidationError('access_type deve ser: all, assigned_only ou none');
    }

    if (!user_id || !channel_id) {
      throw new ValidationError('user_id e channel_id são obrigatórios');
    }

    // Verify user belongs to same account
    const userCheck = await db.query(
      'SELECT id FROM users WHERE id = $1 AND account_id = $2',
      [user_id, accountId]
    );

    if (userCheck.rows.length === 0) {
      throw new NotFoundError('Usuário não encontrado');
    }

    // Verify channel belongs to same account
    const channelCheck = await db.query(
      'SELECT id FROM linkedin_accounts WHERE id = $1 AND account_id = $2',
      [channel_id, accountId]
    );

    if (channelCheck.rows.length === 0) {
      throw new NotFoundError('Canal não encontrado');
    }

    // Upsert permission
    const query = `
      INSERT INTO user_channel_permissions (account_id, user_id, linkedin_account_id, access_type)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, linkedin_account_id)
      DO UPDATE SET access_type = $4, updated_at = NOW()
      RETURNING *
    `;

    const result = await db.query(query, [accountId, user_id, channel_id, access_type]);

    console.log(`✅ Permissão atualizada: user=${user_id}, channel=${channel_id}, access=${access_type}`);

    sendSuccess(res, result.rows[0], 'Permissão atualizada com sucesso');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Set multiple permissions for a user at once
 * PUT /api/channel-permissions/user/:userId/bulk
 */
const setBulkPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body; // Array of { channel_id, access_type }
    const accountId = req.user.account_id;

    if (!Array.isArray(permissions)) {
      throw new ValidationError('permissions deve ser um array');
    }

    // Verify user belongs to same account
    const userCheck = await db.query(
      'SELECT id FROM users WHERE id = $1 AND account_id = $2',
      [userId, accountId]
    );

    if (userCheck.rows.length === 0) {
      throw new NotFoundError('Usuário não encontrado');
    }

    // Get all valid channels for this account
    const channelsResult = await db.query(
      'SELECT id FROM linkedin_accounts WHERE account_id = $1',
      [accountId]
    );
    const validChannelIds = new Set(channelsResult.rows.map(c => c.id));

    // Process each permission
    const results = [];
    for (const perm of permissions) {
      const { channel_id, access_type } = perm;

      // Validate
      if (!validChannelIds.has(channel_id)) {
        continue; // Skip invalid channels
      }

      if (!['all', 'assigned_only', 'none'].includes(access_type)) {
        continue; // Skip invalid access types
      }

      // Upsert
      const query = `
        INSERT INTO user_channel_permissions (account_id, user_id, linkedin_account_id, access_type)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, linkedin_account_id)
        DO UPDATE SET access_type = $4, updated_at = NOW()
        RETURNING *
      `;

      const result = await db.query(query, [accountId, userId, channel_id, access_type]);
      results.push(result.rows[0]);
    }

    console.log(`✅ ${results.length} permissões atualizadas para usuário ${userId}`);

    sendSuccess(res, {
      user_id: userId,
      updated_count: results.length,
      permissions: results
    }, 'Permissões atualizadas com sucesso');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Delete a permission (sets to 'none')
 * DELETE /api/channel-permissions/:permissionId
 */
const deletePermission = async (req, res) => {
  try {
    const { permissionId } = req.params;
    const accountId = req.user.account_id;

    const result = await db.query(
      'DELETE FROM user_channel_permissions WHERE id = $1 AND account_id = $2 RETURNING *',
      [permissionId, accountId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Permissão não encontrada');
    }

    sendSuccess(res, null, 'Permissão removida com sucesso');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Helper: Get accessible channel IDs for a user
 * Returns { channelIds: [], accessTypes: Map }
 */
const getAccessibleChannels = async (userId, accountId) => {
  const query = `
    SELECT linkedin_account_id, access_type
    FROM user_channel_permissions
    WHERE user_id = $1 AND account_id = $2 AND access_type != 'none'
  `;

  const result = await db.query(query, [userId, accountId]);

  const channelIds = result.rows.map(r => r.linkedin_account_id);
  const accessTypes = new Map(result.rows.map(r => [r.linkedin_account_id, r.access_type]));

  return { channelIds, accessTypes };
};

module.exports = {
  getUserPermissions,
  getChannelPermissions,
  setPermission,
  setBulkPermissions,
  deletePermission,
  getAccessibleChannels
};
