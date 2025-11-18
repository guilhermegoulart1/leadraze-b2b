// Fix lead status from 'lead' to 'leads'
const { Pool } = require('pg');

const pool = new Pool({
  host: 'db.epikyczksznhjggzjjgg.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'W5o6k6y0@@',
  ssl: { rejectUnauthorized: false }
});

async function fix() {
  try {
    console.log('\n🔧 Corrigindo status dos leads...\n');

    // Update leads with status='lead' to 'leads'
    const result = await pool.query(
      "UPDATE leads SET status = 'leads' WHERE status = 'lead' RETURNING id"
    );

    console.log(`✅ ${result.rowCount} leads atualizados de 'lead' para 'leads'\n`);

    // Verify
    const verify = await pool.query(
      "SELECT status, COUNT(*) as count FROM leads GROUP BY status"
    );

    console.log('📊 Status dos leads após correção:');
    verify.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.count} leads`);
    });

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    await pool.end();
    process.exit(1);
  }
}

fix();
