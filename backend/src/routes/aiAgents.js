// backend/src/routes/aiAgents.js
const express = require('express');
const router = express.Router();
const aiAgentController = require('../controllers/aiAgentController');
const openaiController = require('../controllers/openaiController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// ================================
// TODAS AS ROTAS REQUEREM AUTH
// ================================
router.use(authenticateToken);
router.use(apiLimiter);

// ================================
// PERFIS COMPORTAMENTAIS
// ================================
router.get('/behavioral-profiles', aiAgentController.getBehavioralProfiles);

// ================================
// OPEN AI - GERAÇÃO DE FILTROS
// ================================
router.post('/generate-filters', openaiController.generateSearchFilters);

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

// Testar mensagem inicial do agente
router.post('/:id/test/initial-message', aiAgentController.testAIAgentInitialMessage);

// Testar resposta do agente
router.post('/:id/test/response', aiAgentController.testAIAgentResponse);

// Clonar agente
router.post('/:id/clone', aiAgentController.cloneAIAgent);

// Obter estatísticas
router.get('/:id/stats', aiAgentController.getAIAgentStats);

// Preview do prompt do agente
router.get('/:id/prompt-preview', aiAgentController.getAgentPromptPreview);

module.exports = router;