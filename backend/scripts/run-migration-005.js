// Script para executar migration 005 - pgvector e knowledge base
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'leadraze',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: false
  });

  try {
    console.log('🔄 Conectando ao banco de dados...');
    console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`   Database: ${process.env.DB_NAME || 'leadraze'}`);

    const migrationPath = path.join(__dirname, '../src/migrations/005_add_ai_knowledge_base.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Executando migration 005...');

    await pool.query(sql);

    console.log('✅ Migration 005 executada com sucesso!');
    console.log('');
    console.log('Estrutura criada:');
    console.log('  - Extensão pgvector habilitada');
    console.log('  - Tabela ai_agent_knowledge criada');
    console.log('  - Índices vetoriais criados (HNSW)');
    console.log('  - Função search_knowledge() criada');
    console.log('  - Novos campos em ai_agents adicionados');

  } catch (error) {
    console.error('❌ Erro ao executar migration:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
