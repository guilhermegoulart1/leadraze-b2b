// backend/src/routes/leads.js
const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const leadCommentsRouter = require('./leadComments');
const taskController = require('../controllers/taskController');
const checklistController = require('../controllers/checklistController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// ================================
// TODAS AS ROTAS REQUEREM AUTH
// ================================
router.use(authenticateToken);
router.use(apiLimiter);

// ================================
// ROTAS ESPECÍFICAS (DEVEM VIR ANTES DE /:id)
// ================================

// Listar usuários que podem ser atribuídos
router.get('/assignable-users', leadController.getAssignableUsers);

// Obter leads de uma campanha específica
router.get('/campaign/:campaignId', leadController.getCampaignLeads);

// Criar leads em lote
router.post('/bulk', leadController.createLeadsBulk);

// ================================
// CRUD DE LEADS
// ================================

// Listar leads
router.get('/', leadController.getLeads);

// Criar lead
router.post('/', leadController.createLead);

// Obter lead específico (deve vir depois de rotas específicas)
router.get('/:id', leadController.getLead);

// Atualizar lead
router.put('/:id', leadController.updateLead);

// Atualizar apenas status do lead
router.patch('/:id/status', leadController.updateLead);

// Atribuir lead a um usuário
router.patch('/:id/assign', leadController.assignLead);

// Auto-atribuir via round-robin
router.post('/:id/auto-assign', leadController.autoAssignLead);

// Deletar lead
router.delete('/:id', leadController.deleteLead);

// ================================
// COMENTÁRIOS EM LEADS
// ================================

// Mount comments routes under /leads/:leadId/comments
router.use('/:leadId/comments', leadCommentsRouter);

// ================================
// TAREFAS DO LEAD
// ================================

// Get tasks for a specific lead
router.get('/:leadId/tasks', taskController.getLeadTasks);

// ================================
// CHECKLISTS DO LEAD
// ================================

// Get all checklists for a lead
router.get('/:leadId/checklists', checklistController.getLeadChecklists);

// Create a new checklist for a lead
router.post('/:leadId/checklists', checklistController.createChecklist);

module.exports = router;