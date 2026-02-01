/**
 * External Instagram Agents Routes
 * Path: /external/v1/instagram-agents
 */

const express = require('express');
const router = express.Router();
const instagramAgentsController = require('../../controllers/external/instagramAgentsExternalController');
const { requirePermission } = require('../../middleware/apiKeyAuth');

// List Instagram agents
router.get('/',
  requirePermission('instagram_agents:read'),
  instagramAgentsController.listAgents
);

// Add profile to Instagram agent
router.post('/:id/profiles',
  requirePermission('instagram_agents:write'),
  instagramAgentsController.addProfile
);

module.exports = router;
