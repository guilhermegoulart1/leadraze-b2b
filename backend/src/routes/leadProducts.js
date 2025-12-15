const express = require('express');
const router = express.Router({ mergeParams: true });
const leadProductController = require('../controllers/leadProductController');
const { authenticateToken } = require('../middleware/auth');

// All lead product routes require authentication
router.use(authenticateToken);

// Lead product routes (nested under /api/leads/:leadId/products)
router.get('/', leadProductController.getLeadProducts);
router.post('/', leadProductController.addLeadProduct);
router.put('/:productItemId', leadProductController.updateLeadProduct);
router.delete('/:productItemId', leadProductController.removeLeadProduct);

// Complete deal route
router.post('/complete-deal', leadProductController.completeDeal);

module.exports = router;
