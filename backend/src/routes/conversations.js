// backend/src/routes/conversations.js
const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// ================================
// TODAS AS ROTAS REQUEREM AUTH
// ================================
router.use(authenticateToken);
router.use(apiLimiter);

// ================================
// CONVERSAS
// ================================

// Listar conversas
router.get('/', conversationController.getConversations);

// Obter estatísticas
router.get('/stats', conversationController.getConversationStats);

// Obter conversa específica com mensagens
router.get('/:id', conversationController.getConversation);

// Deletar conversa
router.delete('/:id', conversationController.deleteConversation);

// ================================
// MENSAGENS
// ================================

// Enviar mensagem
router.post('/:id/messages', conversationController.sendMessage);

// ================================
// CONTROLE
// ================================

// Assumir controle manual (desativar IA)
router.post('/:id/take-control', conversationController.takeControl);

// Liberar para IA (reativar IA)
router.post('/:id/release-control', conversationController.releaseControl);

// ================================
// STATUS
// ================================

// Atualizar status da conversa (hot/warm/cold)
router.put('/:id/status', conversationController.updateConversationStatus);

// Marcar como lida
router.post('/:id/mark-read', conversationController.markAsRead);

module.exports = router;