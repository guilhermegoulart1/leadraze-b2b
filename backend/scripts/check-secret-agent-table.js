/**
 * Check secret_agent_briefings table columns
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkTable() {
  console.log('=== SECRET AGENT BRIEFINGS TABLE COLUMNS ===\n');

  try {
    const result = await pool.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'secret_agent_briefings'
       ORDER BY ordinal_position`
    );

    if (result.rows.length === 0) {
      console.log('Table does not exist or has no columns!');
    } else {
      for (const row of result.rows) {
        console.log(`${row.column_name}: ${row.data_type}`);
      }
    }

    // Check for specific columns we need
    const columns = result.rows.map(r => r.column_name);
    console.log('\n=== COLUMN CHECK ===');
    const required = ['company_data', 'people_data', 'connections_data', 'market_data', 'media_data'];
    for (const col of required) {
      console.log(`${col}: ${columns.includes(col) ? '✅' : '❌ MISSING'}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  await pool.end();
}

checkTable();
