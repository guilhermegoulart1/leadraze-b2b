// backend/scripts/update-schema-ai.js
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

async function updateSchemaAI() {
  const client = await pool.connect();

  try {
    console.log('\n🤖 Atualizando schema para Sistema de IA...\n');

    // 1. Atualizar tabela campaigns
    console.log('📊 Atualizando tabela campaigns...');
    await client.query(`
      DO $$
      BEGIN
        -- Adicionar type (manual/automatic)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'campaigns' AND column_name = 'type'
        ) THEN
          ALTER TABLE campaigns ADD COLUMN type VARCHAR(50) DEFAULT 'manual';
        END IF;

        -- Adicionar current_step (1, 2, 3)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'campaigns' AND column_name = 'current_step'
        ) THEN
          ALTER TABLE campaigns ADD COLUMN current_step INTEGER DEFAULT 1;
        END IF;

        -- Adicionar search_filters (JSON para guardar filtros)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'campaigns' AND column_name = 'search_filters'
        ) THEN
          ALTER TABLE campaigns ADD COLUMN search_filters JSONB;
        END IF;

        -- Adicionar ai_agent_id
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'campaigns' AND column_name = 'ai_agent_id'
        ) THEN
          ALTER TABLE campaigns ADD COLUMN ai_agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL;
        END IF;

        -- Adicionar target_profiles_count
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'campaigns' AND column_name = 'target_profiles_count'
        ) THEN
          ALTER TABLE campaigns ADD COLUMN target_profiles_count INTEGER DEFAULT 100;
        END IF;

        -- Adicionar ai_search_prompt (para campanhas automáticas)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'campaigns' AND column_name = 'ai_search_prompt'
        ) THEN
          ALTER TABLE campaigns ADD COLUMN ai_search_prompt TEXT;
        END IF;
      END $$;
    `);
    console.log('✅ Tabela campaigns atualizada');

    // 2. Atualizar tabela ai_agents
    console.log('\n🤖 Atualizando tabela ai_agents...');
    await client.query(`
      DO $$
      BEGIN
        -- Adicionar products_services (produtos/serviços oferecidos)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'ai_agents' AND column_name = 'products_services'
        ) THEN
          ALTER TABLE ai_agents ADD COLUMN products_services TEXT;
        END IF;

        -- Adicionar behavioral_profile (perfil comportamental escolhido)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'ai_agents' AND column_name = 'behavioral_profile'
        ) THEN
          ALTER TABLE ai_agents ADD COLUMN behavioral_profile VARCHAR(100);
        END IF;

        -- Adicionar initial_approach (abordagem inicial)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'ai_agents' AND column_name = 'initial_approach'
        ) THEN
          ALTER TABLE ai_agents ADD COLUMN initial_approach TEXT;
        END IF;

        -- Adicionar linkedin_variables (variáveis disponíveis)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'ai_agents' AND column_name = 'linkedin_variables'
        ) THEN
          ALTER TABLE ai_agents ADD COLUMN linkedin_variables JSONB;
        END IF;

        -- Adicionar auto_schedule (se agenda automaticamente)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'ai_agents' AND column_name = 'auto_schedule'
        ) THEN
          ALTER TABLE ai_agents ADD COLUMN auto_schedule BOOLEAN DEFAULT false;
        END IF;

        -- Adicionar scheduling_link (link do Calendly ou outro)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'ai_agents' AND column_name = 'scheduling_link'
        ) THEN
          ALTER TABLE ai_agents ADD COLUMN scheduling_link TEXT;
        END IF;

        -- Adicionar intent_detection_enabled
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'ai_agents' AND column_name = 'intent_detection_enabled'
        ) THEN
          ALTER TABLE ai_agents ADD COLUMN intent_detection_enabled BOOLEAN DEFAULT true;
        END IF;

        -- Adicionar response_style_instructions
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'ai_agents' AND column_name = 'response_style_instructions'
        ) THEN
          ALTER TABLE ai_agents ADD COLUMN response_style_instructions TEXT DEFAULT 'Respostas curtas e diretas. Dar espaço para o lead falar.';
        END IF;
      END $$;
    `);
    console.log('✅ Tabela ai_agents atualizada');

    // 3. Criar índices
    console.log('\n📑 Criando índices...');
    await client.query(`
      DO $$
      BEGIN
        -- Índice para type em campaigns
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'idx_campaigns_type'
        ) THEN
          CREATE INDEX idx_campaigns_type ON campaigns(type);
        END IF;

        -- Índice para ai_agent_id em campaigns
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'idx_campaigns_ai_agent_id'
        ) THEN
          CREATE INDEX idx_campaigns_ai_agent_id ON campaigns(ai_agent_id);
        END IF;

        -- Índice para behavioral_profile em ai_agents
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ai_agents_behavioral_profile'
        ) THEN
          CREATE INDEX idx_ai_agents_behavioral_profile ON ai_agents(behavioral_profile);
        END IF;
      END $$;
    `);
    console.log('✅ Índices criados');

    console.log('\n✅ Schema de IA atualizado com sucesso!\n');
    console.log('📋 Resumo das alterações:');
    console.log('   ✓ Tabela campaigns:');
    console.log('     - type (manual/automatic)');
    console.log('     - current_step (1, 2, 3)');
    console.log('     - search_filters (JSONB)');
    console.log('     - ai_agent_id (FK)');
    console.log('     - target_profiles_count');
    console.log('     - ai_search_prompt');
    console.log('   ✓ Tabela ai_agents:');
    console.log('     - products_services');
    console.log('     - behavioral_profile');
    console.log('     - initial_approach');
    console.log('     - linkedin_variables (JSONB)');
    console.log('     - auto_schedule');
    console.log('     - scheduling_link');
    console.log('     - intent_detection_enabled');
    console.log('     - response_style_instructions\n');

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
  updateSchemaAI()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Erro fatal:', error);
      process.exit(1);
    });
}

module.exports = { updateSchemaAI };
