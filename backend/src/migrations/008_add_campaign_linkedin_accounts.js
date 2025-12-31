// backend/src/migrations/008_add_campaign_linkedin_accounts.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'getraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function up() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('📦 Criando tabela campaign_linkedin_accounts...');

    // Criar tabela de relacionamento many-to-many
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaign_linkedin_accounts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,

        -- Controle de distribuição
        priority INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT true,

        -- Estatísticas por conta na campanha
        invites_sent INTEGER DEFAULT 0,
        invites_accepted INTEGER DEFAULT 0,
        last_used_at TIMESTAMP,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        -- Constraint: não permitir duplicatas
        UNIQUE(campaign_id, linkedin_account_id)
      );
    `);

    // Criar índices
    await client.query(`
      CREATE INDEX idx_campaign_linkedin_accounts_campaign
        ON campaign_linkedin_accounts(campaign_id);

      CREATE INDEX idx_campaign_linkedin_accounts_linkedin
        ON campaign_linkedin_accounts(linkedin_account_id);

      CREATE INDEX idx_campaign_linkedin_accounts_active
        ON campaign_linkedin_accounts(campaign_id, is_active);
    `);

    console.log('✅ Tabela campaign_linkedin_accounts criada!');

    // Migrar dados existentes (se houver campanhas com linkedin_account_id)
    console.log('🔄 Migrando campanhas existentes...');

    await client.query(`
      INSERT INTO campaign_linkedin_accounts (campaign_id, linkedin_account_id, priority)
      SELECT id, linkedin_account_id, 1
      FROM campaigns
      WHERE linkedin_account_id IS NOT NULL
      ON CONFLICT (campaign_id, linkedin_account_id) DO NOTHING;
    `);

    console.log('✅ Dados migrados!');

    await client.query('COMMIT');
    console.log('🎉 Migration 008 concluída com sucesso!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na migration:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🔄 Revertendo migration 008...');

    await client.query(`
      DROP TABLE IF EXISTS campaign_linkedin_accounts CASCADE;
    `);

    console.log('✅ Migration 008 revertida!');

    await client.query('COMMIT');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao reverter migration:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'up') {
    up()
      .then(() => {
        console.log('✅ Migration aplicada com sucesso!');
        process.exit(0);
      })
      .catch(err => {
        console.error('❌ Erro:', err);
        process.exit(1);
      });
  } else if (command === 'down') {
    down()
      .then(() => {
        console.log('✅ Migration revertida com sucesso!');
        process.exit(0);
      })
      .catch(err => {
        console.error('❌ Erro:', err);
        process.exit(1);
      });
  } else {
    console.log('Usage: node 008_add_campaign_linkedin_accounts.js [up|down]');
    process.exit(1);
  }
}

module.exports = { up, down };
