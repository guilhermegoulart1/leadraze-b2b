// backend/src/routes/secretAgent.js
// Routes for Secret Agent Intelligence System - GetRaze

const express = require('express');
const router = express.Router();
const secretAgentController = require('../controllers/secretAgentController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// ==========================================
// TEAM INFO
// ==========================================

/**
 * GET /api/secret-agent/team
 * Get intelligence team info (agents, roles, descriptions)
 */
router.get('/team', secretAgentController.getIntelligenceTeam);

// ==========================================
// SESSIONS
// ==========================================

/**
 * POST /api/secret-agent/sessions
 * Create a new secret agent chat session
 */
router.post('/sessions', secretAgentController.createSession);

/**
 * GET /api/secret-agent/sessions
 * Get all sessions for the current user
 * Query params:
 *   - status (optional): chat|investigating|completed|failed
 *   - limit (optional): number (default 20)
 *   - offset (optional): number (default 0)
 */
router.get('/sessions', secretAgentController.getSessions);

/**
 * GET /api/secret-agent/sessions/:id
 * Get a single session with its investigations
 */
router.get('/sessions/:id', secretAgentController.getSession);

/**
 * POST /api/secret-agent/sessions/:id/message
 * Send a message to the secret agent chat
 * Body:
 *   - message (required): string
 *   - attachments (optional): { urls: string[] }
 */
router.post('/sessions/:id/message', secretAgentController.sendMessage);

/**
 * POST /api/secret-agent/sessions/:id/start-investigation
 * Start a research investigation
 * Body:
 *   - targetName (required): string
 *   - targetType (required): company|person|niche|connection
 *   - objective (optional): string
 *   - targetDetails (optional): object { cnpj, domain, socialUrls, etc. }
 */
router.post('/sessions/:id/start-investigation', secretAgentController.startInvestigation);

/**
 * DELETE /api/secret-agent/sessions/:id
 * Delete a session
 */
router.delete('/sessions/:id', secretAgentController.deleteSession);

// ==========================================
// INVESTIGATIONS
// ==========================================

/**
 * GET /api/secret-agent/investigations
 * Get all investigations for the account
 * Query params:
 *   - status (optional): queued|running|completed|failed
 *   - limit (optional): number (default 20)
 *   - offset (optional): number (default 0)
 */
router.get('/investigations', secretAgentController.getInvestigations);

/**
 * GET /api/secret-agent/investigations/:id
 * Get investigation details with agent reports
 */
router.get('/investigations/:id', secretAgentController.getInvestigation);

// ==========================================
// BRIEFINGS
// ==========================================

/**
 * GET /api/secret-agent/briefings
 * Get all briefings
 * Query params:
 *   - search (optional): full-text search query
 *   - classification (optional): CONFIDENTIAL|CLASSIFIED|TOP_SECRET
 *   - researchType (optional): company|person|niche|connection
 *   - limit (optional): number (default 20)
 *   - offset (optional): number (default 0)
 */
router.get('/briefings', secretAgentController.getBriefings);

/**
 * GET /api/secret-agent/briefings/:id
 * Get a single briefing with full details
 */
router.get('/briefings/:id', secretAgentController.getBriefing);

/**
 * POST /api/secret-agent/briefings/:id/link-lead
 * Link a briefing to a contact
 * Body:
 *   - contactId (required): UUID
 */
router.post('/briefings/:id/link-contact', secretAgentController.linkBriefingToContact);

/**
 * DELETE /api/secret-agent/briefings/:id/link-contact/:contactId
 * Unlink a briefing from a contact
 */
router.delete('/briefings/:id/link-contact/:contactId', secretAgentController.unlinkBriefingFromContact);

/**
 * POST /api/secret-agent/briefings/:id/deep-analysis
 * Run deep analysis on a briefing using Gemini (large context)
 * Body:
 *   - analysisType: 'general' | 'connections' | 'opportunities' | 'risks'
 */
router.post('/briefings/:id/deep-analysis', secretAgentController.deepAnalysisBriefing);

/**
 * DELETE /api/secret-agent/briefings/:id
 * Delete a briefing (and related investigation/session data)
 */
router.delete('/briefings/:id', secretAgentController.deleteBriefing);

module.exports = router;
