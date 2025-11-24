// Test database connection
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

console.log('🔍 Testing database connection...\n');

console.log('Environment variables:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? `${process.env.DB_PASSWORD.substring(0, 2)}***${process.env.DB_PASSWORD.substring(process.env.DB_PASSWORD.length - 2)}` : 'undefined');
console.log('DB_PASSWORD type:', typeof process.env.DB_PASSWORD);
console.log('DB_PASSWORD length:', process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 0);
console.log('');

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function testConnection() {
  try {
    console.log('Attempting connection...\n');
    const result = await pool.query('SELECT NOW() as now, current_database() as database, current_user as user');
    console.log('✅ Connection successful!\n');
    console.log('Database:', result.rows[0].database);
    console.log('User:', result.rows[0].user);
    console.log('Server time:', result.rows[0].now);

    // Test campaigns table
    console.log('\nTesting campaigns table...');
    const campaignsResult = await pool.query('SELECT COUNT(*) as count FROM campaigns');
    console.log('Total campaigns:', campaignsResult.rows[0].count);

  } catch (error) {
    console.error('❌ Connection failed!\n');
    console.error('Error:', error.message);
    console.error('\nError details:');
    console.error('Code:', error.code);
    console.error('Detail:', error.detail);
    console.error('\nFull error:', error);
  } finally {
    await pool.end();
    process.exit();
  }
}

testConnection();
