/**
 * Run specific migration 068 - Add target_audience and missing columns to ai_agents
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
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration068() {
  const client = await pool.connect();

  try {
    console.log('Running migration 068_add_target_audience_to_agents.sql...\n');

    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationFile = '068_add_target_audience_to_agents.sql';

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
    console.log('   - Added target_audience column');
    console.log('   - Added products_services column');
    console.log('   - Added behavioral_profile column');
    console.log('   - Added initial_approach column');
    console.log('   - Added linkedin_variables column');
    console.log('   - Added auto_schedule column');
    console.log('   - Added scheduling_link column');
    console.log('   - Added intent_detection_enabled column');
    console.log('   - Added response_style_instructions column');
    console.log('   - Added account_id column');

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
  runMigration068()
    .then(() => {
      console.log('\nMigration 068 completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nFailed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration068 };
