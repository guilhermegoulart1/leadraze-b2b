// backend/scripts/run-migration-024.js
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

async function runMigration() {
  try {
    console.log('🔄 Running Migration 024: Unified AI Agents System...\n');

    // Read migration SQL file
    const sqlPath = path.join(__dirname, '..', 'database', 'migrations', '024_update_ai_agents_unified.sql');

    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration file not found at: ${sqlPath}`);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute SQL
    await pool.query(sql);

    console.log('✅ Migration 024 completed successfully!\n');
    console.log('📊 Table created:');
    console.log('   ✓ ai_agents (unified agents table)');

    console.log('\n🔧 Features:');
    console.log('   ✓ Multi-tenancy support (account_id, user_id, sector_id)');
    console.log('   ✓ Four agent types: LinkedIn, Google Maps, Email, WhatsApp');
    console.log('   ✓ Response length configuration (short, medium, long)');
    console.log('   ✓ Flexible JSONB config field for type-specific settings');
    console.log('   ✓ Statistics tracking');
    console.log('   ✓ Scheduling support');

    console.log('\n🎯 Ready for unified agent management!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Full error:', error);

    if (error.code === 'ECONNREFUSED') {
      console.log('\n🔧 Connection failed. Please check:');
      console.log('   - PostgreSQL is running');
      console.log('   - Database connection settings in .env');
      console.log('   - Database exists');
    } else if (error.code === '42P07') {
      console.log('\n⚠️  Table already exists. This is normal if migration was run before.');
      console.log('   If you need to reset, drop the table first.');
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');

    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();

    console.log('✅ Database connection successful!');
    console.log(`🕐 Server time: ${result.rows[0].now}\n`);

    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('\n🚀 GetRaze - Migration 024: Unified AI Agents\n');
  console.log('========================================\n');

  // Test connection first
  const connectionOk = await testConnection();

  if (!connectionOk) {
    console.log('\n📋 To fix connection issues:');
    console.log('1. Make sure PostgreSQL is installed and running');
    console.log('2. Check your .env file settings\n');
    process.exit(1);
  }

  // Run migration
  await runMigration();
}

if (require.main === module) {
  main();
}

module.exports = { runMigration };
