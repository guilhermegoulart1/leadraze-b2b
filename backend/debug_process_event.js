/**
 * Debug script - directly calls processEvent to see the exact error
 * Run on server: node debug_process_event.js
 */
require('dotenv').config();
const db = require('./src/config/database');
const workflowExecutionService = require('./src/services/workflowExecutionService');
const workflowStateService = require('./src/services/workflowStateService');

const CONVERSATION_ID = '4d2e8fe0-da06-49b6-80d1-0d84c26dade2'; // Gabriel Matias (active, simplest case)

async function main() {
  try {
    console.log('=== Debug processEvent ===\n');

    // 1. Check current state
    const state = await workflowStateService.getWorkflowState(CONVERSATION_ID);
    console.log('Current state:', {
      status: state?.status,
      currentNodeId: state?.currentNodeId,
      resumeNodeId: state?.resumeNodeId,
      pausedReason: state?.pausedReason,
      stepHistoryCount: state?.stepHistory?.length
    });

    if (!state) {
      console.log('No workflow state found!');
      process.exit(1);
    }

    // 2. If not paused, set it to paused for resume
    if (state.status !== 'paused') {
      console.log('\nSetting state to paused for resume...');
      await db.query(`
        UPDATE conversation_workflow_state
        SET status = 'paused',
            paused_reason = 'wait_action',
            resume_node_id = current_node_id,
            updated_at = NOW()
        WHERE conversation_id = $1
      `, [CONVERSATION_ID]);
    }

    // 3. Resume workflow
    console.log('\nResuming workflow...');
    await workflowStateService.resumeWorkflow(CONVERSATION_ID);

    // 4. Get fresh state after resume
    const freshState = await workflowStateService.getWorkflowState(CONVERSATION_ID);
    console.log('State after resume:', {
      status: freshState?.status,
      currentNodeId: freshState?.currentNodeId
    });

    // 5. Call processEvent
    console.log('\nCalling processEvent...');
    const result = await workflowExecutionService.processEvent(
      CONVERSATION_ID,
      'timer_completed',
      { resumeNodeId: 'conversationStep-1770371785281' }
    );

    console.log('\nProcessEvent result:', JSON.stringify({
      processed: result.processed,
      reason: result.reason,
      response: result.response ? result.response.substring(0, 100) + '...' : null,
      allResponsesCount: result.allResponses?.length || 0,
      executedNodesCount: result.executedNodes?.length || 0,
      paused: result.paused,
      completed: result.completed
    }, null, 2));

    if (result.allResponses?.length > 0) {
      console.log('\nAll responses:');
      for (const r of result.allResponses) {
        const text = typeof r === 'string' ? r : r?.message;
        console.log(`  - [${r?.type || 'string'}] ${text?.substring(0, 80)}...`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

main();
