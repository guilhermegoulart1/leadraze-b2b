// backend/src/middleware/apiKeyAuth.js
const apiKeyService = require('../services/apiKeyService');

/**
 * Middleware to authenticate requests using API key
 * API key can be provided in:
 * - X-API-Key header
 * - Authorization: Bearer <key>
 * - Query parameter: ?api_key=<key>
 */
const authenticateApiKey = async (req, res, next) => {
  const startTime = Date.now();
  let apiKeyRecord = null;

  try {
    // Extract API key from various sources
    let apiKey = req.headers['x-api-key']
      || req.headers['authorization']?.replace('Bearer ', '')
      || req.query.api_key;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_API_KEY',
          message: 'API key is required. Provide it via X-API-Key header, Authorization header, or api_key query parameter.'
        }
      });
    }

    // Validate the API key
    apiKeyRecord = await apiKeyService.validateApiKey(apiKey);

    if (!apiKeyRecord) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid or expired API key.'
        }
      });
    }

    // Check rate limit
    const withinLimit = await apiKeyService.checkRateLimit(apiKeyRecord.id, apiKeyRecord.rate_limit);
    const remaining = await apiKeyService.getRateLimitRemaining(apiKeyRecord.id, apiKeyRecord.rate_limit);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', apiKeyRecord.rate_limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', getNextHourTimestamp());

    if (!withinLimit) {
      // Log the rate limit exceeded
      await apiKeyService.logApiKeyUsage(apiKeyRecord.id, {
        endpoint: req.originalUrl,
        method: req.method,
        statusCode: 429,
        responseTimeMs: Date.now() - startTime,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent'],
        errorMessage: 'Rate limit exceeded'
      });

      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit of ${apiKeyRecord.rate_limit} requests per hour exceeded. Try again later.`,
          retry_after: getSecondsUntilNextHour()
        }
      });
    }

    // Update usage timestamp
    await apiKeyService.updateKeyUsage(apiKeyRecord.id);

    // Add API key context to request
    req.apiKey = {
      id: apiKeyRecord.id,
      name: apiKeyRecord.name,
      accountId: apiKeyRecord.account_id,
      permissions: apiKeyRecord.permissions || [],
      rateLimit: apiKeyRecord.rate_limit
    };

    // Add account context (similar to authenticateToken middleware)
    req.account = {
      id: apiKeyRecord.account_id,
      name: apiKeyRecord.account_name
    };

    // Log successful request (after response is sent)
    res.on('finish', async () => {
      try {
        await apiKeyService.logApiKeyUsage(apiKeyRecord.id, {
          endpoint: req.originalUrl,
          method: req.method,
          statusCode: res.statusCode,
          responseTimeMs: Date.now() - startTime,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.headers['user-agent']
        });
      } catch (logError) {
        console.error('Failed to log API key usage:', logError);
      }
    });

    next();
  } catch (error) {
    console.error('API Key authentication error:', error);

    // Log the error if we have a key record
    if (apiKeyRecord) {
      try {
        await apiKeyService.logApiKeyUsage(apiKeyRecord.id, {
          endpoint: req.originalUrl,
          method: req.method,
          statusCode: 500,
          responseTimeMs: Date.now() - startTime,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.headers['user-agent'],
          errorMessage: error.message
        });
      } catch (logError) {
        console.error('Failed to log API key usage:', logError);
      }
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'An error occurred during authentication.'
      }
    });
  }
};

/**
 * Middleware factory to check for specific permissions
 * Usage: requirePermission('contacts:read')
 */
const requirePermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.'
        }
      });
    }

    if (!apiKeyService.hasPermission(req.apiKey.permissions, requiredPermission)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `This API key does not have the required permission: ${requiredPermission}`,
          required_permission: requiredPermission,
          current_permissions: req.apiKey.permissions
        }
      });
    }

    next();
  };
};

/**
 * Middleware factory to check for multiple permissions (all required)
 * Usage: requireAllPermissions(['contacts:read', 'contacts:write'])
 */
const requireAllPermissions = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.'
        }
      });
    }

    const missingPermissions = requiredPermissions.filter(
      perm => !apiKeyService.hasPermission(req.apiKey.permissions, perm)
    );

    if (missingPermissions.length > 0) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `This API key is missing required permissions: ${missingPermissions.join(', ')}`,
          missing_permissions: missingPermissions,
          current_permissions: req.apiKey.permissions
        }
      });
    }

    next();
  };
};

/**
 * Middleware factory to check for any of multiple permissions
 * Usage: requireAnyPermission(['contacts:read', 'contacts:*'])
 */
const requireAnyPermission = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.'
        }
      });
    }

    const hasAnyPermission = requiredPermissions.some(
      perm => apiKeyService.hasPermission(req.apiKey.permissions, perm)
    );

    if (!hasAnyPermission) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `This API key requires at least one of these permissions: ${requiredPermissions.join(', ')}`,
          required_permissions: requiredPermissions,
          current_permissions: req.apiKey.permissions
        }
      });
    }

    next();
  };
};

// Helper functions
function getNextHourTimestamp() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  return Math.floor(now.getTime() / 1000);
}

function getSecondsUntilNextHour() {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);
  return Math.floor((nextHour.getTime() - now.getTime()) / 1000);
}

module.exports = {
  authenticateApiKey,
  requirePermission,
  requireAllPermissions,
  requireAnyPermission
};
