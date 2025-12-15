/**
 * Secret Agent Coaching Controller
 *
 * Handles API endpoints for AI-powered sales coaching
 */

const secretAgentCoachingService = require('../services/secretAgentCoachingService');
const { sendSuccess, sendError } = require('../utils/responses');
const { ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Generate new coaching for a conversation
 * POST /api/conversations/:conversationId/secret-agent
 */
const generateCoaching = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { objective, product_id, difficulties } = req.body;

    console.log(`🕵️ Generating coaching for conversation ${conversationId}`);

    if (!objective || objective.trim().length === 0) {
      throw new ValidationError('Objetivo é obrigatório');
    }

    const result = await secretAgentCoachingService.generateCoaching({
      conversationId,
      accountId,
      userId,
      objective,
      productId: product_id,
      difficulties
    });

    console.log(`✅ Coaching generated: ${result.id}`);

    sendSuccess(res, result, 'Coaching generated successfully');

  } catch (error) {
    console.error(`❌ Error generating coaching:`, error);
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Get coaching history for a conversation
 * GET /api/conversations/:conversationId/secret-agent
 */
const getCoachingHistory = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const accountId = req.user.account_id;
    const { limit = 10 } = req.query;

    console.log(`📋 Getting coaching history for conversation ${conversationId}`);

    const history = await secretAgentCoachingService.getCoachingHistory(
      conversationId,
      accountId,
      parseInt(limit)
    );

    sendSuccess(res, { coachings: history }, 'Coaching history retrieved');

  } catch (error) {
    console.error(`❌ Error getting coaching history:`, error);
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Get latest coaching for a conversation
 * GET /api/conversations/:conversationId/secret-agent/latest
 */
const getLatestCoaching = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const accountId = req.user.account_id;

    console.log(`🔍 Getting latest coaching for conversation ${conversationId}`);

    const latest = await secretAgentCoachingService.getLatestCoaching(conversationId, accountId);

    if (!latest) {
      sendSuccess(res, null, 'No coaching found');
      return;
    }

    sendSuccess(res, latest, 'Latest coaching retrieved');

  } catch (error) {
    console.error(`❌ Error getting latest coaching:`, error);
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  generateCoaching,
  getCoachingHistory,
  getLatestCoaching
};
