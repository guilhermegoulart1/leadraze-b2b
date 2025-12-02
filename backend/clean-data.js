// Script para limpar leads, conversas e contatos
require('dotenv').config();
const db = require('./src/config/database');

async function cleanData() {
  try {
    console.log('🗑️  Limpando dados...\n');

    // Deletar na ordem correta (por causa das foreign keys)
    const tables = [
      'messages',
      'conversation_tags',
      'conversation_assignments',
      'conversations',
      'lead_tags',
      'leads',
      'contacts'
    ];

    for (const table of tables) {
      try {
        const result = await db.query(`DELETE FROM ${table}`);
        console.log(`   ✅ ${table}: ${result.rowCount} registros deletados`);
      } catch (err) {
        console.log(`   ⚠️  ${table}: ${err.message}`);
      }
    }

    console.log('\n✅ Limpeza concluída!');
    process.exit(0);
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
}

cleanData();
