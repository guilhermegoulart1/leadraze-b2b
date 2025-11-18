// backend/scripts/check-tables.js
require('dotenv').config();
const { pool } = require('../src/config/database');

async function checkTables() {
  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('\n📋 Tabelas no banco:\n');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables();
