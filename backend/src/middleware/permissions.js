/**
 * Permissions Middleware
 * Provides role-based access control (RBAC) for the application
 */

const db = require('../config/database');
const { ForbiddenError, UnauthorizedError } = require('../utils/errors');

// In-memory cache for role permissions (reduces DB queries)
const rolePermissionsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let lastCacheUpdate = 0;

/**
 * Load all permissions for a given role from database
 * Uses caching to minimize database hits
 * @param {string} role - User role (admin, supervisor, user)
 * @param {string} accountId - Account ID for multi-tenancy
 */
async function loadRolePermissions(role, accountId) {
  const now = Date.now();

  // Invalidate cache if too old
  if (now - lastCacheUpdate > CACHE_TTL) {
    rolePermissionsCache.clear();
    lastCacheUpdate = now;
  }

  // Cache key includes both role and account for multi-tenancy
  const cacheKey = `${accountId}:${role}`;

  // Return cached permissions if available
  if (rolePermissionsCache.has(cacheKey)) {
    return rolePermissionsCache.get(cacheKey);
  }

  // Load from database (filtered by account_id for multi-tenancy)
  const query = `
    SELECT p.name, p.resource, p.action, p.scope
    FROM permissions p
    JOIN role_permissions rp ON rp.permission_id = p.id
    WHERE rp.role = $1 AND rp.account_id = $2
  `;

  const result = await db.query(query, [role, accountId]);
  const permissions = result.rows.map(r => r.name);

  // Cache the permissions
  rolePermissionsCache.set(cacheKey, permissions);

  return permissions;
}

/**
 * Load effective permissions for a user (role permissions + custom user permissions)
 * Custom permissions override role permissions
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @param {string} accountId - Account ID for multi-tenancy
 * @returns {Promise<string[]>} - Array of permission names
 */
async function loadUserEffectivePermissions(userId, role, accountId) {
  // Start with role-based permissions
  const rolePermissions = await loadRolePermissions(role, accountId);

  // Get custom user permissions (overrides)
  const customPermsQuery = `
    SELECT p.name, up.granted
    FROM user_permissions up
    JOIN permissions p ON p.id = up.permission_id
    WHERE up.user_id = $1
  `;

  const customPermsResult = await db.query(customPermsQuery, [userId]);

  if (customPermsResult.rows.length === 0) {
    // No custom permissions, return role permissions as-is
    return rolePermissions;
  }

  // Build effective permissions set
  const effectivePermissions = new Set(rolePermissions);

  // Apply custom permissions (grant or revoke)
  customPermsResult.rows.forEach(customPerm => {
    if (customPerm.granted) {
      // Grant permission (add to set)
      effectivePermissions.add(customPerm.name);
    } else {
      // Revoke permission (remove from set)
      effectivePermissions.delete(customPerm.name);
    }
  });

  return Array.from(effectivePermissions);
}

/**
 * Middleware: Check if user has a specific permission
 * Usage: app.get('/route', authenticateToken, checkPermission('campaigns:view:own'), handler)
 */
function checkPermission(requiredPermission) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        throw new UnauthorizedError('Authentication required');
      }

      // Get user's full profile including role
      const userProfile = await db.findOne('users', { id: req.user.id });

      if (!userProfile) {
        throw new UnauthorizedError('User not found');
      }

      if (!userProfile.is_active) {
        throw new ForbiddenError('User account is not active');
      }

      const userRole = userProfile.role || 'user';

      // Admin has all permissions
      if (userRole === 'admin') {
        req.user.role = userRole;
        req.user.permissions = ['*']; // Wildcard - all permissions
        return next();
      }

      // Load user's effective permissions (role + custom user permissions)
      const accountId = req.user.account_id || userProfile.account_id;
      const permissions = await loadUserEffectivePermissions(req.user.id, userRole, accountId);

      // Check if user has the required permission
      if (!permissions.includes(requiredPermission)) {
        throw new ForbiddenError(`Permission denied: ${requiredPermission}`);
      }

      // Attach role and permissions to request for use in controllers
      req.user.role = userRole;
      req.user.permissions = permissions;

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware: Check if user has one of multiple permissions (OR logic)
 * Usage: app.get('/route', authenticateToken, checkAnyPermission(['perm1', 'perm2']), handler)
 */
function checkAnyPermission(requiredPermissions) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        throw new UnauthorizedError('Authentication required');
      }

      const userProfile = await db.findOne('users', { id: req.user.id });

      if (!userProfile || !userProfile.is_active) {
        throw new ForbiddenError('User account is not active');
      }

      const userRole = userProfile.role || 'user';

      // Admin has all permissions
      if (userRole === 'admin') {
        req.user.role = userRole;
        req.user.permissions = ['*'];
        return next();
      }

      const accountId = req.user.account_id || userProfile.account_id;
      const permissions = await loadUserEffectivePermissions(req.user.id, userRole, accountId);

      // Check if user has ANY of the required permissions
      const hasPermission = requiredPermissions.some(perm => permissions.includes(perm));

      if (!hasPermission) {
        throw new ForbiddenError(`Permission denied. Required one of: ${requiredPermissions.join(', ')}`);
      }

      req.user.role = userRole;
      req.user.permissions = permissions;

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Helper: Check if user can access a specific resource
 * Handles ownership, team membership, and admin access
 *
 * @param {string} userId - The user's ID
 * @param {string} resourceId - The resource ID to check
 * @param {string} resourceType - Type of resource ('campaign', 'conversation', 'lead', 'contact')
 * @returns {Promise<boolean>} - True if user can access the resource
 */
async function canAccessResource(userId, resourceId, resourceType) {
  try {
    // Get user's role
    const user = await db.findOne('users', { id: userId });
    if (!user) return false;

    const role = user.role || 'user';

    // Admin can access everything
    if (role === 'admin') {
      return true;
    }

    // Map resource type to table name
    const tableMap = {
      'campaign': 'campaigns',
      'conversation': 'conversations',
      'lead': 'leads',
      'contact': 'contacts'
    };

    const tableName = tableMap[resourceType];
    if (!tableName) {
      throw new Error(`Unknown resource type: ${resourceType}`);
    }

    // Get the resource
    const resource = await db.findOne(tableName, { id: resourceId });
    if (!resource) {
      return false; // Resource doesn't exist
    }

    // Check ownership (user_id field)
    if (resource.user_id === userId) {
      return true;
    }

    // Check assignment (assigned_to field)
    if (resource.assigned_to === userId) {
      return true;
    }

    // Supervisor: check if resource belongs to team member
    if (role === 'supervisor') {
      const ownerId = resource.user_id || resource.assigned_to;

      if (ownerId) {
        const teamMember = await db.query(
          'SELECT * FROM user_teams WHERE supervisor_id = $1 AND member_id = $2',
          [userId, ownerId]
        );

        if (teamMember.rows.length > 0) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking resource access:', error);
    return false;
  }
}

/**
 * Helper: Get list of user IDs that a supervisor/admin can access
 * Returns array of user IDs including own ID
 * CRITICAL: Filters by account_id for multi-tenancy data isolation
 * @param {string} userId - The user's ID
 * @param {string} accountId - The account ID for multi-tenancy filtering
 */
async function getAccessibleUserIds(userId, accountId) {
  const user = await db.query(
    'SELECT * FROM users WHERE id = $1 AND account_id = $2',
    [userId, accountId]
  );
  if (user.rows.length === 0) return [userId];

  const userProfile = user.rows[0];
  const role = userProfile.role || 'user';

  // Admin can access all users IN THIS ACCOUNT ONLY (multi-tenancy)
  if (role === 'admin') {
    const allUsers = await db.query(
      'SELECT id FROM users WHERE account_id = $1 AND is_active = true',
      [accountId]
    );
    return allUsers.rows.map(u => u.id);
  }

  // Supervisor can access own ID + team members (within same account)
  if (role === 'supervisor') {
    const teamMembers = await db.query(
      `SELECT ut.member_id FROM user_teams ut
       JOIN users u ON ut.member_id = u.id
       WHERE ut.supervisor_id = $1 AND u.account_id = $2`,
      [userId, accountId]
    );

    const userIds = [userId, ...teamMembers.rows.map(t => t.member_id)];
    return userIds;
  }

  // Regular user can only access own resources
  return [userId];
}

/**
 * Helper: Get list of sector IDs that a user can access
 * Returns array of sector IDs the user has access to
 * CRITICAL: Filters by account_id for multi-tenancy data isolation
 * @param {string} userId - The user's ID
 * @param {string} accountId - The account ID for multi-tenancy filtering
 * @returns {Promise<string[]>} - Array of accessible sector IDs
 */
async function getAccessibleSectorIds(userId, accountId) {
  const user = await db.query(
    'SELECT * FROM users WHERE id = $1 AND account_id = $2',
    [userId, accountId]
  );
  if (user.rows.length === 0) return [];

  const userProfile = user.rows[0];
  const role = userProfile.role || 'user';

  // Admin can access all sectors in their account
  if (role === 'admin') {
    const allSectors = await db.query(
      'SELECT id FROM sectors WHERE account_id = $1 AND is_active = true',
      [accountId]
    );
    return allSectors.rows.map(s => s.id);
  }

  // Supervisor can access sectors they supervise
  if (role === 'supervisor') {
    const supervisedSectors = await db.query(
      `SELECT s.id FROM sectors s
       INNER JOIN supervisor_sectors ss ON ss.sector_id = s.id
       WHERE ss.supervisor_id = $1 AND s.account_id = $2 AND s.is_active = true`,
      [userId, accountId]
    );
    return supervisedSectors.rows.map(s => s.id);
  }

  // Regular user can access sectors they are assigned to
  const userSectors = await db.query(
    `SELECT s.id FROM sectors s
     INNER JOIN user_sectors us ON us.sector_id = s.id
     WHERE us.user_id = $1 AND s.account_id = $2 AND s.is_active = true`,
    [userId, accountId]
  );
  return userSectors.rows.map(s => s.id);
}

/**
 * Middleware: Require specific role
 * Usage: app.get('/admin-route', authenticateToken, requireRole('admin'), handler)
 */
function requireRole(requiredRole) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        throw new UnauthorizedError('Authentication required');
      }

      const userProfile = await db.findOne('users', { id: req.user.id });

      if (!userProfile || !userProfile.is_active) {
        throw new ForbiddenError('User account is not active');
      }

      const userRole = userProfile.role || 'user';

      // Check role match
      if (Array.isArray(requiredRole)) {
        if (!requiredRole.includes(userRole)) {
          throw new ForbiddenError(`Access denied. Required role: ${requiredRole.join(' or ')}`);
        }
      } else {
        if (userRole !== requiredRole) {
          throw new ForbiddenError(`Access denied. Required role: ${requiredRole}`);
        }
      }

      req.user.role = userRole;

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Clear permissions cache (useful after permission changes)
 */
function clearPermissionsCache() {
  rolePermissionsCache.clear();
  lastCacheUpdate = 0;
}

module.exports = {
  checkPermission,
  checkAnyPermission,
  requireRole,
  canAccessResource,
  getAccessibleUserIds,
  getAccessibleSectorIds,
  loadRolePermissions,
  loadUserEffectivePermissions,
  clearPermissionsCache
};
