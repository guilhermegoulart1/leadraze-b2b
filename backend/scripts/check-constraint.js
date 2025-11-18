// Check the constraint definition
const { Pool } = require('pg');

const pool = new Pool({
  host: 'db.epikyczksznhjggzjjgg.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'W5o6k6y0@@',
  ssl: { rejectUnauthorized: false }
});

async function checkConstraint() {
  try {
    console.log('\n🔍 Verificando constraint do campo status...\n');

    const result = await pool.query(`
      SELECT
        conname as constraint_name,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'leads'::regclass
      AND conname LIKE '%status%'
    `);

    if (result.rows.length === 0) {
      console.log('❌ Nenhuma constraint de status encontrada');
    } else {
      result.rows.forEach(row => {
        console.log(`📋 Constraint: ${row.constraint_name}`);
        console.log(`📄 Definição: ${row.definition}\n`);
      });
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkConstraint();
