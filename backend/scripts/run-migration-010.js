// backend/scripts/run-migration-010.js
require('dotenv').config();
const db = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🔧 Executando migration 010 - Adicionar status closed...\n');

  try {
    // Ler o arquivo SQL da migration
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '010_add_closed_status_to_conversations.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Arquivo: 010_add_closed_status_to_conversations.sql');
    console.log('🔄 Executando...\n');

    // Executar a migration
    await db.query(sql);

    console.log('✅ Migration executada com sucesso!');
    console.log('\n📋 Alterações realizadas:');
    console.log('   - Adicionada coluna closed_at');
    console.log('   - Status constraint atualizado para incluir "closed"');
    console.log('   - Índice criado em closed_at');
    console.log('\n🚀 O sistema agora suporta conversas fechadas!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error.message);
    console.error('\nDetalhes:', error);
    process.exit(1);
  }
}

runMigration();
