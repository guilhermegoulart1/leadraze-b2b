// Fix campaigns that were auto-activated during collection
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
    console.log('\n🔧 Corrigindo campanhas auto-ativadas...\n');

    // Find campaigns that are 'active' but should be in review
    // (have completed collection jobs but automation hasn't started)
    const campaignsToFix = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.status,
        bcj.status as job_status,
        bcj.collected_count
      FROM campaigns c
      INNER JOIN bulk_collection_jobs bcj ON c.id = bcj.campaign_id
      WHERE c.status = 'active'
        AND bcj.status = 'completed'
        AND (c.automation_active IS NULL OR c.automation_active = false)
      ORDER BY c.created_at DESC
    `);

    if (campaignsToFix.rows.length === 0) {
      console.log('✅ Nenhuma campanha precisa ser corrigida\n');
      await pool.end();
      process.exit(0);
      return;
    }

    console.log(`📋 Encontradas ${campaignsToFix.rows.length} campanhas para corrigir:\n`);
    campaignsToFix.rows.forEach(row => {
      console.log(`  • ${row.name}`);
      console.log(`    ID: ${row.id}`);
      console.log(`    Leads coletados: ${row.collected_count}`);
      console.log('');
    });

    // Update campaigns back to draft
    const result = await pool.query(`
      UPDATE campaigns c
      SET status = 'draft'
      FROM bulk_collection_jobs bcj
      WHERE c.id = bcj.campaign_id
        AND c.status = 'active'
        AND bcj.status = 'completed'
        AND (c.automation_active IS NULL OR c.automation_active = false)
    `);

    console.log(`✅ ${result.rowCount} campanhas voltaram para status 'draft'\n`);
    console.log('💡 Agora o usuário pode revisar os leads e ativar manualmente\n');

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
