// backend/src/routes/campaigns.js
const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter, campaignLimiter } = require('../middleware/rateLimiter');

// ================================
// TODAS AS ROTAS REQUEREM AUTH
// ================================
router.use(authenticateToken);
router.use(apiLimiter);

// ================================
// CRUD DE CAMPANHAS
// ================================

// Listar campanhas
router.get('/', campaignController.getCampaigns);

// Obter campanha específica
router.get('/:id', campaignController.getCampaign);

// Criar campanha
router.post('/', campaignLimiter, campaignController.createCampaign);

// Atualizar campanha
router.put('/:id', campaignController.updateCampaign);

// Deletar campanha
router.delete('/:id', campaignController.deleteCampaign);

// ================================
// CONTROLE DE AUTOMAÇÃO
// ================================

// Iniciar campanha
router.post('/:id/start', campaignController.startCampaign);

// Pausar campanha
router.post('/:id/pause', campaignController.pauseCampaign);

// Retomar campanha pausada
router.post('/:id/resume', campaignController.resumeCampaign);

// Reativar campanha (após exclusão de agente) com novo agente
router.post('/:id/reactivate', campaignController.reactivateCampaign);

// Parar campanha definitivamente
router.post('/:id/stop', campaignController.stopCampaign);

// ================================
// ESTATÍSTICAS
// ================================

// Obter estatísticas da campanha
router.get('/:id/stats', campaignController.getCampaignStats);

// ================================
// COLETA DE PERFIS
// ================================

// Iniciar coleta de perfis
router.post('/:id/start-collection', campaignController.startCollection);

// Obter status da coleta
router.get('/:id/collection-status', campaignController.getCollectionStatus);

// ================================
// CONFIGURAÇÃO DE REVISÃO E FILA DE CONVITES
// ================================

// Salvar configuração de revisão (round robin, tempo de espera, etc)
router.post('/:id/review-config', campaignController.saveReviewConfig);

// Obter configuração de revisão
router.get('/:id/review-config', campaignController.getReviewConfig);

// Obter relatório da campanha (leads, status de convites, etc)
router.get('/:id/report', campaignController.getCampaignReport);

// Obter status da fila de convites
router.get('/:id/queue-status', campaignController.getQueueStatus);

// Cancelar campanha (retirar convites pendentes)
router.post('/:id/cancel', campaignController.cancelCampaign);

module.exports = router;