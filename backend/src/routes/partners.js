/**
 * Partner Routes
 *
 * Public and authenticated routes for partners
 */

const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partnerController');
const partnerAdminController = require('../controllers/partnerAdminController');
const { authenticatePartner } = require('../middleware/partnerAuth');
const { authenticateToken } = require('../middleware/auth');

// ==========================================
// PUBLIC ROUTES (no authentication)
// ==========================================

// Register new partner
router.post('/register', partnerController.register);

// Partner login
router.post('/login', partnerController.login);

// Set password (after approval)
router.post('/set-password', partnerController.setPassword);

// Validate affiliate code
router.get('/validate/:code', partnerController.validateCode);

// Track click on affiliate link
router.post('/track-click', partnerController.trackClick);

// Quick approve/reject via email link (returns HTML page)
router.get('/quick-approve/:id', partnerController.quickApprove);

// ==========================================
// PARTNER AUTHENTICATED ROUTES
// ==========================================

// Get current partner profile
router.get('/me', authenticatePartner, partnerController.getProfile);

// Update partner profile
router.put('/me', authenticatePartner, partnerController.updateProfile);

// Get partner stats
router.get('/stats', authenticatePartner, partnerController.getStats);

// Get partner referrals
router.get('/referrals', authenticatePartner, partnerController.getReferrals);

// Get partner earnings
router.get('/earnings', authenticatePartner, partnerController.getEarnings);

// Get accounts partner has access to
router.get('/accounts', authenticatePartner, partnerController.getAccessibleAccounts);

// Access a client account
router.post('/access-account/:accountId', authenticatePartner, partnerController.accessAccount);

// ==========================================
// CLIENT ROUTES (user managing partner access)
// ==========================================

// Get partners with access to current account
router.get('/access', authenticateToken, partnerController.getPartnersWithAccess);

// Grant access to a partner
router.post('/access', authenticateToken, partnerController.grantPartnerAccess);

// Revoke access from a partner
router.delete('/access/:partnerId', authenticateToken, partnerController.revokePartnerAccess);

// ==========================================
// ADMIN ROUTES
// ==========================================

// List partners (with filters)
router.get('/admin', authenticateToken, requireAdmin, partnerAdminController.list);

// Get partner details
router.get('/admin/:id', authenticateToken, requireAdmin, partnerAdminController.getById);

// Get partner stats (admin view)
router.get('/admin/:id/stats', authenticateToken, requireAdmin, partnerAdminController.getStats);

// Approve partner
router.put('/admin/:id/approve', authenticateToken, requireAdmin, partnerAdminController.approve);

// Reject partner
router.put('/admin/:id/reject', authenticateToken, requireAdmin, partnerAdminController.reject);

// Suspend partner
router.put('/admin/:id/suspend', authenticateToken, requireAdmin, partnerAdminController.suspend);

// Reactivate partner
router.put('/admin/:id/reactivate', authenticateToken, requireAdmin, partnerAdminController.reactivate);

// Resend password email
router.post('/admin/:id/resend-password-email', authenticateToken, requireAdmin, partnerAdminController.resendPasswordEmail);

// Delete partner
router.delete('/admin/:id', authenticateToken, requireAdmin, partnerAdminController.delete);

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Require admin role
 */
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Apenas administradores.'
    });
  }
  next();
}

module.exports = router;
