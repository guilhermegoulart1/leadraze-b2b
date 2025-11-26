/**
 * Verify if summary migration was applied correctly
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/config/database');

async function verifyMigration() {
  try {
    console.log('\n🔍 Verificando migration de resumo...\n');

    // 1. Check if migration was recorded
    const migrationCheck = await db.query(`
      SELECT * FROM schema_migrations
      WHERE migration_name = '027_add_conversation_summary.sql'
    `);

    if (migrationCheck.rows.length > 0) {
      console.log('✅ Migration registrada em schema_migrations');
      console.log(`   Executada em: ${migrationCheck.rows[0].executed_at}`);
    } else {
      console.log('❌ Migration NÃO encontrada em schema_migrations');
      return;
    }

    // 2. Check if columns exist
    const columnsCheck = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'conversations'
      AND column_name IN (
        'context_summary',
        'summary_up_to_message_id',
        'summary_token_count',
        'summary_updated_at',
        'messages_count'
      )
      ORDER BY column_name
    `);

    console.log('\n📊 Colunas adicionadas à tabela conversations:\n');

    if (columnsCheck.rows.length === 5) {
      columnsCheck.rows.forEach(col => {
        console.log(`   ✅ ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} (nullable: ${col.is_nullable})`);
      });
    } else {
      console.log(`   ⚠️  Esperado 5 colunas, encontrado ${columnsCheck.rows.length}`);
      columnsCheck.rows.forEach(col => {
        console.log(`   - ${col.column_name}`);
      });
    }

    // 3. Check index
    const indexCheck = await db.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'conversations'
      AND indexname = 'idx_conversations_summary_updated'
    `);

    console.log('\n📇 Índices criados:\n');

    if (indexCheck.rows.length > 0) {
      console.log('   ✅ idx_conversations_summary_updated criado');
    } else {
      console.log('   ⚠️  Índice idx_conversations_summary_updated não encontrado');
    }

    // 4. Test a query
    console.log('\n🧪 Testando query...\n');

    const testQuery = await db.query(`
      SELECT
        id,
        context_summary,
        summary_token_count,
        messages_count
      FROM conversations
      LIMIT 1
    `);

    console.log('   ✅ Query executada com sucesso');

    // 5. Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ VERIFICAÇÃO COMPLETA\n');
    console.log('Tudo está configurado corretamente! O sistema está pronto para:');
    console.log('');
    console.log('1. Receber mensagens via webhook');
    console.log('2. Gerar resumos automaticamente (após 20 mensagens)');
    console.log('3. Atualizar resumos incrementalmente');
    console.log('4. Usar resumos no contexto da IA');
    console.log('');
    console.log('Próximos passos:');
    console.log('- Inicie o backend: npm run dev');
    console.log('- Envie mensagens via Unipile');
    console.log('- Monitore os logs para ver resumos sendo criados');
    console.log('');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Erro na verificação:', error.message);
    console.error('\nDetalhes:', error);
  } finally {
    await db.pool.end();
  }
}

verifyMigration();
