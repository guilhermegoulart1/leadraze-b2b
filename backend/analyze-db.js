// Script para analisar estado do banco de dados
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

async function analyze() {
  console.log('🔍 ANÁLISE DO BANCO DE DADOS\n');
  console.log('='.repeat(60));

  try {
    // 1. Conversas
    console.log('\n📞 CONVERSAS:');
    console.log('-'.repeat(60));
    const conversations = await pool.query(`
      SELECT
        id,
        unipile_chat_id,
        contact_id,
        lead_id,
        status,
        last_message_preview,
        created_at
      FROM conversations
      ORDER BY created_at DESC
    `);

    for (const conv of conversations.rows) {
      console.log(`\nID: ${conv.id}`);
      console.log(`  Chat ID: ${conv.unipile_chat_id}`);
      console.log(`  Contact ID: ${conv.contact_id || 'NULL'}`);
      console.log(`  Lead ID: ${conv.lead_id || 'NULL'}`);
      console.log(`  Status: ${conv.status}`);
      console.log(`  Preview: ${conv.last_message_preview}`);
      console.log(`  Created: ${conv.created_at}`);
    }

    // 2. Contatos
    console.log('\n\n👤 CONTATOS:');
    console.log('-'.repeat(60));
    const contacts = await pool.query(`
      SELECT
        id,
        name,
        phone,
        linkedin_profile_id,
        source,
        created_at
      FROM contacts
      ORDER BY created_at DESC
    `);

    if (contacts.rows.length === 0) {
      console.log('  Nenhum contato encontrado');
    } else {
      for (const contact of contacts.rows) {
        console.log(`\nID: ${contact.id}`);
        console.log(`  Nome: ${contact.name}`);
        console.log(`  Telefone: ${contact.phone}`);
        console.log(`  Provider ID: ${contact.linkedin_profile_id}`);
        console.log(`  Source: ${contact.source}`);
        console.log(`  Created: ${contact.created_at}`);
      }
    }

    // 3. Leads relacionados
    console.log('\n\n📋 LEADS:');
    console.log('-'.repeat(60));
    const leads = await pool.query(`
      SELECT
        id,
        name,
        provider_id,
        status,
        created_at
      FROM leads
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (leads.rows.length === 0) {
      console.log('  Nenhum lead encontrado');
    } else {
      for (const lead of leads.rows) {
        console.log(`\nID: ${lead.id}`);
        console.log(`  Nome: ${lead.name}`);
        console.log(`  Provider ID: ${lead.provider_id}`);
        console.log(`  Status: ${lead.status}`);
        console.log(`  Created: ${lead.created_at}`);
      }
    }

    // 4. Mensagens por conversa
    console.log('\n\n💬 MENSAGENS POR CONVERSA:');
    console.log('-'.repeat(60));
    const msgCount = await pool.query(`
      SELECT
        conversation_id,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE sender_type = 'user') as user_msgs,
        COUNT(*) FILTER (WHERE sender_type = 'lead') as lead_msgs
      FROM messages
      GROUP BY conversation_id
    `);

    for (const msg of msgCount.rows) {
      console.log(`\nConversa: ${msg.conversation_id}`);
      console.log(`  Total: ${msg.total} | User: ${msg.user_msgs} | Lead: ${msg.lead_msgs}`);
    }

    // 5. Canal WhatsApp
    console.log('\n\n📱 CANAL WHATSAPP:');
    console.log('-'.repeat(60));
    const channel = await pool.query(`
      SELECT
        id,
        channel_identifier,
        provider_type,
        status
      FROM linkedin_accounts
      WHERE provider_type = 'WHATSAPP'
      LIMIT 1
    `);

    if (channel.rows.length > 0) {
      const ch = channel.rows[0];
      console.log(`  ID: ${ch.id}`);
      console.log(`  Identifier (seu número): ${ch.channel_identifier}`);
      console.log(`  Provider: ${ch.provider_type}`);
      console.log(`  Status: ${ch.status}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Análise concluída');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

analyze();
