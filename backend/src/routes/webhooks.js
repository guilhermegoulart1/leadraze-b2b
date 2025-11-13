// backend/src/routes/webhooks.js
const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const { authenticateToken } = require('../middleware/auth');

// ================================
// WEBHOOK ENDPOINT (SEM AUTH)
// ================================

// Receber webhook do Unipile
// Esta rota NÃO usa autenticação JWT pois é chamada pelo Unipile
router.post('/unipile', webhookController.receiveWebhook);

// ================================
// WEBHOOK LOGS (COM AUTH)
// ================================

// Listar logs de webhooks
router.get('/logs', authenticateToken, webhookController.getWebhookLogs);

// Estatísticas de webhooks
router.get('/stats', authenticateToken, webhookController.getWebhookStats);

module.exports = router;