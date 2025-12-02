// Script para limpar leads criados com o próprio número do usuário
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

async function cleanBadLeads() {
  console.log('🧹 Procurando leads com provider_id igual ao número do canal...\n');

  try {
    // Buscar canais WhatsApp
    const channels = await pool.query(`
      SELECT id, channel_identifier, provider_type
      FROM linkedin_accounts
      WHERE provider_type = 'WHATSAPP'
    `);

    for (const channel of channels.rows) {
      console.log(`\n📱 Canal: ${channel.channel_identifier}`);

      // Buscar leads com provider_id igual ao número do canal
      const badLeads = await pool.query(`
        SELECT l.id, l.name, l.provider_id
        FROM leads l
        JOIN campaigns c ON l.campaign_id = c.id
        WHERE c.linkedin_account_id = $1
        AND (
          l.provider_id = $2
          OR l.provider_id = $3
          OR l.provider_id LIKE $4
        )
      `, [
        channel.id,
        channel.channel_identifier,
        channel.channel_identifier + '@s.whatsapp.net',
        '%' + channel.channel_identifier + '%'
      ]);

      if (badLeads.rows.length > 0) {
        console.log(`   ⚠️ Encontrados ${badLeads.rows.length} leads ruins:`);
        for (const lead of badLeads.rows) {
          console.log(`      - ${lead.name} (${lead.provider_id})`);
        }

        // Deletar
        const deleteResult = await pool.query(`
          DELETE FROM leads
          WHERE id = ANY($1::uuid[])
        `, [badLeads.rows.map(l => l.id)]);

        console.log(`   ✅ ${deleteResult.rowCount} leads deletados`);
      } else {
        console.log(`   ✅ Nenhum lead ruim encontrado`);
      }
    }

    console.log('\n✅ Limpeza concluída!');
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

cleanBadLeads();
