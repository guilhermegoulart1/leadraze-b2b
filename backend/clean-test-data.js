// Script para limpar dados de teste (conversas, contatos, leads)
require('dotenv').config();
const { Pool } = require('pg');

const dbHost = process.env.DB_HOST || 'localhost';
const pool = new Pool({
  host: dbHost,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: dbHost.includes('supabase.co') || dbHost.includes('railway.app')
    ? { rejectUnauthorized: false }
    : false
});

async function cleanTestData() {
  console.log('🧹 Limpando dados de teste...\n');

  try {
    // 1. Limpar mensagens
    const msgResult = await pool.query('DELETE FROM messages');
    console.log(`✅ ${msgResult.rowCount} mensagens deletadas`);

    // 2. Limpar conversas
    const convResult = await pool.query('DELETE FROM conversations');
    console.log(`✅ ${convResult.rowCount} conversas deletadas`);

    // 3. Limpar contatos
    const contactResult = await pool.query('DELETE FROM contacts');
    console.log(`✅ ${contactResult.rowCount} contatos deletados`);

    // 4. Limpar leads (opcional - comente se quiser manter)
    // const leadResult = await pool.query('DELETE FROM leads');
    // console.log(`✅ ${leadResult.rowCount} leads deletados`);

    console.log('\n✅ Limpeza concluída! Pronto para testar.\n');
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

cleanTestData();
