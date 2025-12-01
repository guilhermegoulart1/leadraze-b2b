/**
 * Affiliate Routes
 *
 * API routes for affiliate program management
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const affiliateController = require('../controllers/affiliateController');

// ============================================
// Public Routes (no auth required)
// ============================================

/**
 * POST /api/affiliate/track
 * Track a click on affiliate link
 * Body: { code: string }
 */
router.post('/track', affiliateController.trackClick);

/**
 * GET /api/affiliate/validate/:code
 * Validate if affiliate code exists
 */
router.get('/validate/:code', affiliateController.validateCode);

// ============================================
// Protected Routes (auth required)
// ============================================

router.use(authenticateToken);

/**
 * GET /api/affiliate/link
 * Get or create affiliate link for current user
 */
router.get('/link', affiliateController.getAffiliateLink);

/**
 * GET /api/affiliate/stats
 * Get affiliate dashboard statistics
 */
router.get('/stats', affiliateController.getStats);

/**
 * GET /api/affiliate/referrals
 * Get list of referrals
 * Query: { page?: number, limit?: number }
 */
router.get('/referrals', affiliateController.getReferrals);

/**
 * GET /api/affiliate/earnings
 * Get earnings history
 * Query: { page?: number, limit?: number }
 */
router.get('/earnings', affiliateController.getEarnings);

module.exports = router;
