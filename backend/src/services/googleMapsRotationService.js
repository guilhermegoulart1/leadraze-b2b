/**
 * @deprecated This service is DEPRECATED as of 2024-12.
 *
 * Please use the centralized roundRobinService instead:
 * - roundRobinService.autoAssignLeadOnCreation() for all lead sources
 *
 * The centralized service provides:
 * - Unified round-robin based on SECTORS (not agents)
 * - Fallback to campaign's default_responsible_user_id
 * - Support for all lead sources: Google Maps, LinkedIn, External API, Manual
 *
 * This file is kept for backwards compatibility but will be removed in a future version.
 *
 * ========================================================================
 * ORIGINAL DESCRIPTION (DEPRECATED):
 * Google Maps Rotation Service
 *
 * Manages the round-robin rotation system for Google Maps agent assignees.
 * Distributes leads to users in a fixed order, cycling through all assignees.
 * ========================================================================
 */

const db = require('../config/database');

/**
 * @deprecated Use roundRobinService.getNextUser(sectorId, accountId) instead
 *
 * Get the next assignee for an agent using round-robin rotation
 * @param {string} agentId - The agent ID
 * @returns {Promise<{userId: string, userName: string, userEmail: string} | null>}
 */
async function getNextAssignee(agentId) {
  console.warn('[DEPRECATED] googleMapsRotationService.getNextAssignee() is deprecated. Use roundRobinService.getNextUser() instead.');
  try {
    // 1. Get all active assignees ordered by rotation_order
    const assigneesResult = await db.query(`
      SELECT aa.id, aa.user_id, aa.rotation_order, u.name as user_name, u.email as user_email
      FROM google_maps_agent_assignees aa
      INNER JOIN users u ON aa.user_id = u.id
      WHERE aa.agent_id = $1 AND aa.is_active = true
      ORDER BY aa.rotation_order ASC
    `, [agentId]);

    const assignees = assigneesResult.rows;

    if (assignees.length === 0) {
      console.log(`[GMapsRotation] No active assignees found for agent ${agentId}`);
      return null;
    }

    // 2. Get or create rotation state for this agent
    let stateResult = await db.query(`
      SELECT * FROM google_maps_agent_rotation_state WHERE agent_id = $1
    `, [agentId]);

    let currentPosition = 0;

    if (stateResult.rows.length === 0) {
      // Create initial state
      await db.query(`
        INSERT INTO google_maps_agent_rotation_state (agent_id, current_position, total_assignments)
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
      UPDATE google_maps_agent_rotation_state
      SET current_position = $1,
          last_assigned_user_id = $2,
          total_assignments = total_assignments + 1,
          updated_at = NOW()
      WHERE agent_id = $3
    `, [currentPosition, nextAssignee.user_id, agentId]);

    console.log(`[GMapsRotation] Next assignee for agent ${agentId}: ${nextAssignee.user_name} (position ${currentPosition + 1}/${assignees.length})`);

    return {
      userId: nextAssignee.user_id,
      userName: nextAssignee.user_name,
      userEmail: nextAssignee.user_email,
      rotationPosition: currentPosition + 1,
      totalAssignees: assignees.length
    };
  } catch (error) {
    console.error('[GMapsRotation] Error getting next assignee:', error);
    throw error;
  }
}

/**
 * Get all assignees for an agent
 * @param {string} agentId - The agent ID
 * @returns {Promise<Array>}
 */
async function getAssignees(agentId) {
  try {
    const result = await db.query(`
      SELECT aa.id, aa.user_id, aa.rotation_order, aa.is_active, aa.created_at,
             u.name as user_name, u.email as user_email, u.avatar_url
      FROM google_maps_agent_assignees aa
      INNER JOIN users u ON aa.user_id = u.id
      WHERE aa.agent_id = $1
      ORDER BY aa.rotation_order ASC
    `, [agentId]);

    return result.rows;
  } catch (error) {
    console.error('[GMapsRotation] Error getting assignees:', error);
    throw error;
  }
}

/**
 * Set assignees for an agent (replaces existing)
 * @param {string} agentId - The agent ID
 * @param {Array<string>} userIds - Array of user IDs in rotation order
 */
async function setAssignees(agentId, userIds) {
  try {
    // Start transaction
    await db.query('BEGIN');

    // Remove existing assignees
    await db.query(`DELETE FROM google_maps_agent_assignees WHERE agent_id = $1`, [agentId]);

    // Reset rotation state
    await db.query(`DELETE FROM google_maps_agent_rotation_state WHERE agent_id = $1`, [agentId]);

    // Insert new assignees in order
    for (let i = 0; i < userIds.length; i++) {
      await db.query(`
        INSERT INTO google_maps_agent_assignees (agent_id, user_id, rotation_order, is_active)
        VALUES ($1, $2, $3, true)
      `, [agentId, userIds[i], i + 1]);
    }

    // Create initial rotation state if there are assignees
    if (userIds.length > 0) {
      await db.query(`
        INSERT INTO google_maps_agent_rotation_state (agent_id, current_position, total_assignments)
        VALUES ($1, -1, 0)
      `, [agentId]);
    }

    await db.query('COMMIT');

    console.log(`[GMapsRotation] Set ${userIds.length} assignees for agent ${agentId}`);

    return { success: true, count: userIds.length };
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('[GMapsRotation] Error setting assignees:', error);
    throw error;
  }
}

/**
 * Get the rotation state for an agent
 * @param {string} agentId - The agent ID
 * @returns {Promise<object>}
 */
async function getRotationState(agentId) {
  try {
    const result = await db.query(`
      SELECT rs.*, u.name as last_assigned_user_name
      FROM google_maps_agent_rotation_state rs
      LEFT JOIN users u ON rs.last_assigned_user_id = u.id
      WHERE rs.agent_id = $1
    `, [agentId]);

    return result.rows[0] || null;
  } catch (error) {
    console.error('[GMapsRotation] Error getting rotation state:', error);
    throw error;
  }
}

/**
 * Log an assignment
 * @param {Object} params
 */
async function logAssignment({
  accountId,
  agentId,
  contactId = null,
  leadId = null,
  assignedToUserId,
  rotationPosition,
  totalAssignees,
  leadName = null,
  leadCompany = null
}) {
  try {
    await db.query(`
      INSERT INTO google_maps_agent_assignments (
        account_id, agent_id, contact_id, lead_id, assigned_to_user_id,
        rotation_position, total_assignees, lead_name, lead_company
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      accountId, agentId, contactId, leadId, assignedToUserId,
      rotationPosition, totalAssignees, leadName, leadCompany
    ]);

    console.log(`[GMapsRotation] Logged assignment: ${leadName} -> user ${assignedToUserId}`);
  } catch (error) {
    console.error('[GMapsRotation] Error logging assignment:', error);
    // Don't throw - logging should not fail the main operation
  }
}

/**
 * @deprecated Use roundRobinService.autoAssignLeadOnCreation() instead
 *
 * Assign lead to next user and log the assignment
 * @param {Object} params
 * @returns {Promise<{userId: string, userName: string, userEmail: string, rotationPosition: number, totalAssignees: number} | null>}
 */
async function assignAndLog({
  agentId,
  accountId,
  contactId = null,
  leadId = null,
  leadData = {}
}) {
  try {
    // Get next assignee
    const nextAssignee = await getNextAssignee(agentId);

    if (!nextAssignee) {
      return null;
    }

    // Update contact with assigned user
    if (contactId) {
      await db.query(`
        UPDATE contacts
        SET assigned_user_id = $1, updated_at = NOW()
        WHERE id = $2
      `, [nextAssignee.userId, contactId]);
    }

    // Update lead with assigned user if the column exists
    if (leadId) {
      try {
        await db.query(`
          UPDATE leads
          SET assigned_user_id = $1, updated_at = NOW()
          WHERE id = $2
        `, [nextAssignee.userId, leadId]);
      } catch (err) {
        // Column might not exist, ignore
        console.log('[GMapsRotation] Could not update lead assigned_user_id:', err.message);
      }
    }

    // Log the assignment
    await logAssignment({
      accountId,
      agentId,
      contactId,
      leadId,
      assignedToUserId: nextAssignee.userId,
      rotationPosition: nextAssignee.rotationPosition,
      totalAssignees: nextAssignee.totalAssignees,
      leadName: leadData.name,
      leadCompany: leadData.company
    });

    return nextAssignee;
  } catch (error) {
    console.error('[GMapsRotation] Error in assignAndLog:', error);
    throw error;
  }
}

/**
 * Get recent assignments for an agent
 * @param {string} agentId - The agent ID
 * @param {number} limit - Number of assignments to return
 */
async function getRecentAssignments(agentId, limit = 50) {
  try {
    const result = await db.query(`
      SELECT
        a.id, a.lead_name, a.lead_company, a.rotation_position, a.total_assignees,
        a.created_at, u.name as assigned_to_name, u.email as assigned_to_email
      FROM google_maps_agent_assignments a
      INNER JOIN users u ON a.assigned_to_user_id = u.id
      WHERE a.agent_id = $1
      ORDER BY a.created_at DESC
      LIMIT $2
    `, [agentId, limit]);

    return result.rows;
  } catch (error) {
    console.error('[GMapsRotation] Error getting recent assignments:', error);
    throw error;
  }
}

module.exports = {
  getNextAssignee,
  getAssignees,
  setAssignees,
  getRotationState,
  logAssignment,
  assignAndLog,
  getRecentAssignments
};
