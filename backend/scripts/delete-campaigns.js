// backend/scripts/delete-campaigns.js
const db = require('../src/config/database');

async function deleteCampaigns() {
  try {
    console.log('🗑️  Deletando campanhas do banco...\n');

    // Listar campanhas primeiro
    const campaigns = await db.query('SELECT id, name, status FROM campaigns ORDER BY created_at DESC');
    console.log(`📋 Encontradas ${campaigns.rows.length} campanhas:`);
    campaigns.rows.forEach(c => console.log(`  - ${c.name} (${c.status})`));

    console.log('\n🚀 Iniciando limpeza...');

    // Deletar bulk jobs
    const jobsResult = await db.query('DELETE FROM bulk_collection_jobs RETURNING id');
    console.log(`✅ ${jobsResult.rowCount} bulk collection jobs deletados`);

    // Deletar leads
    const leadsResult = await db.query('DELETE FROM leads RETURNING id');
    console.log(`✅ ${leadsResult.rowCount} leads deletados`);

    // Deletar campanhas
    const campaignsResult = await db.query('DELETE FROM campaigns RETURNING id');
    console.log(`✅ ${campaignsResult.rowCount} campanhas deletadas`);

    console.log('\n🎉 Todas as campanhas foram removidas do banco!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

deleteCampaigns();
