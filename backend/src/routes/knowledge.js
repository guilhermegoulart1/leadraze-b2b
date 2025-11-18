// backend/src/routes/knowledge.js
const express = require('express');
const router = express.Router();
const knowledgeController = require('../controllers/knowledgeController');
const { authenticateToken } = require('../middleware/auth');

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// Listar conhecimentos de um agente
router.get('/ai-agents/:agentId/knowledge', knowledgeController.listKnowledge);

// Adicionar conhecimento individual
router.post('/ai-agents/:agentId/knowledge', knowledgeController.addKnowledge);

// Adicionar múltiplos conhecimentos em lote
router.post('/ai-agents/:agentId/knowledge/batch', knowledgeController.addKnowledgeBatch);

// Testar busca semântica
router.post('/ai-agents/:agentId/knowledge/search', knowledgeController.searchKnowledge);

// Atualizar conhecimento
router.put('/ai-agents/:agentId/knowledge/:knowledgeId', knowledgeController.updateKnowledge);

// Deletar conhecimento
router.delete('/ai-agents/:agentId/knowledge/:knowledgeId', knowledgeController.deleteKnowledge);

module.exports = router;
