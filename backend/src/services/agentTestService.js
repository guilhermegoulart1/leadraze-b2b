// backend/src/services/agentTestService.js

/**
 * Agent Test Service
 *
 * Handles test sessions for AI agents, allowing users to test
 * agent workflows without affecting real conversations.
 */

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const workflowExecutionService = require('./workflowExecutionService');
const workflowLogService = require('./workflowLogService');
const aiResponseService = require('./aiResponseService');
const transferRuleService = require('./transferRuleService');

/**
 * Start a new test session for an agent
 * @param {number} agentId - The AI agent ID
 * @param {number} userId - The user starting the test
 * @param {number} accountId - The account ID
 * @param {object} leadSimulation - Simulated lead data
 * @returns {Promise<object>} Test session info
 */
async function startTestSession(agentId, userId, accountId, leadSimulation = {}) {
  console.log(`🧪 Starting test session for agent ${agentId}`);

  // Get agent data
  const agentResult = await db.query(
    `SELECT id, name, workflow_definition, workflow_enabled,
            products_services, behavioral_profile,
            initial_approach, objective_instructions, language, target_audience,
            conversation_steps, knowledge_similarity_threshold,
            response_style_instructions, config
     FROM ai_agents
     WHERE id = $1 AND account_id = $2`,
    [agentId, accountId]
  );

  if (!agentResult.rows || agentResult.rows.length === 0) {
    throw new Error('Agent not found or access denied');
  }

  const agent = agentResult.rows[0];

  // Create default lead simulation if not provided
  const defaultLeadSimulation = {
    name: leadSimulation.name || 'Lead de Teste',
    title: leadSimulation.title || 'Cargo de Teste',
    company: leadSimulation.company || 'Empresa Teste Ltda',
    location: leadSimulation.location || 'São Paulo, Brasil',
    industry: leadSimulation.industry || 'Tecnologia',
    email: leadSimulation.email || null,
    phone: leadSimulation.phone || null
  };

  // Create test session
  const sessionId = uuidv4();
  const result = await db.query(
    `INSERT INTO agent_test_sessions
     (id, agent_id, user_id, account_id, status, workflow_state, messages, lead_simulation, created_at)
     VALUES ($1, $2, $3, $4, 'active', '{}', '[]', $5, NOW())
     RETURNING *`,
    [sessionId, agentId, userId, accountId, JSON.stringify(defaultLeadSimulation)]
  );

  const session = result.rows[0];

  // If workflow enabled, initialize workflow state for test session
  if (agent.workflow_enabled && agent.workflow_definition) {
    const initialState = {
      current_node_id: null,
      variables: {},
      step_history: [],
      status: 'initialized'
    };

    await db.query(
      `UPDATE agent_test_sessions
       SET workflow_state = $1
       WHERE id = $2`,
      [JSON.stringify(initialState), sessionId]
    );
  }

  // Log session start
  await workflowLogService.logTestEvent({
    testSessionId: sessionId,
    agentId,
    eventType: 'SESSION_STARTED',
    outputData: {
      leadSimulation: defaultLeadSimulation,
      workflowEnabled: agent.workflow_enabled
    }
  });

  console.log(`✅ Test session ${sessionId} created for agent ${agent.name}`);

  return {
    sessionId,
    agentId: agent.id,
    agentName: agent.name,
    workflowEnabled: agent.workflow_enabled,
    leadSimulation: defaultLeadSimulation,
    status: 'active',
    createdAt: session.created_at
  };
}

/**
 * Send a test message or simulate an event
 * @param {string} sessionId - Test session UUID
 * @param {string} message - Message content (null for non-message events)
 * @param {number} userId - User ID for authorization
 * @param {string} eventType - Event type: message_received, invite_accepted, invite_ignored, no_response, wait_skipped
 * @param {boolean} skipWait - If true, skips the current wait action and continues workflow
 * @returns {Promise<object>} Response and logs
 */
async function sendTestMessage(sessionId, message, userId, eventType = 'message_received', skipWait = false) {
  console.log(`💬 Processing test event "${eventType}" in session ${sessionId}`);

  // Get session with agent data
  const sessionResult = await db.query(
    `SELECT
       ts.*,
       aa.id as agent_id,
       aa.name as agent_name,
       aa.workflow_definition,
       aa.workflow_enabled,
       aa.products_services,
       aa.behavioral_profile,
       aa.initial_approach,
       aa.objective_instructions,
       aa.language,
       aa.target_audience,
       aa.conversation_steps,
       aa.knowledge_similarity_threshold,
       aa.response_style_instructions,
       aa.config
     FROM agent_test_sessions ts
     JOIN ai_agents aa ON ts.agent_id = aa.id
     WHERE ts.id = $1 AND ts.user_id = $2 AND ts.status = 'active'`,
    [sessionId, userId]
  );

  if (!sessionResult.rows || sessionResult.rows.length === 0) {
    throw new Error('Test session not found or access denied');
  }

  const session = sessionResult.rows[0];
  const leadSimulation = session.lead_simulation || {};
  const messages = session.messages || [];

  // Only add user message for message_received events
  if (eventType === 'message_received' && message) {
    const userMessage = {
      id: uuidv4(),
      sender: 'lead',
      content: message,
      timestamp: new Date().toISOString()
    };
    messages.push(userMessage);
  }

  // Log received event
  const eventLabels = {
    message_received: 'MESSAGE_RECEIVED',
    invite_accepted: 'INVITE_ACCEPTED',
    invite_ignored: 'INVITE_IGNORED',
    no_response: 'NO_RESPONSE'
  };

  await workflowLogService.logTestEvent({
    testSessionId: sessionId,
    agentId: session.agent_id,
    eventType: eventLabels[eventType] || eventType.toUpperCase(),
    inputData: eventType === 'message_received' ? { message } : { eventType }
  });

  let response;
  let allResponses = null; // ✅ Array com todas as respostas quando múltiplos nós executam
  let workflowLogs = [];
  let waitInfo = null;

  // Check if workflow is enabled
  if (session.workflow_enabled && session.workflow_definition) {
    // Process through workflow engine
    console.log(`🔄 Processing through workflow engine (event: ${eventType})`);

    // Handle skip_wait: modify workflow state to continue from resume node
    let workflowState = session.workflow_state;
    let effectiveEventType = eventType;

    if (skipWait && workflowState?.status === 'paused') {
      console.log(`⏭️ Skipping wait action, workflowState BEFORE:`, JSON.stringify({
        status: workflowState.status,
        pausedReason: workflowState.pausedReason,
        resumeNodeId: workflowState.resumeNodeId
      }));
      // Clear the paused status so workflow continues, but KEEP the resumeNodeId
      workflowState = {
        ...workflowState,
        status: 'active',
        pausedReason: null
        // resumeNodeId is preserved by the spread operator
      };
      effectiveEventType = 'wait_skipped';
      console.log(`⏭️ After modification, workflowState.resumeNodeId: ${workflowState.resumeNodeId}`);
    }

    const workflowResult = await workflowExecutionService.processTestMessage(
      sessionId,
      session.agent_id,
      message,
      {
        lead: leadSimulation,
        conversationContext: buildTestContext(messages),
        agent: {
          id: session.agent_id,
          name: session.agent_name,
          workflow_definition: session.workflow_definition,
          products_services: session.products_services,
          behavioral_profile: session.behavioral_profile,
          initial_approach: session.initial_approach,
          objective_instructions: session.objective_instructions,
          language: session.language,
          target_audience: session.target_audience,
          conversation_steps: session.conversation_steps,
          knowledge_similarity_threshold: session.knowledge_similarity_threshold,
          response_style_instructions: session.response_style_instructions,
          config: session.config
        },
        workflowState: workflowState,
        eventType: effectiveEventType
      }
    );

    response = workflowResult.response;
    allResponses = workflowResult.allResponses; // ✅ Capturar array de respostas
    waitInfo = workflowResult.waitInfo;

    // Update workflow state
    if (workflowResult.newState) {
      await db.query(
        `UPDATE agent_test_sessions
         SET workflow_state = $1
         WHERE id = $2`,
        [JSON.stringify(workflowResult.newState), sessionId]
      );
    }

    // Get workflow logs since message was sent
    workflowLogs = await workflowLogService.getTestSessionLogs(sessionId);

  } else {
    // Process through legacy AI (for agents without workflow)
    console.log(`🤖 Processing through legacy AI`);

    const aiResult = await aiResponseService.generateResponse({
      conversation_id: sessionId, // Use session ID as conversation ID for test
      lead_message: message,
      conversation_context: buildTestContext(messages),
      ai_agent: {
        id: session.agent_id,
        name: session.agent_name,
        products_services: session.products_services,
        behavioral_profile: session.behavioral_profile,
        initial_approach: session.initial_approach,
        objective_instructions: session.objective_instructions,
        language: session.language,
        target_audience: session.target_audience,
        conversation_steps: session.conversation_steps,
        knowledge_similarity_threshold: session.knowledge_similarity_threshold,
        response_style_instructions: session.response_style_instructions,
        config: session.config
      },
      lead_data: leadSimulation,
      current_step: 0,
      context: { isTest: true }
    });

    response = aiResult.response;

    // Log legacy AI response
    await workflowLogService.logTestEvent({
      testSessionId: sessionId,
      agentId: session.agent_id,
      nodeType: 'legacy_ai',
      eventType: 'AI_RESPONSE_GENERATED',
      inputData: { message },
      outputData: {
        response,
        intent: aiResult.intent
      }
    });

    workflowLogs = await workflowLogService.getTestSessionLogs(sessionId);
  }

  // Add AI response to history
  if (response) {
    const aiMessage = {
      id: uuidv4(),
      sender: 'ai',
      content: response,
      timestamp: new Date().toISOString()
    };
    messages.push(aiMessage);
  }

  // Update session messages
  await db.query(
    `UPDATE agent_test_sessions
     SET messages = $1
     WHERE id = $2`,
    [JSON.stringify(messages), sessionId]
  );

  console.log(`[agentTestService] Test message processed, response: "${(response || '').substring(0, 50)}..."`);

  // Evaluate global transfer rules in test mode (simulated)
  let transferRuleMatch = null;
  if (eventType === 'message_received' && message) {
    try {
      const exchangeCount = messages.filter(m => m.sender === 'lead').length;
      transferRuleMatch = await transferRuleService.evaluateTransferRules(
        session.agent_id,
        message,
        { exchangeCount }
      );

      if (transferRuleMatch.shouldTransfer) {
        // Log the match in test mode
        await workflowLogService.logTransferRuleEvaluation({
          testSessionId: sessionId,
          agentId: session.agent_id,
          matchedRule: transferRuleMatch.matchedRule,
          reason: transferRuleMatch.reasonText,
          message,
          simulated: true
        });

        // Refresh logs after adding the transfer rule log
        workflowLogs = await workflowLogService.getTestSessionLogs(sessionId);
      }
    } catch (trError) {
      console.error('[agentTestService] Error evaluating transfer rules:', trError.message);
    }
  }

  return {
    response,
    allResponses,
    messages,
    logs: workflowLogs,
    workflowEnabled: session.workflow_enabled,
    waitInfo,
    transferRuleMatch: transferRuleMatch?.shouldTransfer ? {
      ruleName: transferRuleMatch.matchedRule.name,
      reason: transferRuleMatch.reasonText,
      simulated: true
    } : null
  };
}

/**
 * Build conversation context from test messages
 * @param {array} messages - Test session messages
 * @returns {object} Context object for AI
 */
function buildTestContext(messages) {
  const recentMessages = messages.slice(-20).map(msg => ({
    content: msg.content,
    sender_type: msg.sender === 'ai' ? 'ai' : 'lead',
    sent_at: msg.timestamp
  }));

  return {
    summary: null,
    recentMessages,
    stats: {
      totalMessages: messages.length,
      recentMessagesCount: recentMessages.length,
      summaryTokens: 0,
      recentTokens: 0,
      totalTokens: 0,
      hasSummary: false
    }
  };
}

/**
 * Get test session logs
 * @param {string} sessionId - Test session UUID
 * @param {number} userId - User ID for authorization
 * @param {Date} since - Optional timestamp to get logs since
 * @returns {Promise<array>} Logs
 */
async function getTestLogs(sessionId, userId, since = null) {
  // Verify session access
  const sessionResult = await db.query(
    `SELECT id FROM agent_test_sessions
     WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );

  if (!sessionResult.rows || sessionResult.rows.length === 0) {
    throw new Error('Test session not found or access denied');
  }

  return workflowLogService.getTestSessionLogs(sessionId, since);
}

/**
 * Get test session state
 * @param {string} sessionId - Test session UUID
 * @param {number} userId - User ID for authorization
 * @returns {Promise<object>} Session state
 */
async function getTestSessionState(sessionId, userId) {
  const result = await db.query(
    `SELECT
       ts.id,
       ts.agent_id,
       ts.status,
       ts.workflow_state,
       ts.messages,
       ts.lead_simulation,
       ts.created_at,
       ts.ended_at,
       aa.name as agent_name,
       aa.workflow_enabled
     FROM agent_test_sessions ts
     JOIN ai_agents aa ON ts.agent_id = aa.id
     WHERE ts.id = $1 AND ts.user_id = $2`,
    [sessionId, userId]
  );

  if (!result.rows || result.rows.length === 0) {
    throw new Error('Test session not found or access denied');
  }

  return result.rows[0];
}

/**
 * End a test session
 * @param {string} sessionId - Test session UUID
 * @param {number} userId - User ID for authorization
 * @returns {Promise<object>} Session summary
 */
async function endTestSession(sessionId, userId) {
  console.log(`🛑 Ending test session ${sessionId}`);

  // Verify session access and get data
  const sessionResult = await db.query(
    `SELECT ts.*, aa.name as agent_name
     FROM agent_test_sessions ts
     JOIN ai_agents aa ON ts.agent_id = aa.id
     WHERE ts.id = $1 AND ts.user_id = $2 AND ts.status = 'active'`,
    [sessionId, userId]
  );

  if (!sessionResult.rows || sessionResult.rows.length === 0) {
    throw new Error('Test session not found or already ended');
  }

  const session = sessionResult.rows[0];

  // Update session status
  await db.query(
    `UPDATE agent_test_sessions
     SET status = 'ended',
         ended_at = NOW()
     WHERE id = $1`,
    [sessionId]
  );

  // Log session end
  await workflowLogService.logTestEvent({
    testSessionId: sessionId,
    agentId: session.agent_id,
    eventType: 'SESSION_ENDED',
    outputData: {
      totalMessages: (session.messages || []).length,
      duration: Date.now() - new Date(session.created_at).getTime()
    }
  });

  // Get all logs for summary
  const logs = await workflowLogService.getTestSessionLogs(sessionId);

  console.log(`✅ Test session ${sessionId} ended`);

  return {
    sessionId,
    agentName: session.agent_name,
    status: 'ended',
    totalMessages: (session.messages || []).length,
    duration: Date.now() - new Date(session.created_at).getTime(),
    logs
  };
}

/**
 * Reset a test session (clear messages and state)
 * @param {string} sessionId - Test session UUID
 * @param {number} userId - User ID for authorization
 * @returns {Promise<object>} Reset session
 */
async function resetTestSession(sessionId, userId) {
  console.log(`🔄 Resetting test session ${sessionId}`);

  // Verify session access
  const sessionResult = await db.query(
    `SELECT ts.*, aa.workflow_enabled
     FROM agent_test_sessions ts
     JOIN ai_agents aa ON ts.agent_id = aa.id
     WHERE ts.id = $1 AND ts.user_id = $2`,
    [sessionId, userId]
  );

  if (!sessionResult.rows || sessionResult.rows.length === 0) {
    throw new Error('Test session not found or access denied');
  }

  const session = sessionResult.rows[0];

  // Reset state
  const initialState = {
    current_node_id: null,
    variables: {},
    step_history: [],
    status: 'initialized'
  };

  await db.query(
    `UPDATE agent_test_sessions
     SET status = 'active',
         workflow_state = $1,
         messages = '[]',
         ended_at = NULL
     WHERE id = $2`,
    [JSON.stringify(initialState), sessionId]
  );

  // Clear in-memory logs for this session
  workflowLogService.clearTestSessionLogs(sessionId);

  // Log session reset
  await workflowLogService.logTestEvent({
    testSessionId: sessionId,
    agentId: session.agent_id,
    eventType: 'SESSION_RESET',
    outputData: { workflowEnabled: session.workflow_enabled }
  });

  console.log(`✅ Test session ${sessionId} reset`);

  return {
    sessionId,
    status: 'active',
    messages: [],
    workflowState: initialState
  };
}

/**
 * Update lead simulation data
 * @param {string} sessionId - Test session UUID
 * @param {number} userId - User ID for authorization
 * @param {object} leadSimulation - New lead simulation data
 * @returns {Promise<object>} Updated session
 */
async function updateLeadSimulation(sessionId, userId, leadSimulation) {
  // Verify session access
  const sessionResult = await db.query(
    `SELECT id, lead_simulation, agent_id
     FROM agent_test_sessions
     WHERE id = $1 AND user_id = $2 AND status = 'active'`,
    [sessionId, userId]
  );

  if (!sessionResult.rows || sessionResult.rows.length === 0) {
    throw new Error('Test session not found or access denied');
  }

  const currentSimulation = sessionResult.rows[0].lead_simulation || {};

  // Merge new data with current
  const updatedSimulation = {
    ...currentSimulation,
    ...leadSimulation
  };

  await db.query(
    `UPDATE agent_test_sessions
     SET lead_simulation = $1
     WHERE id = $2`,
    [JSON.stringify(updatedSimulation), sessionId]
  );

  // Log update
  await workflowLogService.logTestEvent({
    testSessionId: sessionId,
    agentId: sessionResult.rows[0].agent_id,
    eventType: 'LEAD_SIMULATION_UPDATED',
    outputData: { leadSimulation: updatedSimulation }
  });

  return {
    sessionId,
    leadSimulation: updatedSimulation
  };
}

/**
 * Get list of active test sessions for a user
 * @param {number} userId - User ID
 * @param {number} accountId - Account ID
 * @returns {Promise<array>} Active sessions
 */
async function getActiveSessions(userId, accountId) {
  const result = await db.query(
    `SELECT
       ts.id as session_id,
       ts.agent_id,
       ts.status,
       ts.created_at,
       aa.name as agent_name
     FROM agent_test_sessions ts
     JOIN ai_agents aa ON ts.agent_id = aa.id
     WHERE ts.user_id = $1
       AND ts.account_id = $2
       AND ts.status = 'active'
     ORDER BY ts.created_at DESC`,
    [userId, accountId]
  );

  return result.rows || [];
}

module.exports = {
  startTestSession,
  sendTestMessage,
  getTestLogs,
  getTestSessionState,
  endTestSession,
  resetTestSession,
  updateLeadSimulation,
  getActiveSessions
};
