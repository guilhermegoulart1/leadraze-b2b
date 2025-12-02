require('dotenv').config();
const { Pool } = require('pg');
const dbHost = process.env.DB_HOST || 'localhost';
const pool = new Pool({
  host: dbHost,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: dbHost.includes('supabase.co') || dbHost.includes('railway.app') ? { rejectUnauthorized: false } : false
});

async function check() {
  // Verificar conversas e seus contatos
  const result = await pool.query(`
    SELECT
      conv.id as conv_id,
      conv.unipile_chat_id,
      conv.contact_id,
      conv.lead_id,
      ct.name as contact_name,
      ct.linkedin_profile_id as contact_provider_id,
      l.name as lead_name,
      l.provider_id as lead_provider_id,
      la.channel_identifier as own_number
    FROM conversations conv
    LEFT JOIN contacts ct ON conv.contact_id = ct.id
    LEFT JOIN leads l ON conv.lead_id = l.id
    LEFT JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
    ORDER BY conv.created_at DESC
    LIMIT 5
  `);

  console.log('=== CONVERSAS E SEUS CONTATOS ===\n');
  for (const row of result.rows) {
    console.log('Conversa:', row.conv_id);
    console.log('  Chat ID:', row.unipile_chat_id);
    console.log('  Own Number:', row.own_number);
    console.log('  Contact ID:', row.contact_id || 'NULL');
    console.log('  Contact Name:', row.contact_name || 'NULL');
    console.log('  Contact Provider ID:', row.contact_provider_id || 'NULL');
    console.log('  Lead ID:', row.lead_id || 'NULL');
    console.log('  Lead Name:', row.lead_name || 'NULL');
    console.log('  Lead Provider ID:', row.lead_provider_id || 'NULL');
    console.log('');
  }

  await pool.end();
}
check().catch(e => console.error(e));
