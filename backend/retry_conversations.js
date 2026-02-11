/**
 * Retry script for stuck conversations in campaign 05db5ba8
 *
 * This script:
 * 1. Resets workflow states for conversations that failed during resume
 * 2. Adds resume_workflow jobs to the followUpQueue
 *
 * Run on server after deploying the fixed code:
 *   node retry_conversations.js
 */

require('dotenv').config();
const db = require('./src/config/database');
const { followUpQueue } = require('./src/queues');

const CAMPAIGN_ID = '05db5ba8-0bd8-48fc-ba73-866dd0c2fbcb';

async function main() {
  try {
    console.log('=== Retry Stuck Conversations ===\n');

    // Get all workflow states for this campaign
    const result = await db.query(`
      SELECT cws.conversation_id, cws.status, cws.current_node_id,
             cws.resume_node_id, cws.paused_reason, cws.step_history,
             ct.name as contact_name
      FROM conversation_workflow_state cws
      JOIN conversations cv ON cv.id = cws.conversation_id
      JOIN contacts ct ON ct.id = cv.contact_id
      WHERE cv.campaign_id = $1
      ORDER BY cws.updated_at DESC
    `, [CAMPAIGN_ID]);

    // Check which ones have messages already
    const msgResult = await db.query(`
      SELECT DISTINCT conversation_id
      FROM messages
      WHERE conversation_id IN (SELECT id FROM conversations WHERE campaign_id = $1)
    `, [CAMPAIGN_ID]);
    const conversationsWithMessages = new Set(msgResult.rows.map(r => r.conversation_id));

    let retryCount = 0;

    for (const row of result.rows) {
      const convId = row.conversation_id;
      const shortId = convId.substring(0, 8);
      const hasMessages = conversationsWithMessages.has(convId);
      const stepNodeIds = (row.step_history || []).map(s => s.nodeId);

      console.log(`\n[${shortId}] ${row.contact_name}`);
      console.log(`  Status: ${row.status}, Node: ${row.current_node_id}, Reason: ${row.paused_reason}`);
      console.log(`  Has messages: ${hasMessages}, Steps: ${stepNodeIds.join(' → ')}`);

      // Skip if already has messages (successfully processed)
      if (hasMessages) {
        console.log(`  ✅ Already has messages, skipping`);
        continue;
      }

      // Special case: conversation 9ac7a726 is at a second wait action
      // It should resume to its own resume_node_id
      if (row.status === 'paused' && row.paused_reason === 'wait_action' && row.resume_node_id) {
        console.log(`  🔄 Already at wait_action, adding resume job → ${row.resume_node_id}`);
        await followUpQueue.add(
          {
            type: 'resume_workflow',
            conversationId: convId,
            nodeId: row.resume_node_id
          },
          {
            delay: 1000 * (retryCount + 1), // Stagger by 1 second each
            attempts: 2,
            removeOnComplete: true,
            removeOnFail: { age: 24 * 3600 }
          }
        );
        retryCount++;
        continue;
      }

      // For conversations that need to (re-)execute conversationStep-1770371785281:
      // Remove it from step_history so hasThisNodeBeenExecuted = false
      const conversationStepId = 'conversationStep-1770371785281';
      const hasConvStepInHistory = stepNodeIds.includes(conversationStepId);

      if (hasConvStepInHistory) {
        // Remove conversationStep entries from step_history
        const cleanedHistory = (row.step_history || []).filter(s => s.nodeId !== conversationStepId);
        console.log(`  🧹 Removing ${stepNodeIds.filter(id => id === conversationStepId).length} conversationStep entries from history`);

        await db.query(`
          UPDATE conversation_workflow_state
          SET step_history = $1,
              status = 'paused',
              paused_reason = 'wait_action',
              current_node_id = $2,
              resume_node_id = $3,
              updated_at = NOW()
          WHERE conversation_id = $4
        `, [JSON.stringify(cleanedHistory), conversationStepId, conversationStepId, convId]);
      } else {
        // conversationStep not in history, just set correct state
        console.log(`  🔧 Setting state to paused/wait_action for resume`);

        await db.query(`
          UPDATE conversation_workflow_state
          SET status = 'paused',
              paused_reason = 'wait_action',
              current_node_id = $1,
              resume_node_id = $1,
              updated_at = NOW()
          WHERE conversation_id = $2
        `, [conversationStepId, convId]);
      }

      // Add resume job
      console.log(`  📤 Adding resume_workflow job → ${conversationStepId}`);
      await followUpQueue.add(
        {
          type: 'resume_workflow',
          conversationId: convId,
          nodeId: conversationStepId
        },
        {
          delay: 1000 * (retryCount + 1),
          attempts: 2,
          removeOnComplete: true,
          removeOnFail: { age: 24 * 3600 }
        }
      );
      retryCount++;
    }

    console.log(`\n=== Done. Added ${retryCount} retry jobs ===`);

    // Show queue status
    const counts = await followUpQueue.getJobCounts();
    console.log('Queue status:', JSON.stringify(counts));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
