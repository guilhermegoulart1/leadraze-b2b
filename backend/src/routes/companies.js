// backend/src/routes/companies.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const companyController = require('../controllers/companyController');

// Todas as rotas requerem autenticação
router.use(authenticate);

// Buscar empresas
router.post('/search', companyController.searchCompanies);

// Obter detalhes de uma empresa específica
router.get('/:identifier', companyController.getCompanyDetails);

// Obter posts de uma empresa
router.get('/:identifier/posts', companyController.getCompanyPosts);

// Obter funcionários de uma empresa
router.get('/:identifier/employees', companyController.getCompanyEmployees);

module.exports = router;
