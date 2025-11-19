const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/config/database');
const { enrichLead } = require('../src/services/leadEnrichmentService');

async function testEnrichment() {
  try {
    console.log('\n🧪 === TESTE DE ENRIQUECIMENTO DE LEAD ===\n');

    // Buscar um lead para testar
    const result = await db.query(`
      SELECT l.id, l.name, l.title, l.provider_id, l.full_profile_fetched_at
      FROM leads l
      WHERE l.provider_id IS NOT NULL
      ORDER BY l.created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('❌ Nenhum lead encontrado para testar');
      process.exit(1);
    }

    const lead = result.rows[0];
    console.log('📋 Lead selecionado para teste:');
    console.log(`  ID: ${lead.id}`);
    console.log(`  Nome: ${lead.name}`);
    console.log(`  Título: ${lead.title}`);
    console.log(`  Provider ID: ${lead.provider_id}`);
    console.log(`  Já enriquecido: ${lead.full_profile_fetched_at ? 'Sim' : 'Não'}\n`);

    // Enriquecer o lead
    const enrichedLead = await enrichLead(lead.id);

    console.log('\n✅ Teste concluído com sucesso!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erro no teste:', error.message);
    process.exit(1);
  }
}

testEnrichment();
