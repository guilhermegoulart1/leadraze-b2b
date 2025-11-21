// backend/src/controllers/userPermissionsController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { NotFoundError, ValidationError } = require('../utils/errors');

// Get all custom permissions for a user
const getUserPermissions = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { userId } = req.params;

    // Verify user belongs to account
    const userCheck = await db.query(
      'SELECT * FROM users WHERE id = $1 AND account_id = $2',
      [userId, accountId]
    );

    if (userCheck.rows.length === 0) {
      throw new NotFoundError('Usuário não encontrado');
    }

    // Get all custom permissions for this user
    const result = await db.query(
      `SELECT
        up.*,
        p.name as permission_name,
        p.resource,
        p.action,
        p.description
      FROM user_permissions up
      INNER JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = $1
      ORDER BY p.resource, p.action`,
      [userId]
    );

    sendSuccess(res, result.rows);
  } catch (error) {
    sendError(res, error);
  }
};

// Get user's effective permissions (role permissions + custom permissions)
const getUserEffectivePermissions = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { userId } = req.params;

    // Verify user belongs to account
    const userCheck = await db.query(
      'SELECT role FROM users WHERE id = $1 AND account_id = $2',
      [userId, accountId]
    );

    if (userCheck.rows.length === 0) {
      throw new NotFoundError('Usuário não encontrado');
    }

    const userRole = userCheck.rows[0].role;

    // Get role-based permissions
    const rolePermissions = await db.query(
      `SELECT
        p.id,
        p.name,
        p.resource,
        p.action,
        p.description,
        'role' as source
      FROM permissions p
      INNER JOIN role_permissions rp ON rp.permission_id = p.id
      WHERE rp.role = $1 AND rp.account_id = $2`,
      [userRole, accountId]
    );

    // Get custom user permissions (both granted and revoked)
    const customPermissions = await db.query(
      `SELECT
        p.id,
        p.name,
        p.resource,
        p.action,
        p.description,
        up.granted,
        'custom' as source
      FROM user_permissions up
      INNER JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = $1`,
      [userId]
    );

    // Build effective permissions map
    const effectivePermissions = new Map();

    // Start with role permissions
    rolePermissions.rows.forEach(perm => {
      effectivePermissions.set(perm.id, {
        ...perm,
        granted: true,
        overridden: false
      });
    });

    // Apply custom permissions (overrides)
    customPermissions.rows.forEach(perm => {
      const existing = effectivePermissions.get(perm.id);
      effectivePermissions.set(perm.id, {
        id: perm.id,
        name: perm.name,
        resource: perm.resource,
        action: perm.action,
        description: perm.description,
        granted: perm.granted,
        source: perm.source,
        overridden: existing ? true : false,
        original_source: existing ? existing.source : null
      });
    });

    const result = Array.from(effectivePermissions.values());

    sendSuccess(res, {
      user_id: userId,
      role: userRole,
      permissions: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

// Grant or revoke a custom permission to a user
const setUserPermission = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { userId } = req.params;
    const { permissionId, granted } = req.body;

    if (!permissionId) {
      throw new ValidationError('ID da permissão é obrigatório');
    }

    if (granted === undefined) {
      throw new ValidationError('Campo "granted" é obrigatório (true ou false)');
    }

    // Verify user belongs to account
    const userCheck = await db.query(
      'SELECT * FROM users WHERE id = $1 AND account_id = $2',
      [userId, accountId]
    );

    if (userCheck.rows.length === 0) {
      throw new NotFoundError('Usuário não encontrado');
    }

    // Verify permission exists
    const permCheck = await db.query(
      'SELECT * FROM permissions WHERE id = $1',
      [permissionId]
    );

    if (permCheck.rows.length === 0) {
      throw new NotFoundError('Permissão não encontrada');
    }

    // Check if custom permission already exists
    const existing = await db.query(
      'SELECT * FROM user_permissions WHERE user_id = $1 AND permission_id = $2',
      [userId, permissionId]
    );

    let result;

    if (existing.rows.length > 0) {
      // Update existing custom permission
      result = await db.update(
        'user_permissions',
        {
          granted,
          updated_at: new Date()
        },
        {
          user_id: userId,
          permission_id: permissionId
        }
      );
    } else {
      // Insert new custom permission
      result = await db.insert('user_permissions', {
        user_id: userId,
        permission_id: permissionId,
        granted
      });
    }

    sendSuccess(res, result, granted ? 'Permissão concedida' : 'Permissão revogada', existing.rows.length > 0 ? 200 : 201);
  } catch (error) {
    sendError(res, error);
  }
};

// Remove a custom permission (revert to role-based permission)
const removeUserPermission = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { userId, permissionId } = req.params;

    // Verify user belongs to account
    const userCheck = await db.query(
      'SELECT * FROM users WHERE id = $1 AND account_id = $2',
      [userId, accountId]
    );

    if (userCheck.rows.length === 0) {
      throw new NotFoundError('Usuário não encontrado');
    }

    // Delete custom permission (user will fall back to role permission)
    await db.query(
      'DELETE FROM user_permissions WHERE user_id = $1 AND permission_id = $2',
      [userId, permissionId]
    );

    sendSuccess(res, null, 'Permissão personalizada removida. Usuário voltará a usar permissão do perfil.');
  } catch (error) {
    sendError(res, error);
  }
};

// Bulk set permissions for a user
const bulkSetUserPermissions = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { userId } = req.params;
    const { permissions } = req.body; // Array of { permissionId, granted }

    if (!Array.isArray(permissions)) {
      throw new ValidationError('Campo "permissions" deve ser um array');
    }

    // Verify user belongs to account
    const userCheck = await db.query(
      'SELECT * FROM users WHERE id = $1 AND account_id = $2',
      [userId, accountId]
    );

    if (userCheck.rows.length === 0) {
      throw new NotFoundError('Usuário não encontrado');
    }

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const results = [];

      for (const perm of permissions) {
        const { permissionId, granted } = perm;

        if (!permissionId || granted === undefined) {
          continue;
        }

        // Check if custom permission already exists
        const existing = await client.query(
          'SELECT * FROM user_permissions WHERE user_id = $1 AND permission_id = $2',
          [userId, permissionId]
        );

        if (existing.rows.length > 0) {
          // Update
          const updated = await client.query(
            `UPDATE user_permissions
            SET granted = $1, updated_at = NOW()
            WHERE user_id = $2 AND permission_id = $3
            RETURNING *`,
            [granted, userId, permissionId]
          );
          results.push(updated.rows[0]);
        } else {
          // Insert
          const inserted = await client.query(
            `INSERT INTO user_permissions (user_id, permission_id, granted)
            VALUES ($1, $2, $3)
            RETURNING *`,
            [userId, permissionId, granted]
          );
          results.push(inserted.rows[0]);
        }
      }

      await client.query('COMMIT');

      sendSuccess(res, results, `${results.length} permissões atualizadas com sucesso`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    sendError(res, error);
  }
};

// Get all available permissions (for UI selection)
const getAvailablePermissions = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
        id,
        name,
        resource,
        action,
        description
      FROM permissions
      ORDER BY resource, action`
    );

    // Group by resource for easier UI display
    const grouped = result.rows.reduce((acc, perm) => {
      if (!acc[perm.resource]) {
        acc[perm.resource] = [];
      }
      acc[perm.resource].push(perm);
      return acc;
    }, {});

    sendSuccess(res, {
      all: result.rows,
      grouped
    });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  getUserPermissions,
  getUserEffectivePermissions,
  setUserPermission,
  removeUserPermission,
  bulkSetUserPermissions,
  getAvailablePermissions
};
