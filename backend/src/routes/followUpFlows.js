// backend/src/routes/followUpFlows.js
// Routes for Follow-Up Flows

const express = require('express');
const router = express.Router();
const followUpFlowController = require('../controllers/followUpFlowController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// ===========================================
// FOLLOW-UP FLOW ROUTES
// ===========================================

// Get all follow-up flows
router.get('/', followUpFlowController.getFlows);

// Get a single flow
router.get('/:id', followUpFlowController.getFlow);

// Create a new flow
router.post('/', followUpFlowController.createFlow);

// Update a flow
router.put('/:id', followUpFlowController.updateFlow);

// Delete a flow
router.delete('/:id', followUpFlowController.deleteFlow);

// Clone a flow
router.post('/:id/clone', followUpFlowController.cloneFlow);

// Toggle flow active status
router.post('/:id/toggle-active', followUpFlowController.toggleActive);

module.exports = router;
