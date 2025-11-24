// backend/scripts/run-google-maps-migrations.js
// Script to run Google Maps migrations

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD),
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting Google Maps migrations...\n');

    // Migration 017: Add Google Maps fields to contacts
    console.log('📦 Running migration 017: Update contacts table...');
    const migration017Path = path.join(__dirname, '../database/migrations/017_update_contacts_google_maps.sql');
    const migration017 = fs.readFileSync(migration017Path, 'utf8');

    await client.query(migration017);
    console.log('✅ Migration 017 completed\n');

    // Migration 018: Create Google Maps Agents table
    console.log('📦 Running migration 018: Create Google Maps Agents...');
    const migration018Path = path.join(__dirname, '../database/migrations/018_create_google_maps_agents.sql');
    const migration018 = fs.readFileSync(migration018Path, 'utf8');

    await client.query(migration018);
    console.log('✅ Migration 018 completed\n');

    console.log('🎉 All Google Maps migrations completed successfully!');

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error.message);
    process.exit(1);
  });
