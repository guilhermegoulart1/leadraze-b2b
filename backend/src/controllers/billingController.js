/**
 * Billing Controller
 *
 * Handles billing-related API requests
 *
 * Pricing model (USD):
 * - Base Plan: $45/month (1 channel, 2 users, 200 gmaps credits/month, 5000 AI credits/month)
 * - Recurring add-ons: Channel (+$27/month), User (+$3/month)
 * - One-time credits: never expire
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
      priceMonthlyFormatted: `$${(plan.price_monthly_cents / 100).toFixed(2)}`,
      priceYearlyFormatted: `$${(plan.price_yearly_cents / 100).toFixed(2)}`,
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
      priceFormatted: `$${(addon.price_cents / 100).toFixed(2)}`,
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
          priceFormatted: `$${(pkg.price / 100).toFixed(2)}`,
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

    // Validate inputs (max 100 extra channels, max 100 extra users)
    const channels = Math.max(0, Math.min(100, parseInt(extraChannels) || 0));
    const users = Math.max(0, Math.min(100, parseInt(extraUsers) || 0));

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
        amountFormatted: inv.total_cents ? `$${(inv.total_cents / 100).toFixed(2)}` : '$0.00',
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
      message: 'Extra channel added. You will be charged $27/month.'
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
    const { extraChannels = 0, extraUsers = 0, successUrl, cancelUrl, affiliateCode, customerEmail } = req.body;

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

    // Use provided URLs or fall back to defaults
    const finalSuccessUrl = successUrl || `${process.env.FRONTEND_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const finalCancelUrl = cancelUrl || `${process.env.FRONTEND_URL}/pricing?canceled=true`;

    // Build metadata
    const metadata = {
      is_guest: 'true',
      plan_type: 'base',
      extra_channels: channels.toString(),
      extra_users: users.toString()
    };

    // Add affiliate code if provided
    if (affiliateCode) {
      metadata.affiliate_code = affiliateCode.toUpperCase();
    }

    // Create checkout session WITHOUT customer (Stripe will collect email)
    const session = await stripeService.createGuestCheckoutSession({
      priceId: plan.priceIdMonthly,
      extraChannels: channels,
      extraUsers: users,
      successUrl: finalSuccessUrl,
      cancelUrl: finalCancelUrl,
      metadata,
      customerEmail: customerEmail || undefined
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
      message: error.userMessage || 'Failed to create checkout session'
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
      message: 'Extra user added. You will be charged $3/month.'
    });
  } catch (error) {
    console.error('Error adding extra user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add extra user'
    });
  }
};

/**
 * Get AI credits with breakdown
 */
exports.getAiCredits = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    // Get detailed breakdown
    const breakdown = await stripeService.getAiCreditBreakdown(accountId);

    // Get AI credit packages for purchase
    const allPackages = getCreditPackages();
    const aiPackages = allPackages.filter(pkg => pkg.creditType === 'ai');

    res.json({
      success: true,
      data: {
        total: breakdown.total,
        monthly: breakdown.monthly,
        permanent: breakdown.permanent,
        packages: breakdown.packages.map(p => ({
          id: p.id,
          type: p.credit_type,
          remaining: p.remaining_credits,
          initial: p.initial_credits,
          expiresAt: p.expires_at,
          neverExpires: p.never_expires,
          source: p.source
        })),
        purchaseOptions: aiPackages.map(pkg => ({
          key: pkg.key,
          name: pkg.name,
          credits: pkg.credits,
          price: pkg.price,
          priceFormatted: `$${(pkg.price / 100).toFixed(2)}`,
          expires: pkg.expires
        }))
      }
    });
  } catch (error) {
    console.error('Error getting AI credits:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI credits'
    });
  }
};

/**
 * Purchase AI credits (never expire)
 */
exports.purchaseAiCredits = async (req, res) => {
  try {
    const { packageKey } = req.body;
    const accountId = req.user.account_id;
    const userEmail = req.user.email;
    const userName = req.user.name;

    // Validate package
    const creditPackage = CREDIT_PACKAGES[packageKey];
    if (!creditPackage || creditPackage.creditType !== 'ai') {
      return res.status(400).json({
        success: false,
        message: 'Invalid AI credit package'
      });
    }

    if (!creditPackage.priceId) {
      return res.status(400).json({
        success: false,
        message: 'AI credit package not configured. Contact support.'
      });
    }

    // Get or create Stripe customer
    const customerId = await stripeService.getOrCreateCustomer(accountId, userEmail, userName);

    // Create checkout session
    const session = await stripeService.createCreditsCheckoutSession({
      accountId,
      customerId,
      packageKey,
      successUrl: `${process.env.FRONTEND_URL}/agents?success=true&type=ai_credits&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.FRONTEND_URL}/agents`
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url
      }
    });
  } catch (error) {
    console.error('Error creating AI credits checkout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session'
    });
  }
};

/**
 * Get saved payment methods
 * Returns the customer's saved cards in Stripe
 */
exports.getPaymentMethods = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    // Get customer ID
    const accountResult = await db.query(
      'SELECT stripe_customer_id FROM accounts WHERE id = $1',
      [accountId]
    );

    const customerId = accountResult.rows[0]?.stripe_customer_id;
    if (!customerId) {
      return res.json({
        success: true,
        data: {
          paymentMethods: [],
          hasPaymentMethod: false
        }
      });
    }

    const paymentMethods = await stripeService.getCustomerPaymentMethods(customerId);

    res.json({
      success: true,
      data: {
        paymentMethods: paymentMethods.map(pm => ({
          id: pm.id,
          brand: pm.card?.brand,
          last4: pm.card?.last4,
          expMonth: pm.card?.exp_month,
          expYear: pm.card?.exp_year
        })),
        hasPaymentMethod: paymentMethods.length > 0
      }
    });
  } catch (error) {
    console.error('Error getting payment methods:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment methods'
    });
  }
};

/**
 * Resubscribe using existing payment method
 * For users who canceled and want to come back without entering card again
 * Body: { extraChannels?: number, extraUsers?: number, paymentMethodId?: string }
 */
exports.resubscribeWithPaymentMethod = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { extraChannels = 0, extraUsers = 0, paymentMethodId } = req.body;

    // Get customer ID
    const accountResult = await db.query(
      'SELECT stripe_customer_id FROM accounts WHERE id = $1',
      [accountId]
    );

    const customerId = accountResult.rows[0]?.stripe_customer_id;
    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'No billing account found',
        code: 'NO_CUSTOMER'
      });
    }

    // Get payment method (use provided or get default)
    let pmId = paymentMethodId;
    if (!pmId) {
      pmId = await stripeService.getDefaultPaymentMethod(customerId);
    }

    if (!pmId) {
      return res.status(400).json({
        success: false,
        message: 'No payment method on file. Please use checkout.',
        code: 'NO_PAYMENT_METHOD'
      });
    }

    // Check if already has active subscription
    const hasSubscription = await stripeService.hasActiveSubscription(accountId);
    if (hasSubscription) {
      return res.status(400).json({
        success: false,
        message: 'Account already has an active subscription'
      });
    }

    // Get base plan
    const plan = PLANS.base;
    if (!plan || !plan.priceIdMonthly) {
      return res.status(400).json({
        success: false,
        message: 'Plan not configured. Contact support.'
      });
    }

    // Create subscription with existing payment method
    const subscription = await stripeService.createSubscriptionWithPaymentMethod({
      customerId,
      paymentMethodId: pmId,
      priceId: plan.priceIdMonthly,
      extraChannels: Math.max(0, Math.min(10, parseInt(extraChannels) || 0)),
      extraUsers: Math.max(0, Math.min(50, parseInt(extraUsers) || 0)),
      metadata: {
        account_id: accountId,
        plan_type: 'base',
        resubscription: 'true'
      }
    });

    // The webhook will handle syncing the subscription to our database
    // But we can return success immediately

    res.json({
      success: true,
      message: 'Subscription reactivated successfully',
      data: {
        subscriptionId: subscription.id,
        status: subscription.status
      }
    });
  } catch (error) {
    console.error('Error resubscribing with payment method:', error);

    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: 'CARD_ERROR'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to resubscribe. Please try checkout instead.'
    });
  }
};

/**
 * Check if account has enough AI credits
 */
exports.checkAiCredits = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { amount = 1 } = req.query;

    const hasCredits = await stripeService.hasEnoughAiCredits(accountId, parseInt(amount));
    const available = await stripeService.getAvailableAiCredits(accountId);

    res.json({
      success: true,
      data: {
        hasCredits,
        available,
        required: parseInt(amount)
      }
    });
  } catch (error) {
    console.error('Error checking AI credits:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check AI credits'
    });
  }
};

/**
 * Get credits summary for header display
 * Returns a quick overview of both AI and GMaps credits
 */
exports.getCreditsSummary = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    // Get AI credits
    const aiBreakdown = await stripeService.getAiCreditBreakdown(accountId);

    // Get GMaps credits
    const gmapsBreakdown = await stripeService.getCreditBreakdown(accountId);

    // Get subscription limits for monthly allocation
    const subscription = await subscriptionService.getStatus(accountId);
    const monthlyAiLimit = subscription?.limits?.monthlyAiCredits || 5000;
    const monthlyGmapsLimit = subscription?.limits?.monthlyGmapsCredits || 200;

    res.json({
      success: true,
      data: {
        ai: {
          total: aiBreakdown.total,
          monthly: aiBreakdown.monthly?.remaining || 0,
          permanent: aiBreakdown.permanent || 0,
          monthlyLimit: monthlyAiLimit,
          percentUsed: monthlyAiLimit > 0
            ? Math.round(((monthlyAiLimit - (aiBreakdown.monthly?.remaining || 0)) / monthlyAiLimit) * 100)
            : 0
        },
        gmaps: {
          total: gmapsBreakdown.total,
          monthly: gmapsBreakdown.expiring || 0,
          permanent: gmapsBreakdown.permanent || 0,
          monthlyLimit: monthlyGmapsLimit,
          percentUsed: monthlyGmapsLimit > 0
            ? Math.round(((monthlyGmapsLimit - (gmapsBreakdown.expiring || 0)) / monthlyGmapsLimit) * 100)
            : 0
        }
      }
    });
  } catch (error) {
    console.error('Error getting credits summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get credits summary'
    });
  }
};
