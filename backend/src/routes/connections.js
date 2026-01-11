// backend/src/routes/connections.js
const express = require('express');
const router = express.Router();
const connectionController = require('../controllers/connectionController');
const connectionCampaignController = require('../controllers/connectionCampaignController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// ================================
// TODAS AS ROTAS REQUEREM AUTH
// ================================
router.use(authenticateToken);
router.use(apiLimiter);

// ================================
// CONEXÕES (1º GRAU)
// ================================

// Listar conexões de 1º grau
router.get('/', connectionController.getConnections);

// Buscar perfil completo de uma conexão
router.get('/:provider_id/profile', connectionController.getFullProfile);

// Salvar conexão no CRM
router.post('/save-to-crm', connectionController.saveConnectionToCRM);

// ================================
// LIMITES DIÁRIOS
// ================================

// Obter limite diário do usuário
router.get('/daily-limit', connectionController.getDailyLimit);

// Atualizar limite diário
router.put('/daily-limit', connectionController.updateDailyLimit);

// ================================
// CONVITES DO LINKEDIN
// ================================

// Listar convites enviados pendentes
router.get('/invitations/sent', connectionController.getSentInvitations);

// Listar convites recebidos pendentes
router.get('/invitations/received', connectionController.getReceivedInvitations);

// Aceitar convite recebido
router.post('/invitations/:invitation_id/accept', connectionController.acceptInvitation);

// Rejeitar convite recebido
router.post('/invitations/:invitation_id/reject', connectionController.rejectInvitation);

// Cancelar convite enviado
router.delete('/invitations/:invitation_id', connectionController.cancelInvitation);

// Enviar convite para um usuário (usado nas conversas)
router.post('/invitations/send', connectionController.sendInvitation);

// ================================
// CAMPANHAS DE ATIVAÇÃO DE CONEXÕES
// ================================

// Listar campanhas de conexões
router.get('/campaigns', connectionCampaignController.getConnectionCampaigns);

// Criar campanha de ativação de conexões
router.post('/campaigns', connectionCampaignController.createConnectionCampaign);

// Pausar campanha
router.post('/campaigns/:id/pause', connectionCampaignController.pauseConnectionCampaign);

// Retomar campanha
router.post('/campaigns/:id/resume', connectionCampaignController.resumeConnectionCampaign);

// Parar campanha
router.post('/campaigns/:id/stop', connectionCampaignController.stopConnectionCampaign);

module.exports = router;
