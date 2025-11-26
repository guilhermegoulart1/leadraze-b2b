/**
 * Test script for conversation summary feature
 * This script tests the progressive summary implementation
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/config/database');
const conversationSummaryService = require('../src/services/conversationSummaryService');

async function testSummary() {
  console.log('\n🧪 Testing Conversation Summary Feature\n');
  console.log('='.repeat(60));

  try {
    // 1. Find a conversation with multiple messages
    console.log('\n📋 Step 1: Finding a conversation with messages...\n');

    const conversationsResult = await db.query(`
      SELECT
        c.id,
        c.unipile_chat_id,
        c.messages_count,
        c.context_summary,
        COUNT(m.id) as actual_message_count,
        l.name as lead_name,
        camp.name as campaign_name
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      LEFT JOIN leads l ON l.id = c.lead_id
      LEFT JOIN campaigns camp ON camp.id = c.campaign_id
      GROUP BY c.id, c.unipile_chat_id, c.messages_count, c.context_summary, l.name, camp.name
      HAVING COUNT(m.id) >= 5
      ORDER BY COUNT(m.id) DESC
      LIMIT 5
    `);

    if (conversationsResult.rows.length === 0) {
      console.log('❌ No conversations found with messages. Please run the app first to generate some conversations.');
      process.exit(0);
    }

    console.log(`✅ Found ${conversationsResult.rows.length} conversations with messages:\n`);

    conversationsResult.rows.forEach((conv, idx) => {
      console.log(`${idx + 1}. ${conv.lead_name || 'Unknown Lead'} (${conv.campaign_name || 'No campaign'})`);
      console.log(`   - Conversation ID: ${conv.id}`);
      console.log(`   - Messages: ${conv.actual_message_count}`);
      console.log(`   - Has summary: ${conv.context_summary ? 'YES' : 'NO'}`);
      console.log('');
    });

    // Pick the first conversation
    const testConversation = conversationsResult.rows[0];
    console.log(`\n🎯 Testing with conversation: ${testConversation.lead_name}`);
    console.log(`   Messages: ${testConversation.actual_message_count}`);
    console.log('');
    console.log('='.repeat(60));

    // 2. Get current context (before generating summary)
    console.log('\n📊 Step 2: Getting current context...\n');

    const contextBefore = await conversationSummaryService.getContextForAI(testConversation.id);

    console.log(`Stats BEFORE summary generation:`);
    console.log(`   - Total messages: ${contextBefore.stats.totalMessages}`);
    console.log(`   - Recent messages: ${contextBefore.stats.recentMessagesCount}`);
    console.log(`   - Has summary: ${contextBefore.stats.hasSummary ? 'YES' : 'NO'}`);
    console.log(`   - Summary tokens: ${contextBefore.stats.summaryTokens}`);
    console.log(`   - Recent tokens: ${contextBefore.stats.recentTokens}`);
    console.log(`   - Total tokens: ${contextBefore.stats.totalTokens}`);
    console.log('');

    if (contextBefore.stats.hasSummary) {
      console.log(`📝 Current summary:\n`);
      console.log(contextBefore.summary);
      console.log('');
    }

    // 3. Generate or update summary
    console.log('='.repeat(60));
    console.log('\n🤖 Step 3: Processing conversation for summary...\n');

    const summaryResult = await conversationSummaryService.processConversation(testConversation.id);

    if (!summaryResult) {
      console.log('ℹ️  Summary not generated (not enough messages or not needed yet)');
      console.log(`   Minimum required: ${conversationSummaryService.CONFIG.MIN_MESSAGES_FOR_SUMMARY} messages`);
      console.log(`   Current messages: ${contextBefore.stats.totalMessages}`);
    } else {
      console.log('✅ Summary processing completed!\n');
      console.log(`   Token count: ${summaryResult.tokenCount}`);
      console.log(`   Messages summarized: ${summaryResult.messagesSummarized}`);
      if (summaryResult.wasCompressed) {
        console.log(`   ⚠️  Summary was compressed (was getting too long)`);
      }
      console.log('');
      console.log('📝 Generated/Updated summary:\n');
      console.log(summaryResult.summary);
      console.log('');
    }

    // 4. Get context after summary
    console.log('='.repeat(60));
    console.log('\n📊 Step 4: Getting context AFTER summary generation...\n');

    const contextAfter = await conversationSummaryService.getContextForAI(testConversation.id);

    console.log(`Stats AFTER summary generation:`);
    console.log(`   - Total messages: ${contextAfter.stats.totalMessages}`);
    console.log(`   - Recent messages: ${contextAfter.stats.recentMessagesCount}`);
    console.log(`   - Has summary: ${contextAfter.stats.hasSummary ? 'YES' : 'NO'}`);
    console.log(`   - Summary tokens: ${contextAfter.stats.summaryTokens}`);
    console.log(`   - Recent tokens: ${contextAfter.stats.recentTokens}`);
    console.log(`   - Total tokens: ${contextAfter.stats.totalTokens}`);
    console.log('');

    // 5. Show token savings
    if (contextAfter.stats.hasSummary) {
      console.log('='.repeat(60));
      console.log('\n💰 Token Savings Analysis:\n');

      const oldApproach = conversationSummaryService.estimateTokens(
        contextBefore.recentMessages.map(m => m.content).join(' ')
      ) * 2; // Rough estimate if we sent all messages

      const newApproach = contextAfter.stats.totalTokens;
      const savings = oldApproach - newApproach;
      const savingsPercent = ((savings / oldApproach) * 100).toFixed(1);

      console.log(`   Old approach (all messages): ~${oldApproach} tokens`);
      console.log(`   New approach (summary + recent): ${newApproach} tokens`);
      console.log(`   Savings: ${savings} tokens (${savingsPercent}%)`);
      console.log('');
    }

    // 6. Show recent messages preview
    console.log('='.repeat(60));
    console.log('\n📬 Recent messages preview (last 5):\n');

    const recentPreview = contextAfter.recentMessages.slice(-5);
    recentPreview.forEach((msg, idx) => {
      const sender = msg.sender_type === 'lead' ? '👤 Lead' :
                     msg.sender_type === 'ai' ? '🤖 AI' : '👨‍💼 User';
      console.log(`${idx + 1}. ${sender}: ${msg.content.substring(0, 80)}${msg.content.length > 80 ? '...' : ''}`);
    });
    console.log('');

    // 7. Test recommendations
    console.log('='.repeat(60));
    console.log('\n✅ Test Complete!\n');
    console.log('📌 What to do next:\n');
    console.log('1. Send a new message to this conversation via Unipile');
    console.log('2. The webhook will automatically update the summary');
    console.log('3. The AI will use the summary + recent messages for context');
    console.log('');
    console.log('🔧 API Endpoints to test:');
    console.log(`   GET  /api/conversations/${testConversation.id}/summary`);
    console.log(`   POST /api/conversations/${testConversation.id}/summary/generate`);
    console.log(`   POST /api/conversations/${testConversation.id}/summary/update`);
    console.log('');
    console.log('📊 Configuration:');
    console.log(`   - Min messages for summary: ${conversationSummaryService.CONFIG.MIN_MESSAGES_FOR_SUMMARY}`);
    console.log(`   - Recent messages window: ${conversationSummaryService.CONFIG.RECENT_MESSAGES_WINDOW}`);
    console.log(`   - Max summary tokens: ${conversationSummaryService.CONFIG.MAX_SUMMARY_TOKENS}`);
    console.log(`   - Update frequency: Every ${conversationSummaryService.CONFIG.UPDATE_FREQUENCY} messages`);
    console.log('');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

// Run test
if (require.main === module) {
  testSummary()
    .then(() => {
      console.log('\n✅ Test completed successfully!\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testSummary };
