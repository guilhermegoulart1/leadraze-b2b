// backend/src/routes/leads.js
const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// ================================
// TODAS AS ROTAS REQUEREM AUTH
// ================================
router.use(authenticateToken);
router.use(apiLimiter);

// ================================
// CRUD DE LEADS
// ================================

// Listar leads
router.get('/', leadController.getLeads);

// Obter lead específico
router.get('/:id', leadController.getLead);

// Criar lead
router.post('/', leadController.createLead);

// Criar leads em lote
router.post('/bulk', leadController.createLeadsBulk);

// Atualizar lead
router.put('/:id', leadController.updateLead);

// Atualizar apenas status do lead
router.patch('/:id/status', leadController.updateLead);

// Deletar lead
router.delete('/:id', leadController.deleteLead);

// ================================
// LEADS POR CAMPANHA
// ================================

// Obter leads de uma campanha específica
router.get('/campaign/:campaignId', leadController.getCampaignLeads);

module.exports = router;