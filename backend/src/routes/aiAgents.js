// backend/src/routes/aiAgents.js
const express = require('express');
const router = express.Router();
const aiAgentController = require('../controllers/aiAgentController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// ================================
// TODAS AS ROTAS REQUEREM AUTH
// ================================
router.use(authenticateToken);
router.use(apiLimiter);

// ================================
// CRUD DE AGENTES
// ================================

// Listar agentes
router.get('/', aiAgentController.getAIAgents);

// Obter agente específico
router.get('/:id', aiAgentController.getAIAgent);

// Criar agente
router.post('/', aiAgentController.createAIAgent);

// Atualizar agente
router.put('/:id', aiAgentController.updateAIAgent);

// Deletar agente
router.delete('/:id', aiAgentController.deleteAIAgent);

// ================================
// AÇÕES ESPECIAIS
// ================================

// Testar agente
router.post('/:id/test', aiAgentController.testAIAgent);

// Clonar agente
router.post('/:id/clone', aiAgentController.cloneAIAgent);

// Obter estatísticas
router.get('/:id/stats', aiAgentController.getAIAgentStats);

module.exports = router;