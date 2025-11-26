// Script to check existing lead status values
const { Pool } = require('pg');

const pool = new Pool({
  host: 'db.epikyczksznhjggzjjgg.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'W5o6k6y0@@',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    console.log('\n🔍 Verificando status existentes na tabela leads...\n');

    const result = await pool.query('SELECT DISTINCT status, COUNT(*) as count FROM leads GROUP BY status ORDER BY count DESC');
    console.log('Status existentes na tabela leads:');
    result.rows.forEach(row => {
      console.log(`  - "${row.status}": ${row.count} leads`);
    });

    // Also check current constraint
    console.log('\n📋 Verificando constraint atual...\n');
    const constraintResult = await pool.query(`
      SELECT
        conname as constraint_name,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'leads'::regclass
      AND conname LIKE '%status%'
    `);

    if (constraintResult.rows.length > 0) {
      constraintResult.rows.forEach(row => {
        console.log(`Constraint: ${row.constraint_name}`);
        console.log(`Definição: ${row.definition}\n`);
      });
    }

    await pool.end();
    process.exit(0);
  } catch (e) {
    console.error('Erro:', e.message);
    await pool.end();
    process.exit(1);
  }
}

check();
