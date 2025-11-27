const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/publicWebsiteChatController');

// Rate limiting for public chat endpoints
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute per IP
  message: {
    success: false,
    message: 'Too many requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  }
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 contact form submissions per hour
  message: {
    success: false,
    message: 'Too many contact submissions. Please try again later.'
  },
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  }
});

/**
 * @route GET /api/public/website-chat/agents
 * @desc Get list of active website agents (public config only)
 * @access Public
 */
router.get('/agents', controller.getAgents);

/**
 * @route GET /api/public/website-chat/agents/:agentKey
 * @desc Get a specific agent's public config
 * @access Public
 */
router.get('/agents/:agentKey', controller.getAgent);

/**
 * @route POST /api/public/website-chat/message
 * @desc Send a message and get AI response
 * @access Public (rate limited)
 * @body { agentKey: string, sessionId: string, message: string, history?: array }
 */
router.post('/message', chatLimiter, controller.chat);

/**
 * @route POST /api/public/website-chat/contact
 * @desc Submit contact form (escalation)
 * @access Public (rate limited)
 * @body { sessionId?: string, agentKey?: string, name: string, email: string, company?: string, message: string }
 */
router.post('/contact', contactLimiter, controller.submitContact);

/**
 * @route GET /api/public/website-chat/session/:sessionId
 * @desc Get chat history for a session (for restoring conversations)
 * @access Public
 */
router.get('/session/:sessionId', controller.getSession);

module.exports = router;
