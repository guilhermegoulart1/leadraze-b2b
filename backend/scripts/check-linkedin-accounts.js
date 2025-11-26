// Script to check LinkedIn accounts and leads
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
    console.log('\n🔍 Verificando contas LinkedIn...\n');

    const accounts = await pool.query(`
      SELECT
        id,
        user_id,
        unipile_account_id,
        profile_name,
        status
      FROM linkedin_accounts
      LIMIT 10
    `);

    console.log(`📋 Contas LinkedIn (${accounts.rows.length}):\n`);
    accounts.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.profile_name || 'Unknown'}`);
      console.log(`   ID: ${row.id}`);
      console.log(`   Unipile ID: ${row.unipile_account_id}`);
      console.log(`   User ID: ${row.user_id}`);
      console.log(`   Status: ${row.status}`);
      console.log('');
    });

    // Check if the account from webhook exists
    console.log('\n🔍 Verificando conta do webhook (seiTJuv3TqK5_GhjJgVZlw)...\n');
    const webhookAccount = await pool.query(`
      SELECT * FROM linkedin_accounts
      WHERE unipile_account_id = 'seiTJuv3TqK5_GhjJgVZlw'
    `);

    if (webhookAccount.rows.length > 0) {
      console.log('✅ Conta encontrada:');
      console.log(JSON.stringify(webhookAccount.rows[0], null, 2));
    } else {
      console.log('❌ Conta NÃO encontrada!');
    }

    // Check campaigns
    console.log('\n🔍 Verificando campanhas ativas...\n');
    const campaigns = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.status,
        c.automation_active,
        c.linkedin_account_id,
        la.profile_name as linkedin_profile,
        la.unipile_account_id
      FROM campaigns c
      LEFT JOIN linkedin_accounts la ON c.linkedin_account_id = la.id
      WHERE c.status = 'active'
      ORDER BY c.created_at DESC
      LIMIT 10
    `);

    console.log(`📋 Campanhas ativas (${campaigns.rows.length}):\n`);
    campaigns.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.name}`);
      console.log(`   Status: ${row.status} | Automation: ${row.automation_active}`);
      console.log(`   LinkedIn: ${row.linkedin_profile || 'N/A'} (${row.unipile_account_id || 'N/A'})`);
      console.log('');
    });

    // Check leads with provider_id matching sender
    console.log('\n🔍 Verificando leads com provider_id do sender (ACoAACHuGFUB8xUc5KFaoZgaIUcsPOZbtYmZo1k)...\n');
    const leads = await pool.query(`
      SELECT
        l.id,
        l.name,
        l.provider_id,
        l.linkedin_profile_id,
        l.status,
        l.campaign_id,
        c.name as campaign_name,
        c.linkedin_account_id
      FROM leads l
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      WHERE l.provider_id = 'ACoAACHuGFUB8xUc5KFaoZgaIUcsPOZbtYmZo1k'
         OR l.linkedin_profile_id = 'ACoAACHuGFUB8xUc5KFaoZgaIUcsPOZbtYmZo1k'
    `);

    if (leads.rows.length > 0) {
      console.log('✅ Lead(s) encontrado(s):');
      leads.rows.forEach(row => {
        console.log(JSON.stringify(row, null, 2));
      });
    } else {
      console.log('❌ Lead NÃO encontrado!');
    }

    await pool.end();
    process.exit(0);
  } catch (e) {
    console.error('Erro:', e.message);
    await pool.end();
    process.exit(1);
  }
}

check();
