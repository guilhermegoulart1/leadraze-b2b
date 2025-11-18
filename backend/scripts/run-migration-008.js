// backend/scripts/run-migration-008.js
const path = require('path');

async function main() {
  const migration = require('../src/migrations/008_add_campaign_linkedin_accounts');

  console.log('🚀 Executando Migration 008: Campaign LinkedIn Accounts...\n');

  try {
    await migration.up();
    console.log('\n✅ Migration executada com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro ao executar migration:', error);
    process.exit(1);
  }
}

main();
