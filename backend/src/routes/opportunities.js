// backend/src/routes/opportunities.js
const express = require('express');
const router = express.Router();
const opportunityController = require('../controllers/opportunityController');
const { checkPermission } = require('../middleware/permissions');

// Reordenar oportunidades (deve vir antes de /:id para não conflitar)
router.put('/reorder', opportunityController.reorderOpportunities);

// Obter oportunidades de um contato
router.get('/contact/:contactId', opportunityController.getContactOpportunities);

// Obter oportunidade por ID
router.get('/:id', opportunityController.getOpportunity);

// Atualizar oportunidade
router.put('/:id', checkPermission('opportunities:edit'), opportunityController.updateOpportunity);

// Mover oportunidade (mudar stage)
router.patch('/:id/move', opportunityController.moveOpportunity);

// Deletar oportunidade
router.delete('/:id', checkPermission('opportunities:delete'), opportunityController.deleteOpportunity);

module.exports = router;
