/**
 * API Key Controller
 * Handles CRUD operations for API keys
 */

const apiKeyService = require('../services/apiKeyService');
const { sendSuccess, sendError } = require('../utils/responses');
const { NotFoundError, BadRequestError } = require('../utils/errors');

// Available permission scopes
const AVAILABLE_PERMISSIONS = [
  'contacts:read',
  'contacts:write',
  'contacts:delete',
  'opportunities:read',
  'opportunities:write',
  'opportunities:delete'
];

/**
 * POST /api/api-keys
 * Create a new API key
 */
exports.createApiKey = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { name, permissions, rate_limit, expires_at } = req.body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      throw new BadRequestError('Name is required');
    }

    // Validate permissions
    let validatedPermissions = permissions;
    if (permissions) {
      if (!Array.isArray(permissions)) {
        throw new BadRequestError('Permissions must be an array');
      }

      // Check if all permissions are valid
      const invalidPermissions = permissions.filter(p => !AVAILABLE_PERMISSIONS.includes(p));
      if (invalidPermissions.length > 0) {
        throw new BadRequestError(`Invalid permissions: ${invalidPermissions.join(', ')}. Available: ${AVAILABLE_PERMISSIONS.join(', ')}`);
      }

      validatedPermissions = permissions;
    } else {
      // Default permissions: read and write for both contacts and opportunities
      validatedPermissions = ['contacts:read', 'contacts:write', 'opportunities:read', 'opportunities:write'];
    }

    // Validate rate limit
    let validatedRateLimit = rate_limit;
    if (rate_limit !== undefined) {
      validatedRateLimit = parseInt(rate_limit);
      if (isNaN(validatedRateLimit) || validatedRateLimit < 10 || validatedRateLimit > 10000) {
        throw new BadRequestError('Rate limit must be between 10 and 10000 requests per hour');
      }
    }

    // Validate expiration date
    let validatedExpiresAt = expires_at;
    if (expires_at) {
      validatedExpiresAt = new Date(expires_at);
      if (isNaN(validatedExpiresAt.getTime())) {
        throw new BadRequestError('Invalid expiration date');
      }
      if (validatedExpiresAt <= new Date()) {
        throw new BadRequestError('Expiration date must be in the future');
      }
    }

    // Create the API key
    const apiKey = await apiKeyService.createApiKey({
      accountId,
      createdBy: userId,
      name: name.trim(),
      permissions: validatedPermissions,
      rateLimit: validatedRateLimit,
      expiresAt: validatedExpiresAt
    });

    // Return the full key (only shown once!)
    return sendSuccess(res, {
      message: 'API key created successfully. Make sure to copy the key now - you won\'t be able to see it again!',
      api_key: {
        id: apiKey.id,
        name: apiKey.name,
        key: apiKey.fullKey,  // Only returned on creation!
        key_prefix: apiKey.key_prefix,
        permissions: apiKey.permissions,
        rate_limit: apiKey.rate_limit,
        expires_at: apiKey.expires_at,
        created_at: apiKey.created_at
      }
    }, 201);
  } catch (error) {
    console.error('Error creating API key:', error);
    return sendError(res, error);
  }
};

/**
 * GET /api/api-keys
 * List all API keys for the account (masked)
 */
exports.listApiKeys = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    const apiKeys = await apiKeyService.listApiKeys(accountId);

    // Mask the keys for display
    const maskedKeys = apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      key_preview: `${key.key_prefix}...`,  // Show only prefix
      permissions: key.permissions,
      rate_limit: key.rate_limit,
      last_used_at: key.last_used_at,
      request_count: key.request_count,
      expires_at: key.expires_at,
      is_active: key.is_active,
      created_at: key.created_at,
      updated_at: key.updated_at,
      created_by: {
        name: key.created_by_name,
        email: key.created_by_email
      }
    }));

    return sendSuccess(res, {
      api_keys: maskedKeys,
      total: maskedKeys.length,
      available_permissions: AVAILABLE_PERMISSIONS
    });
  } catch (error) {
    console.error('Error listing API keys:', error);
    return sendError(res, error);
  }
};

/**
 * GET /api/api-keys/:id
 * Get a single API key
 */
exports.getApiKey = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { id } = req.params;

    const apiKey = await apiKeyService.getApiKeyById(id, accountId);

    if (!apiKey) {
      throw new NotFoundError('API key not found');
    }

    return sendSuccess(res, {
      api_key: {
        id: apiKey.id,
        name: apiKey.name,
        key_preview: `${apiKey.key_prefix}...`,
        permissions: apiKey.permissions,
        rate_limit: apiKey.rate_limit,
        last_used_at: apiKey.last_used_at,
        request_count: apiKey.request_count,
        expires_at: apiKey.expires_at,
        is_active: apiKey.is_active,
        created_at: apiKey.created_at,
        updated_at: apiKey.updated_at,
        created_by: {
          name: apiKey.created_by_name,
          email: apiKey.created_by_email
        }
      }
    });
  } catch (error) {
    console.error('Error getting API key:', error);
    return sendError(res, error);
  }
};

/**
 * PUT /api/api-keys/:id
 * Update an API key
 */
exports.updateApiKey = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { id } = req.params;
    const { name, permissions, rate_limit, expires_at } = req.body;

    // Check if key exists
    const existingKey = await apiKeyService.getApiKeyById(id, accountId);
    if (!existingKey) {
      throw new NotFoundError('API key not found');
    }

    // Validate permissions if provided
    if (permissions !== undefined) {
      if (!Array.isArray(permissions)) {
        throw new BadRequestError('Permissions must be an array');
      }

      const invalidPermissions = permissions.filter(p => !AVAILABLE_PERMISSIONS.includes(p));
      if (invalidPermissions.length > 0) {
        throw new BadRequestError(`Invalid permissions: ${invalidPermissions.join(', ')}`);
      }
    }

    // Validate rate limit if provided
    let validatedRateLimit = rate_limit;
    if (rate_limit !== undefined) {
      validatedRateLimit = parseInt(rate_limit);
      if (isNaN(validatedRateLimit) || validatedRateLimit < 10 || validatedRateLimit > 10000) {
        throw new BadRequestError('Rate limit must be between 10 and 10000 requests per hour');
      }
    }

    // Validate expiration date if provided
    let validatedExpiresAt = expires_at;
    if (expires_at !== undefined && expires_at !== null) {
      validatedExpiresAt = new Date(expires_at);
      if (isNaN(validatedExpiresAt.getTime())) {
        throw new BadRequestError('Invalid expiration date');
      }
    }

    // Update the key
    const updatedKey = await apiKeyService.updateApiKey(id, accountId, {
      name: name?.trim(),
      permissions,
      rateLimit: validatedRateLimit,
      expiresAt: validatedExpiresAt
    });

    return sendSuccess(res, {
      message: 'API key updated successfully',
      api_key: updatedKey
    });
  } catch (error) {
    console.error('Error updating API key:', error);
    return sendError(res, error);
  }
};

/**
 * DELETE /api/api-keys/:id
 * Revoke (deactivate) an API key
 */
exports.revokeApiKey = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { id } = req.params;

    // Check if key exists
    const existingKey = await apiKeyService.getApiKeyById(id, accountId);
    if (!existingKey) {
      throw new NotFoundError('API key not found');
    }

    // Revoke the key
    const revokedKey = await apiKeyService.revokeApiKey(id, accountId);

    return sendSuccess(res, {
      message: 'API key revoked successfully',
      api_key: {
        id: revokedKey.id,
        name: revokedKey.name,
        is_active: revokedKey.is_active
      }
    });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return sendError(res, error);
  }
};

/**
 * DELETE /api/api-keys/:id/permanent
 * Permanently delete an API key
 */
exports.deleteApiKey = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { id } = req.params;

    const deleted = await apiKeyService.deleteApiKey(id, accountId);

    if (!deleted) {
      throw new NotFoundError('API key not found');
    }

    return sendSuccess(res, {
      message: 'API key deleted permanently'
    });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return sendError(res, error);
  }
};

/**
 * GET /api/api-keys/:id/usage
 * Get usage statistics for an API key
 */
exports.getApiKeyUsage = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { id } = req.params;
    const { days = 30 } = req.query;

    // Validate days parameter
    const parsedDays = parseInt(days);
    if (isNaN(parsedDays) || parsedDays < 1 || parsedDays > 365) {
      throw new BadRequestError('Days must be between 1 and 365');
    }

    const stats = await apiKeyService.getApiKeyUsageStats(id, accountId, parsedDays);

    if (!stats) {
      throw new NotFoundError('API key not found');
    }

    return sendSuccess(res, {
      period_days: parsedDays,
      usage: stats
    });
  } catch (error) {
    console.error('Error getting API key usage:', error);
    return sendError(res, error);
  }
};

/**
 * POST /api/api-keys/:id/regenerate
 * Regenerate an API key (creates new key, invalidates old one)
 */
exports.regenerateApiKey = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { id } = req.params;

    // Get existing key
    const existingKey = await apiKeyService.getApiKeyById(id, accountId);
    if (!existingKey) {
      throw new NotFoundError('API key not found');
    }

    // Revoke the old key
    await apiKeyService.revokeApiKey(id, accountId);

    // Create a new key with same settings
    const newKey = await apiKeyService.createApiKey({
      accountId,
      createdBy: userId,
      name: existingKey.name,
      permissions: existingKey.permissions,
      rateLimit: existingKey.rate_limit,
      expiresAt: existingKey.expires_at
    });

    return sendSuccess(res, {
      message: 'API key regenerated successfully. Make sure to copy the new key now - you won\'t be able to see it again!',
      old_key_id: id,
      api_key: {
        id: newKey.id,
        name: newKey.name,
        key: newKey.fullKey,  // Only returned on creation!
        key_prefix: newKey.key_prefix,
        permissions: newKey.permissions,
        rate_limit: newKey.rate_limit,
        expires_at: newKey.expires_at,
        created_at: newKey.created_at
      }
    }, 201);
  } catch (error) {
    console.error('Error regenerating API key:', error);
    return sendError(res, error);
  }
};

/**
 * GET /api/api-keys/permissions
 * Get list of available permissions
 */
exports.getAvailablePermissions = async (req, res) => {
  try {
    return sendSuccess(res, {
      permissions: AVAILABLE_PERMISSIONS.map(perm => {
        const [resource, action] = perm.split(':');
        return {
          value: perm,
          resource,
          action,
          description: getPermissionDescription(perm)
        };
      })
    });
  } catch (error) {
    console.error('Error getting permissions:', error);
    return sendError(res, error);
  }
};

// Helper function to get permission descriptions
function getPermissionDescription(permission) {
  const descriptions = {
    'contacts:read': 'Read contact information',
    'contacts:write': 'Create and update contacts',
    'contacts:delete': 'Delete contacts',
    'opportunities:read': 'Read leads/opportunities information',
    'opportunities:write': 'Create and update leads/opportunities',
    'opportunities:delete': 'Delete leads/opportunities'
  };
  return descriptions[permission] || permission;
}
