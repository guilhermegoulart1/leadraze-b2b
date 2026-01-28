/**
 * Billing Routes
 *
 * API routes for subscription management, payments, and credits
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const billingController = require('../controllers/billingController');
const stripeWebhookController = require('../controllers/stripeWebhookController');

// ============================================
// Public Routes (no auth required)
// ============================================

/**
 * GET /api/billing/plans
 * Get available subscription plans
 */
router.get('/plans', billingController.getPlans);

/**
 * GET /api/billing/pricing
 * Get pricing by currency (dynamic pricing from database)
 * Query: ?currency=BRL|USD|EUR
 */
router.get('/pricing', billingController.getPricing);

/**
 * POST /api/billing/checkout-guest
 * Create Stripe Checkout session for new customers (no auth required)
 * Account will be created automatically after successful payment via webhook
 * Body: { extraChannels?: number, extraUsers?: number, successUrl?: string, cancelUrl?: string, currency?: 'BRL'|'USD'|'EUR' }
 */
router.post('/checkout-guest', billingController.createGuestCheckoutSession);

// ============================================
// Webhook Route (special handling for raw body)
// This route must be registered in app.js with raw body parser
// ============================================

// Note: The webhook route is handled separately in app.js
// because it needs express.raw() middleware for signature verification

// ============================================
// Protected Routes (auth required)
// ============================================

router.use(authenticateToken);

/**
 * GET /api/billing/subscription
 * Get current subscription status and details
 */
router.get('/subscription', billingController.getSubscription);

/**
 * GET /api/billing/usage
 * Get current usage (users, channels) vs limits
 */
router.get('/usage', billingController.getUsage);

/**
 * GET /api/billing/credits
 * Get available credits and packages
 */
router.get('/credits', billingController.getCredits);

/**
 * GET /api/billing/credits/history
 * Get credit usage history
 */
router.get('/credits/history', billingController.getCreditHistory);

/**
 * GET /api/billing/invoices
 * Get invoice history
 */
router.get('/invoices', billingController.getInvoices);

/**
 * POST /api/billing/create-checkout-session
 * Create Stripe Checkout session for subscription
 * Body: { planType: 'starter' | 'professional' | 'enterprise' }
 */
router.post('/create-checkout-session', billingController.createCheckoutSession);

/**
 * POST /api/billing/purchase-credits
 * Create Stripe Checkout session for credit purchase
 * Body: { packageKey: 'gmaps_1000' }
 */
router.post('/purchase-credits', billingController.purchaseCredits);

/**
 * POST /api/billing/create-portal-session
 * Create Stripe Customer Portal session for managing subscription
 */
router.post('/create-portal-session', billingController.createPortalSession);

/**
 * POST /api/billing/cancel
 * Cancel subscription
 * Body: { immediate?: boolean } - defaults to cancel at period end
 */
router.post('/cancel', billingController.cancelSubscription);

/**
 * POST /api/billing/reactivate
 * Reactivate a subscription scheduled for cancellation
 */
router.post('/reactivate', billingController.reactivateSubscription);

/**
 * POST /api/billing/add-channel
 * Add an extra channel to subscription
 */
router.post('/add-channel', billingController.addExtraChannel);

/**
 * POST /api/billing/add-user
 * Add an extra user to subscription
 */
router.post('/add-user', billingController.addExtraUser);

/**
 * GET /api/billing/payment-methods
 * Get saved payment methods for current user
 */
router.get('/payment-methods', billingController.getPaymentMethods);

/**
 * POST /api/billing/resubscribe
 * Resubscribe using existing payment method (for canceled users)
 * Body: { extraChannels?: number, extraUsers?: number, paymentMethodId?: string }
 */
router.post('/resubscribe', billingController.resubscribeWithPaymentMethod);

// ============================================
// AI Credits Routes
// ============================================

/**
 * GET /api/billing/ai-credits
 * Get available AI credits with breakdown (monthly vs permanent)
 */
router.get('/ai-credits', billingController.getAiCredits);

/**
 * GET /api/billing/ai-credits/check
 * Check if account has enough AI credits
 * Query: { amount?: number } - defaults to 1
 */
router.get('/ai-credits/check', billingController.checkAiCredits);

/**
 * POST /api/billing/ai-credits/purchase
 * Purchase AI credits (never expire)
 * Body: { packageKey: 'ai_5000' | 'ai_10000' }
 */
router.post('/ai-credits/purchase', billingController.purchaseAiCredits);

// ============================================
// Credits Summary (for header display)
// ============================================

/**
 * GET /api/billing/credits-summary
 * Get quick summary of all credits (AI + GMaps) for header display
 */
router.get('/credits-summary', billingController.getCreditsSummary);

module.exports = router;
