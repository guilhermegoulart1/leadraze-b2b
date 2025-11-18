// backend/scripts/add-invite-limits.js
const { Pool } = require('pg');

const pool = new Pool({
  host: 'db.epikyczksznhjggzjjgg.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'W5o6k6y0@@',
  ssl: { rejectUnauthorized: false }
});

async function addInviteLimits() {
  const client = await pool.connect();

  try {
    console.log('\n🔄 Adicionando sistema de limites de convites...\n');

    // 1. Adicionar colunas na tabela linkedin_accounts
    console.log('📊 Atualizando tabela linkedin_accounts...');

    await client.query(`
      DO $$
      BEGIN
        -- Adicionar account_type se não existir
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'linkedin_accounts' AND column_name = 'account_type'
        ) THEN
          ALTER TABLE linkedin_accounts
          ADD COLUMN account_type VARCHAR(50) DEFAULT 'free';
        END IF;

        -- Adicionar daily_invite_limit se não existir
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'linkedin_accounts' AND column_name = 'daily_invite_limit'
        ) THEN
          ALTER TABLE linkedin_accounts
          ADD COLUMN daily_invite_limit INTEGER DEFAULT 25;
        END IF;
      END $$;
    `);
    console.log('✅ Tabela linkedin_accounts atualizada');

    // 2. Criar tabela linkedin_invite_logs se não existir
    console.log('\n📝 Criando tabela linkedin_invite_logs...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS linkedin_invite_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
        campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
        lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
        sent_at TIMESTAMP DEFAULT NOW(),
        status VARCHAR(20) DEFAULT 'sent',
        CONSTRAINT check_invite_status CHECK (status IN ('sent', 'failed', 'pending'))
      );
    `);
    console.log('✅ Tabela linkedin_invite_logs criada');

    // 3. Criar índices para otimização
    console.log('\n📑 Criando índices...');

    await client.query(`
      DO $$
      BEGIN
        -- Índice para busca por conta e data
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invite_logs_account_date'
        ) THEN
          CREATE INDEX idx_invite_logs_account_date
          ON linkedin_invite_logs(linkedin_account_id, sent_at);
        END IF;

        -- Índice para busca por campanha
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invite_logs_campaign'
        ) THEN
          CREATE INDEX idx_invite_logs_campaign
          ON linkedin_invite_logs(campaign_id);
        END IF;

        -- Índice para busca por status
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invite_logs_status'
        ) THEN
          CREATE INDEX idx_invite_logs_status
          ON linkedin_invite_logs(status);
        END IF;
      EXCEPTION
        WHEN others THEN
          NULL; -- Índice já existe ou erro
      END $$;
    `);
    console.log('✅ Índices criados');

    // 4. Atualizar contas existentes com limites padrão baseados no tipo
    console.log('\n🔧 Atualizando contas existentes...');

    const updateResult = await client.query(`
      UPDATE linkedin_accounts
      SET
        account_type = 'free',
        daily_invite_limit = 25
      WHERE account_type IS NULL OR daily_invite_limit IS NULL;
    `);
    console.log(`✅ ${updateResult.rowCount} conta(s) atualizada(s)`);

    console.log('\n✅ Sistema de limites de convites adicionado com sucesso!\n');
    console.log('📋 Resumo das alterações:');
    console.log('   ✓ Tabela linkedin_accounts: +2 colunas (account_type, daily_invite_limit)');
    console.log('   ✓ Tabela linkedin_invite_logs: criada com 6 colunas');
    console.log('   ✓ Índices: 3 novos índices para otimização');
    console.log('   ✓ Limites padrão: 25 convites/dia para contas free\n');
    console.log('💡 Limites recomendados por tipo de conta:');
    console.log('   - Free: 20-30 convites/dia');
    console.log('   - Premium: 40-60 convites/dia');
    console.log('   - Sales Navigator: 80-100 convites/dia\n');

  } catch (error) {
    console.error('\n❌ Erro ao adicionar sistema de limites:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Executar migration
if (require.main === module) {
  addInviteLimits()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Erro fatal:', error);
      process.exit(1);
    });
}

module.exports = { addInviteLimits };
