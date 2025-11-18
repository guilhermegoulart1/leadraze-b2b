// Quick database check
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
    const campaignId = '3a82c07f-1e4c-4a2b-9387-e328f98f1c9b';

    console.log('\n🔍 Verificando leads no banco...\n');

    // Count all leads for this campaign
    const result = await pool.query(
      'SELECT status, COUNT(*) as count FROM leads WHERE campaign_id = $1 GROUP BY status',
      [campaignId]
    );

    if (result.rows.length === 0) {
      console.log('❌ NENHUM LEAD ENCONTRADO para esta campanha!');
    } else {
      console.log('✅ Leads encontrados:');
      result.rows.forEach(row => {
        console.log(`   ${row.status}: ${row.count} leads`);
      });

      const total = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
      console.log(`\n📊 TOTAL: ${total} leads\n`);
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

check();
