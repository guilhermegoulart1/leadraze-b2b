// backend/src/routes/quickReplies.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const quickRepliesController = require('../controllers/quickRepliesController');

// All routes require authentication
router.use(authenticateToken);

// GET /api/quick-replies - Get all quick replies (own + global)
router.get('/', quickRepliesController.getQuickReplies);

// GET /api/quick-replies/:id - Get a single quick reply
router.get('/:id', quickRepliesController.getQuickReply);

// POST /api/quick-replies - Create a new quick reply
router.post('/', quickRepliesController.createQuickReply);

// PUT /api/quick-replies/:id - Update a quick reply
router.put('/:id', quickRepliesController.updateQuickReply);

// DELETE /api/quick-replies/:id - Delete a quick reply
router.delete('/:id', quickRepliesController.deleteQuickReply);

module.exports = router;
