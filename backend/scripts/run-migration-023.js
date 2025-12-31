// backend/scripts/run-migration-023.js
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
    console.log('🔄 Running Migration 023: List Activation System...\n');

    // Read migration SQL file
    const sqlPath = path.join(__dirname, '..', 'database', 'migrations', '023_create_list_activation_system.sql');

    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration file not found at: ${sqlPath}`);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute SQL
    await pool.query(sql);

    console.log('✅ Migration 023 completed successfully!\n');
    console.log('📊 Tables created:');
    console.log('   ✓ activation_agents');
    console.log('   ✓ contact_lists');
    console.log('   ✓ contact_list_items');
    console.log('   ✓ activation_campaigns');
    console.log('   ✓ activation_campaign_contacts');

    console.log('\n🔧 Triggers created:');
    console.log('   ✓ update_updated_at_column (all tables)');
    console.log('   ✓ update_contact_list_count');
    console.log('   ✓ update_activation_campaign_stats');

    console.log('\n🔐 Permissions created:');
    console.log('   ✓ activation-agents:* (view, create, update, delete)');
    console.log('   ✓ contact-lists:* (view, create, update, delete, import, export)');
    console.log('   ✓ activation-campaigns:* (view, create, update, delete, start, stop)');

    console.log('\n🎯 System ready for:');
    console.log('   - Creating activation agents for Email, WhatsApp, and LinkedIn');
    console.log('   - Managing contact lists with CSV import');
    console.log('   - Running automated activation campaigns');

    console.log('\n🚀 List Activation System is ready!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Full error:', error);

    if (error.code === 'ECONNREFUSED') {
      console.log('\n🔧 Connection failed. Please check:');
      console.log('   - PostgreSQL is running');
      console.log('   - Database connection settings in .env');
      console.log('   - Database exists');
    } else if (error.code === '42P07') {
      console.log('\n⚠️  Tables already exist. This is normal if migration was run before.');
      console.log('   If you need to reset, drop the tables first.');
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
  console.log('\n🚀 GetRaze - Migration 023: List Activation System\n');
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
