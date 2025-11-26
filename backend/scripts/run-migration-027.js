/**
 * Run migration 027: Add conversation summary fields
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'leadraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' || process.env.DB_HOST?.includes('supabase')
    ? { rejectUnauthorized: false }
    : false,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🔄 Running migration 027: Add conversation summary fields...\n');

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '027_add_conversation_summary.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    await client.query('BEGIN');
    await client.query(sql);

    // Record migration in tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(
      'INSERT INTO schema_migrations (migration_name) VALUES ($1) ON CONFLICT (migration_name) DO NOTHING',
      ['027_add_conversation_summary.sql']
    );

    await client.query('COMMIT');

    console.log('✅ Migration 027 completed successfully!');
    console.log('\n📊 Added fields to conversations table:');
    console.log('   ✓ context_summary (TEXT)');
    console.log('   ✓ summary_up_to_message_id (UUID)');
    console.log('   ✓ summary_token_count (INTEGER)');
    console.log('   ✓ summary_updated_at (TIMESTAMP)');
    console.log('   ✓ messages_count (INTEGER)');
    console.log('\n✅ Done!\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
