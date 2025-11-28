// backend/scripts/run-migration-035.js
// Rodar: node scripts/run-migration-035.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/config/database');
const fs = require('fs');

async function runMigration() {
  console.log('🔧 Executando migration de AI credits...\n');

  try {
    // Ler o arquivo SQL da migration
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '035_add_ai_credits_system.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Arquivo: 035_add_ai_credits_system.sql');
    console.log('🔄 Executando...\n');

    // Executar a migration
    await db.query(sql);

    console.log('✅ Migration executada com sucesso!');
    console.log('\n📋 Alterações:');
    console.log('   - credit_type column added to credit_packages');
    console.log('   - monthly_ai_credits column added to subscriptions');
    console.log('   - get_available_ai_credits() function created');
    console.log('   - consume_ai_credits() function created');
    console.log('   - account_ai_credits_summary view created');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error.message);
    console.error('\nDetalhes:', error);
    process.exit(1);
  }
}

runMigration();
