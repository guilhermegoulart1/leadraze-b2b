// backend/src/routes/activationCampaigns.js
const express = require('express');
const router = express.Router();
const activationCampaignController = require('../controllers/activationCampaignController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter, campaignLimiter } = require('../middleware/rateLimiter');
const { requirePaidSubscription } = require('../middleware/billing');

// ================================
// TODAS AS ROTAS REQUEREM AUTH
// ================================
router.use(authenticateToken);
router.use(apiLimiter);

// ================================
// CRUD DE CAMPANHAS DE ATIVAÇÃO
// ================================

// Listar campanhas de ativação
router.get('/', activationCampaignController.getActivationCampaigns);

// Obter campanha específica
router.get('/:id', activationCampaignController.getActivationCampaign);

// Criar campanha de ativação
router.post('/', campaignLimiter, activationCampaignController.createActivationCampaign);

// Atualizar campanha de ativação
router.put('/:id', activationCampaignController.updateActivationCampaign);

// Deletar campanha de ativação
router.delete('/:id', activationCampaignController.deleteActivationCampaign);

// ================================
// CONTROLE DE AUTOMAÇÃO
// (Blocked for trial users)
// ================================

// Iniciar campanha (blocked for trial users)
router.post('/:id/start', requirePaidSubscription('activation_campaigns'), activationCampaignController.startCampaign);

// Pausar campanha
router.post('/:id/pause', activationCampaignController.pauseCampaign);

// Retomar campanha pausada (blocked for trial users)
router.post('/:id/resume', requirePaidSubscription('activation_campaigns'), activationCampaignController.resumeCampaign);

// Parar campanha definitivamente
router.post('/:id/stop', activationCampaignController.stopCampaign);

// ================================
// ESTATÍSTICAS
// ================================

// Obter estatísticas da campanha
router.get('/:id/stats', activationCampaignController.getCampaignStats);

module.exports = router;
