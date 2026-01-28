// backend/src/routes/supportAccess.js
const express = require('express');
const router = express.Router();
const supportAccessController = require('../controllers/supportAccessController');
const { authenticateToken } = require('../middleware/auth');
const { authenticateSupportSession } = require('../middleware/supportAccessAuth');

/**
 * =============================================
 * ROTAS PÚBLICAS (para operador autenticar)
 * =============================================
 */

// Autenticar com token de suporte
router.post('/authenticate', supportAccessController.authenticateWithToken);

// Listar escopos disponíveis (informativo)
router.get('/scopes', supportAccessController.listAvailableScopes);

/**
 * =============================================
 * ROTAS DO OPERADOR (requer sessão de suporte)
 * =============================================
 */

// Informações da sessão atual
router.get('/session/info',
  authenticateSupportSession,
  supportAccessController.getSessionInfo
);

// Encerrar própria sessão
router.post('/session/end',
  authenticateSupportSession,
  supportAccessController.endOwnSession
);

/**
 * =============================================
 * ROTAS DO CLIENTE (requer auth + admin)
 * =============================================
 */

// Middleware para verificar se é admin
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acesso restrito a administradores'
    });
  }
  next();
};

// Estatísticas de acesso
router.get('/stats',
  authenticateToken,
  requireAdmin,
  supportAccessController.getAccessStats
);

// CRUD de tokens
router.post('/tokens',
  authenticateToken,
  requireAdmin,
  supportAccessController.createToken
);

router.get('/tokens',
  authenticateToken,
  requireAdmin,
  supportAccessController.listTokens
);

router.get('/tokens/:id',
  authenticateToken,
  requireAdmin,
  supportAccessController.getToken
);

router.post('/tokens/:id/extend',
  authenticateToken,
  requireAdmin,
  supportAccessController.extendToken
);

router.delete('/tokens/:id',
  authenticateToken,
  requireAdmin,
  supportAccessController.revokeToken
);

// Sessões
router.get('/sessions',
  authenticateToken,
  requireAdmin,
  supportAccessController.listSessions
);

router.delete('/sessions/:id',
  authenticateToken,
  requireAdmin,
  supportAccessController.endSession
);

// Audit log
router.get('/audit',
  authenticateToken,
  requireAdmin,
  supportAccessController.getAuditLog
);

module.exports = router;
