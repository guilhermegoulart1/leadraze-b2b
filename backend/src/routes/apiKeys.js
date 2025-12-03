/**
 * API Keys Routes
 * Manage API keys for external integrations
 */

const express = require('express');
const router = express.Router();
const apiKeyController = require('../controllers/apiKeyController');
const { authenticateToken } = require('../middleware/auth');
const { requirePaidSubscription } = require('../middleware/billing');

// All API key management routes require authentication
router.use(authenticateToken);

// Get available permissions
router.get('/permissions', apiKeyController.getAvailablePermissions);

// List all API keys for the account
router.get('/', apiKeyController.listApiKeys);

// Create a new API key (blocked for trial users)
router.post('/', requirePaidSubscription('api_keys'), apiKeyController.createApiKey);

// Get a single API key
router.get('/:id', apiKeyController.getApiKey);

// Update an API key
router.put('/:id', apiKeyController.updateApiKey);

// Revoke (deactivate) an API key
router.delete('/:id', apiKeyController.revokeApiKey);

// Permanently delete an API key
router.delete('/:id/permanent', apiKeyController.deleteApiKey);

// Get usage statistics for an API key
router.get('/:id/usage', apiKeyController.getApiKeyUsage);

// Regenerate an API key (blocked for trial users)
router.post('/:id/regenerate', requirePaidSubscription('api_keys'), apiKeyController.regenerateApiKey);

module.exports = router;
