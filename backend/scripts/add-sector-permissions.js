const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'leadraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function addSectorPermissions() {
  const client = await pool.connect();

  try {
    console.log('🔄 Adding sector permissions...\n');

    await client.query('BEGIN');

    // Define sector permissions
    const sectorPermissions = [
      {
        name: 'sectors:view',
        resource: 'sectors',
        action: 'view',
        scope: 'all',
        description: 'Visualizar setores'
      },
      {
        name: 'sectors:create',
        resource: 'sectors',
        action: 'create',
        scope: 'all',
        description: 'Criar novos setores'
      },
      {
        name: 'sectors:edit',
        resource: 'sectors',
        action: 'edit',
        scope: 'all',
        description: 'Editar setores existentes'
      },
      {
        name: 'sectors:delete',
        resource: 'sectors',
        action: 'delete',
        scope: 'all',
        description: 'Deletar setores'
      }
    ];

    // Insert permissions if they don't exist
    for (const perm of sectorPermissions) {
      const existing = await client.query(
        'SELECT id FROM permissions WHERE name = $1',
        [perm.name]
      );

      let permissionId;

      if (existing.rows.length === 0) {
        const result = await client.query(
          `INSERT INTO permissions (name, resource, action, scope, description)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [perm.name, perm.resource, perm.action, perm.scope, perm.description]
        );
        permissionId = result.rows[0].id;
        console.log(`✅ Created permission: ${perm.name}`);
      } else {
        permissionId = existing.rows[0].id;
        console.log(`⏭️  Permission already exists: ${perm.name}`);
      }

      // Assign to admin role for all accounts
      const accounts = await client.query('SELECT id FROM accounts');

      for (const account of accounts.rows) {
        const rolePermExists = await client.query(
          `SELECT id FROM role_permissions
           WHERE role = $1 AND permission_id = $2 AND account_id = $3`,
          ['admin', permissionId, account.id]
        );

        if (rolePermExists.rows.length === 0) {
          await client.query(
            `INSERT INTO role_permissions (role, permission_id, account_id)
             VALUES ($1, $2, $3)`,
            ['admin', permissionId, account.id]
          );
          console.log(`   → Assigned to admin role for account ${account.id}`);
        }
      }
    }

    await client.query('COMMIT');

    console.log('\n✅ Sector permissions added successfully!\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error adding sector permissions:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

addSectorPermissions();
