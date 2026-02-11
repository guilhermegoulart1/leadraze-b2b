// backend/src/workers/followUpWorker.js

/**
 * Follow-Up Worker
 *
 * Processes scheduled workflow actions:
 * - Resume paused workflows
 * - Check for no_response conditions
 * - Execute follow-up flows (sequential node execution)
 * - Resume follow-up flows after wait nodes
 */

const { followUpQueue } = require('../queues');
const db = require('../config/database');
const unipileClient = require('../config/unipile');
const workflowExecutionService = require('../services/workflowExecutionService');
const workflowStateService = require('../services/workflowStateService');
const workflowLogService = require('../services/workflowLogService');
const { executeAction } = require('../services/workflowActionExecutors');

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

      case 'follow_up_flow_resume':
        return await handleFollowUpFlowResume(conversationId, agentId, job.data);

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

  // Check if conversation is still eligible (AI active, not in manual mode)
  if (!await isConversationEligible(conversationId)) {
    return { success: false, reason: 'conversation_not_eligible' };
  }

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

  // If workflow generated a response, send it via Unipile
  // allResponses contains objects { nodeId, nodeLabel, message, type }
  // result.response is a plain string
  const responseTexts = [];
  if (result.allResponses?.length > 0) {
    for (const r of result.allResponses) {
      const text = typeof r === 'string' ? r : r?.message;
      if (text) responseTexts.push(text);
    }
  } else if (result.response) {
    responseTexts.push(result.response);
  }

  if (responseTexts.length > 0) {
    // Check if already sent by an action node
    const sentByAction = result.executedNodes?.some(
      n => n.nodeType === 'action' && n.result?.result?.sent === true
    );

    if (!sentByAction) {
      // Get conversation data for sending
      const convData = await db.query(
        `SELECT c.id, la.unipile_account_id, ct.linkedin_profile_id as lead_unipile_id
         FROM conversations c
         LEFT JOIN linkedin_accounts la ON c.linkedin_account_id = la.id
         LEFT JOIN contacts ct ON c.contact_id = ct.id
         WHERE c.id = $1`,
        [conversationId]
      );
      const conv = convData.rows[0];

      if (conv?.unipile_account_id && conv?.lead_unipile_id) {
        for (const messageText of responseTexts) {
          console.log(`📤 [ResumeWorkflow] Sending response (${messageText.length} chars) via Unipile...`);

          // Wrap in try-catch to prevent destructive retry
          // If Unipile fails but we save locally, the state is preserved
          let sentViaUnipile = false;
          try {
            await unipileClient.messaging.send({
              account_id: conv.unipile_account_id,
              user_id: conv.lead_unipile_id,
              text: messageText
            });
            sentViaUnipile = true;
            console.log(`✅ [ResumeWorkflow] Message sent via Unipile`);
          } catch (sendError) {
            console.error(`❌ [ResumeWorkflow] Unipile send failed: ${sendError.message}`);
            console.error(`❌ [ResumeWorkflow] Error details:`, JSON.stringify(sendError.response?.data || sendError.code || sendError.message));
          }

          // Always save message locally (even if Unipile failed)
          await db.insert('messages', {
            conversation_id: conversationId,
            sender_type: 'ai',
            content: messageText,
            message_type: 'text',
            sent_at: sentViaUnipile ? new Date() : null,
            created_at: new Date(),
            metadata: sentViaUnipile ? null : JSON.stringify({ send_failed: true, error: 'unipile_send_failed' })
          });

          await db.update('conversations', {
            last_message_at: new Date(),
            last_message_preview: messageText.substring(0, 100),
            updated_at: new Date()
          }, { id: conversationId });

          console.log(`✅ [ResumeWorkflow] Message saved to DB (sent=${sentViaUnipile})`);
        }
      } else {
        console.error(`❌ [ResumeWorkflow] Missing Unipile config: account=${conv?.unipile_account_id}, lead=${conv?.lead_unipile_id}`);
      }
    } else {
      console.log(`✅ [ResumeWorkflow] Response already sent by action node`);
    }
  }

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

// ============================================================
// Follow-Up Flow Execution Engine
// ============================================================

/**
 * Execute a follow-up flow for a conversation.
 * Walks through the flow nodes sequentially: trigger -> action -> action -> ...
 * Wait nodes schedule a delayed resume job and return.
 */
async function handleFollowUpFlow(conversationId, agentId, jobData) {
  const { flowId } = jobData;
  console.log(`📋 [FollowUp] Starting follow-up flow ${flowId} for conversation ${conversationId}`);

  // 1. Load flow definition
  const flowResult = await db.query(
    `SELECT flow_definition, name FROM follow_up_flows WHERE id = $1 AND is_active = true`,
    [flowId]
  );

  if (!flowResult.rows?.length) {
    console.log(`⚠️ [FollowUp] Flow ${flowId} not found or not active`);
    return { success: false, reason: 'flow_not_found_or_inactive' };
  }

  const flowDef = flowResult.rows[0].flow_definition;
  const flowName = flowResult.rows[0].name;
  const { nodes, edges } = flowDef;

  if (!nodes?.length) {
    console.log(`⚠️ [FollowUp] Flow ${flowId} has no nodes`);
    return { success: false, reason: 'empty_flow' };
  }

  // 2. Check preconditions
  if (!await isConversationEligible(conversationId)) {
    return { success: false, reason: 'conversation_not_eligible' };
  }

  if (await hasLeadResponded(conversationId)) {
    console.log(`✅ [FollowUp] Lead already responded, skipping flow "${flowName}"`);
    return { success: true, action: 'skipped', reason: 'lead_responded' };
  }

  // 3. Find trigger node and start from first action
  const triggerNode = nodes.find(n => n.type === 'trigger');
  if (!triggerNode) {
    console.log(`⚠️ [FollowUp] No trigger node in flow "${flowName}"`);
    return { success: false, reason: 'no_trigger_node' };
  }

  const firstNodeId = getNextNodeId(edges, triggerNode.id);
  if (!firstNodeId) {
    console.log(`⚠️ [FollowUp] No nodes after trigger in flow "${flowName}"`);
    return { success: false, reason: 'no_nodes_after_trigger' };
  }

  console.log(`▶️ [FollowUp] Executing flow "${flowName}" starting from node ${firstNodeId}`);

  // 4. Execute nodes sequentially
  return await executeFollowUpNodesFrom(firstNodeId, nodes, edges, conversationId, agentId, flowId, flowName);
}

/**
 * Resume a follow-up flow after a wait node completed.
 */
async function handleFollowUpFlowResume(conversationId, agentId, jobData) {
  const { flowId, resumeFromNodeId } = jobData;
  console.log(`▶️ [FollowUp] Resuming flow ${flowId} from node ${resumeFromNodeId} for conversation ${conversationId}`);

  if (!resumeFromNodeId) {
    console.log(`⚠️ [FollowUp] No resumeFromNodeId, flow complete`);
    await recordExecution(flowId, true);
    return { success: true, action: 'completed' };
  }

  // Re-check if lead responded during the wait
  if (await hasLeadResponded(conversationId)) {
    console.log(`✅ [FollowUp] Lead responded during wait, cancelling flow`);
    return { success: true, action: 'cancelled_during_wait', reason: 'lead_responded' };
  }

  if (!await isConversationEligible(conversationId)) {
    return { success: false, reason: 'conversation_not_eligible' };
  }

  // Load flow definition
  const flowResult = await db.query(
    `SELECT flow_definition, name FROM follow_up_flows WHERE id = $1`,
    [flowId]
  );

  if (!flowResult.rows?.length) {
    return { success: false, reason: 'flow_not_found' };
  }

  const { nodes, edges } = flowResult.rows[0].flow_definition;
  const flowName = flowResult.rows[0].name;

  return await executeFollowUpNodesFrom(resumeFromNodeId, nodes, edges, conversationId, agentId, flowId, flowName);
}

/**
 * Execute follow-up flow nodes starting from a given node ID.
 * Walks through nodes sequentially. Stops at wait nodes (schedules resume).
 */
async function executeFollowUpNodesFrom(startNodeId, nodes, edges, conversationId, agentId, flowId, flowName) {
  let currentNodeId = startNodeId;
  let executedCount = 0;

  while (currentNodeId) {
    const node = nodes.find(n => n.id === currentNodeId);
    if (!node) {
      console.log(`⚠️ [FollowUp] Node ${currentNodeId} not found in flow, stopping`);
      break;
    }

    // Re-check if lead responded before each action
    if (await hasLeadResponded(conversationId)) {
      console.log(`✅ [FollowUp] Lead responded mid-flow after ${executedCount} actions, stopping`);
      return { success: true, action: 'cancelled_mid_flow', reason: 'lead_responded', executedCount };
    }

    if (node.type === 'action') {
      const { actionType } = node.data;
      console.log(`🎬 [FollowUp] Executing action: ${actionType} (node ${node.id}) in flow "${flowName}"`);

      // Wait nodes schedule a delayed resume and return
      if (actionType === 'wait') {
        const delayMs = calculateWaitDelay(node.data);
        const nextNodeId = getNextNodeId(edges, currentNodeId);

        const job = await followUpQueue.add(
          {
            type: 'follow_up_flow_resume',
            conversationId,
            agentId,
            flowId,
            resumeFromNodeId: nextNodeId
          },
          {
            delay: delayMs,
            removeOnComplete: true,
            removeOnFail: { age: 7 * 24 * 3600 }
          }
        );

        const waitDesc = formatWaitDescription(node.data);
        console.log(`⏰ [FollowUp] Wait ${waitDesc} scheduled, resume job ${job.id}`);

        return {
          success: true,
          action: 'waiting',
          waitDescription: waitDesc,
          delayMs,
          nextNodeId,
          jobId: job.id,
          executedCount
        };
      }

      // Execute other action types
      try {
        await executeFollowUpAction(node, conversationId, agentId);
        executedCount++;
        console.log(`✅ [FollowUp] Action ${actionType} completed (${executedCount} total)`);
      } catch (actionErr) {
        console.error(`❌ [FollowUp] Action ${actionType} failed:`, actionErr.message);
        await recordExecution(flowId, false);
        return { success: false, action: 'action_failed', actionType, error: actionErr.message, executedCount };
      }
    }

    // Move to next node
    currentNodeId = getNextNodeId(edges, currentNodeId);
  }

  // Flow completed successfully
  console.log(`✅ [FollowUp] Flow "${flowName}" completed. ${executedCount} actions executed.`);
  await recordExecution(flowId, true);
  return { success: true, action: 'completed', executedCount };
}

/**
 * Execute a single follow-up action node.
 */
async function executeFollowUpAction(node, conversationId, agentId) {
  const { actionType } = node.data;
  const context = await buildFollowUpContext(conversationId, agentId);

  switch (actionType) {
    case 'send_message': {
      // Reuse the main action executor for sending messages
      const actionNode = { data: { ...node.data, waitForResponse: false } };
      const result = await executeAction(actionNode, context);
      if (!result.success) throw new Error(result.error || 'send_message failed');
      return result;
    }

    case 'ai_message': {
      // Generate AI response using agent instructions + follow-up context
      const aiResponseService = require('../services/aiResponseService');

      const convContext = await getConversationContext(conversationId);
      const agent = await getAgentData(agentId);

      if (!agent) throw new Error('Agent not found for ai_message');

      const aiInstructions = node.data.aiInstructions || 'Envie uma mensagem de follow-up amigavel para retomar a conversa.';

      const aiResult = await aiResponseService.generateResponse({
        conversation_id: conversationId,
        lead_message: '',
        conversation_context: convContext,
        ai_agent: {
          ...agent,
          objective_instructions: `CONTEXTO: Esta e uma mensagem de follow-up porque o lead nao respondeu. ${aiInstructions}`
        },
        lead_data: context.lead,
        current_step: 0
      });

      if (aiResult?.response) {
        // Send the AI-generated message via Unipile
        const sendNode = { data: { actionType: 'send_message', message: aiResult.response, waitForResponse: false } };
        const sendResult = await executeAction(sendNode, context);
        if (!sendResult.success) throw new Error(sendResult.error || 'Failed to send AI message');
      }

      return { success: true, response: aiResult?.response };
    }

    case 'add_tag':
    case 'remove_tag':
    case 'send_email': {
      const result = await executeAction(node, context);
      if (!result.success) throw new Error(result.error || `${actionType} failed`);
      return result;
    }

    case 'transfer': {
      const result = await executeAction(node, context);
      // Disable AI since conversation is being transferred
      await db.query(
        `UPDATE conversations SET ai_active = false, manual_control_taken = true WHERE id = $1`,
        [conversationId]
      );
      return result;
    }

    case 'close_negative': {
      const result = await executeAction(node, context);
      // Mark conversation as closed
      await db.query(
        `UPDATE conversations SET ai_active = false, status = 'closed' WHERE id = $1`,
        [conversationId]
      );
      return result;
    }

    default:
      console.warn(`⚠️ [FollowUp] Unknown action type: ${actionType}`);
      return { success: false, reason: `unknown_action: ${actionType}` };
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Check if the lead has responded (last message is from lead)
 */
async function hasLeadResponded(conversationId) {
  const result = await db.query(
    `SELECT sender_type FROM messages
     WHERE conversation_id = $1
     ORDER BY sent_at DESC LIMIT 1`,
    [conversationId]
  );
  return result.rows?.[0]?.sender_type === 'lead';
}

/**
 * Check if conversation is still eligible for follow-up
 */
async function isConversationEligible(conversationId) {
  const result = await db.query(
    `SELECT ai_active, status, manual_control_taken FROM conversations WHERE id = $1`,
    [conversationId]
  );
  const conv = result.rows?.[0];
  if (!conv) {
    console.log(`⚠️ [FollowUp] Conversation ${conversationId} not found`);
    return false;
  }
  if (!conv.ai_active || conv.manual_control_taken) {
    console.log(`⚠️ [FollowUp] Conversation ${conversationId} not eligible (ai_active=${conv.ai_active}, manual=${conv.manual_control_taken})`);
    return false;
  }
  return true;
}

/**
 * Get the next node ID by following edges
 */
function getNextNodeId(edges, sourceId) {
  const edge = edges.find(e => e.source === sourceId);
  return edge?.target || null;
}

/**
 * Calculate wait delay in milliseconds from node data
 */
function calculateWaitDelay(nodeData) {
  const { waitTime = 24, waitUnit = 'hours' } = nodeData;
  const multipliers = {
    seconds: 1000,
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000
  };
  return waitTime * (multipliers[waitUnit] || multipliers.hours);
}

/**
 * Format wait description for logging
 */
function formatWaitDescription(nodeData) {
  const { waitTime = 24, waitUnit = 'hours' } = nodeData;
  const unitLabels = { seconds: 'segundos', minutes: 'minutos', hours: 'horas', days: 'dias' };
  return `${waitTime} ${unitLabels[waitUnit] || 'horas'}`;
}

/**
 * Build execution context for follow-up actions (compatible with workflowActionExecutors)
 */
async function buildFollowUpContext(conversationId, agentId) {
  const convResult = await db.query(
    `SELECT
      c.*,
      o.id as opportunity_id,
      ct.id as contact_id,
      ct.name as contact_name,
      ct.first_name as contact_first_name,
      ct.last_name as contact_last_name,
      ct.email as contact_email,
      ct.phone as contact_phone,
      ct.company as contact_company,
      ct.title as contact_title,
      ct.location as contact_location,
      ct.headline as contact_headline,
      ct.linkedin_profile_id as contact_unipile_id,
      la.unipile_account_id
     FROM conversations c
     LEFT JOIN opportunities o ON c.opportunity_id = o.id
     LEFT JOIN contacts ct ON ct.id = COALESCE(c.contact_id, o.contact_id)
     LEFT JOIN linkedin_accounts la ON c.linkedin_account_id = la.id
     WHERE c.id = $1`,
    [conversationId]
  );

  const conv = convResult.rows[0] || {};

  return {
    conversationId,
    agentId,
    opportunityId: conv.opportunity_id,
    contactId: conv.contact_id,
    leadId: conv.contact_id,
    accountId: conv.account_id,
    userId: conv.user_id,
    isTestMode: false,
    lead: {
      id: conv.contact_id,
      name: conv.contact_name,
      email: conv.contact_email,
      phone: conv.contact_phone,
      company: conv.contact_company,
      title: conv.contact_title
    },
    contact: {
      id: conv.contact_id,
      name: conv.contact_name,
      first_name: conv.contact_first_name,
      last_name: conv.contact_last_name,
      email: conv.contact_email,
      phone: conv.contact_phone,
      company: conv.contact_company,
      title: conv.contact_title,
      location: conv.contact_location,
      headline: conv.contact_headline
    },
    unipileAccountId: conv.unipile_account_id,
    leadUnipileId: conv.contact_unipile_id || conv.lead_unipile_id,
    channel: conv.channel || conv.provider_type || 'linkedin',
    variables: {}
  };
}

/**
 * Get conversation message history for AI context
 */
async function getConversationContext(conversationId) {
  const result = await db.query(
    `SELECT sender_type, content, sent_at
     FROM messages
     WHERE conversation_id = $1
     ORDER BY sent_at DESC
     LIMIT 20`,
    [conversationId]
  );
  return result.rows?.reverse().map(m =>
    `${m.sender_type === 'lead' ? 'Lead' : 'AI'}: ${m.content}`
  ).join('\n') || '';
}

/**
 * Get agent data for AI message generation
 */
async function getAgentData(agentId) {
  const result = await db.query(
    `SELECT * FROM ai_agents WHERE id = $1`,
    [agentId]
  );
  return result.rows?.[0] || null;
}

/**
 * Record follow-up flow execution metrics
 */
async function recordExecution(flowId, success) {
  if (!flowId) return;
  try {
    const field = success ? 'successful_executions' : 'failed_executions';
    await db.query(
      `UPDATE follow_up_flows
       SET total_executions = total_executions + 1,
           ${field} = ${field} + 1,
           updated_at = NOW()
       WHERE id = $1`,
      [flowId]
    );
  } catch (err) {
    console.error(`⚠️ [FollowUp] Failed to record execution metrics:`, err.message);
  }
}

// ============================================================
// Scheduling Functions
// ============================================================

/**
 * Schedule a no_response check
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
      removeOnFail: { age: 24 * 3600 }
    }
  );

  console.log(`⏰ Scheduled no_response check for conversation ${conversationId} in ${Math.round(delayMs / 60000)} minutes`);
  return { jobId: job.id, scheduledFor: new Date(Date.now() + delayMs) };
}

/**
 * Schedule workflow resume
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
      removeOnFail: { age: 24 * 3600 }
    }
  );

  console.log(`⏰ Scheduled workflow resume for conversation ${conversationId} in ${Math.round(delayMs / 60000)} minutes`);
  return { jobId: job.id, scheduledFor: new Date(Date.now() + delayMs) };
}

/**
 * Cancel all scheduled follow-up jobs for a conversation
 */
async function cancelScheduledJobs(conversationId) {
  console.log(`🛑 Cancelling scheduled jobs for conversation ${conversationId}`);

  try {
    const waitingJobs = await followUpQueue.getWaiting();
    const delayedJobs = await followUpQueue.getDelayed();

    const allJobs = [...waitingJobs, ...delayedJobs];
    let cancelledCount = 0;

    for (const job of allJobs) {
      if (job.data.conversationId === conversationId &&
          (job.data.type === 'follow_up_flow' ||
           job.data.type === 'follow_up_flow_resume' ||
           job.data.type === 'check_no_response' ||
           job.data.type === 'resume_workflow')) {
        await job.remove();
        cancelledCount++;
        console.log(`✅ Cancelled job ${job.id} (${job.data.type})`);
      }
    }

    if (cancelledCount === 0) {
      console.log(`ℹ️ No pending follow-up jobs found for conversation ${conversationId}`);
    }

    return cancelledCount;
  } catch (error) {
    console.error('❌ Error cancelling scheduled jobs:', error);
    return 0;
  }
}

// ============================================================
// Queue Processor & Event Handlers
// ============================================================

followUpQueue.process(async (job) => {
  return await processFollowUpJob(job);
});

followUpQueue.on('completed', (job, result) => {
  const emoji = result?.success ? '✅' : '⚠️';
  console.log(`${emoji} Follow-up job ${job.id} completed: ${result?.action || result?.reason || 'success'}`);
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
  handleFollowUpFlowResume,
  scheduleNoResponseCheck,
  scheduleWorkflowResume,
  cancelScheduledJobs
};
