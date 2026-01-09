// backend/src/routes/pipelines.js
const express = require('express');
const router = express.Router();
const pipelineController = require('../controllers/pipelineController');
const pipelineStageController = require('../controllers/pipelineStageController');
const opportunityController = require('../controllers/opportunityController');
const { checkPermission } = require('../middleware/permissions');

// ================================
// PIPELINES
// ================================

// Listar pipelines
router.get('/', pipelineController.getPipelines);

// Obter pipeline por ID
router.get('/:id', pipelineController.getPipeline);

// Criar pipeline
router.post('/', checkPermission('pipelines:create'), pipelineController.createPipeline);

// Atualizar pipeline
router.put('/:id', checkPermission('pipelines:edit'), pipelineController.updatePipeline);

// Deletar pipeline
router.delete('/:id', checkPermission('pipelines:delete'), pipelineController.deletePipeline);

// Obter estatísticas da pipeline
router.get('/:id/stats', pipelineController.getPipelineStats);

// Obter dados do funil para dashboard
router.get('/:id/funnel', pipelineController.getPipelineFunnel);

// Mover pipeline para outro projeto
router.patch('/:id/move', checkPermission('pipelines:edit'), pipelineController.movePipelineToProject);

// Gerenciar usuários da pipeline
router.post('/:id/users', checkPermission('pipelines:manage_users'), pipelineController.addPipelineUser);
router.delete('/:id/users/:userId', checkPermission('pipelines:manage_users'), pipelineController.removePipelineUser);

// ================================
// STAGES (ETAPAS)
// ================================

// Listar etapas da pipeline
router.get('/:pipelineId/stages', pipelineStageController.getStages);

// Criar etapa
router.post('/:pipelineId/stages', checkPermission('pipelines:edit'), pipelineStageController.createStage);

// Atualizar etapa
router.put('/:pipelineId/stages/:stageId', checkPermission('pipelines:edit'), pipelineStageController.updateStage);

// Deletar etapa
router.delete('/:pipelineId/stages/:stageId', checkPermission('pipelines:edit'), pipelineStageController.deleteStage);

// Reordenar etapas
router.put('/:pipelineId/stages/reorder', checkPermission('pipelines:edit'), pipelineStageController.reorderStages);

// ================================
// OPPORTUNITIES (OPORTUNIDADES) - via Pipeline
// ================================

// Listar oportunidades da pipeline
router.get('/:pipelineId/opportunities', opportunityController.getOpportunities);

// Obter oportunidades no formato Kanban
router.get('/:pipelineId/opportunities/kanban', opportunityController.getOpportunitiesKanban);

// Criar oportunidade na pipeline
router.post('/:pipelineId/opportunities', checkPermission('opportunities:create'), opportunityController.createOpportunity);

module.exports = router;
