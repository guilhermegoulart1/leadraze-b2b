// backend/src/routes/terms.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const termsController = require('../controllers/termsController');

// All routes require authentication
router.use(authenticateToken);

// POST /api/terms/accept - Accept terms
router.post('/accept', termsController.acceptTerms);

// GET /api/terms/status - Get acceptance status
router.get('/status', termsController.getTermsStatus);

module.exports = router;
