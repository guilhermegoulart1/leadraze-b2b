// Script to check failed invites
require('dotenv').config();
const db = require('../src/config/database');

async function check() {
  try {
    // Check failed invites with details
    const result = await db.query(`
      SELECT
        ciq.id,
        ciq.status,
        ciq.scheduled_for,
        ciq.updated_at,
        l.name as lead_name,
        l.linkedin_profile_id,
        l.status as lead_status,
        c.name as campaign_name,
        la.unipile_account_id
      FROM campaign_invite_queue ciq
      JOIN leads l ON l.id = ciq.lead_id
      JOIN campaigns c ON c.id = ciq.campaign_id
      JOIN linkedin_accounts la ON la.id = ciq.linkedin_account_id
      WHERE ciq.status = 'failed'
      ORDER BY ciq.updated_at DESC
      LIMIT 10
    `);

    console.log('\n📊 CONVITES COM FALHA:');
    console.log('=======================');
    result.rows.forEach((row, i) => {
      console.log(`\n${i + 1}. ${row.lead_name}`);
      console.log(`   Queue ID: ${row.id}`);
      console.log(`   LinkedIn Profile ID: ${row.linkedin_profile_id}`);
      console.log(`   Lead Status: ${row.lead_status}`);
      console.log(`   Scheduled For: ${row.scheduled_for}`);
      console.log(`   Updated At: ${row.updated_at}`);
      console.log(`   Unipile Account ID: ${row.unipile_account_id}`);
    });

    // Check the Unipile account status
    console.log('\n\n📱 VERIFICANDO CONTA LINKEDIN:');
    console.log('================================');
    const accountResult = await db.query(`
      SELECT id, name, status, unipile_account_id, connection_status, last_sync_at
      FROM linkedin_accounts
      WHERE id IN (SELECT DISTINCT linkedin_account_id FROM campaign_invite_queue WHERE status = 'failed')
    `);

    accountResult.rows.forEach(acc => {
      console.log(`  ${acc.name}:`);
      console.log(`    Status: ${acc.status}`);
      console.log(`    Connection Status: ${acc.connection_status}`);
      console.log(`    Unipile ID: ${acc.unipile_account_id}`);
      console.log(`    Last Sync: ${acc.last_sync_at}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Erro:', error.message);
    process.exit(1);
  }
}

check();
