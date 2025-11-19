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

// Obter mensagens (proxy para Unipile)
router.get('/:id/messages', conversationController.getMessages);

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

// Atualizar status da conversa (ai_active/manual)
router.patch('/:id/status', conversationController.updateStatus);

// Marcar como lida
router.post('/:id/mark-read', conversationController.markAsRead);

module.exports = router;