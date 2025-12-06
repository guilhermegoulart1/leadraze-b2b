const express = require('express');
const router = express.Router();
const tagController = require('../controllers/tagController');
const { authenticateToken } = require('../middleware/auth');

// All tag routes require authentication
router.use(authenticateToken);

// Tag CRUD routes
router.get('/', tagController.getTags);
router.post('/', tagController.createTag);
router.put('/:id', tagController.updateTag);
router.delete('/:id', tagController.deleteTag);

module.exports = router;
