// backend/src/routes/profiles.js
const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// ================================
// TODAS AS ROTAS REQUEREM AUTH
// ================================
router.use(authenticateToken);
router.use(apiLimiter);

// ================================
// LINKEDIN ACCOUNTS
// ================================

// Conectar nova conta
router.post('/linkedin-accounts/connect', profileController.connectLinkedInAccount);

// Listar contas
router.get('/linkedin-accounts', profileController.getLinkedInAccounts);

// Obter conta específica
router.get('/linkedin-accounts/:id', profileController.getLinkedInAccount);

// Atualizar conta
router.put('/linkedin-accounts/:id', profileController.updateLinkedInAccount);

// Deletar conta
router.delete('/linkedin-accounts/:id', profileController.deleteLinkedInAccount);

// ================================
// LINKEDIN SEARCH & ACTIONS
// ================================

// ✅ NOVA ROTA: Busca avançada com filtros complexos (POST)
router.post('/search', profileController.searchProfilesAdvanced);

// Buscar perfis - rota simples (GET - mantida para compatibilidade)
router.get('/linkedin/search', profileController.searchProfiles);

// Enviar convite
router.post('/linkedin/invite', profileController.sendInvitation);

module.exports = router;