const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken } = require('../middleware/auth');

// All product routes require authentication
router.use(authenticateToken);

// Product CRUD routes
router.get('/', productController.getProducts);
router.get('/:id', productController.getProduct);
router.post('/', productController.createProduct);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);
router.post('/:id/reactivate', productController.reactivateProduct);

module.exports = router;
