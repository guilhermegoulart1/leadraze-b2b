// backend/src/routes/activationAgents.js
const express = require('express');
const router = express.Router();
const activationAgentController = require('../controllers/activationAgentController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// ================================
// TODAS AS ROTAS REQUEREM AUTH
// ================================
router.use(authenticateToken);
router.use(apiLimiter);

// ================================
// CRUD DE AGENTES DE ATIVAÇÃO
// ================================

// Listar agentes de ativação
router.get('/', activationAgentController.getActivationAgents);

// Obter agente específico
router.get('/:id', activationAgentController.getActivationAgent);

// Criar agente de ativação
router.post('/', activationAgentController.createActivationAgent);

// Atualizar agente de ativação
router.put('/:id', activationAgentController.updateActivationAgent);

// Deletar agente de ativação
router.delete('/:id', activationAgentController.deleteActivationAgent);

// ================================
// TESTE DE AGENTES
// ================================

// Testar agente de ativação
router.post('/:id/test', activationAgentController.testActivationAgent);

module.exports = router;
