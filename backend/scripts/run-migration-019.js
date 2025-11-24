// Script to run migration 019
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Running migration 019...\n');

    const migrationPath = path.join(__dirname, '../database/migrations/019_update_google_maps_agents_ux.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    await client.query(migrationSql);

    console.log('✅ Migration 019 completed successfully!\n');

  } catch (error) {
    console.error('❌ Migration error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  });
