// backend/scripts/migrate.js
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

async function runMigrations() {
  try {
    console.log('🔄 Starting database migrations...\n');

    // Read SQL schema file
    const sqlPath = path.join(__dirname, '..', 'database', 'schema.sql');
    
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Schema file not found at: ${sqlPath}`);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute SQL
    await pool.query(sql);

    console.log('\n✅ Database migrations completed successfully!');
    console.log('\n📊 Tables created:');
    console.log('   ✓ users');
    console.log('   ✓ linkedin_accounts');
    console.log('   ✓ ai_agents');
    console.log('   ✓ campaigns');
    console.log('   ✓ leads');
    console.log('   ✓ conversations');
    console.log('   ✓ messages');
    console.log('   ✓ webhook_logs');
    console.log('   ✓ activity_logs');
    console.log('   ✓ daily_analytics');

    console.log('\n🎯 Pipeline stages configured:');
    console.log('   leads → invite_sent → accepted → qualifying → qualified');

    console.log('\n🚀 Database is ready! You can now start the server with: npm run dev\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n🔧 Connection failed. Please check:');
      console.log('   - PostgreSQL is running');
      console.log('   - Database connection settings in .env');
      console.log('   - Database exists (CREATE DATABASE leadraze;)');
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
  console.log('\n🚀 LeadRaze - Database Setup\n');
  console.log('========================================\n');

  // Test connection first
  const connectionOk = await testConnection();
  
  if (!connectionOk) {
    console.log('\n📋 To fix connection issues:');
    console.log('1. Make sure PostgreSQL is installed and running');
    console.log('2. Create database: CREATE DATABASE leadraze;');
    console.log('3. Check your .env file settings\n');
    process.exit(1);
  }

  // Run migrations
  await runMigrations();
}

if (require.main === module) {
  main();
}

module.exports = { runMigrations, testConnection };