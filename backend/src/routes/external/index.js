/**
 * External API Routes
 * Public endpoints authenticated via API key
 * Base path: /external/v1
 */

const express = require('express');
const router = express.Router();
const { authenticateApiKey } = require('../../middleware/apiKeyAuth');

// Apply API key authentication to all external routes
router.use(authenticateApiKey);

// Mount sub-routes
router.use('/contacts', require('./contacts'));
router.use('/opportunities', require('./opportunities'));

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'GetRaze External API v1',
    version: '1.0.0',
    endpoints: {
      contacts: {
        list: 'GET /external/v1/contacts',
        get: 'GET /external/v1/contacts/:id',
        create: 'POST /external/v1/contacts',
        update: 'PUT /external/v1/contacts/:id',
        delete: 'DELETE /external/v1/contacts/:id'
      },
      opportunities: {
        list: 'GET /external/v1/opportunities',
        get: 'GET /external/v1/opportunities/:id',
        create: 'POST /external/v1/opportunities',
        update: 'PUT /external/v1/opportunities/:id',
        delete: 'DELETE /external/v1/opportunities/:id',
        updateStage: 'PATCH /external/v1/opportunities/:id/stage'
      }
    },
    documentation: 'https://docs.getraze.co/api',
    rate_limit: {
      limit: req.apiKey?.rateLimit || 1000,
      window: '1 hour'
    }
  });
});

module.exports = router;
