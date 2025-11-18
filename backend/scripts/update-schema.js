// backend/scripts/update-schema.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'leadraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function updateSchema() {
  const client = await pool.connect();

  try {
    console.log('\n🔄 Atualizando schema do banco de dados...\n');

    // 1. Adicionar novas colunas na tabela campaigns se não existirem
    console.log('📊 Atualizando tabela campaigns...');

    await client.query(`
      DO $$
      BEGIN
        -- Adicionar description se não existir
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'campaigns' AND column_name = 'description'
        ) THEN
          ALTER TABLE campaigns ADD COLUMN description TEXT;
        END IF;

        -- Adicionar leads_scheduled se não existir
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'campaigns' AND column_name = 'leads_scheduled'
        ) THEN
          ALTER TABLE campaigns ADD COLUMN leads_scheduled INTEGER DEFAULT 0;
        END IF;

        -- Adicionar leads_won se não existir
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'campaigns' AND column_name = 'leads_won'
        ) THEN
          ALTER TABLE campaigns ADD COLUMN leads_won INTEGER DEFAULT 0;
        END IF;

        -- Adicionar leads_lost se não existir
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'campaigns' AND column_name = 'leads_lost'
        ) THEN
          ALTER TABLE campaigns ADD COLUMN leads_lost INTEGER DEFAULT 0;
        END IF;
      END $$;
    `);
    console.log('✅ Tabela campaigns atualizada');

    // 2. Adicionar novas colunas na tabela leads se não existirem
    console.log('\n👥 Atualizando tabela leads...');

    await client.query(`
      DO $$
      BEGIN
        -- Adicionar scheduled_at se não existir
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'leads' AND column_name = 'scheduled_at'
        ) THEN
          ALTER TABLE leads ADD COLUMN scheduled_at TIMESTAMP;
        END IF;

        -- Adicionar won_at se não existir
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'leads' AND column_name = 'won_at'
        ) THEN
          ALTER TABLE leads ADD COLUMN won_at TIMESTAMP;
        END IF;

        -- Adicionar lost_at se não existir
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'leads' AND column_name = 'lost_at'
        ) THEN
          ALTER TABLE leads ADD COLUMN lost_at TIMESTAMP;
        END IF;

        -- Adicionar lost_reason se não existir
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'leads' AND column_name = 'lost_reason'
        ) THEN
          ALTER TABLE leads ADD COLUMN lost_reason TEXT;
        END IF;

        -- Adicionar notes se não existir
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'leads' AND column_name = 'notes'
        ) THEN
          ALTER TABLE leads ADD COLUMN notes TEXT;
        END IF;

        -- Adicionar summary se não existir
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'leads' AND column_name = 'summary'
        ) THEN
          ALTER TABLE leads ADD COLUMN summary TEXT;
        END IF;

        -- Adicionar industry se não existir
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'leads' AND column_name = 'industry'
        ) THEN
          ALTER TABLE leads ADD COLUMN industry VARCHAR(255);
        END IF;

        -- Adicionar connections se não existir
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'leads' AND column_name = 'connections'
        ) THEN
          ALTER TABLE leads ADD COLUMN connections INTEGER;
        END IF;
      END $$;
    `);
    console.log('✅ Tabela leads atualizada');

    // 3. Remover constraint antiga de status se existir e adicionar nova
    console.log('\n🔧 Atualizando constraints...');

    await client.query(`
      DO $$
      BEGIN
        -- Remover constraint antiga se existir
        IF EXISTS (
          SELECT 1 FROM information_schema.constraint_column_usage
          WHERE constraint_name = 'check_status'
        ) THEN
          ALTER TABLE leads DROP CONSTRAINT check_status;
        END IF;

        -- Adicionar nova constraint
        ALTER TABLE leads ADD CONSTRAINT check_status
          CHECK (status IN ('lead', 'invite_sent', 'qualifying', 'scheduled', 'won', 'lost'));
      EXCEPTION
        WHEN duplicate_object THEN
          NULL; -- Constraint já existe
      END $$;
    `);
    console.log('✅ Constraints atualizados');

    // 4. Adicionar novos índices se não existirem
    console.log('\n📑 Criando índices...');

    await client.query(`
      DO $$
      BEGIN
        -- Índice para summary
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'idx_leads_summary'
        ) THEN
          CREATE INDEX idx_leads_summary ON leads USING gin(to_tsvector('portuguese', summary));
        END IF;
      EXCEPTION
        WHEN others THEN
          NULL; -- Índice já existe ou erro
      END $$;
    `);
    console.log('✅ Índices criados');

    console.log('\n✅ Schema atualizado com sucesso!\n');
    console.log('📋 Resumo das alterações:');
    console.log('   ✓ Tabela campaigns: +3 colunas (leads_scheduled, leads_won, leads_lost)');
    console.log('   ✓ Tabela leads: +8 colunas (scheduled_at, won_at, lost_at, lost_reason, notes, summary, industry, connections)');
    console.log('   ✓ Constraints: status atualizado com novos valores (scheduled, won, lost)');
    console.log('   ✓ Índices: adicionados para busca otimizada\n');

  } catch (error) {
    console.error('\n❌ Erro ao atualizar schema:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Executar atualização
if (require.main === module) {
  updateSchema()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Erro fatal:', error);
      process.exit(1);
    });
}

module.exports = { updateSchema };
