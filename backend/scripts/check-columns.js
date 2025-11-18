// backend/scripts/check-columns.js
require('dotenv').config();
const { pool } = require('../src/config/database');

async function checkColumns() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'ai_agents'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Colunas da tabela ai_agents:\n');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

checkColumns();
