// backend/src/controllers/aiEmployeesController.js
// Controller for AI Employees V2 and templates

const templateService = require('../services/templateService');
const smartInterviewService = require('../services/smartInterviewService');
const agentTestService = require('../services/agentTestService');

/**
 * Get all templates
 * GET /api/ai-employees/templates
 */
async function getTemplates(req, res) {
  try {
    const { accountId } = req.user;
    const {
      agent_type,
      niche,
      language = 'pt-BR',
      include_public = 'true',
      only_official = 'false',
      limit = 50,
      offset = 0
    } = req.query;

    const templates = await templateService.getTemplates({
      accountId,
      agentType: agent_type,
      niche,
      language,
      includePublic: include_public === 'true',
      onlyOfficial: only_official === 'true',
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: { templates }
    });
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get a single template
 * GET /api/ai-employees/templates/:id
 */
async function getTemplate(req, res) {
  try {
    const { id } = req.params;
    const { accountId } = req.user;

    const template = await templateService.getTemplateById(id, accountId);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Get user's rating if exists
    const userRating = await templateService.getUserRating(id, accountId);

    res.json({
      success: true,
      data: {
        template,
        userRating
      }
    });
  } catch (error) {
    console.error('Error getting template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Create a new template
 * POST /api/ai-employees/templates
 */
async function createTemplate(req, res) {
  try {
    const { accountId, id: userId } = req.user;
    const {
      name,
      description,
      agent_type,
      niche,
      niche_display_name,
      tags,
      language,
      niche_parameters,
      workflow_definition,
      prompt_template,
      default_config,
      is_public
    } = req.body;

    if (!name || !agent_type) {
      return res.status(400).json({
        success: false,
        error: 'Name and agent_type are required'
      });
    }

    const template = await templateService.createTemplate({
      accountId,
      userId,
      name,
      description,
      agentType: agent_type,
      niche,
      nicheDisplayName: niche_display_name,
      tags,
      language,
      nicheParameters: niche_parameters,
      workflowDefinition: workflow_definition,
      promptTemplate: prompt_template,
      defaultConfig: default_config,
      isPublic: is_public
    });

    res.status(201).json({
      success: true,
      data: { template }
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Update a template
 * PUT /api/ai-employees/templates/:id
 */
async function updateTemplate(req, res) {
  try {
    const { id } = req.params;
    const { accountId } = req.user;

    const template = await templateService.updateTemplate(id, accountId, req.body);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found or not authorized'
      });
    }

    res.json({
      success: true,
      data: { template }
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Delete a template
 * DELETE /api/ai-employees/templates/:id
 */
async function deleteTemplate(req, res) {
  try {
    const { id } = req.params;
    const { accountId } = req.user;

    const deleted = await templateService.deleteTemplate(id, accountId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Template not found or not authorized'
      });
    }

    res.json({
      success: true,
      message: 'Template deleted'
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Clone a template
 * POST /api/ai-employees/templates/:id/clone
 */
async function cloneTemplate(req, res) {
  try {
    const { id } = req.params;
    const { accountId, id: userId } = req.user;

    const template = await templateService.cloneTemplate(id, accountId, userId);

    res.status(201).json({
      success: true,
      data: { template }
    });
  } catch (error) {
    console.error('Error cloning template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Rate a template
 * POST /api/ai-employees/templates/:id/rate
 */
async function rateTemplate(req, res) {
  try {
    const { id } = req.params;
    const { accountId } = req.user;
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }

    const result = await templateService.rateTemplate(id, accountId, rating, review);

    res.json({
      success: true,
      data: { rating: result }
    });
  } catch (error) {
    console.error('Error rating template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get available niches
 * GET /api/ai-employees/niches
 */
async function getNiches(req, res) {
  try {
    const { agent_type } = req.query;

    const niches = await templateService.getNiches(agent_type);

    res.json({
      success: true,
      data: { niches }
    });
  } catch (error) {
    console.error('Error getting niches:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Smart Interview - Get next question
 * POST /api/ai-employees/interview
 */
async function getInterviewQuestion(req, res) {
  try {
    const { agent_type, niche, template_id, answers_so_far = {} } = req.body;

    if (!agent_type) {
      return res.status(400).json({
        success: false,
        error: 'agent_type is required'
      });
    }

    const result = await smartInterviewService.getNextQuestion({
      agentType: agent_type,
      niche,
      templateId: template_id,
      answersSoFar: answers_so_far
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting interview question:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Generate agent from interview answers
 * POST /api/ai-employees/generate
 */
async function generateAgent(req, res) {
  try {
    const { accountId, id: userId } = req.user;
    const {
      agent_type,
      niche,
      template_id,
      answers,
      workflow_definition
    } = req.body;

    if (!agent_type || !answers) {
      return res.status(400).json({
        success: false,
        error: 'agent_type and answers are required'
      });
    }

    const result = await smartInterviewService.generateAgentConfig({
      accountId,
      userId,
      agentType: agent_type,
      niche,
      templateId: template_id,
      answers,
      workflowDefinition: workflow_definition
    });

    // Record template usage if using a template
    if (template_id) {
      await templateService.recordUsage(template_id, accountId, result.agentId);
    }

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error generating agent:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get templates pending approval (admin only)
 * GET /api/ai-employees/admin/pending
 */
async function getPendingTemplates(req, res) {
  try {
    // TODO: Check admin role
    const templates = await templateService.getPendingTemplates();

    res.json({
      success: true,
      data: { templates }
    });
  } catch (error) {
    console.error('Error getting pending templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Approve or reject a template (admin only)
 * POST /api/ai-employees/admin/moderate/:id
 */
async function moderateTemplate(req, res) {
  try {
    const { id } = req.params;
    const { id: adminUserId } = req.user;
    const { approved, reason } = req.body;

    // TODO: Check admin role

    const template = await templateService.moderateTemplate(
      id,
      adminUserId,
      approved === true,
      reason
    );

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.json({
      success: true,
      data: { template }
    });
  } catch (error) {
    console.error('Error moderating template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ===========================================
// TEST SESSION ROUTES
// ===========================================

/**
 * Start a test session for an agent
 * POST /api/ai-employees/:agentId/test/start
 */
async function startTestSession(req, res) {
  try {
    const { agentId } = req.params;
    const { accountId, id: userId } = req.user;
    const { leadSimulation = {} } = req.body;

    const session = await agentTestService.startTestSession(
      agentId,
      userId,
      accountId,
      leadSimulation
    );

    res.status(201).json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Error starting test session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Send a test message or simulate an event
 * POST /api/ai-employees/test/:sessionId/message
 * Body: { message?: string, eventType?: string, skipWait?: boolean }
 * eventType can be: message_received, invite_accepted, invite_ignored, no_response
 * skipWait: if true, skips current wait action and continues workflow (test mode only)
 */
async function sendTestMessage(req, res) {
  try {
    const { sessionId } = req.params;
    const { id: userId } = req.user;
    const { message, eventType = 'message_received', skipWait = false } = req.body;

    // Message is required only for message_received event (unless skipping wait)
    if (eventType === 'message_received' && !skipWait && (!message || !message.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Message is required for message_received event'
      });
    }

    const result = await agentTestService.sendTestMessage(
      sessionId,
      message ? message.trim() : null,
      userId,
      eventType,
      skipWait
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error sending test message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get test session logs
 * GET /api/ai-employees/test/:sessionId/logs
 */
async function getTestLogs(req, res) {
  try {
    const { sessionId } = req.params;
    const { id: userId } = req.user;
    const { since } = req.query;

    const logs = await agentTestService.getTestLogs(
      sessionId,
      userId,
      since ? new Date(since) : null
    );

    res.json({
      success: true,
      data: { logs }
    });
  } catch (error) {
    console.error('Error getting test logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get test session state
 * GET /api/ai-employees/test/:sessionId
 */
async function getTestSession(req, res) {
  try {
    const { sessionId } = req.params;
    const { id: userId } = req.user;

    const session = await agentTestService.getTestSessionState(
      sessionId,
      userId
    );

    res.json({
      success: true,
      data: { session }
    });
  } catch (error) {
    console.error('Error getting test session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * End a test session
 * POST /api/ai-employees/test/:sessionId/end
 */
async function endTestSession(req, res) {
  try {
    const { sessionId } = req.params;
    const { id: userId } = req.user;

    const result = await agentTestService.endTestSession(sessionId, userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error ending test session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Reset a test session
 * POST /api/ai-employees/test/:sessionId/reset
 */
async function resetTestSession(req, res) {
  try {
    const { sessionId } = req.params;
    const { id: userId } = req.user;

    const result = await agentTestService.resetTestSession(sessionId, userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error resetting test session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Update lead simulation for a test session
 * PUT /api/ai-employees/test/:sessionId/lead
 */
async function updateTestLead(req, res) {
  try {
    const { sessionId } = req.params;
    const { id: userId } = req.user;
    const { leadSimulation } = req.body;

    const result = await agentTestService.updateLeadSimulation(
      sessionId,
      userId,
      leadSimulation
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error updating test lead:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get active test sessions for current user
 * GET /api/ai-employees/test/sessions
 */
async function getActiveSessions(req, res) {
  try {
    const { accountId, id: userId } = req.user;

    const sessions = await agentTestService.getActiveSessions(userId, accountId);

    res.json({
      success: true,
      data: { sessions }
    });
  } catch (error) {
    console.error('Error getting active sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  cloneTemplate,
  rateTemplate,
  getNiches,
  getInterviewQuestion,
  generateAgent,
  getPendingTemplates,
  moderateTemplate,
  // Test session routes
  startTestSession,
  sendTestMessage,
  getTestLogs,
  getTestSession,
  endTestSession,
  resetTestSession,
  updateTestLead,
  getActiveSessions
};
