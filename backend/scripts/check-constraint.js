// Check the constraint definition
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'getraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function checkConstraint() {
  try {
    console.log('\n🔍 Verificando constraint credit_type...\n');

    const result = await pool.query(`
      SELECT
        conname as constraint_name,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'credit_packages'::regclass
      AND conname LIKE '%credit_type%'
    `);

    if (result.rows.length === 0) {
      console.log('❌ Nenhuma constraint de credit_type encontrada');
    } else {
      result.rows.forEach(row => {
        console.log(`📋 Constraint: ${row.constraint_name}`);
        console.log(`📄 Definição: ${row.definition}\n`);
      });
    }

    // Check existing types
    const types = await pool.query(`
      SELECT DISTINCT credit_type FROM credit_packages
    `);
    console.log('Tipos existentes:', types.rows.map(r => r.credit_type));

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkConstraint();
