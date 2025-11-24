// backend/src/routes/googleMaps.js
const express = require('express');
const router = express.Router();
const googleMapsController = require('../controllers/googleMapsController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// ================================
// TODAS AS ROTAS REQUEREM AUTH
// ================================
router.use(authenticateToken);
router.use(apiLimiter);

// ================================
// GOOGLE MAPS SEARCH ROUTES
// ================================

// Buscar estabelecimentos no Google Maps
router.post('/search', googleMapsController.searchGoogleMaps);

// Exportar resultados para CSV
router.post('/export', googleMapsController.exportToCSV);

// Verificar créditos da conta Outscraper
router.get('/account', googleMapsController.getAccountInfo);

module.exports = router;
