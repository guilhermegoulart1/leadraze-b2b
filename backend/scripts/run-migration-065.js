require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function run() {
  const sqlPath = path.join(__dirname, '../database/migrations/065_fix_tags_updated_at.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    await pool.query(sql);
    console.log('✅ Migration 065_fix_tags_updated_at.sql executed successfully');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    process.exit(0);
  }
}

run();
