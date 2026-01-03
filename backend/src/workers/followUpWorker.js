// backend/src/workers/followUpWorker.js

/**
 * Follow-Up Worker
 *
 * Processes scheduled workflow actions:
 * - Resume paused workflows
 * - Check for no_response conditions
 * - Execute follow-up flows
 */

const { followUpQueue } = require('../queues');
const db = require('../config/database');
const workflowExecutionService = require('../services/workflowExecutionService');
const workflowStateService = require('../services/workflowStateService');
const workflowLogService = require('../services/workflowLogService');

/**
 * Process follow-up job
 */
async function processFollowUpJob(job) {
  const { type, conversationId, nodeId, scheduledFor, agentId } = job.data;

  console.log(`\n🔄 Processing follow-up job: ${type} for conversation ${conversationId}`);

  try {
    switch (type) {
      case 'resume_workflow':
        return await handleResumeWorkflow(conversationId, nodeId);

      case 'check_no_response':
        return await handleCheckNoResponse(conversationId, agentId);

      case 'follow_up_flow':
        return await handleFollowUpFlow(conversationId, agentId, job.data);

      default:
        console.warn(`⚠️ Unknown follow-up job type: ${type}`);
        return { success: false, reason: `unknown_type: ${type}` };
    }
  } catch (error) {
    console.error(`❌ Follow-up job failed:`, error);
    throw error;
  }
}

/**
 * Resume a paused workflow
 */
async function handleResumeWorkflow(conversationId, resumeNodeId) {
  console.log(`▶️ Resuming workflow for conversation ${conversationId}`);

  // Get current workflow state
  const state = await workflowStateService.getWorkflowState(conversationId);

  if (!state) {
    console.log(`⚠️ No workflow state found for conversation ${conversationId}`);
    return { success: false, reason: 'no_workflow_state' };
  }

  if (state.status !== 'paused') {
    console.log(`⚠️ Workflow is not paused (status: ${state.status})`);
    return { success: false, reason: `not_paused: ${state.status}` };
  }

  // Log workflow resume
  await workflowLogService.logWorkflowResumed({
    conversationId,
    agentId: state.agentId,
    nodeId: resumeNodeId || state.resumeNodeId,
    inputData: { pausedReason: state.pausedReason }
  });

  // Resume the workflow
  await workflowStateService.resumeWorkflow(conversationId);

  // Continue processing from resume node
  const result = await workflowExecutionService.processEvent(
    conversationId,
    'timer_completed',
    { resumeNodeId: resumeNodeId || state.resumeNodeId }
  );

  return {
    success: true,
    resumed: true,
    result
  };
}

/**
 * Check if lead has not responded and trigger no_response event
 */
async function handleCheckNoResponse(conversationId, agentId) {
  console.log(`🔍 Checking no_response for conversation ${conversationId}`);

  // Get last message info
  const messagesResult = await db.query(
    `SELECT sender_type, sent_at
     FROM messages
     WHERE conversation_id = $1
     ORDER BY sent_at DESC
     LIMIT 1`,
    [conversationId]
  );

  if (!messagesResult.rows || messagesResult.rows.length === 0) {
    console.log(`⚠️ No messages found for conversation ${conversationId}`);
    return { success: false, reason: 'no_messages' };
  }

  const lastMessage = messagesResult.rows[0];

  // If last message was from lead, they responded - no action needed
  if (lastMessage.sender_type === 'lead') {
    console.log(`✅ Lead has responded, no follow-up needed`);
    return { success: true, action: 'none', reason: 'lead_responded' };
  }

  // Check if conversation is still active
  const convResult = await db.query(
    `SELECT ai_active, status, manual_control_taken
     FROM conversations
     WHERE id = $1`,
    [conversationId]
  );

  const conv = convResult.rows[0];

  if (!conv || !conv.ai_active || conv.manual_control_taken) {
    console.log(`⚠️ Conversation is not active or manual control taken`);
    return { success: false, reason: 'conversation_not_active' };
  }

  // Trigger no_response event in workflow
  console.log(`📨 Triggering no_response event for conversation ${conversationId}`);

  const result = await workflowExecutionService.processEvent(
    conversationId,
    'no_response',
    { timeSinceLastMessage: Date.now() - new Date(lastMessage.sent_at).getTime() }
  );

  return {
    success: true,
    action: 'no_response_triggered',
    result
  };
}

/**
 * Execute a follow-up flow for a conversation
 */
async function handleFollowUpFlow(conversationId, agentId, jobData) {
  console.log(`📋 Executing follow-up flow for conversation ${conversationId}`);

  const { flowId, flowDefinition } = jobData;

  // Get follow-up flow if not provided
  let workflow = flowDefinition;

  if (!workflow && flowId) {
    const flowResult = await db.query(
      `SELECT flow_definition FROM follow_up_flows WHERE id = $1`,
      [flowId]
    );

    if (flowResult.rows && flowResult.rows.length > 0) {
      workflow = flowResult.rows[0].flow_definition;
    }
  }

  if (!workflow) {
    console.log(`⚠️ No follow-up flow definition found`);
    return { success: false, reason: 'no_flow_definition' };
  }

  // Execute the follow-up flow
  // This is similar to regular workflow but separate context
  const result = await workflowExecutionService.processEvent(
    conversationId,
    'follow_up_triggered',
    { flowId, workflow },
    { isFollowUp: true }
  );

  // Record execution
  if (flowId) {
    await db.query(
      `UPDATE follow_up_flows
       SET total_executions = total_executions + 1,
           ${result.processed ? 'successful_executions = successful_executions + 1' : 'failed_executions = failed_executions + 1'},
           updated_at = NOW()
       WHERE id = $1`,
      [flowId]
    );
  }

  return {
    success: true,
    action: 'follow_up_executed',
    result
  };
}

/**
 * Schedule a no_response check
 * @param {string} conversationId - Conversation UUID
 * @param {number} agentId - Agent ID
 * @param {number} delayMs - Delay in milliseconds before checking
 * @returns {Promise<object>} Scheduled job info
 */
async function scheduleNoResponseCheck(conversationId, agentId, delayMs) {
  const job = await followUpQueue.add(
    {
      type: 'check_no_response',
      conversationId,
      agentId,
      scheduledFor: new Date(Date.now() + delayMs).toISOString()
    },
    {
      delay: delayMs,
      removeOnComplete: true,
      removeOnFail: {
        age: 24 * 3600 // 24 hours
      }
    }
  );

  console.log(`⏰ Scheduled no_response check for conversation ${conversationId} in ${Math.round(delayMs / 60000)} minutes`);

  return {
    jobId: job.id,
    scheduledFor: new Date(Date.now() + delayMs)
  };
}

/**
 * Schedule workflow resume
 * @param {string} conversationId - Conversation UUID
 * @param {string} nodeId - Node to resume at
 * @param {number} delayMs - Delay in milliseconds
 * @returns {Promise<object>} Scheduled job info
 */
async function scheduleWorkflowResume(conversationId, nodeId, delayMs) {
  const job = await followUpQueue.add(
    {
      type: 'resume_workflow',
      conversationId,
      nodeId,
      scheduledFor: new Date(Date.now() + delayMs).toISOString()
    },
    {
      delay: delayMs,
      removeOnComplete: true,
      removeOnFail: {
        age: 24 * 3600 // 24 hours
      }
    }
  );

  console.log(`⏰ Scheduled workflow resume for conversation ${conversationId} in ${Math.round(delayMs / 60000)} minutes`);

  return {
    jobId: job.id,
    scheduledFor: new Date(Date.now() + delayMs)
  };
}

/**
 * Cancel scheduled jobs for a conversation
 * @param {string} conversationId - Conversation UUID
 * @returns {Promise<number>} Number of cancelled jobs
 */
async function cancelScheduledJobs(conversationId) {
  console.log(`🛑 Cancelling scheduled jobs for conversation ${conversationId}`);

  try {
    // Get all waiting and delayed jobs
    const waitingJobs = await followUpQueue.getWaiting();
    const delayedJobs = await followUpQueue.getDelayed();

    const allJobs = [...waitingJobs, ...delayedJobs];
    let cancelledCount = 0;

    for (const job of allJobs) {
      if (job.data.conversationId === conversationId) {
        await job.remove();
        cancelledCount++;
        console.log(`✅ Cancelled job ${job.id} (${job.data.type})`);
      }
    }

    if (cancelledCount === 0) {
      console.log(`ℹ️ No pending jobs found for conversation ${conversationId}`);
    }

    return cancelledCount;
  } catch (error) {
    console.error('❌ Error cancelling scheduled jobs:', error);
    return 0;
  }
}

// Register queue processor
followUpQueue.process(async (job) => {
  return await processFollowUpJob(job);
});

// Event handlers
followUpQueue.on('completed', (job, result) => {
  const emoji = result.success ? '✅' : '⚠️';
  console.log(`${emoji} Follow-up job ${job.id} completed: ${result.action || result.reason || 'success'}`);
});

followUpQueue.on('failed', (job, err) => {
  console.error(`❌ Follow-up job ${job.id} failed:`, err.message);
});

followUpQueue.on('stalled', (job) => {
  console.warn(`⚠️ Follow-up job ${job.id} stalled, will be reprocessed`);
});

module.exports = {
  processFollowUpJob,
  handleResumeWorkflow,
  handleCheckNoResponse,
  handleFollowUpFlow,
  scheduleNoResponseCheck,
  scheduleWorkflowResume,
  cancelScheduledJobs
};
