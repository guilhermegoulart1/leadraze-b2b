// backend/src/services/workflowLogService.js

/**
 * Workflow Log Service
 *
 * Handles logging of workflow execution for debugging and real-time display.
 *
 * IMPORTANT: Logs are stored IN-MEMORY ONLY and returned in real-time during tests.
 * They are NOT persisted to database.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * In-memory storage for test session logs
 * Map<sessionId, LogEntry[]>
 */
const sessionLogsMap = new Map();

/**
 * Maximum logs per session (to prevent memory bloat)
 */
const MAX_LOGS_PER_SESSION = 500;

/**
 * Event types for workflow logging
 */
const EVENT_TYPES = {
  // Node lifecycle
  NODE_ENTERED: 'node_entered',
  NODE_EXITED: 'node_exited',

  // Trigger events
  TRIGGER_FIRED: 'trigger_fired',
  TRIGGER_MATCHED: 'trigger_matched',

  // Conversation step events
  MESSAGE_GENERATING: 'message_generating',
  MESSAGE_GENERATED: 'message_generated',
  MESSAGE_RECEIVED: 'message_received',
  RAG_SEARCH: 'rag_search',
  INTENT_DETECTED: 'intent_detected',
  SENTIMENT_DETECTED: 'sentiment_detected',

  // Condition events
  CONDITION_EVALUATING: 'condition_evaluating',
  CONDITION_EVALUATED: 'condition_evaluated',

  // Action events
  ACTION_STARTED: 'action_started',
  ACTION_COMPLETED: 'action_completed',
  ACTION_FAILED: 'action_failed',

  // Workflow lifecycle
  WORKFLOW_STARTED: 'workflow_started',
  WORKFLOW_PAUSED: 'workflow_paused',
  WORKFLOW_RESUMED: 'workflow_resumed',
  WORKFLOW_COMPLETED: 'workflow_completed',
  WORKFLOW_FAILED: 'workflow_failed',
  WORKFLOW_TRANSFERRED: 'workflow_transferred',

  // Test session events
  SESSION_STARTED: 'session_started',
  SESSION_ENDED: 'session_ended',
  SESSION_RESET: 'session_reset',
  LEAD_SIMULATION_UPDATED: 'lead_simulation_updated',
  AI_RESPONSE_GENERATED: 'ai_response_generated',

  // Edge navigation
  EDGE_FOLLOWED: 'edge_followed',

  // Errors
  ERROR: 'error'
};

/**
 * Create a log entry object
 * @param {object} params - Log parameters
 * @returns {object} Log entry
 */
function createLogEntry(params) {
  const {
    testSessionId = null,
    conversationId = null,
    agentId,
    nodeId = null,
    nodeType = null,
    nodeLabel = null,
    eventType,
    inputData = null,
    outputData = null,
    decisionReason = null,
    durationMs = null,
    success = true,
    errorMessage = null
  } = params;

  return {
    id: uuidv4(),
    testSessionId,
    conversationId,
    agentId,
    nodeId,
    nodeType,
    nodeLabel,
    eventType,
    inputData,
    outputData,
    decisionReason,
    durationMs,
    success,
    errorMessage,
    createdAt: new Date().toISOString(),
    // Helper fields for UI
    emoji: getEventEmoji(eventType, success),
    color: getEventColor(eventType, success)
  };
}

/**
 * Log a test event (in-memory only)
 * @param {object} params - Log parameters
 * @returns {object} Created log entry
 */
function logTestEvent(params) {
  const { testSessionId } = params;

  if (!testSessionId) {
    // Without testSessionId, just log to console (for real conversations)
    const emoji = params.success !== false ? '📝' : '❌';
    console.log(`${emoji} [WORKFLOW] ${params.eventType}: ${params.nodeLabel || params.nodeId || 'workflow'}`);
    return null;
  }

  const logEntry = createLogEntry(params);

  // Get or create session logs array
  if (!sessionLogsMap.has(testSessionId)) {
    sessionLogsMap.set(testSessionId, []);
  }

  const sessionLogs = sessionLogsMap.get(testSessionId);

  // Enforce max logs limit
  if (sessionLogs.length >= MAX_LOGS_PER_SESSION) {
    sessionLogs.shift(); // Remove oldest log
  }

  sessionLogs.push(logEntry);

  // Also log to console for debugging
  const context = `[TEST:${testSessionId.slice(0, 8)}]`;
  const emoji = logEntry.success ? logEntry.emoji : '❌';
  console.log(`${emoji} ${context} ${logEntry.eventType}: ${logEntry.nodeLabel || logEntry.nodeId || 'workflow'}`);

  return logEntry;
}

/**
 * Log a workflow event (wrapper for backward compatibility)
 * For test sessions, stores in memory. For real conversations, logs to console only.
 */
function logEvent(params) {
  return logTestEvent(params);
}

/**
 * Get logs for a test session
 * @param {string} testSessionId - Test session UUID
 * @param {Date} since - Optional: only get logs after this timestamp
 * @returns {array} Log entries
 */
function getTestSessionLogs(testSessionId, since = null) {
  const sessionLogs = sessionLogsMap.get(testSessionId) || [];

  if (since) {
    const sinceDate = new Date(since);
    return sessionLogs.filter(log => new Date(log.createdAt) > sinceDate);
  }

  return [...sessionLogs]; // Return copy to prevent mutation
}

/**
 * Clear logs for a test session
 * @param {string} testSessionId - Test session UUID
 */
function clearTestSessionLogs(testSessionId) {
  sessionLogsMap.delete(testSessionId);
  console.log(`🗑️ Cleared logs for test session ${testSessionId.slice(0, 8)}`);
}

/**
 * Get logs since a specific timestamp
 * @param {string} contextId - Test session ID
 * @param {string} contextType - 'test_session' (only supported type now)
 * @param {Date} since - Timestamp to get logs after
 * @returns {array} New log entries
 */
function getLogsSince(contextId, contextType, since) {
  if (contextType !== 'test_session') {
    console.warn('getLogsSince only supports test_session type now (logs not persisted)');
    return [];
  }
  return getTestSessionLogs(contextId, since);
}

// ============================================
// Convenience logging functions
// ============================================

function logNodeEntered(params) {
  return logEvent({ ...params, eventType: EVENT_TYPES.NODE_ENTERED });
}

function logNodeExited(params) {
  return logEvent({ ...params, eventType: EVENT_TYPES.NODE_EXITED });
}

function logTriggerFired(params) {
  return logEvent({ ...params, eventType: EVENT_TYPES.TRIGGER_FIRED });
}

function logMessageGenerated(params) {
  return logEvent({ ...params, eventType: EVENT_TYPES.MESSAGE_GENERATED });
}

function logRagSearch(params) {
  return logEvent({ ...params, eventType: EVENT_TYPES.RAG_SEARCH });
}

function logIntentDetected(params) {
  return logEvent({ ...params, eventType: EVENT_TYPES.INTENT_DETECTED });
}

function logConditionEvaluated(params) {
  return logEvent({ ...params, eventType: EVENT_TYPES.CONDITION_EVALUATED });
}

function logActionStarted(params) {
  return logEvent({ ...params, eventType: EVENT_TYPES.ACTION_STARTED });
}

function logActionCompleted(params) {
  return logEvent({ ...params, eventType: EVENT_TYPES.ACTION_COMPLETED });
}

function logActionFailed(params) {
  return logEvent({ ...params, eventType: EVENT_TYPES.ACTION_FAILED, success: false });
}

function logWorkflowStarted(params) {
  return logEvent({ ...params, eventType: EVENT_TYPES.WORKFLOW_STARTED });
}

function logWorkflowPaused(params) {
  return logEvent({ ...params, eventType: EVENT_TYPES.WORKFLOW_PAUSED });
}

function logWorkflowResumed(params) {
  return logEvent({ ...params, eventType: EVENT_TYPES.WORKFLOW_RESUMED });
}

function logWorkflowCompleted(params) {
  return logEvent({ ...params, eventType: EVENT_TYPES.WORKFLOW_COMPLETED });
}

function logWorkflowFailed(params) {
  return logEvent({ ...params, eventType: EVENT_TYPES.WORKFLOW_FAILED, success: false });
}

function logError(params) {
  return logEvent({ ...params, eventType: EVENT_TYPES.ERROR, success: false });
}

// ============================================
// UI Helper functions
// ============================================

/**
 * Get emoji for event type
 */
function getEventEmoji(eventType, success) {
  if (!success) return '❌';

  const emojiMap = {
    [EVENT_TYPES.NODE_ENTERED]: '➡️',
    [EVENT_TYPES.NODE_EXITED]: '✅',
    [EVENT_TYPES.TRIGGER_FIRED]: '⚡',
    [EVENT_TYPES.TRIGGER_MATCHED]: '🎯',
    [EVENT_TYPES.MESSAGE_GENERATING]: '🤖',
    [EVENT_TYPES.MESSAGE_GENERATED]: '💬',
    [EVENT_TYPES.MESSAGE_RECEIVED]: '📨',
    [EVENT_TYPES.RAG_SEARCH]: '🔍',
    [EVENT_TYPES.INTENT_DETECTED]: '🎯',
    [EVENT_TYPES.SENTIMENT_DETECTED]: '💭',
    [EVENT_TYPES.CONDITION_EVALUATING]: '🔄',
    [EVENT_TYPES.CONDITION_EVALUATED]: '❓',
    [EVENT_TYPES.ACTION_STARTED]: '🚀',
    [EVENT_TYPES.ACTION_COMPLETED]: '✅',
    [EVENT_TYPES.ACTION_FAILED]: '❌',
    [EVENT_TYPES.WORKFLOW_STARTED]: '🏁',
    [EVENT_TYPES.WORKFLOW_PAUSED]: '⏸️',
    [EVENT_TYPES.WORKFLOW_RESUMED]: '▶️',
    [EVENT_TYPES.WORKFLOW_COMPLETED]: '🏆',
    [EVENT_TYPES.WORKFLOW_FAILED]: '💥',
    [EVENT_TYPES.WORKFLOW_TRANSFERRED]: '🔄',
    [EVENT_TYPES.SESSION_STARTED]: '🧪',
    [EVENT_TYPES.SESSION_ENDED]: '🛑',
    [EVENT_TYPES.SESSION_RESET]: '🔄',
    [EVENT_TYPES.LEAD_SIMULATION_UPDATED]: '👤',
    [EVENT_TYPES.AI_RESPONSE_GENERATED]: '🤖',
    [EVENT_TYPES.EDGE_FOLLOWED]: '➡️',
    [EVENT_TYPES.ERROR]: '❌'
  };

  return emojiMap[eventType] || '📝';
}

/**
 * Get color for event type (for frontend styling)
 */
function getEventColor(eventType, success) {
  if (!success) return 'red';

  const colorMap = {
    // Trigger events - green
    [EVENT_TYPES.TRIGGER_FIRED]: 'green',
    [EVENT_TYPES.TRIGGER_MATCHED]: 'green',

    // Condition events - yellow/amber
    [EVENT_TYPES.CONDITION_EVALUATING]: 'amber',
    [EVENT_TYPES.CONDITION_EVALUATED]: 'amber',

    // Action events - blue
    [EVENT_TYPES.ACTION_STARTED]: 'blue',
    [EVENT_TYPES.ACTION_COMPLETED]: 'blue',
    [EVENT_TYPES.ACTION_FAILED]: 'red',

    // Message events - purple
    [EVENT_TYPES.MESSAGE_GENERATING]: 'purple',
    [EVENT_TYPES.MESSAGE_GENERATED]: 'purple',
    [EVENT_TYPES.MESSAGE_RECEIVED]: 'gray',
    [EVENT_TYPES.AI_RESPONSE_GENERATED]: 'purple',

    // RAG events - cyan
    [EVENT_TYPES.RAG_SEARCH]: 'cyan',

    // Workflow lifecycle - indigo
    [EVENT_TYPES.WORKFLOW_STARTED]: 'indigo',
    [EVENT_TYPES.WORKFLOW_PAUSED]: 'orange',
    [EVENT_TYPES.WORKFLOW_RESUMED]: 'indigo',
    [EVENT_TYPES.WORKFLOW_COMPLETED]: 'green',
    [EVENT_TYPES.WORKFLOW_FAILED]: 'red',
    [EVENT_TYPES.WORKFLOW_TRANSFERRED]: 'orange',

    // Test session events - teal
    [EVENT_TYPES.SESSION_STARTED]: 'teal',
    [EVENT_TYPES.SESSION_ENDED]: 'teal',
    [EVENT_TYPES.SESSION_RESET]: 'teal',
    [EVENT_TYPES.LEAD_SIMULATION_UPDATED]: 'teal',

    // Default
    [EVENT_TYPES.NODE_ENTERED]: 'gray',
    [EVENT_TYPES.NODE_EXITED]: 'gray',
    [EVENT_TYPES.ERROR]: 'red'
  };

  return colorMap[eventType] || 'gray';
}

/**
 * Format log entry for API response (identity function for in-memory logs)
 */
function formatLogEntry(entry) {
  return entry;
}

/**
 * Get session stats (for debugging)
 */
function getSessionStats() {
  return {
    activeSessions: sessionLogsMap.size,
    totalLogs: Array.from(sessionLogsMap.values()).reduce((sum, logs) => sum + logs.length, 0)
  };
}

/**
 * Cleanup old sessions (call periodically to prevent memory leaks)
 * Removes sessions that haven't received logs in the last hour
 */
function cleanupOldSessions(maxAgeMs = 60 * 60 * 1000) {
  const now = Date.now();
  let cleaned = 0;

  for (const [sessionId, logs] of sessionLogsMap.entries()) {
    if (logs.length === 0) {
      sessionLogsMap.delete(sessionId);
      cleaned++;
      continue;
    }

    const lastLog = logs[logs.length - 1];
    const lastLogTime = new Date(lastLog.createdAt).getTime();

    if (now - lastLogTime > maxAgeMs) {
      sessionLogsMap.delete(sessionId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} old test session log caches`);
  }

  return cleaned;
}

// Run cleanup every 30 minutes
setInterval(() => cleanupOldSessions(), 30 * 60 * 1000);

module.exports = {
  EVENT_TYPES,
  logEvent,
  logTestEvent,
  logNodeEntered,
  logNodeExited,
  logTriggerFired,
  logMessageGenerated,
  logRagSearch,
  logIntentDetected,
  logConditionEvaluated,
  logActionStarted,
  logActionCompleted,
  logActionFailed,
  logWorkflowStarted,
  logWorkflowPaused,
  logWorkflowResumed,
  logWorkflowCompleted,
  logWorkflowFailed,
  logError,
  getTestSessionLogs,
  clearTestSessionLogs,
  getLogsSince,
  formatLogEntry,
  getEventEmoji,
  getEventColor,
  getSessionStats,
  cleanupOldSessions
};
