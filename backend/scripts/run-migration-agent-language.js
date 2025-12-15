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

async function runMigration() {
  try {
    console.log('🔄 Running Migration: Add Language Field to AI Agents\n');

    // Read migration file
    const sqlPath = path.join(__dirname, '..', 'src', 'migrations', '015_add_agent_language.sql');

    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration file not found at: ${sqlPath}`);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📝 Executing SQL migration...\n');

    // Execute SQL
    await pool.query(sql);

    console.log('\n✅ Migration completed successfully!');
    console.log('   - Added "language" column to ai_agents table');
    console.log('   - Default is NULL (uses user preference as fallback)\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
