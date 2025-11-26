// Add phone column to users table
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : false
});

async function addPhoneColumn() {
  try {
    console.log('Adding phone column to users table...');

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
    `);

    console.log('✅ Phone column added');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
    `);

    console.log('✅ Index created');
    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

addPhoneColumn();
