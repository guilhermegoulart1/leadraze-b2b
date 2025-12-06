const fs = require('fs');
const path = require('path');
const { query, pool } = require('../src/config/database');

async function runMigration() {
  try {
    console.log('Starting migration 062: Create tags system...');

    const migrationPath = path.join(__dirname, '../database/migrations/062_create_tags_system.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await query('BEGIN');
    await query(sql);
    await query('COMMIT');

    console.log('✓ Migration 062 completed successfully!');
    console.log('  - Created tags table');
    console.log('  - Created lead_tags junction table');
    console.log('  - Created indexes');
    console.log('  - Created triggers');

  } catch (error) {
    await query('ROLLBACK');
    console.error('✗ Migration 062 failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration().catch(console.error);
