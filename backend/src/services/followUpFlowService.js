// backend/src/services/followUpFlowService.js
// Service for managing Follow-Up Flows

const db = require('../config/database');

/**
 * Get all follow-up flows for an account
 * @param {Object} options - Query options
 * @returns {Promise<Array>} List of flows
 */
async function getFlows(options = {}) {
  const {
    accountId,
    isActive = null,
    limit = 50,
    offset = 0
  } = options;

  let query = `
    SELECT
      f.*,
      u.name as created_by_name
    FROM follow_up_flows f
    LEFT JOIN users u ON f.created_by = u.id
    WHERE f.account_id = $1
  `;
  const params = [accountId];
  let paramIndex = 2;

  // Filter by active status
  if (isActive !== null) {
    query += ` AND f.is_active = $${paramIndex++}`;
    params.push(isActive);
  }

  // Order by created_at descending
  query += ` ORDER BY f.created_at DESC`;

  // Pagination
  query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params.push(limit, offset);

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Get total count of flows for an account
 * @param {string} accountId - Account ID
 * @param {boolean|null} isActive - Filter by active status
 * @returns {Promise<number>} Total count
 */
async function getFlowsCount(accountId, isActive = null) {
  let query = `SELECT COUNT(*) as total FROM follow_up_flows WHERE account_id = $1`;
  const params = [accountId];

  if (isActive !== null) {
    query += ` AND is_active = $2`;
    params.push(isActive);
  }

  const result = await db.query(query, params);
  return parseInt(result.rows[0].total, 10);
}

/**
 * Get a single flow by ID
 * @param {string} flowId - Flow UUID
 * @param {string} accountId - Account ID for permission check
 * @returns {Promise<Object|null>} Flow or null
 */
async function getFlowById(flowId, accountId) {
  const query = `
    SELECT
      f.*,
      u.name as created_by_name
    FROM follow_up_flows f
    LEFT JOIN users u ON f.created_by = u.id
    WHERE f.id = $1 AND f.account_id = $2
  `;

  const result = await db.query(query, [flowId, accountId]);
  return result.rows[0] || null;
}

/**
 * Create a new follow-up flow
 * @param {Object} data - Flow data
 * @returns {Promise<Object>} Created flow
 */
async function createFlow(data) {
  const {
    accountId,
    userId,
    name,
    description = null,
    flowDefinition = { nodes: [], edges: [] },
    isActive = false
  } = data;

  const query = `
    INSERT INTO follow_up_flows (
      account_id, name, description, flow_definition, is_active, created_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6
    )
    RETURNING *
  `;

  const result = await db.query(query, [
    accountId,
    name,
    description,
    JSON.stringify(flowDefinition),
    isActive,
    userId
  ]);

  return result.rows[0];
}

/**
 * Update an existing flow
 * @param {string} flowId - Flow UUID
 * @param {string} accountId - Account ID for permission check
 * @param {Object} data - Update data
 * @returns {Promise<Object|null>} Updated flow or null
 */
async function updateFlow(flowId, accountId, data) {
  // First check ownership
  const checkQuery = `
    SELECT id FROM follow_up_flows
    WHERE id = $1 AND account_id = $2
  `;
  const checkResult = await db.query(checkQuery, [flowId, accountId]);

  if (checkResult.rows.length === 0) {
    return null; // Not found or not authorized
  }

  const updateFields = [];
  const params = [flowId];
  let paramIndex = 2;

  // Fields that can be updated
  if (data.name !== undefined) {
    updateFields.push(`name = $${paramIndex++}`);
    params.push(data.name);
  }

  if (data.description !== undefined) {
    updateFields.push(`description = $${paramIndex++}`);
    params.push(data.description);
  }

  if (data.flowDefinition !== undefined) {
    updateFields.push(`flow_definition = $${paramIndex++}`);
    params.push(JSON.stringify(data.flowDefinition));
  }

  if (data.isActive !== undefined) {
    updateFields.push(`is_active = $${paramIndex++}`);
    params.push(data.isActive);
  }

  if (updateFields.length === 0) {
    return await getFlowById(flowId, accountId);
  }

  // updated_at is handled by trigger, but let's be explicit
  updateFields.push(`updated_at = NOW()`);

  const query = `
    UPDATE follow_up_flows
    SET ${updateFields.join(', ')}
    WHERE id = $1
    RETURNING *
  `;

  const result = await db.query(query, params);
  return result.rows[0];
}

/**
 * Delete a flow
 * @param {string} flowId - Flow UUID
 * @param {string} accountId - Account ID for permission check
 * @returns {Promise<boolean>} Success
 */
async function deleteFlow(flowId, accountId) {
  const query = `
    DELETE FROM follow_up_flows
    WHERE id = $1 AND account_id = $2
    RETURNING id
  `;

  const result = await db.query(query, [flowId, accountId]);
  return result.rows.length > 0;
}

/**
 * Clone a flow
 * @param {string} flowId - Flow to clone
 * @param {string} accountId - Account ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Cloned flow
 */
async function cloneFlow(flowId, accountId, userId) {
  const original = await getFlowById(flowId, accountId);

  if (!original) {
    throw new Error('Flow not found');
  }

  const cloneData = {
    accountId,
    userId,
    name: `${original.name} (Copia)`,
    description: original.description,
    flowDefinition: original.flow_definition,
    isActive: false
  };

  return await createFlow(cloneData);
}

/**
 * Toggle flow active status
 * @param {string} flowId - Flow UUID
 * @param {string} accountId - Account ID
 * @returns {Promise<Object|null>} Updated flow or null
 */
async function toggleFlowActive(flowId, accountId) {
  const query = `
    UPDATE follow_up_flows
    SET is_active = NOT is_active, updated_at = NOW()
    WHERE id = $1 AND account_id = $2
    RETURNING *
  `;

  const result = await db.query(query, [flowId, accountId]);
  return result.rows[0] || null;
}

/**
 * Increment execution counters
 * @param {string} flowId - Flow UUID
 * @param {boolean} success - Whether execution was successful
 */
async function recordExecution(flowId, success = true) {
  const query = `
    UPDATE follow_up_flows
    SET
      total_executions = total_executions + 1,
      successful_executions = successful_executions + CASE WHEN $2 THEN 1 ELSE 0 END,
      failed_executions = failed_executions + CASE WHEN $2 THEN 0 ELSE 1 END
    WHERE id = $1
  `;

  await db.query(query, [flowId, success]);
}

module.exports = {
  getFlows,
  getFlowsCount,
  getFlowById,
  createFlow,
  updateFlow,
  deleteFlow,
  cloneFlow,
  toggleFlowActive,
  recordExecution
};
