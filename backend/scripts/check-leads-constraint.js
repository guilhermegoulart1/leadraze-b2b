// backend/scripts/check-leads-constraint.js
require('dotenv').config();
const db = require('../src/config/database');

async function checkConstraint() {
  try {
    const result = await db.query(`
      SELECT
        con.conname AS constraint_name,
        pg_get_constraintdef(con.oid) AS constraint_definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'leads' AND con.contype = 'c';
    `);

    console.log('📋 Constraints na tabela leads:\n');
    result.rows.forEach(row => {
      console.log(`${row.constraint_name}:`);
      console.log(`  ${row.constraint_definition}\n`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

checkConstraint();
