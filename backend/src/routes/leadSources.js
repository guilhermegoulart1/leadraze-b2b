const express = require('express');
const router = express.Router();
const leadSourceController = require('../controllers/leadSourceController');
const { authenticateToken } = require('../middleware/auth');

// All lead source routes require authentication
router.use(authenticateToken);

// Lead source CRUD routes
router.get('/', leadSourceController.getLeadSources);
router.get('/:id', leadSourceController.getLeadSource);
router.post('/', leadSourceController.createLeadSource);
router.put('/:id', leadSourceController.updateLeadSource);
router.delete('/:id', leadSourceController.deleteLeadSource);

// Seed default sources
router.post('/seed', leadSourceController.seedDefaultSources);

module.exports = router;
