// backend/src/controllers/followUpFlowController.js
// Controller for Follow-Up Flows

const followUpFlowService = require('../services/followUpFlowService');

/**
 * Get all follow-up flows
 * GET /api/follow-up-flows
 */
async function getFlows(req, res) {
  try {
    const { accountId } = req.user;
    const {
      is_active,
      limit = 50,
      offset = 0
    } = req.query;

    const flows = await followUpFlowService.getFlows({
      accountId,
      isActive: is_active === 'true' ? true : is_active === 'false' ? false : null,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const total = await followUpFlowService.getFlowsCount(
      accountId,
      is_active === 'true' ? true : is_active === 'false' ? false : null
    );

    res.json({
      success: true,
      data: {
        flows,
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Error getting follow-up flows:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get a single flow
 * GET /api/follow-up-flows/:id
 */
async function getFlow(req, res) {
  try {
    const { id } = req.params;
    const { accountId } = req.user;

    const flow = await followUpFlowService.getFlowById(id, accountId);

    if (!flow) {
      return res.status(404).json({
        success: false,
        error: 'Flow not found'
      });
    }

    res.json({
      success: true,
      data: { flow }
    });
  } catch (error) {
    console.error('Error getting follow-up flow:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Create a new flow
 * POST /api/follow-up-flows
 */
async function createFlow(req, res) {
  try {
    const { accountId, id: userId } = req.user;
    const {
      name,
      description,
      flow_definition,
      is_active
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Flow name is required'
      });
    }

    const flow = await followUpFlowService.createFlow({
      accountId,
      userId,
      name,
      description,
      flowDefinition: flow_definition,
      isActive: is_active
    });

    res.status(201).json({
      success: true,
      data: { flow }
    });
  } catch (error) {
    console.error('Error creating follow-up flow:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Update a flow
 * PUT /api/follow-up-flows/:id
 */
async function updateFlow(req, res) {
  try {
    const { id } = req.params;
    const { accountId } = req.user;
    const {
      name,
      description,
      flow_definition,
      is_active
    } = req.body;

    const flow = await followUpFlowService.updateFlow(id, accountId, {
      name,
      description,
      flowDefinition: flow_definition,
      isActive: is_active
    });

    if (!flow) {
      return res.status(404).json({
        success: false,
        error: 'Flow not found or not authorized'
      });
    }

    res.json({
      success: true,
      data: { flow }
    });
  } catch (error) {
    console.error('Error updating follow-up flow:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Delete a flow
 * DELETE /api/follow-up-flows/:id
 */
async function deleteFlow(req, res) {
  try {
    const { id } = req.params;
    const { accountId } = req.user;

    const deleted = await followUpFlowService.deleteFlow(id, accountId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Flow not found or not authorized'
      });
    }

    res.json({
      success: true,
      message: 'Flow deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting follow-up flow:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Clone a flow
 * POST /api/follow-up-flows/:id/clone
 */
async function cloneFlow(req, res) {
  try {
    const { id } = req.params;
    const { accountId, id: userId } = req.user;

    const flow = await followUpFlowService.cloneFlow(id, accountId, userId);

    res.status(201).json({
      success: true,
      data: { flow }
    });
  } catch (error) {
    console.error('Error cloning follow-up flow:', error);
    if (error.message === 'Flow not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Toggle flow active status
 * POST /api/follow-up-flows/:id/toggle-active
 */
async function toggleActive(req, res) {
  try {
    const { id } = req.params;
    const { accountId } = req.user;

    const flow = await followUpFlowService.toggleFlowActive(id, accountId);

    if (!flow) {
      return res.status(404).json({
        success: false,
        error: 'Flow not found or not authorized'
      });
    }

    res.json({
      success: true,
      data: { flow }
    });
  } catch (error) {
    console.error('Error toggling follow-up flow status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  getFlows,
  getFlow,
  createFlow,
  updateFlow,
  deleteFlow,
  cloneFlow,
  toggleActive
};
