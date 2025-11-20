const { Pool } = require('pg');

const pool = new Pool({
  host: 'db.epikyczksznhjggzjjgg.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'W5o6k6y0@@',
  ssl: { rejectUnauthorized: false }
});

async function checkParaguayCampaign() {
  try {
    console.log('\n🔍 INVESTIGANDO CAMPANHAS DO PARAGUAI...\n');

    // Buscar todas as campanhas com "paraguay" no nome
    const campaigns = await pool.query(`
      SELECT
        id,
        name,
        status,
        user_id,
        target_location,
        target_language,
        message_template,
        total_leads,
        leads_pending,
        leads_sent,
        created_at,
        started_at,
        completed_at
      FROM campaigns
      WHERE LOWER(name) LIKE '%paraguay%' OR LOWER(target_location) LIKE '%paraguay%'
      ORDER BY created_at DESC
    `);

    if (campaigns.rows.length === 0) {
      console.log('❌ Nenhuma campanha encontrada com "Paraguay" no nome ou localização');

      // Mostrar todas as campanhas recentes
      console.log('\n📋 Campanhas mais recentes:');
      const recentCampaigns = await pool.query(`
        SELECT
          id,
          name,
          status,
          target_location,
          target_language,
          total_leads,
          created_at
        FROM campaigns
        ORDER BY created_at DESC
        LIMIT 10
      `);

      recentCampaigns.rows.forEach((campaign, idx) => {
        console.log(`\n${idx + 1}. ${campaign.name}`);
        console.log(`   ID: ${campaign.id}`);
        console.log(`   Status: ${campaign.status}`);
        console.log(`   Localização: ${campaign.target_location || 'N/A'}`);
        console.log(`   Idioma: ${campaign.target_language || 'N/A'}`);
        console.log(`   Total leads: ${campaign.total_leads}`);
        console.log(`   Criada em: ${campaign.created_at}`);
      });
    } else {
      console.log(`✅ Encontradas ${campaigns.rows.length} campanha(s) do Paraguay:\n`);

      for (const campaign of campaigns.rows) {
        console.log('='.repeat(80));
        console.log(`📦 CAMPANHA: ${campaign.name}`);
        console.log('='.repeat(80));
        console.log(`ID: ${campaign.id}`);
        console.log(`Status: ${campaign.status}`);
        console.log(`Localização alvo: ${campaign.target_location || 'N/A'}`);
        console.log(`Idioma alvo: ${campaign.target_language || 'N/A'}`);
        console.log(`Total de leads: ${campaign.total_leads}`);
        console.log(`Leads pendentes: ${campaign.leads_pending}`);
        console.log(`Leads enviados: ${campaign.leads_sent}`);
        console.log(`Criada em: ${campaign.created_at}`);
        console.log(`Iniciada em: ${campaign.started_at || 'Não iniciada'}`);
        console.log(`Completada em: ${campaign.completed_at || 'Não completada'}`);

        // Verificar mensagem template
        console.log(`\n📝 MENSAGEM TEMPLATE:`);
        if (campaign.message_template) {
          console.log(`"${campaign.message_template}"`);
        } else {
          console.log('(Nenhuma mensagem configurada)');
        }

        // Buscar leads dessa campanha
        const leads = await pool.query(`
          SELECT
            id,
            name,
            status,
            location,
            sent_at,
            accepted_at,
            created_at
          FROM leads
          WHERE campaign_id = $1
          ORDER BY created_at DESC
        `, [campaign.id]);

        console.log(`\n📊 LEADS (Total: ${leads.rows.length}):`);
        if (leads.rows.length === 0) {
          console.log('   ⚠️ Nenhum lead coletado para esta campanha!');
        } else {
          const statusDistribution = {};
          leads.rows.forEach(lead => {
            statusDistribution[lead.status] = (statusDistribution[lead.status] || 0) + 1;
          });

          console.log('\n   Distribuição por status:');
          Object.entries(statusDistribution).forEach(([status, count]) => {
            console.log(`     ${status}: ${count}`);
          });

          console.log('\n   Primeiros 10 leads:');
          leads.rows.slice(0, 10).forEach((lead, idx) => {
            console.log(`     ${idx + 1}. [${lead.status}] ${lead.name} - ${lead.location || 'N/A'}`);
            if (lead.sent_at) {
              console.log(`        Enviado em: ${lead.sent_at}`);
            }
          });
        }

        // Verificar bulk jobs relacionados
        const bulkJobs = await pool.query(`
          SELECT
            id,
            status,
            total_leads,
            processed_leads,
            sent_count,
            failed_count,
            created_at,
            started_at,
            completed_at,
            error
          FROM bulk_collection_jobs
          WHERE campaign_id = $1
          ORDER BY created_at DESC
        `, [campaign.id]);

        console.log(`\n🔧 BULK JOBS (Total: ${bulkJobs.rows.length}):`);
        if (bulkJobs.rows.length === 0) {
          console.log('   ⚠️ Nenhum bulk job encontrado!');
        } else {
          bulkJobs.rows.forEach((job, idx) => {
            console.log(`\n   Job ${idx + 1}:`);
            console.log(`     ID: ${job.id}`);
            console.log(`     Status: ${job.status}`);
            console.log(`     Total leads: ${job.total_leads}`);
            console.log(`     Processados: ${job.processed_leads}`);
            console.log(`     Enviados: ${job.sent_count}`);
            console.log(`     Falhas: ${job.failed_count}`);
            console.log(`     Criado em: ${job.created_at}`);
            console.log(`     Iniciado em: ${job.started_at || 'Não iniciado'}`);
            console.log(`     Completado em: ${job.completed_at || 'Não completado'}`);
            if (job.error) {
              console.log(`     ❌ Erro: ${job.error}`);
            }
          });
        }

        console.log('\n');
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkParaguayCampaign();
