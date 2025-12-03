// backend/src/routes/profiles.js
const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const { requirePaidSubscription } = require('../middleware/billing');

// ================================
// ROTAS PÚBLICAS (SEM AUTH) - CALLBACKS
// ================================

// Callback do Unipile após Hosted Auth (chamado pelo Unipile via notify_url)
router.post('/channels/auth-notify', profileController.handleAuthNotify);

// ================================
// TODAS AS DEMAIS ROTAS REQUEREM AUTH
// ================================
router.use(authenticateToken);
router.use(apiLimiter);

// ================================
// LINKEDIN ACCOUNTS
// ================================

// Gerar hosted auth link (Unipile) - blocked for trial users
router.get('/linkedin-accounts/hosted-auth-link', requirePaidSubscription('channels'), profileController.getHostedAuthLink);

// ✅ MULTI-CHANNEL: Callback após Hosted Auth - blocked for trial users
router.post('/channels/callback', requirePaidSubscription('channels'), profileController.handleHostedAuthCallback);

// ✅ MULTI-CHANNEL: Sincronizar contas da Unipile
router.post('/channels/sync', profileController.syncUnipileAccounts);

// ✅ MULTI-CHANNEL: Atualizar configurações do canal
router.patch('/channels/:id/settings', profileController.updateChannelSettings);

// ✅ MULTI-CHANNEL: Obter tipos de canais disponíveis
router.get('/channel-types', profileController.getChannelTypes);

// Conectar nova conta (legado - LinkedIn direto) - blocked for trial users
router.post('/linkedin-accounts/connect', requirePaidSubscription('channels'), profileController.connectLinkedInAccount);

// Listar contas
router.get('/linkedin-accounts', profileController.getLinkedInAccounts);

// Obter conta específica
router.get('/linkedin-accounts/:id', profileController.getLinkedInAccount);

// Atualizar conta
router.put('/linkedin-accounts/:id', profileController.updateLinkedInAccount);

// Deletar conta (permanente)
router.delete('/linkedin-accounts/:id', profileController.deleteLinkedInAccount);

// Desconectar conta (soft - mantém histórico)
router.post('/linkedin-accounts/:id/disconnect', profileController.disconnectLinkedInAccount);

// Reativar conta desconectada
router.post('/linkedin-accounts/:id/reactivate', profileController.reactivateLinkedInAccount);

// Atualizar dados da conta (refresh)
router.post('/linkedin-accounts/:id/refresh', profileController.refreshLinkedInAccount);

// Obter estatísticas de convites
router.get('/linkedin-accounts/:id/invite-stats', profileController.getInviteStats);

// Atualizar limite diário de convites
router.patch('/linkedin-accounts/:id/daily-limit', profileController.updateInviteLimit);

// Obter health score da conta
router.get('/linkedin-accounts/:id/health', profileController.getAccountHealth);

// Obter limite recomendado
router.get('/linkedin-accounts/:id/recommended-limit', profileController.getRecommendedLimit);

// Override manual de limite (com motivo)
router.post('/linkedin-accounts/:id/override-limit', profileController.overrideLimit);

// Histórico de alterações de limite
router.get('/linkedin-accounts/:id/limit-history', profileController.getLimitHistory);

// ================================
// LINKEDIN SEARCH & ACTIONS
// ================================

// ✅ NOVA ROTA: Busca avançada com filtros complexos (POST)
router.post('/search', profileController.searchProfilesAdvanced);

// Buscar perfis - rota simples (GET - mantida para compatibilidade)
router.get('/linkedin/search', profileController.searchProfiles);

// Buscar detalhes completos de um perfil
router.get('/:profileId/details', profileController.getProfileDetails);

// Enviar convite
router.post('/linkedin/invite', profileController.sendInvitation);

module.exports = router;