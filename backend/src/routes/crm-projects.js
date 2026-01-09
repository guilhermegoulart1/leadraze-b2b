// backend/src/routes/crm-projects.js
const express = require('express');
const router = express.Router();
const crmProjectController = require('../controllers/crmProjectController');
const { checkPermission } = require('../middleware/permissions');

// Listar projetos
router.get('/', crmProjectController.getProjects);

// Criar projeto
router.post('/', checkPermission('pipelines:create'), crmProjectController.createProject);

// Reordenar projetos (DEVE vir antes de /:id para não ser capturado como ID)
router.put('/reorder', checkPermission('pipelines:edit'), crmProjectController.reorderProjects);

// Obter projeto por ID
router.get('/:id', crmProjectController.getProject);

// Atualizar projeto
router.put('/:id', checkPermission('pipelines:edit'), crmProjectController.updateProject);

// Deletar projeto
router.delete('/:id', checkPermission('pipelines:delete'), crmProjectController.deleteProject);

module.exports = router;
