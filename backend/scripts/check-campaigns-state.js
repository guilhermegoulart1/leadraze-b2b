// backend/scripts/check-campaigns-state.js
const db = require('../src/config/database');

async function checkCampaignsState() {
  try {
    console.log('🔍 Verificando estado das campanhas...\n');

    // Listar campanhas
    const campaigns = await db.query(`
      SELECT id, name, status, search_filters, created_at
      FROM campaigns
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log(`📋 Encontradas ${campaigns.rows.length} campanhas:\n`);

    campaigns.rows.forEach((c, index) => {
      console.log(`${index + 1}. ${c.name}`);
      console.log(`   ID: ${c.id}`);
      console.log(`   Status: ${c.status}`);
      console.log(`   Criada em: ${new Date(c.created_at).toLocaleString('pt-BR')}`);

      // Parse search_filters
      let filters;
      try {
        filters = typeof c.search_filters === 'string'
          ? JSON.parse(c.search_filters)
          : c.search_filters;
      } catch (e) {
        console.log(`   ❌ Erro ao fazer parse dos filtros: ${e.message}`);
        filters = null;
      }

      if (filters && filters.location) {
        const locationType = typeof filters.location;
        const locationValue = Array.isArray(filters.location) ? filters.location : [filters.location];

        console.log(`   Location Type: ${locationType}`);
        console.log(`   Location Values:`, locationValue);

        // Verificar se é array de números (IDs) ou strings
        const isStringLocation = locationValue.some(loc => typeof loc === 'string' && isNaN(loc));
        if (isStringLocation) {
          console.log(`   ⚠️  CAMPANHA ANTIGA - Location como STRING (pré-autocomplete)`);
        } else {
          console.log(`   ✅ CAMPANHA NOVA - Location como ID`);
        }
      } else {
        console.log(`   ⚠️  Sem location definida`);
      }

      console.log('');
    });

    // Verificar jobs de coleta
    const jobs = await db.query(`
      SELECT id, campaign_id, status, error_message, created_at
      FROM bulk_collection_jobs
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log(`\n📊 Últimos ${jobs.rows.length} jobs de coleta:\n`);

    jobs.rows.forEach((job, index) => {
      console.log(`${index + 1}. Job ${job.id.substring(0, 8)}...`);
      console.log(`   Campaign ID: ${job.campaign_id}`);
      console.log(`   Status: ${job.status}`);
      if (job.error_message) {
        console.log(`   Erro: ${job.error_message.substring(0, 100)}...`);
      }
      console.log(`   Criado em: ${new Date(job.created_at).toLocaleString('pt-BR')}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

checkCampaignsState();
