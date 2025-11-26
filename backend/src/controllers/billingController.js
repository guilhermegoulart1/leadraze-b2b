/**
 * Billing Controller
 *
 * Handles billing-related API requests
 *
 * Modelo:
 * - Plano Base único: R$ 297/mês (1 canal, 2 usuários, 200 créditos/mês)
 * - Add-ons recorrentes: Canal (+R$ 147/mês), Usuário (+R$ 27/mês)
 * - Créditos avulsos: não expiram
 */

const stripeService = require('../services/stripeService');
const billingService = require('../services/billingService');
const subscriptionService = require('../services/subscriptionService');
const {
  PLANS,
  ADDONS,
  CREDIT_PACKAGES,
  getPublicPlans,
  getAddons,
  getCreditPackages
} = require('../config/stripe');
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
 * Get available plans (for pricing page)
 */
exports.getPlans = async (req, res) => {
  try {
    // Get plans from database
    const result = await db.query(`
      SELECT
        id, name, slug, description,
        price_monthly_cents, price_yearly_cents,
        max_channels, max_users, monthly_gmaps_credits,
        features, is_highlighted, highlight_text
      FROM plans
      WHERE is_active = true AND is_public = true
      ORDER BY display_order
    `);

    const plans = result.rows.map(plan => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      priceMonthly: plan.price_monthly_cents,
      priceYearly: plan.price_yearly_cents,
      priceMonthlyFormatted: `R$ ${(plan.price_monthly_cents / 100).toFixed(2)}`,
      priceYearlyFormatted: `R$ ${(plan.price_yearly_cents / 100).toFixed(2)}`,
      limits: {
        maxChannels: plan.max_channels,
        maxUsers: plan.max_users,
        monthlyGmapsCredits: plan.monthly_gmaps_credits
      },
      features: plan.features,
      isHighlighted: plan.is_highlighted,
      highlightText: plan.highlight_text
    }));

    // Get add-ons
    const addonsResult = await db.query(`
      SELECT
        id, name, slug, description, addon_type,
        price_cents, billing_type, credits_amount, credits_expire
      FROM addons
      WHERE is_active = true
      ORDER BY display_order
    `);

    const addons = addonsResult.rows.map(addon => ({
      id: addon.id,
      name: addon.name,
      slug: addon.slug,
      description: addon.description,
      type: addon.addon_type,
      price: addon.price_cents,
      priceFormatted: `R$ ${(addon.price_cents / 100).toFixed(2)}`,
      billingType: addon.billing_type,
      creditsAmount: addon.credits_amount,
      creditsExpire: addon.credits_expire
    }));

    res.json({
      success: true,
      data: {
        plans,
        addons: {
          recurring: addons.filter(a => a.billingType === 'recurring'),
          credits: addons.filter(a => a.type === 'credits')
        }
      }
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
 * Get available credits with breakdown
 */
exports.getCredits = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    // Get detailed breakdown
    const breakdown = await stripeService.getCreditBreakdown(accountId);

    // Get credit packages for purchase
    const purchasePackages = getCreditPackages();

    res.json({
      success: true,
      data: {
        total: breakdown.total,
        expiring: breakdown.expiring,    // Créditos do plano mensal (expiram)
        permanent: breakdown.permanent,   // Créditos comprados (não expiram)
        packages: breakdown.packages.map(p => ({
          id: p.id,
          type: p.credit_type,
          remaining: p.remaining_credits,
          initial: p.initial_credits,
          expiresAt: p.expires_at,
          neverExpires: p.never_expires,
          source: p.source
        })),
        purchaseOptions: purchasePackages.map(pkg => ({
          key: pkg.key,
          name: pkg.name,
          credits: pkg.credits,
          price: pkg.price,
          priceFormatted: `R$ ${(pkg.price / 100).toFixed(2)}`,
          expires: pkg.expires
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
 * Create checkout session for subscription (Base plan + add-ons)
 * Body: { extraChannels?: number, extraUsers?: number }
 */
exports.createCheckoutSession = async (req, res) => {
  try {
    const { extraChannels = 0, extraUsers = 0 } = req.body;
    const accountId = req.user.account_id;
    const userEmail = req.user.email;
    const userName = req.user.name;

    // Validate inputs (max 10 extra channels, max 50 extra users)
    const channels = Math.max(0, Math.min(10, parseInt(extraChannels) || 0));
    const users = Math.max(0, Math.min(50, parseInt(extraUsers) || 0));

    // Get base plan
    const plan = PLANS.base;
    if (!plan || !plan.priceIdMonthly) {
      return res.status(400).json({
        success: false,
        message: 'Plan not configured. Contact support.'
      });
    }

    // Check if already has subscription
    const hasSubscription = await stripeService.hasActiveSubscription(accountId);
    if (hasSubscription) {
      return res.status(400).json({
        success: false,
        message: 'Account already has an active subscription'
      });
    }

    // Get or create Stripe customer
    const customerId = await stripeService.getOrCreateCustomer(accountId, userEmail, userName);

    // Create checkout session with all line items
    const session = await stripeService.createCheckoutSession({
      accountId,
      customerId,
      priceId: plan.priceIdMonthly,
      extraChannels: channels,
      extraUsers: users,
      successUrl: `${process.env.FRONTEND_URL}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.FRONTEND_URL}/checkout?canceled=true`,
      metadata: {
        plan_type: 'base',
        extra_channels: channels.toString(),
        extra_users: users.toString()
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
 * Create checkout session for credits purchase (never expire)
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

    if (!creditPackage.priceId) {
      return res.status(400).json({
        success: false,
        message: 'Credit package not configured. Contact support.'
      });
    }

    // Get or create Stripe customer
    const customerId = await stripeService.getOrCreateCustomer(accountId, userEmail, userName);

    // Create checkout session
    const session = await stripeService.createCreditsCheckoutSession({
      accountId,
      customerId,
      packageKey,
      successUrl: `${process.env.FRONTEND_URL}/settings/billing?success=true&type=credits&session_id={CHECKOUT_SESSION_ID}`,
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
        message: 'No billing account found. Subscribe first.'
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
        amountFormatted: inv.total_cents ? `R$ ${(inv.total_cents / 100).toFixed(2)}` : 'R$ 0,00',
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
 * Add extra channel (creates checkout for recurring add-on)
 */
exports.addExtraChannel = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const userEmail = req.user.email;
    const userName = req.user.name;

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

      // Update local db
      await db.query(
        'UPDATE subscription_items SET quantity = quantity + 1 WHERE id = $1',
        [item.id]
      );
    } else {
      // Create new subscription item in Stripe
      const stripeItem = await stripeService.addSubscriptionItem(
        subscription.stripe_subscription_id,
        addon.priceId,
        1
      );

      // Save to local db
      await db.query(`
        INSERT INTO subscription_items (subscription_id, stripe_subscription_item_id, stripe_price_id, addon_type, quantity)
        VALUES ($1, $2, $3, 'channel', 1)
      `, [subscription.id, stripeItem.id, addon.priceId]);
    }

    // Update subscription limits
    await db.query(
      'UPDATE subscriptions SET max_channels = max_channels + 1 WHERE id = $1',
      [subscription.id]
    );

    res.json({
      success: true,
      message: 'Extra channel added. You will be charged R$ 147/month.'
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
 * Create checkout session for GUEST (no auth required)
 * Account will be created after successful payment via webhook
 * Body: { extraChannels?: number, extraUsers?: number }
 */
exports.createGuestCheckoutSession = async (req, res) => {
  try {
    const { extraChannels = 0, extraUsers = 0 } = req.body;

    // Validate inputs
    const channels = Math.max(0, Math.min(10, parseInt(extraChannels) || 0));
    const users = Math.max(0, Math.min(50, parseInt(extraUsers) || 0));

    // Get base plan
    const plan = PLANS.base;
    if (!plan || !plan.priceIdMonthly) {
      return res.status(400).json({
        success: false,
        message: 'Plan not configured. Contact support.'
      });
    }

    // Create checkout session WITHOUT customer (Stripe will collect email)
    const session = await stripeService.createGuestCheckoutSession({
      priceId: plan.priceIdMonthly,
      extraChannels: channels,
      extraUsers: users,
      successUrl: `${process.env.FRONTEND_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.FRONTEND_URL}/pricing?canceled=true`,
      metadata: {
        is_guest: 'true',
        plan_type: 'base',
        extra_channels: channels.toString(),
        extra_users: users.toString()
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
    console.error('Error creating guest checkout session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session'
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

      // Update local db
      await db.query(
        'UPDATE subscription_items SET quantity = quantity + 1 WHERE id = $1',
        [item.id]
      );
    } else {
      // Create new subscription item in Stripe
      const stripeItem = await stripeService.addSubscriptionItem(
        subscription.stripe_subscription_id,
        addon.priceId,
        1
      );

      // Save to local db
      await db.query(`
        INSERT INTO subscription_items (subscription_id, stripe_subscription_item_id, stripe_price_id, addon_type, quantity)
        VALUES ($1, $2, $3, 'user', 1)
      `, [subscription.id, stripeItem.id, addon.priceId]);
    }

    // Update subscription limits
    await db.query(
      'UPDATE subscriptions SET max_users = max_users + 1 WHERE id = $1',
      [subscription.id]
    );

    res.json({
      success: true,
      message: 'Extra user added. You will be charged R$ 27/month.'
    });
  } catch (error) {
    console.error('Error adding extra user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add extra user'
    });
  }
};
