// Fix status constraint to match LEAD_STATUS constants
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
    console.log('\n🔧 Corrigindo constraint de status...\n');

    // 1. Drop old constraint
    await pool.query('ALTER TABLE leads DROP CONSTRAINT IF EXISTS check_status');
    console.log('✅ Constraint antiga removida');

    // 2. Update existing data 'lead' -> 'leads'
    const updateResult = await pool.query(
      "UPDATE leads SET status = 'leads' WHERE status = 'lead'"
    );
    console.log(`✅ ${updateResult.rowCount} leads atualizados de 'lead' para 'leads'`);

    // 3. Create new constraint matching LEAD_STATUS
    await pool.query(`
      ALTER TABLE leads ADD CONSTRAINT check_status
      CHECK (status IN ('leads', 'invite_sent', 'accepted', 'qualifying', 'qualified', 'discarded'))
    `);
    console.log('✅ Nova constraint criada com valores corretos');

    // 4. Verify
    const verify = await pool.query(
      "SELECT status, COUNT(*) as count FROM leads GROUP BY status ORDER BY status"
    );

    console.log('\n📊 Status dos leads após correção:');
    verify.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.count} leads`);
    });

    console.log('\n🎉 Constraint corrigida com sucesso!\n');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

fix();
