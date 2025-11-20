const { Pool } = require('pg');

const pool = new Pool({
  host: 'db.epikyczksznhjggzjjgg.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'W5o6k6y0@@',
  ssl: { rejectUnauthorized: false }
});

async function checkParaguay() {
  try {
    console.log('\n🔍 INVESTIGANDO CAMPANHAS DO PARAGUAI...\n');

    // Buscar todas as campanhas recentes
    const campaigns = await pool.query(`
      SELECT
        id,
        name,
        status,
        description,
        total_leads,
        leads_pending,
        leads_sent,
        created_at
      FROM campaigns
      ORDER BY created_at DESC
      LIMIT 20
    `);

    console.log(`📋 Últimas ${campaigns.rows.length} campanhas:\n`);

    for (const campaign of campaigns.rows) {
      const isParaguay = campaign.name?.toLowerCase().includes('paraguay') ||
                         campaign.name?.toLowerCase().includes('paraguai');

      console.log('─'.repeat(80));
      console.log(`${isParaguay ? '🇵🇾 ' : '📦 '}${campaign.name}`);
      console.log('─'.repeat(80));
      console.log(`ID: ${campaign.id}`);
      console.log(`Status: ${campaign.status}`);
      console.log(`Descrição: ${campaign.description || 'N/A'}`);
      console.log(`Total de leads: ${campaign.total_leads}`);
      console.log(`Leads pendentes: ${campaign.leads_pending}`);
      console.log(`Leads enviados: ${campaign.leads_sent}`);
      console.log(`Criada em: ${campaign.created_at}`);

      // Buscar leads dessa campanha
      const leads = await pool.query(`
        SELECT
          id,
          name,
          status,
          location,
          sent_at,
          created_at
        FROM leads
        WHERE campaign_id = $1
        ORDER BY created_at DESC
        LIMIT 10
      `, [campaign.id]);

      console.log(`\n📊 Leads: ${leads.rows.length} (mostrando até 10)`);

      if (leads.rows.length > 0) {
        const statusCount = {};
        const allLeadsResult = await pool.query(`
          SELECT status, COUNT(*) as count
          FROM leads
          WHERE campaign_id = $1
          GROUP BY status
        `, [campaign.id]);

        console.log('\nDistribuição por status:');
        allLeadsResult.rows.forEach(row => {
          console.log(`  ${row.status}: ${row.count}`);
        });

        console.log('\nPrimeiros leads:');
        leads.rows.forEach((lead, idx) => {
          console.log(`  ${idx + 1}. [${lead.status}] ${lead.name} - ${lead.location || 'N/A'}`);
        });
      }

      // Buscar bulk jobs
      const jobs = await pool.query(`
        SELECT
          id,
          status,
          target_count,
          collected_count,
          error_count,
          error_message,
          search_filters,
          created_at,
          started_at,
          completed_at
        FROM bulk_collection_jobs
        WHERE campaign_id = $1
        ORDER BY created_at DESC
        LIMIT 3
      `, [campaign.id]);

      if (jobs.rows.length > 0) {
        console.log(`\n🔧 Bulk Jobs (${jobs.rows.length}):`);
        jobs.rows.forEach((job, idx) => {
          console.log(`  ${idx + 1}. Status: ${job.status}`);
          console.log(`     Target: ${job.target_count}, Coletados: ${job.collected_count}, Erros: ${job.error_count}`);
          console.log(`     Criado: ${job.created_at}`);
          console.log(`     Iniciado: ${job.started_at || 'N/A'}`);
          console.log(`     Completado: ${job.completed_at || 'N/A'}`);
          if (job.search_filters) {
            console.log(`     Filtros: ${JSON.stringify(job.search_filters)}`);
          }
          if (job.error_message) {
            console.log(`     ❌ Erro: ${job.error_message}`);
          }
        });
      }

      console.log('\n');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkParaguay();
