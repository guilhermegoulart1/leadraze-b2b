/**
 * Admin Pricing Routes
 *
 * Routes for managing pricing tables (admin only)
 * Supports multi-currency (BRL, USD, EUR) and custom pricing per account
 */

const express = require('express');
const router = express.Router();
const adminPricingController = require('../controllers/adminPricingController');
const { authenticateToken } = require('../middleware/auth');

// Middleware to check if user is admin
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Requer privilégios de administrador.'
    });
  }
  next();
}

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// ==========================================
// PRICING TABLES
// ==========================================

// List all pricing tables
router.get('/tables', adminPricingController.listPricingTables);

// Create new pricing table
router.post('/tables', adminPricingController.createPricingTable);

// Get pricing table by ID
router.get('/tables/:id', adminPricingController.getPricingTable);

// Update pricing table
router.put('/tables/:id', adminPricingController.updatePricingTable);

// Delete pricing table
router.delete('/tables/:id', adminPricingController.deletePricingTable);

// Get accounts using this pricing table
router.get('/tables/:id/accounts', adminPricingController.getAccountsUsingPricingTable);

// ==========================================
// PRICING TABLE ITEMS
// ==========================================

// Get items for a pricing table
router.get('/tables/:id/items', adminPricingController.getPricingTableItems);

// Add item to pricing table
router.post('/tables/:id/items', adminPricingController.addPricingTableItem);

// Update pricing table item
router.put('/items/:itemId', adminPricingController.updatePricingTableItem);

// Delete pricing table item
router.delete('/items/:itemId', adminPricingController.deletePricingTableItem);

// ==========================================
// ACCOUNT PRICING ASSIGNMENT
// ==========================================

// Get accounts with custom pricing
router.get('/accounts', adminPricingController.getAccountsWithCustomPricing);

// Assign pricing table to account
router.post('/accounts/:accountId', adminPricingController.assignPricingTableToAccount);

// Remove pricing table from account (revert to default)
router.delete('/accounts/:accountId', adminPricingController.removePricingTableFromAccount);

// Update account currency preference
router.put('/accounts/:accountId/currency', adminPricingController.updateAccountCurrency);

module.exports = router;
