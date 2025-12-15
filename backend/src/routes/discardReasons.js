const express = require('express');
const router = express.Router();
const discardReasonController = require('../controllers/discardReasonController');
const { authenticateToken } = require('../middleware/auth');

// All discard reason routes require authentication
router.use(authenticateToken);

// Discard reason CRUD routes
router.get('/', discardReasonController.getDiscardReasons);
router.get('/:id', discardReasonController.getDiscardReason);
router.post('/', discardReasonController.createDiscardReason);
router.put('/:id', discardReasonController.updateDiscardReason);
router.delete('/:id', discardReasonController.deleteDiscardReason);

// Seed default reasons
router.post('/seed', discardReasonController.seedDefaultReasons);

module.exports = router;
