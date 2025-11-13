// backend/src/routes/analytics.js
const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// ================================
// TODAS AS ROTAS REQUEREM AUTH
// ================================
router.use(authenticateToken);
router.use(apiLimiter);

// ================================
// ANALYTICS E RELATÓRIOS
// ================================

// Dashboard geral
router.get('/dashboard', analyticsController.getDashboard);

// Métricas de campanha específica
router.get('/campaigns/:campaignId', analyticsController.getCampaignAnalytics);

// Funil de conversão
router.get('/funnel', analyticsController.getConversionFunnel);

// Performance de contas LinkedIn
router.get('/linkedin-performance', analyticsController.getLinkedInAccountsPerformance);

// Performance de agentes de IA
router.get('/ai-agents-performance', analyticsController.getAIAgentsPerformance);

// Relatório de atividade diária
router.get('/daily-activity', analyticsController.getDailyActivity);

module.exports = router;