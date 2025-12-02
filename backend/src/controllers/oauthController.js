// backend/src/controllers/oauthController.js
// OAuth2 Provider Controller for SSO with Fider (GetRaze Next)

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// In-memory store for authorization codes (use Redis in production for multi-instance)
const authorizationCodes = new Map();

// Registered OAuth clients
const OAUTH_CLIENTS = {
  'fider_getraze': {
    name: 'GetRaze Next (Fider)',
    secret: process.env.OAUTH_FIDER_SECRET || 'fider_secret_change_in_production',
    redirectUris: [
      'http://localhost:3004/oauth/callback',
      'https://next.getraze.co/oauth/callback'
    ]
  }
};

/**
 * GET /oauth/authorize
 * Authorization endpoint - auto-approves for trusted first-party clients
 */
exports.authorize = async (req, res) => {
  try {
    const { client_id, redirect_uri, response_type, scope, state } = req.query;

    // Validate client
    const client = OAUTH_CLIENTS[client_id];
    if (!client) {
      return res.status(400).json({
        error: 'invalid_client',
        error_description: 'Unknown client_id'
      });
    }

    // Validate redirect_uri
    if (!client.redirectUris.includes(redirect_uri)) {
      return res.status(400).json({
        error: 'invalid_redirect_uri',
        error_description: 'Redirect URI not registered for this client'
      });
    }

    // Validate response_type
    if (response_type !== 'code') {
      return res.status(400).json({
        error: 'unsupported_response_type',
        error_description: 'Only authorization code flow is supported'
      });
    }

    // Generate authorization code
    const code = crypto.randomBytes(32).toString('hex');

    // Store code with user info (expires in 10 minutes)
    authorizationCodes.set(code, {
      userId: req.user.id,
      clientId: client_id,
      redirectUri: redirect_uri,
      scope: scope || 'profile email',
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    // Redirect back to client with code
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }

    res.redirect(redirectUrl.toString());

  } catch (error) {
    console.error('OAuth authorize error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Authorization failed'
    });
  }
};

/**
 * POST /oauth/token
 * Token endpoint - exchange authorization code for access token
 */
exports.token = async (req, res) => {
  try {
    const { grant_type, code, redirect_uri, client_id, client_secret } = req.body;

    // Validate grant type
    if (grant_type !== 'authorization_code') {
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'Only authorization_code grant is supported'
      });
    }

    // Validate client credentials
    const client = OAUTH_CLIENTS[client_id];
    if (!client || client.secret !== client_secret) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client credentials'
      });
    }

    // Validate authorization code
    const authCode = authorizationCodes.get(code);
    if (!authCode) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid or expired authorization code'
      });
    }

    // Check if code is expired
    if (Date.now() > authCode.expiresAt) {
      authorizationCodes.delete(code);
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Authorization code has expired'
      });
    }

    // Validate redirect_uri matches
    if (authCode.redirectUri !== redirect_uri) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Redirect URI mismatch'
      });
    }

    // Validate client_id matches
    if (authCode.clientId !== client_id) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Client ID mismatch'
      });
    }

    // Delete used code (one-time use)
    authorizationCodes.delete(code);

    // Get user from database
    const userResult = await pool.query(
      'SELECT id, email, name, avatar_url FROM users WHERE id = $1',
      [authCode.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Generate access token (JWT)
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        scope: authCode.scope,
        clientId: client_id
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Return token response (OAuth2 standard format)
    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: authCode.scope
    });

  } catch (error) {
    console.error('OAuth token error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Token generation failed'
    });
  }
};

// Cleanup expired authorization codes every minute
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of authorizationCodes.entries()) {
    if (now > data.expiresAt) {
      authorizationCodes.delete(code);
    }
  }
}, 60 * 1000);
