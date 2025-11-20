const { Pool } = require('pg');

const pool = new Pool({
  host: 'db.epikyczksznhjggzjjgg.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'W5o6k6y0@@',
  ssl: { rejectUnauthorized: false }
});

async function searchParaguay() {
  try {
    console.log('\n🔍 PROCURANDO CAMPANHA DO PARAGUAI...\n');

    // Buscar por "paraguay" ou "paraguai" em qualquer parte do nome
    const result = await pool.query(`
      SELECT
        id,
        name,
        status,
        description,
        total_leads,
        created_at
      FROM campaigns
      WHERE
        LOWER(name) LIKE '%paraguay%'
        OR LOWER(name) LIKE '%paraguai%'
        OR LOWER(description) LIKE '%paraguay%'
        OR LOWER(description) LIKE '%paraguai%'
      ORDER BY created_at DESC
    `);

    if (result.rows.length === 0) {
      console.log('❌ Nenhuma campanha do Paraguai encontrada!');
      console.log('\n📋 Listando TODAS as campanhas:');

      const allCampaigns = await pool.query(`
        SELECT
          id,
          name,
          status,
          description,
          total_leads,
          created_at
        FROM campaigns
        ORDER BY created_at DESC
      `);

      allCampaigns.rows.forEach((campaign, idx) => {
        console.log(`\n${idx + 1}. ${campaign.name}`);
        console.log(`   Status: ${campaign.status}`);
        console.log(`   Descrição: ${campaign.description || 'N/A'}`);
        console.log(`   Total leads: ${campaign.total_leads}`);
        console.log(`   Criada em: ${campaign.created_at}`);
      });
    } else {
      console.log(`✅ Encontradas ${result.rows.length} campanha(s):
`);

      for (const campaign of result.rows) {
        console.log('='.repeat(80));
        console.log(`🇵🇾 ${campaign.name}`);
        console.log('='.repeat(80));
        console.log(`ID: ${campaign.id}`);
        console.log(`Status: ${campaign.status}`);
        console.log(`Descrição: ${campaign.description || 'N/A'}`);
        console.log(`Total leads: ${campaign.total_leads}`);
        console.log(`Criada em: ${campaign.created_at}\n`);

        // Verificar bulk jobs
        const jobs = await pool.query(`
          SELECT *
          FROM bulk_collection_jobs
          WHERE campaign_id = $1
          ORDER BY created_at DESC
        `, [campaign.id]);

        console.log(`Bulk Jobs: ${jobs.rows.length}`);
        if (jobs.rows.length > 0) {
          jobs.rows.forEach((job, idx) => {
            console.log(`\n  Job ${idx + 1}:`);
            console.log(`    Status: ${job.status}`);
            console.log(`    Target: ${job.target_count}, Coletados: ${job.collected_count}`);
            console.log(`    Filtros: ${JSON.stringify(job.search_filters, null, 2)}`);
            if (job.error_message) {
              console.log(`    ❌ Erro: ${job.error_message}`);
            }
          });
        }

        // Verificar leads
        const leads = await pool.query(`
          SELECT COUNT(*) as count
          FROM leads
          WHERE campaign_id = $1
        `, [campaign.id]);

        console.log(`\nLeads coletados: ${leads.rows[0].count}`);
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

searchParaguay();
