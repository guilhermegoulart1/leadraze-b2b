// backend/scripts/seed-mock-conversations.js
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'leadraze_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function seedMockConversations() {
  console.log('🌱 Criando conversas mock...\n');

  try {
    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, 'seed-mock-conversations.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Executar o SQL
    const result = await pool.query(sql);

    console.log('\n✅ Conversas mock criadas com sucesso!');
    console.log('\n📊 Criadas:');
    console.log('   - 10 leads com perfis variados');
    console.log('   - 10 conversas (7 AI Active, 3 Manual)');
    console.log('   - 6 conversas com mensagens não lidas');
    console.log('\n🎨 Visualize em: http://localhost:5173/conversations');
    console.log('\n🗑️  Para remover:');
    console.log('   DELETE FROM campaigns WHERE name = \'Campanha Mock - Visualização\';');

  } catch (error) {
    console.error('❌ Erro ao criar conversas mock:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedMockConversations();
