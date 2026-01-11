/**
 * Realtime Routes
 *
 * Endpoints for Ably authentication and realtime features
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { createTokenRequest, isAblyConnected } = require('../services/ablyService');

/**
 * GET /realtime/token
 * Generate Ably token for frontend authentication
 */
router.get('/token', authenticateToken, async (req, res) => {
  try {
    const { userId, accountId } = req.user;

    if (!userId || !accountId) {
      return res.status(400).json({
        success: false,
        error: 'Missing user or account information'
      });
    }

    const tokenRequest = await createTokenRequest(userId, accountId);

    res.json({
      success: true,
      tokenRequest
    });
  } catch (error) {
    console.error('[Realtime] Token generation error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate realtime token'
    });
  }
});

/**
 * GET /realtime/status
 * Check Ably connection status
 */
router.get('/status', authenticateToken, async (req, res) => {
  res.json({
    success: true,
    connected: isAblyConnected(),
    provider: 'ably'
  });
});

module.exports = router;
