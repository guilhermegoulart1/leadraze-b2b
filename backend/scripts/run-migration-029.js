// Run migration 029 - Update lead status constraint
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: 'db.epikyczksznhjggzjjgg.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'W5o6k6y0@@',
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('\n🔧 Executando migration 029...\n');

    const migrationPath = path.join(__dirname, '../database/migrations/029_add_accepted_status_to_leads.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 SQL a ser executado:');
    console.log(sql);
    console.log('\n🔄 Executando...\n');

    await pool.query(sql);

    console.log('✅ Migration 029 executada com sucesso!');

    // Verify the new constraint
    console.log('\n📋 Verificando nova constraint...\n');
    const result = await pool.query(`
      SELECT
        conname as constraint_name,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'leads'::regclass
      AND conname LIKE '%status%'
    `);

    result.rows.forEach(row => {
      console.log(`Constraint: ${row.constraint_name}`);
      console.log(`Definição: ${row.definition}\n`);
    });

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
