// backend/src/routes/activationCampaigns.js
const express = require('express');
const router = express.Router();
const activationCampaignController = require('../controllers/activationCampaignController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter, campaignLimiter } = require('../middleware/rateLimiter');

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
// ================================

// Iniciar campanha
router.post('/:id/start', activationCampaignController.startCampaign);

// Pausar campanha
router.post('/:id/pause', activationCampaignController.pauseCampaign);

// Retomar campanha pausada
router.post('/:id/resume', activationCampaignController.resumeCampaign);

// Parar campanha definitivamente
router.post('/:id/stop', activationCampaignController.stopCampaign);

// ================================
// ESTATÍSTICAS
// ================================

// Obter estatísticas da campanha
router.get('/:id/stats', activationCampaignController.getCampaignStats);

module.exports = router;
