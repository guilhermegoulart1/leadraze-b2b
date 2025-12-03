/**
 * Partner Authentication Middleware
 *
 * Verifies JWT tokens for partner authentication
 */

const jwt = require('jsonwebtoken');
const partnerService = require('../services/partnerService');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Authenticate partner token
 */
const authenticatePartner = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expirado'
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    // Check if it's a partner token
    if (decoded.type !== 'partner') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido para esta rota'
      });
    }

    // Get partner from database
    const partner = await partnerService.getById(decoded.id);

    if (!partner) {
      return res.status(401).json({
        success: false,
        message: 'Partner não encontrado'
      });
    }

    if (partner.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Conta não aprovada ou suspensa'
      });
    }

    // Attach partner to request
    req.partner = {
      id: partner.id,
      email: partner.email,
      name: partner.name,
      type: partner.type,
      affiliate_code: partner.affiliate_code
    };

    next();
  } catch (error) {
    console.error('Partner auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro de autenticação'
    });
  }
};

/**
 * Optional partner authentication (doesn't fail if no token)
 */
const optionalPartnerAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);

      if (decoded.type === 'partner') {
        const partner = await partnerService.getById(decoded.id);

        if (partner && partner.status === 'approved') {
          req.partner = {
            id: partner.id,
            email: partner.email,
            name: partner.name,
            type: partner.type,
            affiliate_code: partner.affiliate_code
          };
        }
      }
    } catch (err) {
      // Token invalid, continue without partner
    }

    next();
  } catch (error) {
    next();
  }
};

module.exports = {
  authenticatePartner,
  optionalPartnerAuth
};
