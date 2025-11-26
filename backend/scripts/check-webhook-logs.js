// Script to check recent webhook logs
const { Pool } = require('pg');

const pool = new Pool({
  host: 'db.epikyczksznhjggzjjgg.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'W5o6k6y0@@',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    console.log('\n🔍 Verificando últimos webhooks recebidos...\n');

    // Check last 10 webhooks
    const webhooks = await pool.query(`
      SELECT
        id,
        event_type,
        account_id,
        processed,
        error,
        created_at,
        LEFT(payload::text, 500) as payload_preview
      FROM webhook_logs
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log(`📋 Últimos ${webhooks.rows.length} webhooks:\n`);
    webhooks.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.event_type || 'unknown'}`);
      console.log(`   ID: ${row.id}`);
      console.log(`   Account: ${row.account_id || 'N/A'}`);
      console.log(`   Processed: ${row.processed}`);
      console.log(`   Error: ${row.error || 'None'}`);
      console.log(`   Created: ${row.created_at}`);
      console.log(`   Payload: ${row.payload_preview}...`);
      console.log('');
    });

    // Check recent conversations
    console.log('\n🔍 Verificando últimas conversas criadas...\n');
    const conversations = await pool.query(`
      SELECT
        c.id,
        c.unipile_chat_id,
        c.status,
        c.ai_active,
        c.created_at,
        l.name as lead_name,
        l.status as lead_status
      FROM conversations c
      LEFT JOIN leads l ON c.lead_id = l.id
      ORDER BY c.created_at DESC
      LIMIT 5
    `);

    console.log(`📋 Últimas ${conversations.rows.length} conversas:\n`);
    conversations.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.lead_name || 'Unknown'}`);
      console.log(`   ID: ${row.id}`);
      console.log(`   Chat ID: ${row.unipile_chat_id}`);
      console.log(`   Status: ${row.status} (AI Active: ${row.ai_active})`);
      console.log(`   Lead Status: ${row.lead_status}`);
      console.log(`   Created: ${row.created_at}`);
      console.log('');
    });

    // Check recent messages
    console.log('\n🔍 Verificando últimas mensagens...\n');
    const messages = await pool.query(`
      SELECT
        m.id,
        m.conversation_id,
        m.sender_type,
        m.content,
        m.created_at,
        c.unipile_chat_id
      FROM messages m
      LEFT JOIN conversations c ON m.conversation_id = c.id
      ORDER BY m.created_at DESC
      LIMIT 10
    `);

    console.log(`📋 Últimas ${messages.rows.length} mensagens:\n`);
    messages.rows.forEach((row, i) => {
      console.log(`${i + 1}. [${row.sender_type}] ${(row.content || '').substring(0, 100)}...`);
      console.log(`   ID: ${row.id}`);
      console.log(`   Conv ID: ${row.conversation_id}`);
      console.log(`   Chat ID: ${row.unipile_chat_id}`);
      console.log(`   Created: ${row.created_at}`);
      console.log('');
    });

    await pool.end();
    process.exit(0);
  } catch (e) {
    console.error('Erro:', e.message);
    await pool.end();
    process.exit(1);
  }
}

check();
