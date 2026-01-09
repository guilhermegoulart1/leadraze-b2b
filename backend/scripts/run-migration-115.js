// backend/scripts/run-migration-115.js
require('dotenv').config();
const db = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('⚠️  ATENÇÃO: Reset completo de dados\n');
  console.log('========================================\n');
  console.log('Esta migration irá DELETAR:');
  console.log('   - Todas as oportunidades e histórico');
  console.log('   - Todos os leads (tabela antiga)');
  console.log('   - Todas as conversas e mensagens');
  console.log('   - Todos os contatos');
  console.log('   - Todas as notificações');
  console.log('   - Filas de convites');
  console.log('   - Tasks');
  console.log('\nSerão MANTIDOS:');
  console.log('   - Usuários e contas');
  console.log('   - Pipelines e stages');
  console.log('   - Projetos CRM');
  console.log('   - Campanhas (contadores zerados)');
  console.log('   - Tags (definições)');
  console.log('   - Setores');
  console.log('   - Contas LinkedIn');
  console.log('\n========================================\n');
  console.log('🔄 Executando migration 115...\n');

  try {
    // Ler o arquivo SQL da migration
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '115_reset_all_data.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Arquivo: 115_reset_all_data.sql');
    console.log('🔄 Executando...\n');

    // Executar a migration
    await db.query(sql);

    console.log('✅ Reset completo realizado com sucesso!');
    console.log('\n🚀 Sistema pronto para começar do zero!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error.message);
    console.error('\nDetalhes:', error);
    process.exit(1);
  }
}

runMigration();
