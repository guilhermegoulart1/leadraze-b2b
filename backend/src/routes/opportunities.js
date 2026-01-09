// backend/src/routes/opportunities.js
const express = require('express');
const router = express.Router();
const opportunityController = require('../controllers/opportunityController');
const opportunityCommentController = require('../controllers/opportunityCommentController');
const leadProductController = require('../controllers/leadProductController');
const taskController = require('../controllers/taskController');
const checklistController = require('../controllers/checklistController');
const tagController = require('../controllers/tagController');
const { checkPermission } = require('../middleware/permissions');

// ================================
// ROTAS ESPECÍFICAS (DEVEM VIR ANTES DE /:id)
// ================================

// Listar usuários que podem ser atribuídos
router.get('/assignable-users', opportunityController.getAssignableUsers);

// Obter oportunidades de uma campanha específica
router.get('/campaign/:campaignId', opportunityController.getCampaignOpportunities);

// Criar oportunidades em lote
router.post('/bulk', opportunityController.createOpportunitiesBulk);

// Criar oportunidade manual (sem campanha)
router.post('/manual', opportunityController.createManualOpportunity);

// Reordenar oportunidades
router.put('/reorder', opportunityController.reorderOpportunities);

// Obter oportunidades de um contato
router.get('/contact/:contactId', opportunityController.getContactOpportunities);

// ================================
// CRUD DE OPORTUNIDADES
// ================================

// Listar oportunidades
router.get('/', opportunityController.getOpportunities);

// Criar oportunidade
router.post('/', opportunityController.createOpportunity);

// Obter oportunidade por ID
router.get('/:id', opportunityController.getOpportunity);

// Atualizar oportunidade
router.put('/:id', checkPermission('opportunities:edit'), opportunityController.updateOpportunity);

// Atualizar apenas status da oportunidade
router.patch('/:id/status', opportunityController.updateOpportunity);

// Mover oportunidade (mudar stage)
router.patch('/:id/move', opportunityController.moveOpportunity);

// Atribuir oportunidade a um usuário
router.patch('/:id/assign', opportunityController.assignOpportunity);

// Auto-atribuir via round-robin
router.post('/:id/auto-assign', opportunityController.autoAssignOpportunity);

// Deletar oportunidade
router.delete('/:id', checkPermission('opportunities:delete'), opportunityController.deleteOpportunity);

// Reativar oportunidade descartada
router.post('/:id/reactivate', opportunityController.reactivateOpportunity);

// ================================
// COMENTÁRIOS
// ================================
router.get('/:opportunityId/comments', opportunityCommentController.getComments);
router.post('/:opportunityId/comments', opportunityCommentController.createComment);
router.put('/:opportunityId/comments/:commentId', opportunityCommentController.updateComment);
router.delete('/:opportunityId/comments/:commentId', opportunityCommentController.deleteComment);
router.get('/:opportunityId/comments/search-users', opportunityCommentController.searchUsersForMentions);

// ================================
// PRODUTOS DA OPORTUNIDADE (Win Deal)
// ================================
router.get('/:leadId/products', leadProductController.getLeadProducts);
router.post('/:leadId/products', leadProductController.addLeadProduct);
router.put('/:leadId/products/:productItemId', leadProductController.updateLeadProduct);
router.delete('/:leadId/products/:productItemId', leadProductController.removeLeadProduct);
router.post('/:leadId/products/complete-deal', leadProductController.completeDeal);

// ================================
// TAGS DA OPORTUNIDADE
// ================================
router.post('/:opportunityId/tags', tagController.addTagToOpportunity);
router.delete('/:opportunityId/tags/:tagId', tagController.removeTagFromOpportunity);

// ================================
// TAREFAS DA OPORTUNIDADE
// ================================
router.get('/:opportunityId/tasks', taskController.getOpportunityTasks);

// ================================
// CHECKLISTS DA OPORTUNIDADE
// ================================
router.get('/:opportunityId/checklists', checklistController.getOpportunityChecklists);
router.post('/:opportunityId/checklists', checklistController.createChecklist);

module.exports = router;
