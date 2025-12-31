// backend/scripts/run-migration-025.js
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
    console.log('🔄 Running Migration 025: Multi-Channel Activation Campaigns...\n');

    // Read migration SQL file
    const sqlPath = path.join(__dirname, '..', 'database', 'migrations', '025_multi_channel_activation_campaigns.sql');

    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration file not found at: ${sqlPath}`);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute SQL
    await pool.query(sql);

    console.log('✅ Migration 025 completed successfully!\n');
    console.log('📊 Changes applied:');
    console.log('   ✓ Added email_agent_id column');
    console.log('   ✓ Added whatsapp_agent_id column');
    console.log('   ✓ Added linkedin_agent_id column');
    console.log('   ✓ Added activate_email flag');
    console.log('   ✓ Added activate_whatsapp flag');
    console.log('   ✓ Added activate_linkedin flag');
    console.log('   ✓ Migrated existing campaigns to new structure');
    console.log('   ✓ Removed old agent_id column');
    console.log('   ✓ Removed old activation_type column');

    console.log('\n🔧 Features:');
    console.log('   ✓ Support for multiple agents (one per channel)');
    console.log('   ✓ Simultaneous activation via Email, WhatsApp, and LinkedIn');
    console.log('   ✓ At least one channel required per campaign');
    console.log('   ✓ Track which channel was used for each contact');

    console.log('\n🎯 Multi-channel activation campaigns are now ready!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Full error:', error);

    if (error.code === 'ECONNREFUSED') {
      console.log('\n🔧 Connection failed. Please check:');
      console.log('   - PostgreSQL is running');
      console.log('   - Database connection settings in .env');
      console.log('   - Database exists');
    } else if (error.code === '42P07') {
      console.log('\n⚠️  Columns already exist. This is normal if migration was run before.');
      console.log('   If you need to reset, drop the columns first.');
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
  console.log('\n🚀 GetRaze - Migration 025: Multi-Channel Activation Campaigns\n');
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
