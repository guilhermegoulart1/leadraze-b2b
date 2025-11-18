// backend/scripts/check-bulk-jobs-table.js
require('dotenv').config();
const { pool } = require('../src/config/database');

async function checkColumns() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'bulk_collection_jobs'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Colunas da tabela bulk_collection_jobs:\n');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}) ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

checkColumns();
