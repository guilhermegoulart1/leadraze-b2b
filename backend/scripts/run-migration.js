// backend/scripts/run-migration.js
require('dotenv').config();
const db = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🔧 Executando migration de conversas...\n');

  try {
    // Ler o arquivo SQL da migration
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '002_update_conversations_table.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Arquivo: 002_update_conversations_table.sql');
    console.log('🔄 Executando...\n');

    // Executar a migration
    await db.query(sql);

    console.log('✅ Migration executada com sucesso!');
    console.log('\n📋 Colunas adicionadas:');
    console.log('   - campaign_id');
    console.log('   - linkedin_account_id');
    console.log('   - ai_paused_at');
    console.log('   - last_message_preview');
    console.log('   - unread_count');
    console.log('\n✅ Constraints e índices atualizados');
    console.log('\n🚀 Agora você pode rodar: node scripts/seed-mock-conversations.js');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error.message);
    console.error('\nDetalhes:', error);
    process.exit(1);
  }
}

runMigration();
