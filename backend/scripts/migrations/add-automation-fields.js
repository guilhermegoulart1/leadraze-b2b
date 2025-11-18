// backend/scripts/migrations/add-automation-fields.js
const { Pool } = require('pg');

const pool = new Pool({
  host: 'db.epikyczksznhjggzjjgg.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'W5o6k6y0@@',
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('\n🔄 Iniciando migração para adicionar campos de automação...\n');

    await client.query('BEGIN');

    // ========================================
    // 1. CRIAR TABELA linkedin_invite_logs
    // ========================================
    console.log('📋 Criando tabela linkedin_invite_logs...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS linkedin_invite_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
        campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
        lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending', 'accepted')),
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_invite_logs_account_sent_at
      ON linkedin_invite_logs(linkedin_account_id, sent_at)
    `);

    console.log('✅ Tabela linkedin_invite_logs criada');

    // ========================================
    // 2. ADICIONAR CAMPOS EM ai_agents
    // ========================================
    console.log('\n📋 Adicionando campos em ai_agents...');

    const aiAgentColumns = [
      { name: 'products_services', type: 'TEXT', description: 'Produtos/serviços que o agente vende' },
      { name: 'behavioral_profile', type: 'VARCHAR(50)', description: 'Perfil comportamental (consultivo, direto, educativo, amigavel)' },
      { name: 'initial_approach', type: 'TEXT', description: 'Template de mensagem inicial com variáveis LinkedIn' },
      { name: 'linkedin_variables', type: 'JSONB', description: 'Variáveis disponíveis e usadas' },
      { name: 'auto_schedule', type: 'BOOLEAN DEFAULT false', description: 'Auto-oferece agendamento de reunião' },
      { name: 'scheduling_link', type: 'VARCHAR(500)', description: 'Link do Calendly/calendário' },
      { name: 'intent_detection_enabled', type: 'BOOLEAN DEFAULT true', description: 'Ativa detecção de intenção' },
      { name: 'response_style_instructions', type: 'TEXT', description: 'Instruções de estilo de resposta para OpenAI' }
    ];

    for (const col of aiAgentColumns) {
      try {
        await client.query(`
          ALTER TABLE ai_agents
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `);
        console.log(`  ✅ Adicionado ${col.name} - ${col.description}`);
      } catch (err) {
        if (err.code !== '42701') { // 42701 = column already exists
          throw err;
        }
        console.log(`  ⏭️  ${col.name} já existe`);
      }
    }

    // ========================================
    // 3. ADICIONAR CAMPOS EM conversations
    // ========================================
    console.log('\n📋 Adicionando campos em conversations...');

    const conversationColumns = [
      { name: 'user_id', type: 'UUID REFERENCES users(id) ON DELETE CASCADE', description: 'Dono da conversa' },
      { name: 'linkedin_account_id', type: 'UUID REFERENCES linkedin_accounts(id) ON DELETE CASCADE', description: 'Conta LinkedIn usada' },
      { name: 'ai_active', type: 'BOOLEAN DEFAULT true', description: 'IA está respondendo automaticamente' },
      { name: 'manual_control_taken', type: 'BOOLEAN DEFAULT false', description: 'Usuário assumiu controle manual' },
      { name: 'last_message_preview', type: 'TEXT', description: 'Preview da última mensagem' },
      { name: 'unread_count', type: 'INTEGER DEFAULT 0', description: 'Número de mensagens não lidas' },
      { name: 'is_connection', type: 'BOOLEAN DEFAULT false', description: 'É uma conexão estabelecida' }
    ];

    for (const col of conversationColumns) {
      try {
        await client.query(`
          ALTER TABLE conversations
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `);
        console.log(`  ✅ Adicionado ${col.name} - ${col.description}`);
      } catch (err) {
        if (err.code !== '42701') {
          throw err;
        }
        console.log(`  ⏭️  ${col.name} já existe`);
      }
    }

    // ========================================
    // 4. ADICIONAR CAMPOS EM messages
    // ========================================
    console.log('\n📋 Adicionando campos em messages...');

    try {
      await client.query(`
        ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS message_type VARCHAR(50) DEFAULT 'text'
      `);
      console.log('  ✅ Adicionado message_type - Tipo de mensagem');
    } catch (err) {
      if (err.code !== '42701') {
        throw err;
      }
      console.log('  ⏭️  message_type já existe');
    }

    // ========================================
    // 5. CRIAR ÍNDICES PARA PERFORMANCE
    // ========================================
    console.log('\n📋 Criando índices para performance...');

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_conversations_linkedin_account_id ON conversations(linkedin_account_id)',
      'CREATE INDEX IF NOT EXISTS idx_conversations_ai_active ON conversations(ai_active) WHERE ai_active = true',
      'CREATE INDEX IF NOT EXISTS idx_invite_logs_campaign ON linkedin_invite_logs(campaign_id)',
      'CREATE INDEX IF NOT EXISTS idx_invite_logs_lead ON linkedin_invite_logs(lead_id)'
    ];

    for (const indexSql of indexes) {
      await client.query(indexSql);
      console.log(`  ✅ Índice criado`);
    }

    await client.query('COMMIT');

    console.log('\n✅ Migração concluída com sucesso!\n');
    console.log('📊 Resumo:');
    console.log('   - Tabela linkedin_invite_logs: CRIADA');
    console.log('   - Campos em ai_agents: 8 adicionados');
    console.log('   - Campos em conversations: 7 adicionados');
    console.log('   - Campos em messages: 1 adicionado');
    console.log('   - Índices de performance: 5 criados\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Erro na migração:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Executar migração
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('🎉 Migração finalizada!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Falha na migração:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
