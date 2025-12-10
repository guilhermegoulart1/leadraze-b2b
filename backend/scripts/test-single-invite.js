// Script to test sending a single invite
require('dotenv').config();
const db = require('../src/config/database');
const unipileClient = require('../src/config/unipile');

async function test() {
  try {
    console.log('\n🧪 TESTE DE ENVIO DE CONVITE');
    console.log('============================\n');

    // Get a scheduled invite that's ready
    const result = await db.query(`
      SELECT ciq.*, l.linkedin_profile_id, l.name as lead_name,
             c.name as campaign_name, la.unipile_account_id
      FROM campaign_invite_queue ciq
      JOIN leads l ON l.id = ciq.lead_id
      JOIN campaigns c ON c.id = ciq.campaign_id
      JOIN linkedin_accounts la ON la.id = ciq.linkedin_account_id
      WHERE ciq.status = 'scheduled'
        AND ciq.scheduled_for <= NOW()
        AND c.status = 'active'
        AND c.automation_active = true
      ORDER BY ciq.scheduled_for ASC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('❌ Nenhum convite pronto para envio.\n');
      console.log('Verificando próximo convite agendado...');

      const nextResult = await db.query(`
        SELECT ciq.scheduled_for, l.name as lead_name
        FROM campaign_invite_queue ciq
        JOIN leads l ON l.id = ciq.lead_id
        WHERE ciq.status = 'scheduled'
        ORDER BY ciq.scheduled_for ASC
        LIMIT 1
      `);

      if (nextResult.rows.length > 0) {
        const next = nextResult.rows[0];
        console.log(`\nPróximo convite: ${next.lead_name}`);
        console.log(`Agendado para: ${next.scheduled_for}`);
        console.log(`Hora atual: ${new Date()}`);
      }

      process.exit(0);
      return;
    }

    const invite = result.rows[0];
    console.log('📋 CONVITE ENCONTRADO:');
    console.log(`   Lead: ${invite.lead_name}`);
    console.log(`   LinkedIn Profile ID: ${invite.linkedin_profile_id}`);
    console.log(`   Unipile Account ID: ${invite.unipile_account_id}`);
    console.log(`   Campaign: ${invite.campaign_name}`);
    console.log(`   Scheduled For: ${invite.scheduled_for}`);

    // Check if Unipile is initialized
    console.log('\n📡 VERIFICANDO UNIPILE:');
    console.log(`   Initialized: ${unipileClient.isInitialized()}`);
    if (!unipileClient.isInitialized()) {
      console.log(`   Error: ${unipileClient.getError()}`);
      process.exit(1);
      return;
    }

    // Try to send the invite
    console.log('\n🚀 ENVIANDO CONVITE...');
    console.log(`   URL: https://${process.env.UNIPILE_DSN}/api/v1/users/${invite.linkedin_profile_id}/connection?account_id=${invite.unipile_account_id}`);

    try {
      const sendResult = await unipileClient.users.sendConnectionRequest({
        account_id: invite.unipile_account_id,
        user_id: invite.linkedin_profile_id,
        message: "Olá! Gostaria de conectar com você no LinkedIn."
      });

      console.log('\n✅ CONVITE ENVIADO COM SUCESSO!');
      console.log('   Response:', JSON.stringify(sendResult, null, 2));
    } catch (apiError) {
      console.log('\n❌ ERRO DA API UNIPILE:');
      console.log(`   Status: ${apiError.response?.status}`);
      console.log(`   Status Text: ${apiError.response?.statusText}`);
      console.log(`   Error Type: ${apiError.response?.data?.type}`);
      console.log(`   Error Detail: ${apiError.response?.data?.detail}`);
      console.log(`   Error Message: ${apiError.message}`);
      console.log(`   Full Response: ${JSON.stringify(apiError.response?.data, null, 2)}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.error(error);
    process.exit(1);
  }
}

test();
