// backend/src/migrations/010_add_messages_deleted_at.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'leadraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function up() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('📦 Adding deleted_at column to messages table...');

    // Add deleted_at column
    await client.query(`
      ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
    `);

    // Create index for soft delete queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_deleted_at
        ON messages(deleted_at);
    `);

    console.log('✅ deleted_at column added to messages!');

    await client.query('COMMIT');
    console.log('🎉 Migration 010 completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🔄 Reverting migration 010...');

    await client.query(`
      DROP INDEX IF EXISTS idx_messages_deleted_at;
    `);

    await client.query(`
      ALTER TABLE messages
      DROP COLUMN IF EXISTS deleted_at;
    `);

    console.log('✅ Migration 010 reverted!');

    await client.query('COMMIT');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error reverting migration:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Execute if called directly
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'up') {
    up()
      .then(() => {
        console.log('✅ Migration applied successfully!');
        process.exit(0);
      })
      .catch(err => {
        console.error('❌ Error:', err);
        process.exit(1);
      });
  } else if (command === 'down') {
    down()
      .then(() => {
        console.log('✅ Migration reverted successfully!');
        process.exit(0);
      })
      .catch(err => {
        console.error('❌ Error:', err);
        process.exit(1);
      });
  } else {
    console.log('Usage: node 010_add_messages_deleted_at.js [up|down]');
    process.exit(1);
  }
}

module.exports = { up, down };
