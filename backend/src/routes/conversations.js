// backend/src/routes/conversations.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const conversationController = require('../controllers/conversationController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// Configuração do Multer para upload de arquivos em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB max (limite da Unipile)
    files: 5 // máximo 5 arquivos por vez
  },
  fileFilter: (req, file, cb) => {
    // Tipos permitidos: imagens, documentos, vídeos, áudios
    const allowedMimes = [
      // Imagens
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      // Documentos
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv',
      // Vídeos
      'video/mp4', 'video/webm', 'video/quicktime',
      // Áudios
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`), false);
    }
  }
});

// ================================
// TODAS AS ROTAS REQUEREM AUTH
// ================================
router.use(authenticateToken);
router.use(apiLimiter);

// ================================
// INICIAR CONVERSAS
// ================================

// Iniciar conversa WhatsApp (nova ou retornar existente)
router.post('/whatsapp/start', conversationController.startWhatsAppConversation);

// ================================
// CONVERSAS
// ================================

// Listar conversas
router.get('/', conversationController.getConversations);

// Obter estatísticas
router.get('/stats', conversationController.getConversationStats);

// Obter usuários atribuíveis (não requer users:view)
router.get('/assignable-users', conversationController.getAssignableUsers);

// Obter setores atribuíveis (não requer sectors:view)
router.get('/assignable-sectors', conversationController.getAssignableSectors);

// ================================
// AGENTE SECRETO - COACHING DE VENDAS (rotas estáticas ANTES de /:id)
// ================================
const secretAgentCoachingController = require('../controllers/secretAgentCoachingController');

// Obter lista de agentes de coaching disponíveis
router.get('/coaching-agents', secretAgentCoachingController.getAgents);

// Obter conversa específica com mensagens
router.get('/:id', conversationController.getConversation);

// Deletar conversa
router.delete('/:id', conversationController.deleteConversation);

// ================================
// MENSAGENS
// ================================

// Obter mensagens (proxy para Unipile)
router.get('/:id/messages', conversationController.getMessages);

// Enviar mensagem (com suporte a attachments via multer)
router.post('/:id/messages', upload.array('attachments', 5), conversationController.sendMessage);

// ================================
// ATTACHMENTS
// ================================

// Download de attachment (proxy para Unipile)
router.get('/:id/messages/:messageId/attachments/:attachmentId', conversationController.downloadAttachment);

// Proxy para exibir imagem inline (para exibição no chat)
router.get('/:id/messages/:messageId/attachments/:attachmentId/inline', conversationController.getAttachmentInline);

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

// ================================
// FECHAR/REABRIR CONVERSA
// ================================

// Fechar conversa
router.post('/:id/close', conversationController.closeConversation);

// Reabrir conversa
router.post('/:id/reopen', conversationController.reopenConversation);

// ================================
// ATRIBUIÇÃO DE CONVERSAS
// ================================

// Atribuir conversa a um usuário
router.post('/:id/assign', conversationController.assignConversation);

// Desatribuir conversa
router.post('/:id/unassign', conversationController.unassignConversation);

// ================================
// ATRIBUIÇÃO DE SETOR
// ================================

// Atribuir conversa a um setor
router.post('/:id/assign-sector', conversationController.assignSectorToConversation);

// Desatribuir setor da conversa
router.post('/:id/unassign-sector', conversationController.unassignSectorFromConversation);

// ================================
// RESUMO DE CONVERSAS (PROGRESSIVE SUMMARY)
// ================================

// Obter resumo e estatísticas de contexto
router.get('/:id/summary', conversationController.getSummaryStats);

// Gerar resumo manualmente
router.post('/:id/summary/generate', conversationController.generateSummary);

// Atualizar resumo incrementalmente
router.post('/:id/summary/update', conversationController.updateSummary);

// ================================
// EDIÇÃO DE CONTATO
// ================================

// Atualizar nome do contato/lead da conversa
router.patch('/:id/contact-name', conversationController.updateContactName);

// ================================
// AGENTE SECRETO - ROTAS COM :conversationId
// ================================

// Gerar nova orientação de coaching
router.post('/:conversationId/secret-agent', secretAgentCoachingController.generateCoaching);

// Obter histórico de orientações
router.get('/:conversationId/secret-agent', secretAgentCoachingController.getCoachingHistory);

// Obter última orientação
router.get('/:conversationId/secret-agent/latest', secretAgentCoachingController.getLatestCoaching);

module.exports = router;