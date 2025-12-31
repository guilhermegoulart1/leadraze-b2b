// Script to add language preference fields to users table
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

async function addLanguageFields() {
  const client = await pool.connect();

  try {
    console.log('🌍 Adding language preference fields to users table...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../src/migrations/009_add_user_language_preferences.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');

    console.log('✅ Language fields added successfully!\n');
    console.log('Fields added:');
    console.log('  ✓ preferred_language (VARCHAR(10), default: en)');
    console.log('  ✓ timezone (VARCHAR(50), default: America/Sao_Paulo)');
    console.log('\nSupported languages: en (English), pt (Portuguese), es (Spanish)\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

addLanguageFields();
