// Script para verificar o schema do banco de dados
require('dotenv').config();
const db = require('../src/config/database');

async function checkSchema() {
  console.log('🔍 Verificando schema do banco de dados...\n');

  try {
    // 1. Verificar tabelas existentes
    const tablesResult = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('📋 TABELAS EXISTENTES:');
    console.log('─'.repeat(50));
    tablesResult.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    console.log(`\nTotal: ${tablesResult.rows.length} tabelas\n`);

    // 2. Verificar colunas da tabela campaigns
    console.log('📊 COLUNAS DA TABELA CAMPAIGNS:');
    console.log('─'.repeat(50));
    try {
      const campaignsColumns = await db.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'campaigns'
        ORDER BY ordinal_position
      `);

      if (campaignsColumns.rows.length === 0) {
        console.log('  ❌ Tabela campaigns NÃO EXISTE!');
      } else {
        campaignsColumns.rows.forEach(col => {
          console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
        });

        // Verificar se account_id existe
        const hasAccountId = campaignsColumns.rows.some(c => c.column_name === 'account_id');
        const hasLinkedinAccountId = campaignsColumns.rows.some(c => c.column_name === 'linkedin_account_id');

        console.log('\n📌 VERIFICAÇÃO:');
        console.log(`  account_id: ${hasAccountId ? '✓ EXISTE' : '❌ FALTANDO'}`);
        console.log(`  linkedin_account_id: ${hasLinkedinAccountId ? '✓ EXISTE' : '❌ FALTANDO'}`);
      }
    } catch (e) {
      console.log('  ❌ Erro ao verificar campaigns:', e.message);
    }

    // 3. Verificar tabelas de website_agents (migration 034)
    console.log('\n📊 TABELAS DE WEBSITE AGENTS (Migration 034):');
    console.log('─'.repeat(50));

    const websiteTables = ['website_agents', 'website_chat_sessions', 'website_agent_knowledge'];
    for (const tableName of websiteTables) {
      const exists = tablesResult.rows.some(r => r.table_name === tableName);
      console.log(`  ${tableName}: ${exists ? '✓ EXISTE' : '❌ FALTANDO'}`);
    }

    // 4. Verificar outras tabelas importantes
    console.log('\n📊 OUTRAS TABELAS IMPORTANTES:');
    console.log('─'.repeat(50));

    const importantTables = [
      'accounts', 'users', 'linkedin_accounts', 'leads', 'conversations',
      'ai_agents', 'contacts', 'tags', 'permissions', 'role_permissions',
      'sectors', 'contact_lists', 'activation_agents', 'activation_campaigns',
      'google_maps_agents', 'subscriptions', 'plans', 'credit_transactions',
      'email_branding_settings', 'email_signatures', 'lead_comments', 'unified_agents'
    ];

    for (const tableName of importantTables) {
      const exists = tablesResult.rows.some(r => r.table_name === tableName);
      console.log(`  ${tableName}: ${exists ? '✓' : '❌ FALTANDO'}`);
    }

    // 5. Verificar extensões
    console.log('\n📊 EXTENSÕES INSTALADAS:');
    console.log('─'.repeat(50));
    const extensionsResult = await db.query(`
      SELECT extname FROM pg_extension
    `);
    extensionsResult.rows.forEach(ext => {
      console.log(`  ✓ ${ext.extname}`);
    });

    // Verificar pgvector especificamente
    const hasPgvector = extensionsResult.rows.some(e => e.extname === 'vector');
    if (!hasPgvector) {
      console.log('\n⚠️  ATENÇÃO: pgvector NÃO está instalado! Necessário para RAG.');
    }

    console.log('\n✅ Verificação concluída!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    process.exit(0);
  }
}

checkSchema();
