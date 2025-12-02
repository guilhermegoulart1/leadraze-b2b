/**
 * Assignment Log Service
 *
 * Logs all automatic assignments from the round-robin rotation system.
 * Called by rotationService when a new assignment is made.
 */

const db = require('../config/database');

/**
 * Log an assignment event
 * @param {Object} params
 * @param {string} params.accountId - Account ID
 * @param {string} params.agentId - Agent ID
 * @param {string} params.leadId - Lead ID (optional)
 * @param {string} params.conversationId - Conversation ID (optional)
 * @param {string} params.assignedToUserId - User ID who received the assignment
 * @param {number} params.rotationPosition - Position in the rotation (1-based)
 * @param {number} params.totalAssignees - Total number of users in rotation
 * @param {Object} params.leadData - Optional lead data for denormalization
 */
async function logAssignment({
  accountId,
  agentId,
  leadId = null,
  conversationId = null,
  assignedToUserId,
  rotationPosition,
  totalAssignees,
  leadData = {}
}) {
  try {
    const result = await db.query(`
      INSERT INTO agent_assignments (
        account_id,
        agent_id,
        lead_id,
        conversation_id,
        assigned_to_user_id,
        rotation_position,
        total_assignees,
        lead_name,
        lead_company,
        lead_profile_picture
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
      accountId,
      agentId,
      leadId,
      conversationId,
      assignedToUserId,
      rotationPosition,
      totalAssignees,
      leadData.name || null,
      leadData.company || null,
      leadData.profile_picture || null
    ]);

    console.log(`[AssignmentLog] Logged assignment: agent ${agentId} -> user ${assignedToUserId} (pos ${rotationPosition}/${totalAssignees})`);

    return result.rows[0];
  } catch (error) {
    // Log error but don't throw - we don't want to break the main flow
    console.error('[AssignmentLog] Error logging assignment:', error);
    return null;
  }
}

/**
 * Get assignments for an agent with pagination
 * @param {Object} params
 * @param {string} params.agentId - Agent ID
 * @param {string} params.accountId - Account ID
 * @param {number} params.page - Page number (1-based)
 * @param {number} params.limit - Items per page
 * @param {string} params.userId - Filter by user ID (optional)
 * @param {string} params.startDate - Start date filter (optional)
 * @param {string} params.endDate - End date filter (optional)
 */
async function getAssignments({
  agentId,
  accountId,
  page = 1,
  limit = 50,
  userId = null,
  startDate = null,
  endDate = null
}) {
  try {
    let whereConditions = ['aa.agent_id = $1', 'aa.account_id = $2'];
    let queryParams = [agentId, accountId];
    let paramIndex = 3;

    if (userId) {
      whereConditions.push(`aa.assigned_to_user_id = $${paramIndex}`);
      queryParams.push(userId);
      paramIndex++;
    }

    if (startDate) {
      whereConditions.push(`aa.created_at >= $${paramIndex}`);
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`aa.created_at <= $${paramIndex}`);
      queryParams.push(endDate);
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.join(' AND ');

    // Main query with user info
    const query = `
      SELECT
        aa.id,
        aa.agent_id,
        aa.lead_id,
        aa.conversation_id,
        aa.assigned_to_user_id,
        aa.rotation_position,
        aa.total_assignees,
        aa.lead_name,
        aa.lead_company,
        aa.lead_profile_picture,
        aa.created_at,
        u.name as assigned_to_user_name,
        u.email as assigned_to_user_email,
        u.avatar_url as assigned_to_user_avatar
      FROM agent_assignments aa
      LEFT JOIN users u ON aa.assigned_to_user_id = u.id
      WHERE ${whereClause}
      ORDER BY aa.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);

    // Count total
    const countQuery = `
      SELECT COUNT(*) FROM agent_assignments aa WHERE ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    return {
      assignments: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('[AssignmentLog] Error getting assignments:', error);
    throw error;
  }
}

/**
 * Get assignment statistics for an agent
 * @param {string} agentId - Agent ID
 * @param {string} accountId - Account ID
 */
async function getAssignmentStats(agentId, accountId) {
  try {
    const query = `
      SELECT
        COUNT(*) as total_assignments,
        COUNT(DISTINCT assigned_to_user_id) as unique_users,
        COUNT(DISTINCT lead_id) as unique_leads,
        MIN(created_at) as first_assignment,
        MAX(created_at) as last_assignment
      FROM agent_assignments
      WHERE agent_id = $1 AND account_id = $2
    `;

    const result = await db.query(query, [agentId, accountId]);

    // Get assignments per user
    const perUserQuery = `
      SELECT
        aa.assigned_to_user_id,
        u.name as user_name,
        COUNT(*) as assignment_count
      FROM agent_assignments aa
      LEFT JOIN users u ON aa.assigned_to_user_id = u.id
      WHERE aa.agent_id = $1 AND aa.account_id = $2
      GROUP BY aa.assigned_to_user_id, u.name
      ORDER BY assignment_count DESC
    `;

    const perUserResult = await db.query(perUserQuery, [agentId, accountId]);

    return {
      ...result.rows[0],
      per_user: perUserResult.rows
    };
  } catch (error) {
    console.error('[AssignmentLog] Error getting assignment stats:', error);
    throw error;
  }
}

module.exports = {
  logAssignment,
  getAssignments,
  getAssignmentStats
};
