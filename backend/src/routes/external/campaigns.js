/**
 * External Campaigns Routes
 * Path: /external/v1/campaigns
 */

const express = require('express');
const router = express.Router();
const campaignsController = require('../../controllers/external/campaignsExternalController');
const { requirePermission } = require('../../middleware/apiKeyAuth');

// List campaigns
router.get('/',
  requirePermission('campaigns:read'),
  campaignsController.listCampaigns
);

// Add contact to campaign
router.post('/:id/contacts',
  requirePermission('campaigns:write'),
  campaignsController.addContactToCampaign
);

module.exports = router;
