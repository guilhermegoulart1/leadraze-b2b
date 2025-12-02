/**
 * Rotation Service
 *
 * Manages the round-robin rotation system for agent assignees.
 * Distributes conversations to users in a fixed order, cycling through all assignees.
 *
 * Features:
 * - Fixed order rotation based on rotation_order
 * - Circular: returns to first assignee after last
 * - All users receive regardless of online status
 * - No limit on simultaneous conversations per user
 */

const db = require('../config/database');
const assignmentLogService = require('./assignmentLogService');

/**
 * Get the next assignee for an agent using round-robin rotation
 * @param {number} agentId - The agent ID
 * @returns {Promise<{userId: number, userName: string, userEmail: string} | null>}
 */
async function getNextAssignee(agentId) {
  try {
    // 1. Get all active assignees ordered by rotation_order
    const assigneesResult = await db.query(`
      SELECT aa.id, aa.user_id, aa.rotation_order, u.name as user_name, u.email as user_email
      FROM agent_assignees aa
      INNER JOIN users u ON aa.user_id = u.id
      WHERE aa.agent_id = $1 AND aa.is_active = true
      ORDER BY aa.rotation_order ASC
    `, [agentId]);

    const assignees = assigneesResult.rows;

    if (assignees.length === 0) {
      console.log(`[RotationService] No active assignees found for agent ${agentId}`);
      return null;
    }

    // 2. Get or create rotation state for this agent
    let stateResult = await db.query(`
      SELECT * FROM agent_rotation_state WHERE agent_id = $1
    `, [agentId]);

    let currentPosition = 0;

    if (stateResult.rows.length === 0) {
      // Create initial state
      await db.query(`
        INSERT INTO agent_rotation_state (agent_id, current_position, total_assignments)
        VALUES ($1, 0, 0)
      `, [agentId]);
    } else {
      // Get next position (circular)
      currentPosition = (stateResult.rows[0].current_position + 1) % assignees.length;
    }

    // 3. Get the assignee at the current position
    const nextAssignee = assignees[currentPosition];

    // 4. Update rotation state
    await db.query(`
      UPDATE agent_rotation_state
      SET current_position = $1,
          last_assigned_user_id = $2,
          total_assignments = total_assignments + 1,
          updated_at = NOW()
      WHERE agent_id = $3
    `, [currentPosition, nextAssignee.user_id, agentId]);

    console.log(`[RotationService] Next assignee for agent ${agentId}: ${nextAssignee.user_name} (position ${currentPosition + 1}/${assignees.length})`);

    return {
      userId: nextAssignee.user_id,
      userName: nextAssignee.user_name,
      userEmail: nextAssignee.user_email
    };
  } catch (error) {
    console.error('[RotationService] Error getting next assignee:', error);
    throw error;
  }
}

/**
 * Record an assignment (for tracking purposes)
 * @param {number} agentId - The agent ID
 * @param {number} userId - The user ID who received the assignment
 * @param {number} conversationId - The conversation that was assigned
 */
async function recordAssignment(agentId, userId, conversationId) {
  try {
    // Update the conversation with the assigned user
    await db.query(`
      UPDATE conversations
      SET assigned_user_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [userId, conversationId]);

    console.log(`[RotationService] Recorded assignment: conversation ${conversationId} -> user ${userId}`);
  } catch (error) {
    console.error('[RotationService] Error recording assignment:', error);
    throw error;
  }
}

/**
 * Get the rotation state for an agent
 * @param {number} agentId - The agent ID
 * @returns {Promise<object>}
 */
async function getRotationState(agentId) {
  try {
    const result = await db.query(`
      SELECT rs.*, u.name as last_assigned_user_name
      FROM agent_rotation_state rs
      LEFT JOIN users u ON rs.last_assigned_user_id = u.id
      WHERE rs.agent_id = $1
    `, [agentId]);

    return result.rows[0] || null;
  } catch (error) {
    console.error('[RotationService] Error getting rotation state:', error);
    throw error;
  }
}

/**
 * Get all assignees for an agent
 * @param {number} agentId - The agent ID
 * @returns {Promise<Array>}
 */
async function getAssignees(agentId) {
  try {
    const result = await db.query(`
      SELECT aa.id, aa.user_id, aa.rotation_order, aa.is_active, aa.created_at,
             u.name as user_name, u.email as user_email, u.avatar_url
      FROM agent_assignees aa
      INNER JOIN users u ON aa.user_id = u.id
      WHERE aa.agent_id = $1
      ORDER BY aa.rotation_order ASC
    `, [agentId]);

    return result.rows;
  } catch (error) {
    console.error('[RotationService] Error getting assignees:', error);
    throw error;
  }
}

/**
 * Set assignees for an agent (replaces existing)
 * @param {number} agentId - The agent ID
 * @param {Array<number>} userIds - Array of user IDs in rotation order
 */
async function setAssignees(agentId, userIds) {
  try {
    // Start transaction
    await db.query('BEGIN');

    // Remove existing assignees
    await db.query(`DELETE FROM agent_assignees WHERE agent_id = $1`, [agentId]);

    // Reset rotation state
    await db.query(`
      DELETE FROM agent_rotation_state WHERE agent_id = $1
    `, [agentId]);

    // Insert new assignees in order
    for (let i = 0; i < userIds.length; i++) {
      await db.query(`
        INSERT INTO agent_assignees (agent_id, user_id, rotation_order, is_active)
        VALUES ($1, $2, $3, true)
      `, [agentId, userIds[i], i + 1]);
    }

    // Create initial rotation state if there are assignees
    if (userIds.length > 0) {
      await db.query(`
        INSERT INTO agent_rotation_state (agent_id, current_position, total_assignments)
        VALUES ($1, -1, 0)
      `, [agentId]);
    }

    await db.query('COMMIT');

    console.log(`[RotationService] Set ${userIds.length} assignees for agent ${agentId}`);

    return { success: true, count: userIds.length };
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('[RotationService] Error setting assignees:', error);
    throw error;
  }
}

/**
 * Add a single assignee to an agent
 * @param {number} agentId - The agent ID
 * @param {number} userId - The user ID to add
 * @returns {Promise<object>}
 */
async function addAssignee(agentId, userId) {
  try {
    // Get the current max order
    const maxResult = await db.query(`
      SELECT COALESCE(MAX(rotation_order), 0) as max_order
      FROM agent_assignees WHERE agent_id = $1
    `, [agentId]);

    const nextOrder = maxResult.rows[0].max_order + 1;

    await db.query(`
      INSERT INTO agent_assignees (agent_id, user_id, rotation_order, is_active)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (agent_id, user_id) DO UPDATE SET is_active = true, rotation_order = $3
    `, [agentId, userId, nextOrder]);

    // Ensure rotation state exists
    await db.query(`
      INSERT INTO agent_rotation_state (agent_id, current_position, total_assignments)
      VALUES ($1, -1, 0)
      ON CONFLICT (agent_id) DO NOTHING
    `, [agentId]);

    console.log(`[RotationService] Added assignee ${userId} to agent ${agentId} at position ${nextOrder}`);

    return { success: true, rotationOrder: nextOrder };
  } catch (error) {
    console.error('[RotationService] Error adding assignee:', error);
    throw error;
  }
}

/**
 * Remove an assignee from an agent
 * @param {number} agentId - The agent ID
 * @param {number} userId - The user ID to remove
 */
async function removeAssignee(agentId, userId) {
  try {
    await db.query(`
      DELETE FROM agent_assignees WHERE agent_id = $1 AND user_id = $2
    `, [agentId, userId]);

    // Reorder remaining assignees
    await db.query(`
      WITH ordered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY rotation_order) as new_order
        FROM agent_assignees WHERE agent_id = $1
      )
      UPDATE agent_assignees aa
      SET rotation_order = o.new_order
      FROM ordered o
      WHERE aa.id = o.id
    `, [agentId]);

    console.log(`[RotationService] Removed assignee ${userId} from agent ${agentId}`);

    return { success: true };
  } catch (error) {
    console.error('[RotationService] Error removing assignee:', error);
    throw error;
  }
}

/**
 * Update the rotation order for an assignee
 * @param {number} agentId - The agent ID
 * @param {number} userId - The user ID
 * @param {number} newOrder - The new rotation order
 */
async function updateAssigneeOrder(agentId, userId, newOrder) {
  try {
    await db.query(`
      UPDATE agent_assignees
      SET rotation_order = $1, updated_at = NOW()
      WHERE agent_id = $2 AND user_id = $3
    `, [newOrder, agentId, userId]);

    console.log(`[RotationService] Updated assignee ${userId} order to ${newOrder} for agent ${agentId}`);

    return { success: true };
  } catch (error) {
    console.error('[RotationService] Error updating assignee order:', error);
    throw error;
  }
}

/**
 * Get the next assignee AND log the assignment in one operation
 * This is the preferred method for making assignments as it handles logging automatically
 * @param {Object} params
 * @param {string} params.agentId - The agent ID
 * @param {string} params.accountId - The account ID (for logging)
 * @param {string} params.conversationId - The conversation ID (optional)
 * @param {string} params.leadId - The lead ID (optional)
 * @param {Object} params.leadData - Lead data for denormalization (optional)
 * @returns {Promise<{userId: number, userName: string, userEmail: string, rotationPosition: number, totalAssignees: number} | null>}
 */
async function assignAndLog({
  agentId,
  accountId,
  conversationId = null,
  leadId = null,
  leadData = {}
}) {
  try {
    // 1. Get all active assignees ordered by rotation_order
    const assigneesResult = await db.query(`
      SELECT aa.id, aa.user_id, aa.rotation_order, u.name as user_name, u.email as user_email
      FROM agent_assignees aa
      INNER JOIN users u ON aa.user_id = u.id
      WHERE aa.agent_id = $1 AND aa.is_active = true
      ORDER BY aa.rotation_order ASC
    `, [agentId]);

    const assignees = assigneesResult.rows;

    if (assignees.length === 0) {
      console.log(`[RotationService] No active assignees found for agent ${agentId}`);
      return null;
    }

    // 2. Get or create rotation state for this agent
    let stateResult = await db.query(`
      SELECT * FROM agent_rotation_state WHERE agent_id = $1
    `, [agentId]);

    let currentPosition = 0;

    if (stateResult.rows.length === 0) {
      // Create initial state
      await db.query(`
        INSERT INTO agent_rotation_state (agent_id, current_position, total_assignments)
        VALUES ($1, 0, 0)
      `, [agentId]);
    } else {
      // Get next position (circular)
      currentPosition = (stateResult.rows[0].current_position + 1) % assignees.length;
    }

    // 3. Get the assignee at the current position
    const nextAssignee = assignees[currentPosition];

    // 4. Update rotation state
    await db.query(`
      UPDATE agent_rotation_state
      SET current_position = $1,
          last_assigned_user_id = $2,
          total_assignments = total_assignments + 1,
          updated_at = NOW()
      WHERE agent_id = $3
    `, [currentPosition, nextAssignee.user_id, agentId]);

    // 5. Record in conversations if provided
    if (conversationId) {
      await db.query(`
        UPDATE conversations
        SET assigned_user_id = $1, updated_at = NOW()
        WHERE id = $2
      `, [nextAssignee.user_id, conversationId]);
    }

    // 6. Log the assignment (fire and forget - don't block on this)
    const rotationPosition = currentPosition + 1; // 1-based for display
    const totalAssignees = assignees.length;

    assignmentLogService.logAssignment({
      accountId,
      agentId,
      leadId,
      conversationId,
      assignedToUserId: nextAssignee.user_id,
      rotationPosition,
      totalAssignees,
      leadData
    }).catch(err => {
      console.error('[RotationService] Failed to log assignment:', err);
    });

    console.log(`[RotationService] Assigned to ${nextAssignee.user_name} (position ${rotationPosition}/${totalAssignees})`);

    return {
      userId: nextAssignee.user_id,
      userName: nextAssignee.user_name,
      userEmail: nextAssignee.user_email,
      rotationPosition,
      totalAssignees
    };
  } catch (error) {
    console.error('[RotationService] Error in assignAndLog:', error);
    throw error;
  }
}

module.exports = {
  getNextAssignee,
  recordAssignment,
  getRotationState,
  getAssignees,
  setAssignees,
  addAssignee,
  removeAssignee,
  updateAssigneeOrder,
  assignAndLog
};
