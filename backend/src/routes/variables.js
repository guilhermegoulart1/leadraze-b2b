// backend/src/routes/variables.js
// Rotas para API de variaveis de templates

const express = require('express');
const router = express.Router();
const variablesController = require('../controllers/variablesController');
const { authenticateToken } = require('../middleware/auth');

// Todas as rotas requerem autenticacao
router.use(authenticateToken);

// GET /api/variables/definitions - Retorna definicoes de variaveis
router.get('/definitions', variablesController.getDefinitions);

// GET /api/variables/values - Retorna valores reais
router.get('/values', variablesController.getValues);

// POST /api/variables/validate - Valida um template
router.post('/validate', variablesController.validateTemplate);

// POST /api/variables/preview - Gera preview do template
router.post('/preview', variablesController.previewTemplate);

module.exports = router;
