// Script para executar migration 007: Account Health Tracking
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'leadraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Iniciando Migration 007: Account Health Tracking...\n');

    // Ler arquivo SQL
    const migrationPath = path.join(__dirname, '../src/migrations/007_add_account_health_tracking.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Executar migration
    await client.query('BEGIN');

    console.log('📝 Executando migration SQL...');
    await client.query(migrationSQL);

    await client.query('COMMIT');

    console.log('\n✅ Migration 007 executada com sucesso!\n');

    // Verificar estruturas criadas
    console.log('🔍 Verificando estruturas criadas...\n');

    // Verificar campo account_type
    const typeCheck = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'linkedin_accounts'
        AND column_name = 'account_type'
    `);
    console.log('  ✓ Campo account_type:', typeCheck.rows.length > 0 ? 'OK' : 'ERRO');

    // Verificar campo accepted_at
    const acceptedCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'linkedin_invite_logs'
        AND column_name = 'accepted_at'
    `);
    console.log('  ✓ Campo accepted_at:', acceptedCheck.rows.length > 0 ? 'OK' : 'ERRO');

    // Verificar tabela limit_changes
    const limitTableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'linkedin_account_limit_changes'
    `);
    console.log('  ✓ Tabela limit_changes:', limitTableCheck.rows.length > 0 ? 'OK' : 'ERRO');

    // Verificar tabela health_metrics
    const metricsTableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'linkedin_account_health_metrics'
    `);
    console.log('  ✓ Tabela health_metrics:', metricsTableCheck.rows.length > 0 ? 'OK' : 'ERRO');

    // Verificar função
    const functionCheck = await client.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_name = 'calculate_account_health_metrics'
    `);
    console.log('  ✓ Função calculate_health:', functionCheck.rows.length > 0 ? 'OK' : 'ERRO');

    // Verificar view
    const viewCheck = await client.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_name = 'vw_linkedin_account_health'
    `);
    console.log('  ✓ View account_health:', viewCheck.rows.length > 0 ? 'OK' : 'ERRO');

    console.log('\n📊 Testando cálculo de métricas...\n');

    // Buscar primeira conta para teste
    const accountTest = await client.query(`
      SELECT id, profile_name FROM linkedin_accounts LIMIT 1
    `);

    if (accountTest.rows.length > 0) {
      const account = accountTest.rows[0];
      console.log(`  📋 Testando com conta: ${account.profile_name}`);

      const metrics = await client.query(`
        SELECT * FROM calculate_account_health_metrics($1, 30)
      `, [account.id]);

      if (metrics.rows.length > 0) {
        const m = metrics.rows[0];
        console.log(`    - Convites enviados (30d): ${m.invites_sent}`);
        console.log(`    - Convites aceitos (30d): ${m.invites_accepted}`);
        console.log(`    - Taxa de aceitação: ${m.acceptance_rate}%`);
        console.log(`    - Health Score: ${m.health_score}/100`);
      }
    } else {
      console.log('  ⚠️ Nenhuma conta encontrada para teste');
    }

    console.log('\n✅ Todos os componentes verificados!\n');
    console.log('📌 Próximos passos:');
    console.log('   1. Implementar accountHealthService.js');
    console.log('   2. Atualizar profileController para auto-detect tipo');
    console.log('   3. Criar endpoints de API\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Erro ao executar migration:', error);
    console.error('\nStack:', error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
