// backend/src/services/apiKeyService.js
const crypto = require('crypto');
const db = require('../config/database');

/**
 * Generate a new API key
 * Returns the plain key (only shown once) and the hash for storage
 */
const generateApiKey = () => {
  // Generate 32 random bytes (256 bits)
  const randomBytes = crypto.randomBytes(32);

  // Create the full key with prefix: lr_live_<base64 encoded random bytes>
  const keyBody = randomBytes.toString('base64url');
  const fullKey = `lr_live_${keyBody}`;

  // Create prefix for visual identification (first 12 chars)
  const keyPrefix = fullKey.substring(0, 12);

  // Hash the key with SHA-256 for storage
  const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

  return {
    fullKey,      // Return to user ONCE
    keyPrefix,    // Store for identification
    keyHash       // Store in database
  };
};

/**
 * Hash an API key for comparison
 */
const hashApiKey = (key) => {
  return crypto.createHash('sha256').update(key).digest('hex');
};

/**
 * Validate an API key and return the key record
 */
const validateApiKey = async (apiKey) => {
  if (!apiKey) {
    return null;
  }

  const keyHash = hashApiKey(apiKey);

  const result = await db.query(
    `SELECT ak.*, a.name as account_name, a.is_active as account_active,
            u.name as created_by_name, u.email as created_by_email
     FROM api_keys ak
     JOIN accounts a ON ak.account_id = a.id
     JOIN users u ON ak.created_by = u.id
     WHERE ak.key_hash = $1
       AND ak.is_active = true
       AND (ak.expires_at IS NULL OR ak.expires_at > NOW())`,
    [keyHash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const keyRecord = result.rows[0];

  // Check if account is active
  if (!keyRecord.account_active) {
    return null;
  }

  return keyRecord;
};

/**
 * Update last used timestamp and increment request count
 */
const updateKeyUsage = async (keyId) => {
  await db.query(
    `UPDATE api_keys
     SET last_used_at = NOW(),
         request_count = request_count + 1,
         updated_at = NOW()
     WHERE id = $1`,
    [keyId]
  );
};

/**
 * Log API key usage
 */
const logApiKeyUsage = async (keyId, { endpoint, method, statusCode, responseTimeMs, ipAddress, userAgent, errorMessage }) => {
  await db.query(
    `INSERT INTO api_key_usage_logs
     (api_key_id, endpoint, method, status_code, response_time_ms, ip_address, user_agent, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [keyId, endpoint, method, statusCode, responseTimeMs, ipAddress, userAgent, errorMessage]
  );
};

/**
 * Check rate limit for an API key
 * Returns true if within limit, false if exceeded
 */
const checkRateLimit = async (keyId, rateLimit) => {
  const windowStart = new Date();
  windowStart.setMinutes(0, 0, 0); // Start of current hour

  // Get or create rate limit record
  const result = await db.query(
    `INSERT INTO api_key_rate_limits (api_key_id, window_start, request_count)
     VALUES ($1, $2, 1)
     ON CONFLICT (api_key_id, window_start)
     DO UPDATE SET request_count = api_key_rate_limits.request_count + 1
     RETURNING request_count`,
    [keyId, windowStart]
  );

  const currentCount = result.rows[0].request_count;
  return currentCount <= rateLimit;
};

/**
 * Get remaining rate limit for an API key
 */
const getRateLimitRemaining = async (keyId, rateLimit) => {
  const windowStart = new Date();
  windowStart.setMinutes(0, 0, 0);

  const result = await db.query(
    `SELECT request_count FROM api_key_rate_limits
     WHERE api_key_id = $1 AND window_start = $2`,
    [keyId, windowStart]
  );

  const currentCount = result.rows[0]?.request_count || 0;
  return Math.max(0, rateLimit - currentCount);
};

/**
 * Create a new API key
 */
const createApiKey = async ({ accountId, createdBy, name, permissions, rateLimit, expiresAt }) => {
  const { fullKey, keyPrefix, keyHash } = generateApiKey();

  const result = await db.query(
    `INSERT INTO api_keys
     (account_id, created_by, name, key_hash, key_prefix, permissions, rate_limit, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, account_id, created_by, name, key_prefix, permissions, rate_limit, expires_at, is_active, created_at`,
    [accountId, createdBy, name, keyHash, keyPrefix, JSON.stringify(permissions), rateLimit || 1000, expiresAt]
  );

  return {
    ...result.rows[0],
    fullKey // Return the full key only on creation
  };
};

/**
 * List API keys for an account (masked)
 */
const listApiKeys = async (accountId) => {
  const result = await db.query(
    `SELECT ak.id, ak.name, ak.key_prefix, ak.permissions, ak.rate_limit,
            ak.last_used_at, ak.request_count, ak.expires_at, ak.is_active,
            ak.created_at, ak.updated_at,
            u.name as created_by_name, u.email as created_by_email
     FROM api_keys ak
     JOIN users u ON ak.created_by = u.id
     WHERE ak.account_id = $1
     ORDER BY ak.created_at DESC`,
    [accountId]
  );

  return result.rows;
};

/**
 * Get a single API key by ID
 */
const getApiKeyById = async (keyId, accountId) => {
  const result = await db.query(
    `SELECT ak.id, ak.name, ak.key_prefix, ak.permissions, ak.rate_limit,
            ak.last_used_at, ak.request_count, ak.expires_at, ak.is_active,
            ak.created_at, ak.updated_at,
            u.name as created_by_name, u.email as created_by_email
     FROM api_keys ak
     JOIN users u ON ak.created_by = u.id
     WHERE ak.id = $1 AND ak.account_id = $2`,
    [keyId, accountId]
  );

  return result.rows[0];
};

/**
 * Update an API key
 */
const updateApiKey = async (keyId, accountId, { name, permissions, rateLimit, expiresAt }) => {
  const updates = [];
  const values = [];
  let paramCount = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramCount++}`);
    values.push(name);
  }

  if (permissions !== undefined) {
    updates.push(`permissions = $${paramCount++}`);
    values.push(JSON.stringify(permissions));
  }

  if (rateLimit !== undefined) {
    updates.push(`rate_limit = $${paramCount++}`);
    values.push(rateLimit);
  }

  if (expiresAt !== undefined) {
    updates.push(`expires_at = $${paramCount++}`);
    values.push(expiresAt);
  }

  if (updates.length === 0) {
    return getApiKeyById(keyId, accountId);
  }

  updates.push(`updated_at = NOW()`);
  values.push(keyId, accountId);

  const result = await db.query(
    `UPDATE api_keys
     SET ${updates.join(', ')}
     WHERE id = $${paramCount++} AND account_id = $${paramCount}
     RETURNING id, name, key_prefix, permissions, rate_limit, expires_at, is_active, updated_at`,
    values
  );

  return result.rows[0];
};

/**
 * Revoke (deactivate) an API key
 */
const revokeApiKey = async (keyId, accountId) => {
  const result = await db.query(
    `UPDATE api_keys
     SET is_active = false, updated_at = NOW()
     WHERE id = $1 AND account_id = $2
     RETURNING id, name, is_active`,
    [keyId, accountId]
  );

  return result.rows[0];
};

/**
 * Delete an API key permanently
 */
const deleteApiKey = async (keyId, accountId) => {
  const result = await db.query(
    `DELETE FROM api_keys
     WHERE id = $1 AND account_id = $2
     RETURNING id`,
    [keyId, accountId]
  );

  return result.rowCount > 0;
};

/**
 * Get API key usage statistics
 */
const getApiKeyUsageStats = async (keyId, accountId, days = 30) => {
  // First verify the key belongs to the account
  const keyCheck = await db.query(
    `SELECT id FROM api_keys WHERE id = $1 AND account_id = $2`,
    [keyId, accountId]
  );

  if (keyCheck.rows.length === 0) {
    return null;
  }

  // Get daily usage stats
  const result = await db.query(
    `SELECT
       DATE(created_at) as date,
       COUNT(*) as total_requests,
       COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as successful_requests,
       COUNT(*) FILTER (WHERE status_code >= 400) as failed_requests,
       AVG(response_time_ms)::INTEGER as avg_response_time_ms,
       array_agg(DISTINCT endpoint) as endpoints_used
     FROM api_key_usage_logs
     WHERE api_key_id = $1
       AND created_at >= NOW() - INTERVAL '${days} days'
     GROUP BY DATE(created_at)
     ORDER BY date DESC`,
    [keyId]
  );

  // Get total stats
  const totals = await db.query(
    `SELECT
       COUNT(*) as total_requests,
       COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as successful_requests,
       COUNT(*) FILTER (WHERE status_code >= 400) as failed_requests,
       AVG(response_time_ms)::INTEGER as avg_response_time_ms
     FROM api_key_usage_logs
     WHERE api_key_id = $1
       AND created_at >= NOW() - INTERVAL '${days} days'`,
    [keyId]
  );

  return {
    daily: result.rows,
    totals: totals.rows[0]
  };
};

/**
 * Check if a key has a specific permission
 */
const hasPermission = (permissions, requiredPermission) => {
  if (!permissions || !Array.isArray(permissions)) {
    return false;
  }

  // Check for exact match
  if (permissions.includes(requiredPermission)) {
    return true;
  }

  // Check for wildcard permissions (e.g., "contacts:*" matches "contacts:read")
  const [resource, action] = requiredPermission.split(':');
  if (permissions.includes(`${resource}:*`)) {
    return true;
  }

  // Check for full wildcard
  if (permissions.includes('*')) {
    return true;
  }

  return false;
};

/**
 * Clean up old usage logs (for maintenance)
 */
const cleanupOldLogs = async (retentionDays = 90) => {
  const result = await db.query(
    `DELETE FROM api_key_usage_logs
     WHERE created_at < NOW() - INTERVAL '${retentionDays} days'
     RETURNING id`
  );

  return result.rowCount;
};

/**
 * Clean up old rate limit records
 */
const cleanupOldRateLimits = async () => {
  const result = await db.query(
    `DELETE FROM api_key_rate_limits
     WHERE window_start < NOW() - INTERVAL '24 hours'
     RETURNING id`
  );

  return result.rowCount;
};

module.exports = {
  generateApiKey,
  hashApiKey,
  validateApiKey,
  updateKeyUsage,
  logApiKeyUsage,
  checkRateLimit,
  getRateLimitRemaining,
  createApiKey,
  listApiKeys,
  getApiKeyById,
  updateApiKey,
  revokeApiKey,
  deleteApiKey,
  getApiKeyUsageStats,
  hasPermission,
  cleanupOldLogs,
  cleanupOldRateLimits
};
