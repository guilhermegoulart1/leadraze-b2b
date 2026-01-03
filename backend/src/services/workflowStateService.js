// backend/src/services/workflowStateService.js

/**
 * Workflow State Service
 *
 * Manages workflow execution state for conversations.
 * Handles state initialization, updates, and persistence.
 */

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Initialize workflow state for a new conversation
 * @param {string} conversationId - Conversation UUID
 * @param {number} agentId - AI Agent ID
 * @param {object} workflowDefinition - React Flow nodes and edges
 * @param {string} triggerNodeId - Initial trigger node ID
 * @returns {Promise<object>} Created workflow state
 */
async function initializeWorkflowState(conversationId, agentId, workflowDefinition, triggerNodeId = null) {
  try {
    console.log(`📋 Initializing workflow state for conversation ${conversationId}`);

    // Find trigger node if not specified
    let initialNodeId = triggerNodeId;
    if (!initialNodeId && workflowDefinition?.nodes) {
      const triggerNode = workflowDefinition.nodes.find(n => n.type === 'trigger');
      initialNodeId = triggerNode?.id || null;
    }

    const stateData = {
      id: uuidv4(),
      conversation_id: conversationId,
      agent_id: agentId,
      current_node_id: initialNodeId,
      workflow_definition: JSON.stringify(workflowDefinition),
      variables: JSON.stringify({}),
      step_history: JSON.stringify([]),
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await db.insert('conversation_workflow_state', stateData);

    console.log(`✅ Workflow state initialized - starting at node: ${initialNodeId || 'none'}`);

    return {
      id: stateData.id,
      conversationId,
      agentId,
      currentNodeId: initialNodeId,
      workflowDefinition,
      variables: {},
      stepHistory: [],
      status: 'active'
    };
  } catch (error) {
    console.error('❌ Error initializing workflow state:', error);
    throw error;
  }
}

/**
 * Get workflow state for a conversation
 * @param {string} conversationId - Conversation UUID
 * @returns {Promise<object|null>} Workflow state or null if not found
 */
async function getWorkflowState(conversationId) {
  try {
    const result = await db.query(
      `SELECT
        cws.*,
        aa.name as agent_name,
        aa.products_services,
        aa.behavioral_profile,
        aa.language,
        aa.objective_instructions,
        aa.response_style_instructions,
        aa.target_audience,
        aa.conversation_steps,
        aa.knowledge_similarity_threshold,
        aa.config
      FROM conversation_workflow_state cws
      JOIN ai_agents aa ON cws.agent_id = aa.id
      WHERE cws.conversation_id = $1`,
      [conversationId]
    );

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      id: row.id,
      conversationId: row.conversation_id,
      agentId: row.agent_id,
      agentName: row.agent_name,
      currentNodeId: row.current_node_id,
      workflowDefinition: row.workflow_definition,
      variables: row.variables || {},
      stepHistory: row.step_history || [],
      status: row.status,
      pausedUntil: row.paused_until,
      pausedReason: row.paused_reason,
      resumeNodeId: row.resume_node_id,
      resumeJobId: row.resume_job_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      agent: {
        id: row.agent_id,
        name: row.agent_name,
        productsServices: row.products_services,
        behavioralProfile: row.behavioral_profile,
        language: row.language,
        objectiveInstructions: row.objective_instructions,
        responseStyleInstructions: row.response_style_instructions,
        targetAudience: row.target_audience,
        conversationSteps: row.conversation_steps,
        knowledgeSimilarityThreshold: row.knowledge_similarity_threshold,
        config: row.config
      }
    };
  } catch (error) {
    console.error('❌ Error getting workflow state:', error);
    throw error;
  }
}

/**
 * Update workflow state
 * @param {string} conversationId - Conversation UUID
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} Updated state
 */
async function updateWorkflowState(conversationId, updates) {
  try {
    const updateData = {
      updated_at: new Date()
    };

    // Map camelCase to snake_case
    if (updates.currentNodeId !== undefined) {
      updateData.current_node_id = updates.currentNodeId;
    }
    if (updates.variables !== undefined) {
      updateData.variables = JSON.stringify(updates.variables);
    }
    if (updates.stepHistory !== undefined) {
      updateData.step_history = JSON.stringify(updates.stepHistory);
    }
    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }
    if (updates.pausedUntil !== undefined) {
      updateData.paused_until = updates.pausedUntil;
    }
    if (updates.pausedReason !== undefined) {
      updateData.paused_reason = updates.pausedReason;
    }
    if (updates.resumeNodeId !== undefined) {
      updateData.resume_node_id = updates.resumeNodeId;
    }
    if (updates.resumeJobId !== undefined) {
      updateData.resume_job_id = updates.resumeJobId;
    }

    await db.update(
      'conversation_workflow_state',
      updateData,
      { conversation_id: conversationId }
    );

    return await getWorkflowState(conversationId);
  } catch (error) {
    console.error('❌ Error updating workflow state:', error);
    throw error;
  }
}

/**
 * Add step to history
 * @param {string} conversationId - Conversation UUID
 * @param {object} stepInfo - Step information to add
 * @returns {Promise<void>}
 */
async function addStepToHistory(conversationId, stepInfo) {
  try {
    const stepEntry = {
      nodeId: stepInfo.nodeId,
      nodeType: stepInfo.nodeType,
      nodeLabel: stepInfo.nodeLabel,
      timestamp: new Date().toISOString(),
      result: stepInfo.result || null,
      metadata: stepInfo.metadata || {}
    };

    await db.query(
      `UPDATE conversation_workflow_state
       SET step_history = COALESCE(step_history, '[]'::jsonb) || $1::jsonb,
           updated_at = NOW()
       WHERE conversation_id = $2`,
      [JSON.stringify([stepEntry]), conversationId]
    );
  } catch (error) {
    console.error('❌ Error adding step to history:', error);
    throw error;
  }
}

/**
 * Set variable in workflow state
 * @param {string} conversationId - Conversation UUID
 * @param {string} key - Variable key
 * @param {any} value - Variable value
 * @returns {Promise<void>}
 */
async function setVariable(conversationId, key, value) {
  try {
    await db.query(
      `UPDATE conversation_workflow_state
       SET variables = COALESCE(variables, '{}'::jsonb) || $1::jsonb,
           updated_at = NOW()
       WHERE conversation_id = $2`,
      [JSON.stringify({ [key]: value }), conversationId]
    );
  } catch (error) {
    console.error('❌ Error setting variable:', error);
    throw error;
  }
}

/**
 * Get variable from workflow state
 * @param {string} conversationId - Conversation UUID
 * @param {string} key - Variable key
 * @returns {Promise<any>} Variable value or undefined
 */
async function getVariable(conversationId, key) {
  try {
    const state = await getWorkflowState(conversationId);
    return state?.variables?.[key];
  } catch (error) {
    console.error('❌ Error getting variable:', error);
    throw error;
  }
}

/**
 * Pause workflow execution
 * @param {string} conversationId - Conversation UUID
 * @param {Date} resumeAt - When to resume
 * @param {string} reason - Reason for pause
 * @param {string} resumeNodeId - Node to resume at
 * @param {string} jobId - Bull job ID for resume
 * @returns {Promise<object>} Updated state
 */
async function pauseWorkflow(conversationId, resumeAt, reason, resumeNodeId = null, jobId = null) {
  try {
    console.log(`⏸️ Pausing workflow for conversation ${conversationId} until ${resumeAt}`);

    return await updateWorkflowState(conversationId, {
      status: 'paused',
      pausedUntil: resumeAt,
      pausedReason: reason,
      resumeNodeId,
      resumeJobId: jobId
    });
  } catch (error) {
    console.error('❌ Error pausing workflow:', error);
    throw error;
  }
}

/**
 * Resume paused workflow
 * @param {string} conversationId - Conversation UUID
 * @returns {Promise<object>} Updated state with resume node
 */
async function resumeWorkflow(conversationId) {
  try {
    const state = await getWorkflowState(conversationId);

    if (!state || state.status !== 'paused') {
      throw new Error('Workflow is not paused');
    }

    console.log(`▶️ Resuming workflow for conversation ${conversationId}`);

    // Clear pause fields and set to active
    await updateWorkflowState(conversationId, {
      status: 'active',
      pausedUntil: null,
      pausedReason: null,
      currentNodeId: state.resumeNodeId || state.currentNodeId,
      resumeNodeId: null,
      resumeJobId: null
    });

    return await getWorkflowState(conversationId);
  } catch (error) {
    console.error('❌ Error resuming workflow:', error);
    throw error;
  }
}

/**
 * Complete workflow (success)
 * @param {string} conversationId - Conversation UUID
 * @param {string} reason - Completion reason
 * @returns {Promise<object>} Updated state
 */
async function completeWorkflow(conversationId, reason = 'completed') {
  try {
    console.log(`✅ Completing workflow for conversation ${conversationId}: ${reason}`);

    return await updateWorkflowState(conversationId, {
      status: 'completed',
      pausedReason: reason
    });
  } catch (error) {
    console.error('❌ Error completing workflow:', error);
    throw error;
  }
}

/**
 * Mark workflow as failed
 * @param {string} conversationId - Conversation UUID
 * @param {string} errorMessage - Error message
 * @returns {Promise<object>} Updated state
 */
async function failWorkflow(conversationId, errorMessage) {
  try {
    console.log(`❌ Failing workflow for conversation ${conversationId}: ${errorMessage}`);

    return await updateWorkflowState(conversationId, {
      status: 'failed',
      pausedReason: errorMessage
    });
  } catch (error) {
    console.error('❌ Error failing workflow:', error);
    throw error;
  }
}

/**
 * Mark workflow as transferred (handed off to human)
 * @param {string} conversationId - Conversation UUID
 * @param {string} reason - Transfer reason
 * @returns {Promise<object>} Updated state
 */
async function transferWorkflow(conversationId, reason = 'transferred_to_human') {
  try {
    console.log(`🔄 Transferring workflow for conversation ${conversationId}: ${reason}`);

    return await updateWorkflowState(conversationId, {
      status: 'transferred',
      pausedReason: reason
    });
  } catch (error) {
    console.error('❌ Error transferring workflow:', error);
    throw error;
  }
}

/**
 * Reset workflow state (for testing or restart)
 * @param {string} conversationId - Conversation UUID
 * @returns {Promise<object>} Reset state
 */
async function resetWorkflowState(conversationId) {
  try {
    const state = await getWorkflowState(conversationId);

    if (!state) {
      throw new Error('Workflow state not found');
    }

    // Find trigger node
    let triggerNodeId = null;
    if (state.workflowDefinition?.nodes) {
      const triggerNode = state.workflowDefinition.nodes.find(n => n.type === 'trigger');
      triggerNodeId = triggerNode?.id || null;
    }

    console.log(`🔄 Resetting workflow for conversation ${conversationId}`);

    return await updateWorkflowState(conversationId, {
      currentNodeId: triggerNodeId,
      variables: {},
      stepHistory: [],
      status: 'active',
      pausedUntil: null,
      pausedReason: null,
      resumeNodeId: null,
      resumeJobId: null
    });
  } catch (error) {
    console.error('❌ Error resetting workflow state:', error);
    throw error;
  }
}

/**
 * Delete workflow state
 * @param {string} conversationId - Conversation UUID
 * @returns {Promise<void>}
 */
async function deleteWorkflowState(conversationId) {
  try {
    await db.delete('conversation_workflow_state', { conversation_id: conversationId });
    console.log(`🗑️ Deleted workflow state for conversation ${conversationId}`);
  } catch (error) {
    console.error('❌ Error deleting workflow state:', error);
    throw error;
  }
}

/**
 * Check if workflow is active (not paused, completed, or failed)
 * @param {string} conversationId - Conversation UUID
 * @returns {Promise<boolean>}
 */
async function isWorkflowActive(conversationId) {
  try {
    const state = await getWorkflowState(conversationId);
    return state?.status === 'active';
  } catch (error) {
    console.error('❌ Error checking workflow status:', error);
    return false;
  }
}

/**
 * Check if workflow is paused and should resume
 * @param {string} conversationId - Conversation UUID
 * @returns {Promise<boolean>}
 */
async function shouldResume(conversationId) {
  try {
    const state = await getWorkflowState(conversationId);

    if (!state || state.status !== 'paused') {
      return false;
    }

    if (!state.pausedUntil) {
      return false;
    }

    return new Date(state.pausedUntil) <= new Date();
  } catch (error) {
    console.error('❌ Error checking resume status:', error);
    return false;
  }
}

/**
 * Get paused workflows that should resume
 * @returns {Promise<array>} List of workflow states ready to resume
 */
async function getPausedWorkflowsReadyToResume() {
  try {
    const result = await db.query(
      `SELECT cws.*
       FROM conversation_workflow_state cws
       WHERE cws.status = 'paused'
         AND cws.paused_until <= NOW()
         AND cws.resume_job_id IS NULL`,
      []
    );

    return result.rows.map(row => ({
      id: row.id,
      conversationId: row.conversation_id,
      agentId: row.agent_id,
      currentNodeId: row.current_node_id,
      resumeNodeId: row.resume_node_id,
      pausedReason: row.paused_reason
    }));
  } catch (error) {
    console.error('❌ Error getting paused workflows:', error);
    return [];
  }
}

module.exports = {
  initializeWorkflowState,
  getWorkflowState,
  updateWorkflowState,
  addStepToHistory,
  setVariable,
  getVariable,
  pauseWorkflow,
  resumeWorkflow,
  completeWorkflow,
  failWorkflow,
  transferWorkflow,
  resetWorkflowState,
  deleteWorkflowState,
  isWorkflowActive,
  shouldResume,
  getPausedWorkflowsReadyToResume
};
