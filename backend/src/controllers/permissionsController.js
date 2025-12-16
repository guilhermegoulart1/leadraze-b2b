/**
 * Permissions Controller
 * Handles viewing and editing permissions for roles
 */

const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { BadRequestError, ForbiddenError } = require('../utils/errors');
const { clearPermissionsCache } = require('../middleware/permissions');
const { ensureAccountPermissions } = require('../services/permissionsService');

/**
 * GET /permissions
 * List all available permissions
 */
exports.getAllPermissions = async (req, res) => {
  try {
    const { resource, action } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (resource) {
      whereConditions.push(`resource = $${paramIndex}`);
      queryParams.push(resource);
      paramIndex++;
    }

    if (action) {
      whereConditions.push(`action = $${paramIndex}`);
      queryParams.push(action);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    const query = `
      SELECT id, name, resource, action, scope, description, created_at
      FROM permissions
      ${whereClause}
      ORDER BY resource, action, scope
    `;

    const result = await db.query(query, queryParams);

    // Group by resource for easier frontend handling
    const grouped = {};
    result.rows.forEach(perm => {
      if (!grouped[perm.resource]) {
        grouped[perm.resource] = [];
      }
      grouped[perm.resource].push(perm);
    });

    sendSuccess(res, {
      permissions: result.rows,
      grouped
    });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * GET /permissions/roles/:role
 * Get permissions assigned to a specific role
 */
exports.getRolePermissions = async (req, res) => {
  try {
    const { role } = req.params;
    const accountId = req.user.account_id;

    // Validate role
    const validRoles = ['admin', 'supervisor', 'user'];
    if (!validRoles.includes(role)) {
      throw new BadRequestError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Ensure account has permissions configured (auto-initialize if needed)
    await ensureAccountPermissions(accountId);

    const query = `
      SELECT
        p.id, p.name, p.resource, p.action, p.scope, p.description,
        rp.role, rp.created_at as assigned_at
      FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      WHERE rp.role = $1 AND rp.account_id = $2
      ORDER BY p.resource, p.action, p.scope
    `;

    const result = await db.query(query, [role, accountId]);

    // Group by resource
    const grouped = {};
    result.rows.forEach(perm => {
      if (!grouped[perm.resource]) {
        grouped[perm.resource] = [];
      }
      grouped[perm.resource].push(perm);
    });

    sendSuccess(res, {
      role,
      permissions: result.rows,
      grouped,
      total: result.rows.length
    });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * PUT /permissions/roles/:role
 * Update permissions for a role (admin only, or supervisor for user role)
 */
exports.updateRolePermissions = async (req, res) => {
  try {
    const { role } = req.params;
    const { permission_ids } = req.body; // Array of permission IDs to assign
    const accountId = req.user.account_id;

    // Validate role
    const validRoles = ['admin', 'supervisor', 'user'];
    if (!validRoles.includes(role)) {
      throw new BadRequestError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Prevent modifying admin role (admins always have all permissions)
    if (role === 'admin') {
      throw new ForbiddenError('Cannot modify admin permissions. Admins have all permissions by default.');
    }

    // Supervisors can only edit 'user' role permissions
    if (req.user.role === 'supervisor' && role !== 'user') {
      throw new ForbiddenError('Supervisors can only edit permissions for the user role');
    }

    // Validate permission_ids
    if (!Array.isArray(permission_ids)) {
      throw new BadRequestError('permission_ids must be an array');
    }

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Remove existing permissions for this role IN THIS ACCOUNT
      await client.query(
        'DELETE FROM role_permissions WHERE role = $1 AND account_id = $2',
        [role, accountId]
      );

      // Add new permissions
      if (permission_ids.length > 0) {
        const values = permission_ids.map((permId, idx) => {
          const offset = idx * 3;
          return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
        }).join(', ');

        const params = [];
        permission_ids.forEach(permId => {
          params.push(role, permId, accountId);
        });

        await client.query(`
          INSERT INTO role_permissions (role, permission_id, account_id)
          VALUES ${values}
        `, params);
      }

      await client.query('COMMIT');

      // Clear permissions cache so changes take effect immediately
      clearPermissionsCache();

      // Get updated permissions FOR THIS ACCOUNT
      const updated = await client.query(`
        SELECT
          p.id, p.name, p.resource, p.action, p.scope, p.description
        FROM permissions p
        JOIN role_permissions rp ON rp.permission_id = p.id
        WHERE rp.role = $1 AND rp.account_id = $2
        ORDER BY p.resource, p.action, p.scope
      `, [role, accountId]);

      sendSuccess(res, {
        message: `Permissions updated for role: ${role}`,
        role,
        permissions: updated.rows,
        total: updated.rows.length
      });

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

/**
 * GET /permissions/roles
 * Get summary of permissions for all roles
 */
exports.getRolesSummary = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    // Ensure account has permissions configured (auto-initialize if needed)
    await ensureAccountPermissions(accountId);

    const query = `
      SELECT
        rp.role,
        COUNT(p.id) as permission_count,
        json_agg(
          json_build_object(
            'resource', p.resource,
            'count', 1
          )
        ) as resources
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.account_id = $1
      GROUP BY rp.role
      ORDER BY rp.role
    `;

    const result = await db.query(query, [accountId]);

    // Process resources to get unique counts
    const roles = result.rows.map(row => {
      const resourceCounts = {};
      if (row.resources) {
        row.resources.forEach(r => {
          resourceCounts[r.resource] = (resourceCounts[r.resource] || 0) + 1;
        });
      }

      return {
        role: row.role,
        permission_count: parseInt(row.permission_count),
        resources: resourceCounts
      };
    });

    sendSuccess(res, { roles });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * POST /permissions/roles/:role/assign
 * Assign a single permission to a role
 */
exports.assignPermissionToRole = async (req, res) => {
  try {
    const { role } = req.params;
    const { permission_id } = req.body;
    const accountId = req.user.account_id;

    // Validate role
    const validRoles = ['admin', 'supervisor', 'user'];
    if (!validRoles.includes(role)) {
      throw new BadRequestError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Prevent modifying admin role
    if (role === 'admin') {
      throw new ForbiddenError('Cannot modify admin permissions');
    }

    // Supervisors can only edit 'user' role permissions
    if (req.user.role === 'supervisor' && role !== 'user') {
      throw new ForbiddenError('Supervisors can only edit permissions for the user role');
    }

    // Check if permission exists
    const permission = await db.findOne('permissions', { id: permission_id });
    if (!permission) {
      throw new BadRequestError('Permission not found');
    }

    // Assign permission FOR THIS ACCOUNT
    await db.query(`
      INSERT INTO role_permissions (role, permission_id, account_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (account_id, role, permission_id) DO NOTHING
    `, [role, permission_id, accountId]);

    // Clear cache
    clearPermissionsCache();

    sendSuccess(res, {
      message: 'Permission assigned successfully',
      role,
      permission: permission.name
    });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * DELETE /permissions/roles/:role/remove/:permissionId
 * Remove a single permission from a role
 */
exports.removePermissionFromRole = async (req, res) => {
  try {
    const { role, permissionId } = req.params;
    const accountId = req.user.account_id;

    // Validate role
    const validRoles = ['admin', 'supervisor', 'user'];
    if (!validRoles.includes(role)) {
      throw new BadRequestError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Prevent modifying admin role
    if (role === 'admin') {
      throw new ForbiddenError('Cannot modify admin permissions');
    }

    // Supervisors can only edit 'user' role permissions
    if (req.user.role === 'supervisor' && role !== 'user') {
      throw new ForbiddenError('Supervisors can only edit permissions for the user role');
    }

    // Remove permission FROM THIS ACCOUNT
    const result = await db.query(`
      DELETE FROM role_permissions
      WHERE role = $1 AND permission_id = $2 AND account_id = $3
      RETURNING *
    `, [role, permissionId, accountId]);

    if (result.rows.length === 0) {
      throw new BadRequestError('Permission assignment not found');
    }

    // Clear cache
    clearPermissionsCache();

    sendSuccess(res, {
      message: 'Permission removed successfully',
      role
    });

  } catch (error) {
    sendError(res, error);
  }
};
