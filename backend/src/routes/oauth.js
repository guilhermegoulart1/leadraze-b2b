// backend/src/routes/oauth.js
// OAuth2 Provider routes for SSO with Fider (GetRaze Next)

const express = require('express');
const router = express.Router();
const oauthController = require('../controllers/oauthController');
const { authenticateToken } = require('../middleware/auth');

// Authorization endpoint - User grants permission (requires auth)
router.get('/authorize', authenticateToken, oauthController.authorize);

// Token endpoint - Exchange code for access token (public)
router.post('/token', oauthController.token);

module.exports = router;
