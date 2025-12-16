/**
 * Permissions Service
 * Handles initialization and management of role permissions per account
 */

const db = require('../config/database');

// Default permissions for each role
const roleAssignments = {
  admin: [
    // Admin has ALL permissions - will be populated dynamically
  ],
  supervisor: [
    'campaigns:view:own', 'campaigns:view:team', 'campaigns:create',
    'campaigns:edit:own', 'campaigns:edit:team', 'campaigns:delete:own',
    'contacts:view:own', 'contacts:view:team', 'contacts:create',
    'contacts:edit:own', 'contacts:edit:team', 'contacts:delete:own',
    'contacts:export', 'contacts:import',
    'conversations:view:own', 'conversations:view:team',
    'conversations:manage:own', 'conversations:manage:team', 'conversations:take_control',
    'leads:view:own', 'leads:view:team', 'leads:edit:own', 'leads:edit:team',
    'ai_agents:view:own', 'ai_agents:create', 'ai_agents:edit:own',
    'analytics:view:own', 'analytics:view:team',
    'settings:view', 'settings:edit:own',
    'permissions:view', 'permissions:edit:own',
    'tags:view', 'tags:manage'
  ],
  user: [
    'campaigns:view:own', 'campaigns:create', 'campaigns:edit:own', 'campaigns:delete:own',
    'contacts:view:own', 'contacts:create', 'contacts:edit:own', 'contacts:delete:own',
    'contacts:export', 'contacts:import',
    'conversations:view:own', 'conversations:manage:own',
    'leads:view:own', 'leads:edit:own',
    'ai_agents:view:own', 'ai_agents:create', 'ai_agents:edit:own',
    'analytics:view:own',
    'settings:view', 'settings:edit:own',
    'tags:view', 'tags:manage'
  ]
};

/**
 * Check if an account has role permissions configured
 */
async function hasPermissionsConfigured(accountId) {
  const result = await db.query(
    'SELECT COUNT(*) as count FROM role_permissions WHERE account_id = $1',
    [accountId]
  );
  return parseInt(result.rows[0].count) > 0;
}

/**
 * Initialize default permissions for an account
 * This should be called when:
 * 1. A new account is created
 * 2. An account is detected with no permissions
 */
async function initializeAccountPermissions(accountId) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // Check if already has permissions
    const existing = await client.query(
      'SELECT COUNT(*) as count FROM role_permissions WHERE account_id = $1',
      [accountId]
    );

    if (parseInt(existing.rows[0].count) > 0) {
      await client.query('COMMIT');
      return { initialized: false, message: 'Account already has permissions configured' };
    }

    // Get all available permissions
    const permissionsResult = await client.query(
      'SELECT id, name FROM permissions ORDER BY resource, action'
    );
    const allPermissions = permissionsResult.rows;

    if (allPermissions.length === 0) {
      await client.query('ROLLBACK');
      return { initialized: false, message: 'No permissions defined in system' };
    }

    // Create a map for quick lookup
    const permissionMap = {};
    allPermissions.forEach(p => {
      permissionMap[p.name] = p.id;
    });

    // Admin gets ALL permissions
    const adminPermissions = allPermissions.map(p => p.name);

    const assignments = {
      admin: adminPermissions,
      supervisor: roleAssignments.supervisor,
      user: roleAssignments.user
    };

    let totalInserted = 0;

    for (const [role, permissionNames] of Object.entries(assignments)) {
      for (const permName of permissionNames) {
        const permId = permissionMap[permName];
        if (permId) {
          await client.query(`
            INSERT INTO role_permissions (account_id, role, permission_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (account_id, role, permission_id) DO NOTHING
          `, [accountId, role, permId]);
          totalInserted++;
        }
      }
    }

    await client.query('COMMIT');

    return {
      initialized: true,
      message: `Initialized ${totalInserted} permissions for account`,
      permissionsCount: totalInserted
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Ensure account has permissions - initialize if not
 * This is a safe method to call anytime
 */
async function ensureAccountPermissions(accountId) {
  const hasPerms = await hasPermissionsConfigured(accountId);
  if (!hasPerms) {
    return await initializeAccountPermissions(accountId);
  }
  return { initialized: false, message: 'Permissions already configured' };
}

module.exports = {
  hasPermissionsConfigured,
  initializeAccountPermissions,
  ensureAccountPermissions,
  roleAssignments
};
