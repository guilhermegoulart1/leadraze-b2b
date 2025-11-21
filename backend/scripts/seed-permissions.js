/**
 * Seed default permissions for the role-based access control system
 * This script populates the permissions table and assigns them to roles
 */

// Try to load .env if it exists
try {
  require('dotenv').config();
} catch (e) {
  // .env might not exist, that's ok
}

const { Pool } = require('pg');

// Create a dedicated pool for seeding (same config as run-migrations.js)
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'leadraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Define all permissions in the system
const permissions = [
  // =====================
  // CAMPAIGNS
  // =====================
  { name: 'campaigns:view:own', resource: 'campaigns', action: 'view', scope: 'own',
    description: 'View own campaigns' },
  { name: 'campaigns:view:team', resource: 'campaigns', action: 'view', scope: 'team',
    description: 'View team campaigns (supervisor)' },
  { name: 'campaigns:view:all', resource: 'campaigns', action: 'view', scope: 'all',
    description: 'View all campaigns (admin)' },
  { name: 'campaigns:create', resource: 'campaigns', action: 'create', scope: 'own',
    description: 'Create new campaigns' },
  { name: 'campaigns:edit:own', resource: 'campaigns', action: 'edit', scope: 'own',
    description: 'Edit own campaigns' },
  { name: 'campaigns:edit:team', resource: 'campaigns', action: 'edit', scope: 'team',
    description: 'Edit team campaigns (supervisor)' },
  { name: 'campaigns:delete:own', resource: 'campaigns', action: 'delete', scope: 'own',
    description: 'Delete own campaigns' },
  { name: 'campaigns:delete:team', resource: 'campaigns', action: 'delete', scope: 'team',
    description: 'Delete team campaigns (supervisor)' },

  // =====================
  // CONTACTS
  // =====================
  { name: 'contacts:view:own', resource: 'contacts', action: 'view', scope: 'own',
    description: 'View own contacts' },
  { name: 'contacts:view:team', resource: 'contacts', action: 'view', scope: 'team',
    description: 'View team contacts (supervisor)' },
  { name: 'contacts:view:all', resource: 'contacts', action: 'view', scope: 'all',
    description: 'View all contacts (admin)' },
  { name: 'contacts:create', resource: 'contacts', action: 'create', scope: 'own',
    description: 'Create new contacts' },
  { name: 'contacts:edit:own', resource: 'contacts', action: 'edit', scope: 'own',
    description: 'Edit own contacts' },
  { name: 'contacts:edit:team', resource: 'contacts', action: 'edit', scope: 'team',
    description: 'Edit team contacts (supervisor)' },
  { name: 'contacts:delete:own', resource: 'contacts', action: 'delete', scope: 'own',
    description: 'Delete own contacts' },
  { name: 'contacts:export', resource: 'contacts', action: 'export', scope: 'own',
    description: 'Export contacts to CSV' },
  { name: 'contacts:import', resource: 'contacts', action: 'import', scope: 'own',
    description: 'Import contacts from CSV' },

  // =====================
  // CONVERSATIONS
  // =====================
  { name: 'conversations:view:own', resource: 'conversations', action: 'view', scope: 'own',
    description: 'View own conversations' },
  { name: 'conversations:view:team', resource: 'conversations', action: 'view', scope: 'team',
    description: 'View team conversations (supervisor)' },
  { name: 'conversations:view:all', resource: 'conversations', action: 'view', scope: 'all',
    description: 'View all conversations (admin)' },
  { name: 'conversations:manage:own', resource: 'conversations', action: 'manage', scope: 'own',
    description: 'Manage own conversations' },
  { name: 'conversations:manage:team', resource: 'conversations', action: 'manage', scope: 'team',
    description: 'Manage team conversations (supervisor)' },
  { name: 'conversations:take_control', resource: 'conversations', action: 'take_control', scope: 'team',
    description: 'Take control from AI agent (supervisor)' },

  // =====================
  // LEADS (Pipeline)
  // =====================
  { name: 'leads:view:own', resource: 'leads', action: 'view', scope: 'own',
    description: 'View own leads in pipeline' },
  { name: 'leads:view:team', resource: 'leads', action: 'view', scope: 'team',
    description: 'View team leads (supervisor)' },
  { name: 'leads:view:all', resource: 'leads', action: 'view', scope: 'all',
    description: 'View all leads (admin)' },
  { name: 'leads:edit:own', resource: 'leads', action: 'edit', scope: 'own',
    description: 'Edit own leads' },
  { name: 'leads:edit:team', resource: 'leads', action: 'edit', scope: 'team',
    description: 'Edit team leads (supervisor)' },

  // =====================
  // AI AGENTS
  // =====================
  { name: 'ai_agents:view:own', resource: 'ai_agents', action: 'view', scope: 'own',
    description: 'View own AI agents' },
  { name: 'ai_agents:view:all', resource: 'ai_agents', action: 'view', scope: 'all',
    description: 'View all AI agents (admin)' },
  { name: 'ai_agents:create', resource: 'ai_agents', action: 'create', scope: 'own',
    description: 'Create AI agents' },
  { name: 'ai_agents:edit:own', resource: 'ai_agents', action: 'edit', scope: 'own',
    description: 'Edit own AI agents' },
  { name: 'ai_agents:edit:all', resource: 'ai_agents', action: 'edit', scope: 'all',
    description: 'Edit all AI agents (admin)' },

  // =====================
  // ANALYTICS
  // =====================
  { name: 'analytics:view:own', resource: 'analytics', action: 'view', scope: 'own',
    description: 'View own analytics' },
  { name: 'analytics:view:team', resource: 'analytics', action: 'view', scope: 'team',
    description: 'View team analytics (supervisor)' },
  { name: 'analytics:view:all', resource: 'analytics', action: 'view', scope: 'all',
    description: 'View all analytics (admin)' },

  // =====================
  // SETTINGS
  // =====================
  { name: 'settings:view', resource: 'settings', action: 'view', scope: 'own',
    description: 'View settings' },
  { name: 'settings:edit:own', resource: 'settings', action: 'edit', scope: 'own',
    description: 'Edit own settings' },
  { name: 'settings:edit:system', resource: 'settings', action: 'edit', scope: 'all',
    description: 'Edit system settings (admin)' },

  // =====================
  // USERS MANAGEMENT
  // =====================
  { name: 'users:view', resource: 'users', action: 'view', scope: 'all',
    description: 'View users list (admin)' },
  { name: 'users:create', resource: 'users', action: 'create', scope: 'all',
    description: 'Create new users (admin)' },
  { name: 'users:edit', resource: 'users', action: 'edit', scope: 'all',
    description: 'Edit users (admin)' },
  { name: 'users:delete', resource: 'users', action: 'delete', scope: 'all',
    description: 'Delete users (admin)' },
  { name: 'users:assign_roles', resource: 'users', action: 'assign_roles', scope: 'all',
    description: 'Assign roles to users (admin)' },

  // =====================
  // PERMISSIONS MANAGEMENT
  // =====================
  { name: 'permissions:view', resource: 'permissions', action: 'view', scope: 'all',
    description: 'View permissions (admin/supervisor)' },
  { name: 'permissions:edit:own', resource: 'permissions', action: 'edit', scope: 'own',
    description: 'Edit permissions for own team (supervisor)' },
  { name: 'permissions:edit:all', resource: 'permissions', action: 'edit', scope: 'all',
    description: 'Edit all permissions (admin)' },

  // =====================
  // TEAMS MANAGEMENT
  // =====================
  { name: 'teams:manage', resource: 'teams', action: 'manage', scope: 'all',
    description: 'Manage teams (admin)' },

  // =====================
  // TAGS
  // =====================
  { name: 'tags:view', resource: 'tags', action: 'view', scope: 'all',
    description: 'View tags (all users)' },
  { name: 'tags:manage', resource: 'tags', action: 'manage', scope: 'all',
    description: 'Create/edit/delete tags (all users - global tags)' },
];

// Define which permissions each role has
const roleAssignments = {
  admin: [
    // Admin has ALL permissions
    ...permissions.map(p => p.name)
  ],

  supervisor: [
    // Campaigns
    'campaigns:view:own',
    'campaigns:view:team',
    'campaigns:create',
    'campaigns:edit:own',
    'campaigns:edit:team',
    'campaigns:delete:own',

    // Contacts
    'contacts:view:own',
    'contacts:view:team',
    'contacts:create',
    'contacts:edit:own',
    'contacts:edit:team',
    'contacts:delete:own',
    'contacts:export',
    'contacts:import',

    // Conversations
    'conversations:view:own',
    'conversations:view:team',
    'conversations:manage:own',
    'conversations:manage:team',
    'conversations:take_control',

    // Leads
    'leads:view:own',
    'leads:view:team',
    'leads:edit:own',
    'leads:edit:team',

    // AI Agents
    'ai_agents:view:own',
    'ai_agents:create',
    'ai_agents:edit:own',

    // Analytics
    'analytics:view:own',
    'analytics:view:team',

    // Settings
    'settings:view',
    'settings:edit:own',

    // Permissions (can view and edit for own team)
    'permissions:view',
    'permissions:edit:own',

    // Tags
    'tags:view',
    'tags:manage',
  ],

  user: [
    // Campaigns
    'campaigns:view:own',
    'campaigns:create',
    'campaigns:edit:own',
    'campaigns:delete:own',

    // Contacts
    'contacts:view:own',
    'contacts:create',
    'contacts:edit:own',
    'contacts:delete:own',
    'contacts:export',
    'contacts:import',

    // Conversations
    'conversations:view:own',
    'conversations:manage:own',

    // Leads
    'leads:view:own',
    'leads:edit:own',

    // AI Agents
    'ai_agents:view:own',
    'ai_agents:create',
    'ai_agents:edit:own',

    // Analytics
    'analytics:view:own',

    // Settings
    'settings:view',
    'settings:edit:own',

    // Tags
    'tags:view',
    'tags:manage',
  ]
};

async function seedPermissions() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🌱 Seeding permissions...');

    // Insert permissions
    for (const permission of permissions) {
      await client.query(`
        INSERT INTO permissions (name, resource, action, scope, description)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (name) DO UPDATE SET
          description = EXCLUDED.description
      `, [permission.name, permission.resource, permission.action, permission.scope, permission.description]);
    }

    console.log(`✅ Inserted ${permissions.length} permissions`);

    // Assign permissions to roles
    for (const [role, permissionNames] of Object.entries(roleAssignments)) {
      console.log(`\n📋 Assigning permissions to role: ${role}`);

      for (const permissionName of permissionNames) {
        const permissionResult = await client.query(
          'SELECT id FROM permissions WHERE name = $1',
          [permissionName]
        );

        if (permissionResult.rows.length > 0) {
          await client.query(`
            INSERT INTO role_permissions (role, permission_id)
            VALUES ($1, $2)
            ON CONFLICT (role, permission_id) DO NOTHING
          `, [role, permissionResult.rows[0].id]);
        }
      }

      console.log(`✅ Assigned ${permissionNames.length} permissions to ${role}`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Permissions seeded successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding permissions:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  seedPermissions()
    .then(() => {
      console.log('✅ Done!');
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Failed:', error);
      pool.end().finally(() => process.exit(1));
    });
}

module.exports = { seedPermissions };
