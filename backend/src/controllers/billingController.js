/**
 * Billing Controller
 *
 * Handles billing-related API requests
 */

const stripeService = require('../services/stripeService');
const billingService = require('../services/billingService');
const subscriptionService = require('../services/subscriptionService');
const { PLANS, ADDONS, CREDIT_PACKAGES } = require('../config/stripe');
const db = require('../config/database');

/**
 * Get subscription status
 */
exports.getSubscription = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const status = await subscriptionService.getStatus(accountId);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscription status'
    });
  }
};

/**
 * Get available plans
 */
exports.getPlans = async (req, res) => {
  try {
    const plans = Object.entries(PLANS).map(([key, plan]) => ({
      id: key,
      name: plan.name,
      price: plan.price,
      priceFormatted: `$${(plan.price / 100).toFixed(2)}/mo`,
      limits: plan.limits,
      features: plan.features
    }));

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Error getting plans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get plans'
    });
  }
};

/**
 * Get current usage
 */
exports.getUsage = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const usage = await billingService.getCurrentUsage(accountId);
    const limits = await subscriptionService.calculateLimits(accountId);

    res.json({
      success: true,
      data: {
        usage,
        limits,
        percentages: {
          users: limits.maxUsers > 0 ? Math.round((usage.users / limits.maxUsers) * 100) : 0,
          channels: limits.maxChannels > 0 ? Math.round((usage.channels / limits.maxChannels) * 100) : 0
        }
      }
    });
  } catch (error) {
    console.error('Error getting usage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get usage'
    });
  }
};

/**
 * Get available credits
 */
exports.getCredits = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const credits = await billingService.getAvailableCredits(accountId, 'gmaps');
    const packages = await billingService.getCreditPackages(accountId);

    res.json({
      success: true,
      data: {
        available: credits,
        packages: packages.map(p => ({
          id: p.id,
          type: p.credit_type,
          remaining: p.remaining_credits,
          initial: p.initial_credits,
          expiresAt: p.expires_at,
          source: p.source
        }))
      }
    });
  } catch (error) {
    console.error('Error getting credits:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get credits'
    });
  }
};

/**
 * Create checkout session for subscription
 */
exports.createCheckoutSession = async (req, res) => {
  try {
    const { priceId, planType } = req.body;
    const accountId = req.user.account_id;
    const userEmail = req.user.email;
    const userName = req.user.name;

    // Validate plan
    const plan = PLANS[planType];
    if (!plan || !plan.priceId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan selected'
      });
    }

    // Get or create Stripe customer
    const customerId = await stripeService.getOrCreateCustomer(accountId, userEmail, userName);

    // Create checkout session
    const session = await stripeService.createCheckoutSession({
      accountId,
      customerId,
      priceId: plan.priceId,
      successUrl: `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.FRONTEND_URL}/pricing`,
      metadata: {
        plan_type: planType
      }
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url
      }
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session'
    });
  }
};

/**
 * Create checkout session for credits purchase
 */
exports.purchaseCredits = async (req, res) => {
  try {
    const { packageKey } = req.body;
    const accountId = req.user.account_id;
    const userEmail = req.user.email;
    const userName = req.user.name;

    // Validate package
    const creditPackage = CREDIT_PACKAGES[packageKey];
    if (!creditPackage) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credit package'
      });
    }

    // Get or create Stripe customer
    const customerId = await stripeService.getOrCreateCustomer(accountId, userEmail, userName);

    // Create checkout session
    const session = await stripeService.createCreditsCheckoutSession({
      accountId,
      customerId,
      packageKey,
      successUrl: `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}&type=credits`,
      cancelUrl: `${process.env.FRONTEND_URL}/settings/billing`
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url
      }
    });
  } catch (error) {
    console.error('Error creating credits checkout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session'
    });
  }
};

/**
 * Create portal session for managing subscription
 */
exports.createPortalSession = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    // Get customer ID
    const accountResult = await db.query(
      'SELECT stripe_customer_id FROM accounts WHERE id = $1',
      [accountId]
    );

    const customerId = accountResult.rows[0]?.stripe_customer_id;
    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'No billing account found'
      });
    }

    const session = await stripeService.createPortalSession(
      customerId,
      `${process.env.FRONTEND_URL}/settings/billing`
    );

    res.json({
      success: true,
      data: {
        url: session.url
      }
    });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create portal session'
    });
  }
};

/**
 * Cancel subscription
 */
exports.cancelSubscription = async (req, res) => {
  try {
    const { immediate = false } = req.body;
    const accountId = req.user.account_id;

    const subscription = await subscriptionService.getSubscription(accountId);
    if (!subscription || !subscription.stripe_subscription_id) {
      return res.status(400).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    await stripeService.cancelSubscription(subscription.stripe_subscription_id, immediate);

    res.json({
      success: true,
      message: immediate ? 'Subscription canceled immediately' : 'Subscription will be canceled at period end'
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription'
    });
  }
};

/**
 * Reactivate subscription
 */
exports.reactivateSubscription = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    const subscription = await subscriptionService.getSubscription(accountId);
    if (!subscription || !subscription.stripe_subscription_id) {
      return res.status(400).json({
        success: false,
        message: 'No subscription found'
      });
    }

    if (!subscription.cancel_at_period_end) {
      return res.status(400).json({
        success: false,
        message: 'Subscription is not scheduled for cancellation'
      });
    }

    await stripeService.reactivateSubscription(subscription.stripe_subscription_id);

    res.json({
      success: true,
      message: 'Subscription reactivated'
    });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reactivate subscription'
    });
  }
};

/**
 * Get invoices
 */
exports.getInvoices = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { limit = 10 } = req.query;

    // Get from local cache first
    const result = await db.query(
      `SELECT * FROM invoices
       WHERE account_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [accountId, parseInt(limit)]
    );

    res.json({
      success: true,
      data: result.rows.map(inv => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        amount: inv.total_cents ? (inv.total_cents / 100).toFixed(2) : '0.00',
        currency: inv.currency,
        periodStart: inv.period_start,
        periodEnd: inv.period_end,
        paidAt: inv.paid_at,
        invoiceUrl: inv.hosted_invoice_url,
        pdfUrl: inv.invoice_pdf_url,
        createdAt: inv.created_at
      }))
    });
  } catch (error) {
    console.error('Error getting invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get invoices'
    });
  }
};

/**
 * Get credit usage history
 */
exports.getCreditHistory = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { limit = 50, offset = 0 } = req.query;

    const history = await billingService.getCreditUsageHistory(accountId, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error getting credit history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get credit history'
    });
  }
};

/**
 * Add extra channel
 */
exports.addExtraChannel = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    const subscription = await subscriptionService.getSubscription(accountId);
    if (!subscription || !['active', 'trialing'].includes(subscription.status)) {
      return res.status(400).json({
        success: false,
        message: 'Active subscription required'
      });
    }

    const addon = ADDONS.channel;
    if (!addon.priceId) {
      return res.status(400).json({
        success: false,
        message: 'Channel add-on not configured'
      });
    }

    // Check if already has channel add-on
    const existingItem = await db.query(
      `SELECT si.* FROM subscription_items si
       WHERE si.subscription_id = $1 AND si.addon_type = 'channel' AND si.is_active = true`,
      [subscription.id]
    );

    if (existingItem.rows.length > 0) {
      // Increment quantity
      const item = existingItem.rows[0];
      await stripeService.updateSubscriptionItemQuantity(
        item.stripe_subscription_item_id,
        item.quantity + 1
      );
    } else {
      // Create new subscription item
      await stripeService.addSubscriptionItem(
        subscription.stripe_subscription_id,
        addon.priceId,
        1
      );
    }

    res.json({
      success: true,
      message: 'Extra channel added'
    });
  } catch (error) {
    console.error('Error adding extra channel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add extra channel'
    });
  }
};

/**
 * Add extra user
 */
exports.addExtraUser = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    const subscription = await subscriptionService.getSubscription(accountId);
    if (!subscription || !['active', 'trialing'].includes(subscription.status)) {
      return res.status(400).json({
        success: false,
        message: 'Active subscription required'
      });
    }

    const addon = ADDONS.user;
    if (!addon.priceId) {
      return res.status(400).json({
        success: false,
        message: 'User add-on not configured'
      });
    }

    // Check if already has user add-on
    const existingItem = await db.query(
      `SELECT si.* FROM subscription_items si
       WHERE si.subscription_id = $1 AND si.addon_type = 'user' AND si.is_active = true`,
      [subscription.id]
    );

    if (existingItem.rows.length > 0) {
      // Increment quantity
      const item = existingItem.rows[0];
      await stripeService.updateSubscriptionItemQuantity(
        item.stripe_subscription_item_id,
        item.quantity + 1
      );
    } else {
      // Create new subscription item
      await stripeService.addSubscriptionItem(
        subscription.stripe_subscription_id,
        addon.priceId,
        1
      );
    }

    res.json({
      success: true,
      message: 'Extra user added'
    });
  } catch (error) {
    console.error('Error adding extra user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add extra user'
    });
  }
};
