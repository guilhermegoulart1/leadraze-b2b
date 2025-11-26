/**
 * Check conversations in database
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/config/database');

async function checkConversations() {
  try {
    console.log('\n🔍 Checking conversations in database...\n');

    // Count total conversations
    const countResult = await db.query('SELECT COUNT(*) as total FROM conversations');
    const totalConversations = countResult.rows[0].total;

    console.log(`📊 Total conversations: ${totalConversations}`);

    if (totalConversations > 0) {
      // Get some examples
      const conversationsResult = await db.query(`
        SELECT
          c.id,
          c.unipile_chat_id,
          c.messages_count,
          c.context_summary IS NOT NULL as has_summary,
          COUNT(m.id) as actual_message_count,
          l.name as lead_name
        FROM conversations c
        LEFT JOIN messages m ON m.conversation_id = c.id
        LEFT JOIN leads l ON l.id = c.lead_id
        GROUP BY c.id, c.unipile_chat_id, c.messages_count, c.context_summary, l.name
        ORDER BY COUNT(m.id) DESC
        LIMIT 10
      `);

      console.log(`\n📋 Top conversations by message count:\n`);

      conversationsResult.rows.forEach((conv, idx) => {
        console.log(`${idx + 1}. ${conv.lead_name || 'Unknown'}`);
        console.log(`   - ID: ${conv.id}`);
        console.log(`   - Chat ID: ${conv.unipile_chat_id}`);
        console.log(`   - Messages: ${conv.actual_message_count} (stored count: ${conv.messages_count || 0})`);
        console.log(`   - Has summary: ${conv.has_summary ? 'YES' : 'NO'}`);
        console.log('');
      });
    } else {
      console.log('\n⚠️  No conversations found in database');
      console.log('');
      console.log('To test the summary feature:');
      console.log('1. Start the backend server: npm run dev');
      console.log('2. Make sure you have active campaigns with automation');
      console.log('3. Wait for webhook messages from Unipile');
      console.log('4. Or manually seed some test data');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.pool.end();
  }
}

checkConversations();
