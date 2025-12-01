// backend/src/middleware/auth.js
const { verifyToken } = require('../utils/helpers');
const { UnauthorizedError } = require('../utils/errors');
const db = require('../config/database');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const decoded = verifyToken(token);

    // Fetch full user data including account_id and role
    const userResult = await db.query(
      'SELECT id, email, name, role, account_id FROM users WHERE id = $1',
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
      sectors: sectorsResult.rows || []
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

module.exports = {
  authenticateToken,
  optionalAuth
};