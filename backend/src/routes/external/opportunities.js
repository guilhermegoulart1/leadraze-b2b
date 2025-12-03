/**
 * External Opportunities (Leads) Routes
 * Path: /external/v1/opportunities
 */

const express = require('express');
const router = express.Router();
const opportunitiesController = require('../../controllers/external/opportunitiesExternalController');
const { requirePermission } = require('../../middleware/apiKeyAuth');

// List opportunities
router.get('/',
  requirePermission('opportunities:read'),
  opportunitiesController.listOpportunities
);

// Get single opportunity
router.get('/:id',
  requirePermission('opportunities:read'),
  opportunitiesController.getOpportunity
);

// Create opportunity
router.post('/',
  requirePermission('opportunities:write'),
  opportunitiesController.createOpportunity
);

// Update opportunity
router.put('/:id',
  requirePermission('opportunities:write'),
  opportunitiesController.updateOpportunity
);

// Update opportunity stage
router.patch('/:id/stage',
  requirePermission('opportunities:write'),
  opportunitiesController.updateOpportunityStage
);

// Delete opportunity
router.delete('/:id',
  requirePermission('opportunities:delete'),
  opportunitiesController.deleteOpportunity
);

module.exports = router;
