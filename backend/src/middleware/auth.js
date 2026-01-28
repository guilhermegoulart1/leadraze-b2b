// backend/src/middleware/auth.js
const { verifyToken } = require('../utils/helpers');
const { UnauthorizedError } = require('../utils/errors');
const db = require('../config/database');
const supportAccessService = require('../services/supportAccessService');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    // Aceitar token via header OU via query param (para imagens inline em <img src>)
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

    // Verificar se é um token de sessão de suporte (impersonação)
    const supportSessionHeader = req.headers['x-support-session'];
    if (supportSessionHeader || (token && token.startsWith('eyJ') && req.headers['x-impersonation-mode'] === 'true')) {
      const sessionToken = supportSessionHeader || token;
      const session = await supportAccessService.validateSupportSession(sessionToken);

      if (session) {
        // Modo impersonação - operador acessando conta do cliente
        req.supportSession = {
          sessionId: session.id,
          tokenId: session.token_id,
          accountId: session.account_id,
          accountName: session.account_name,
          operatorName: session.operator_name,
          operatorEmail: session.operator_email,
          scope: session.scope,
          startedAt: session.started_at,
          isImpersonating: true
        };

        req.user = {
          id: null,
          userId: null,
          email: session.operator_email || `support-${session.id}@getraze.co`,
          name: session.operator_name,
          role: 'support',
          account_id: session.account_id,
          accountId: session.account_id,
          must_change_password: false,
          sectors: [],
          // Flags de impersonação
          isImpersonating: true,
          impersonationSessionId: session.id,
          impersonationTokenId: session.token_id,
          impersonationScope: session.scope,
          originalOperator: {
            name: session.operator_name,
            email: session.operator_email
          }
        };

        return next();
      }
    }

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const decoded = verifyToken(token);

    // Fetch full user data including account_id, role, and must_change_password
    const userResult = await db.query(
      'SELECT id, email, name, role, account_id, must_change_password FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      throw new UnauthorizedError('User not found');
    }

    const user = userResult.rows[0];

    // Load user's sectors
    const sectorsResult = await db.query(
      `SELECT s.id, s.name
       FROM sectors s
       JOIN user_sectors us ON s.id = us.sector_id
       WHERE us.user_id = $1`,
      [user.id]
    );

    req.user = {
      id: user.id,
      userId: user.id,  // Add userId for consistency
      email: user.email,
      name: user.name,
      role: user.role,
      account_id: user.account_id,
      accountId: user.account_id,  // Add accountId for consistency
      must_change_password: user.must_change_password || false,
      sectors: sectorsResult.rows || [],
      isImpersonating: false
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    return res.status(401).json({
      success: false,
      message: error.message || 'Authentication failed'
    });
  }
};

const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = verifyToken(token);
      req.user = {
        id: decoded.userId,
        email: decoded.email
      };
    }

    next();
  } catch (error) {
    // If token is invalid, just continue without user
    next();
  }
};

/**
 * Middleware to check if user must change password
 * Blocks access to most endpoints until password is changed
 */
const checkMustChangePassword = (req, res, next) => {
  // Skip check for certain endpoints that should always be accessible
  const skipPaths = [
    '/api/auth/force-change-password',
    '/api/auth/logout',
    '/api/auth/profile',
    '/api/users/profile'
  ];

  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Check if user must change password
  if (req.user && req.user.must_change_password) {
    return res.status(403).json({
      success: false,
      message: 'Password change required',
      code: 'PASSWORD_CHANGE_REQUIRED',
      mustChangePassword: true
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  authenticate: authenticateToken, // Alias para compatibilidade
  optionalAuth,
  checkMustChangePassword
};