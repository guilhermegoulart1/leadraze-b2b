// backend/scripts/run-migration-003.js
require('dotenv').config();
const db = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🔧 Executando migration 003 - Add is_system to campaigns...\n');

  try {
    // Ler o arquivo SQL da migration
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '003_add_is_system_to_campaigns.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Arquivo: 003_add_is_system_to_campaigns.sql');
    console.log('🔄 Executando...\n');

    // Executar a migration
    await db.query(sql);

    console.log('✅ Migration executada com sucesso!');
    console.log('\n📋 Mudanças:');
    console.log('   - Coluna is_system adicionada à tabela campaigns');
    console.log('   - Campanhas "Organic Conversations" marcadas como is_system = true');
    console.log('   - Índice criado para melhor performance');
    console.log('\n✅ Agora campanhas do sistema não aparecerão na lista de campanhas');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error.message);
    console.error('\nDetalhes:', error);
    process.exit(1);
  }
}

runMigration();
