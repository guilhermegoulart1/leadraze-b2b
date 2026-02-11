/**
 * Test Unipile messaging.send directly
 * Run on server: node test_unipile_send.js
 */
require('dotenv').config();
const db = require('./src/config/database');
const unipileClient = require('./src/config/unipile');

async function main() {
  try {
    console.log('=== Test Unipile Send ===\n');

    // Get Gabriel Matias conversation data
    const convId = '4d2e8fe0-da06-49b6-80d1-0d84c26dade2';

    const convData = await db.query(
      `SELECT c.id, la.unipile_account_id, la.profile_name,
              ct.linkedin_profile_id as lead_unipile_id, ct.name as contact_name
       FROM conversations c
       LEFT JOIN linkedin_accounts la ON c.linkedin_account_id = la.id
       LEFT JOIN contacts ct ON c.contact_id = ct.id
       WHERE c.id = $1`,
      [convId]
    );
    const conv = convData.rows[0];

    console.log('Conversation data:', {
      id: conv?.id,
      unipile_account_id: conv?.unipile_account_id,
      profile_name: conv?.profile_name,
      lead_unipile_id: conv?.lead_unipile_id,
      contact_name: conv?.contact_name
    });

    if (!conv?.unipile_account_id) {
      console.log('❌ No unipile_account_id found!');
      process.exit(1);
    }

    if (!conv?.lead_unipile_id) {
      console.log('❌ No lead_unipile_id found!');
      process.exit(1);
    }

    // Test sending (dry run first - just log what we would send)
    const testMessage = 'Test message from Getraze - ignore this';

    console.log('\nWould send:');
    console.log(`  account_id: ${conv.unipile_account_id}`);
    console.log(`  user_id: ${conv.lead_unipile_id}`);
    console.log(`  text: ${testMessage}`);

    // Check what methods are available on unipileClient
    console.log('\nunipileClient type:', typeof unipileClient);
    console.log('unipileClient keys:', Object.keys(unipileClient));
    if (unipileClient.messaging) {
      console.log('messaging type:', typeof unipileClient.messaging);
      console.log('messaging keys:', Object.keys(unipileClient.messaging));
      console.log('messaging.send type:', typeof unipileClient.messaging?.send);
    } else {
      console.log('❌ unipileClient.messaging does not exist!');
      console.log('Available on client:', JSON.stringify(Object.keys(unipileClient), null, 2));

      // Check if it's a different API structure
      if (unipileClient.sendMessage) {
        console.log('✅ unipileClient.sendMessage exists');
      }
      if (unipileClient.messages) {
        console.log('✅ unipileClient.messages exists, keys:', Object.keys(unipileClient.messages));
      }
    }

    // Actually test the send
    console.log('\n--- Testing actual send ---');
    try {
      const sendResult = await unipileClient.messaging.send({
        account_id: conv.unipile_account_id,
        user_id: conv.lead_unipile_id,
        text: 'Olá Gabriel, obrigado por aceitar meu convite de conexão!'
      });
      console.log('✅ Send SUCCESS:', JSON.stringify(sendResult, null, 2));
    } catch (sendErr) {
      console.error('❌ Send FAILED:', sendErr.message);
      console.error('Error code:', sendErr.code);
      console.error('Error response:', JSON.stringify(sendErr.response?.data || sendErr.response?.status || 'no response data'));
      console.error('Full error keys:', Object.keys(sendErr));
      if (sendErr.stack) console.error('Stack:', sendErr.stack.split('\n').slice(0, 5).join('\n'));
    }

    process.exit(0);
  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

main();
