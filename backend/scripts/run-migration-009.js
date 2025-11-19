const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('Starting migration 009: Add user profile picture...');

    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../database/migrations/009_add_user_profile_picture.sql'),
      'utf8'
    );

    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');

    console.log('✓ Migration 009 completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ Migration 009 failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
