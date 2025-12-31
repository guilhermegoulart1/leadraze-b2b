/**
 * Run migration 098: Create folders table for organizing AI Employees and Follow-up Flows
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

async function run() {
  const client = await pool.connect();
  try {
    console.log('🚀 Running migration 098: Create folders table...');

    const migrationPath = path.join(__dirname, '../database/migrations/098_create_folders.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await client.query(sql);

    console.log('✅ Migration 098 completed successfully!');
    console.log('   - Created folders table with hierarchical support');
    console.log('   - Added folder_id column to ai_agents');
    console.log('   - Added folder_id column to follow_up_flows');
    console.log('   - Created indexes for performance');
    console.log('   - Created trigger for updated_at');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
