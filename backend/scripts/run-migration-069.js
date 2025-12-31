/**
 * Run migration 069 - Add knowledge_similarity_threshold to ai_agents
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'getraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration069() {
  const client = await pool.connect();

  try {
    console.log('Running migration 069_add_knowledge_similarity_threshold.sql...\n');

    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationFile = '069_add_knowledge_similarity_threshold.sql';

    // Check if already executed
    const result = await client.query(
      'SELECT * FROM schema_migrations WHERE migration_name = $1',
      [migrationFile]
    );

    if (result.rows.length > 0) {
      console.log(`Migration ${migrationFile} already executed`);
      return;
    }

    // Execute migration
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await client.query('BEGIN');
    await client.query(sql);

    // Record migration
    await client.query(
      'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
      [migrationFile]
    );

    await client.query('COMMIT');
    console.log(`Successfully executed ${migrationFile}`);
    console.log('   - Added knowledge_similarity_threshold column to ai_agents (default: 0.70)');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\nMigration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigration069()
    .then(() => {
      console.log('\nMigration 069 completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nFailed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration069 };
