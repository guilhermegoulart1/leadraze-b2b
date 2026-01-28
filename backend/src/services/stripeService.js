/**
 * Stripe Service
 *
 * Wrapper for Stripe SDK operations
 * Handles customer creation, subscriptions, checkout sessions, and webhooks
 *
 * IMPORTANT: Pricing is now dynamic via pricingService.
 * Supports multiple currencies (BRL, USD, EUR) and custom pricing per account.
 *
 * @see migration 139_create_pricing_tables.sql
 * @see services/pricingService.js
 */

const {
  stripe,
  PLANS,
  ADDONS,
  CREDIT_PACKAGES,
  TRIAL_CONFIG,
  getPlanByPriceId,
  getAddonByPriceId,
  getCreditPackageByPriceId
} = require('../config/stripe');
const db = require('../config/database');
const pricingService = require('./pricingService');

// Helper to check if Stripe is in test mode
const isTestMode = () => {
  const key = process.env.STRIPE_SECRET_KEY || '';
  return key.startsWith('sk_test_');
};

// Helper to validate price ID matches the current mode
const validatePriceIdMode = (priceId, context = '') => {
  if (!priceId) return; // Skip validation if no price ID

  const testMode = isTestMode();
  // Price IDs from live mode contain the same structure but were created in live mode
  // We can't directly tell from the ID, but if Stripe returns 'resource_missing' with
  // "exists in live mode", we know there's a mismatch
  // This is a pre-check warning based on common patterns

  if (testMode) {
    console.log(`🔧 Stripe Mode: TEST | Using price: ${priceId} ${context ? `(${context})` : ''}`);
  }
};

class StripeService {
  /**
   * Create or get Stripe customer for an account
   */
  async getOrCreateCustomer(accountId, email, name) {
    // Check if customer already exists
    const accountResult = await db.query(
      'SELECT stripe_customer_id FROM accounts WHERE id = $1',
      [accountId]
    );

    if (accountResult.rows[0]?.stripe_customer_id) {
      return accountResult.rows[0].stripe_customer_id;
    }

    // Create new customer in Stripe
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        account_id: accountId
      }
    });

    // Save customer ID to account
    await db.query(
      'UPDATE accounts SET stripe_customer_id = $1 WHERE id = $2',
      [customer.id, accountId]
    );

    return customer.id;
  }

  /**
   * Create checkout session for subscription (Base plan + add-ons)
   * Uses dynamic pricing from pricingService based on account's pricing table
   */
  async createCheckoutSession(options) {
    const {
      accountId,
      customerId,
      priceId, // Optional: if provided, uses this; otherwise fetches from pricingService
      extraChannels = 0,
      extraUsers = 0,
      successUrl,
      cancelUrl,
      mode = 'subscription',
      trialDays = TRIAL_CONFIG.days,
      metadata = {}
    } = options;

    // Get pricing from pricingService if priceId not provided
    let basePlanPriceId = priceId;
    let channelPriceId = ADDONS.channel?.priceId;
    let userPriceId = ADDONS.user?.priceId;
    let currency = 'USD';

    if (accountId) {
      try {
        const pricing = await pricingService.getBillingPricing(accountId);
        currency = pricing.currency;

        if (!priceId && pricing.basePlan) {
          basePlanPriceId = pricing.basePlan.priceId;
        }
        if (pricing.addons.channel) {
          channelPriceId = pricing.addons.channel.priceId;
        }
        if (pricing.addons.user) {
          userPriceId = pricing.addons.user.priceId;
        }
      } catch (error) {
        console.warn('createCheckoutSession: pricingService lookup failed, using provided priceId', error.message);
      }
    }

    // Build line items array
    const lineItems = [
      {
        price: basePlanPriceId,
        quantity: 1
      }
    ];

    // Add extra channels if requested
    if (extraChannels > 0 && channelPriceId) {
      lineItems.push({
        price: channelPriceId,
        quantity: extraChannels
      });
    }

    // Add extra users if requested
    if (extraUsers > 0 && userPriceId) {
      lineItems.push({
        price: userPriceId,
        quantity: extraUsers
      });
    }

    const sessionConfig = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: lineItems,
      mode,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        account_id: accountId,
        extra_channels: extraChannels.toString(),
        extra_users: extraUsers.toString(),
        currency,
        ...metadata
      },
      // Billing address collection
      billing_address_collection: 'auto'
    };

    // Add subscription metadata with trial
    if (mode === 'subscription') {
      sessionConfig.subscription_data = {
        trial_period_days: trialDays,
        metadata: {
          account_id: accountId,
          extra_channels: extraChannels.toString(),
          extra_users: extraUsers.toString(),
          currency
        }
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return session;
  }

  /**
   * Create checkout session for GUEST (no account yet)
   * Stripe will collect customer email
   * Account will be created after successful payment via webhook
   * Uses dynamic pricing based on currency parameter
   */
  async createGuestCheckoutSession(options) {
    const {
      priceId,
      extraChannels = 0,
      extraUsers = 0,
      successUrl,
      cancelUrl,
      metadata = {},
      customerEmail,
      currency = 'BRL' // Default to BRL for new accounts
    } = options;

    // Get pricing from pricingService based on currency
    let basePlanPriceId = priceId;
    let channelPriceId = ADDONS.channel?.priceId;
    let userPriceId = ADDONS.user?.priceId;

    if (!priceId) {
      try {
        const basePlan = await pricingService.getProductPriceIdForGuest(currency, 'base_plan');
        basePlanPriceId = basePlan.priceId;

        const extraChannel = await pricingService.getProductPriceIdForGuest(currency, 'extra_channel');
        channelPriceId = extraChannel.priceId;

        const extraUser = await pricingService.getProductPriceIdForGuest(currency, 'extra_user');
        userPriceId = extraUser.priceId;
      } catch (error) {
        console.warn('createGuestCheckoutSession: pricingService lookup failed', error.message);
        throw new Error(`No pricing available for currency: ${currency}`);
      }
    }

    // Log mode for debugging
    validatePriceIdMode(basePlanPriceId, 'base plan');

    // Build line items array
    const lineItems = [
      {
        price: basePlanPriceId,
        quantity: 1
      }
    ];

    // Add extra channels if requested
    if (extraChannels > 0 && channelPriceId) {
      validatePriceIdMode(channelPriceId, 'extra channel');
      lineItems.push({
        price: channelPriceId,
        quantity: extraChannels
      });
    }

    // Add extra users if requested
    if (extraUsers > 0 && userPriceId) {
      validatePriceIdMode(userPriceId, 'extra user');
      lineItems.push({
        price: userPriceId,
        quantity: extraUsers
      });
    }

    const sessionConfig = {
      // NO customer - Stripe will automatically create one for subscription mode
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Pre-fill email if captured from Hero form
      ...(customerEmail && { customer_email: customerEmail }),
      // Collect phone number (required)
      phone_number_collection: {
        enabled: true
      },
      // Billing address collection (required - includes name)
      billing_address_collection: 'required',
      // Store metadata for webhook processing
      metadata: {
        is_guest: 'true',
        extra_channels: extraChannels.toString(),
        extra_users: extraUsers.toString(),
        currency,
        ...metadata
      },
      subscription_data: {
        trial_period_days: TRIAL_CONFIG.days,
        metadata: {
          is_guest: 'true',
          extra_channels: extraChannels.toString(),
          extra_users: extraUsers.toString(),
          currency,
          ...metadata
        }
      }
    };

    try {
      const session = await stripe.checkout.sessions.create(sessionConfig);
      return session;
    } catch (error) {
      // Check for live/test mode mismatch
      if (error.code === 'resource_missing' && error.message?.includes('exists in live mode')) {
        const mode = isTestMode() ? 'TEST' : 'LIVE';
        console.error(`❌ Stripe Mode Mismatch: Using ${mode} mode key but price ID exists in the other mode.`);
        console.error(`   Price ID: ${basePlanPriceId}`);
        console.error(`   Solution: Check pricing_tables in database or STRIPE_* env vars.`);
        error.userMessage = `Stripe configuration error: Price IDs don't match the API key mode (${mode}). Please contact support.`;
      }
      throw error;
    }
  }

  /**
   * Create checkout session for one-time credit purchase
   * Credits purchased this way NEVER expire
   * Uses dynamic pricing from pricingService based on account's pricing table
   */
  async createCreditsCheckoutSession(options) {
    const {
      accountId,
      customerId,
      packageKey, // Format: 'gmaps_500', 'gmaps_1000', 'ai_5000', etc.
      successUrl,
      cancelUrl
    } = options;

    // Parse packageKey to get creditType and amount
    const [creditType, creditsAmount] = packageKey.split('_');
    const productType = creditType === 'ai' ? 'credits_ai' : 'credits_gmaps';

    // Try to get pricing from pricingService
    let priceId;
    let credits;
    let currency = 'BRL';

    try {
      const priceInfo = await pricingService.getProductPriceId(accountId, productType, {
        creditsAmount: parseInt(creditsAmount)
      });
      priceId = priceInfo.priceId;
      credits = priceInfo.creditsAmount;
      currency = priceInfo.currency;
    } catch (error) {
      // Fallback to legacy CREDIT_PACKAGES
      console.warn('createCreditsCheckoutSession: pricingService lookup failed, using legacy', error.message);
      const creditPackage = CREDIT_PACKAGES[packageKey];
      if (!creditPackage) {
        throw new Error(`Invalid credit package: ${packageKey}`);
      }
      priceId = creditPackage.priceId;
      credits = creditPackage.credits;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        account_id: accountId,
        credit_package: packageKey,
        credits: credits.toString(),
        credit_type: creditType,
        currency,
        never_expires: 'true'  // One-time purchases never expire
      }
    });

    return session;
  }

  /**
   * Add credits to account after successful payment
   * @param {string} accountId - Account UUID
   * @param {number} credits - Number of credits
   * @param {boolean} neverExpires - If true, credits never expire
   * @param {string} source - Source of credits (purchase_onetime, subscription, bonus)
   * @param {object} stripeData - Stripe payment data for reference
   * @param {string} creditType - Type of credits ('gmaps' or 'ai')
   */
  async addCreditsToAccount(accountId, credits, neverExpires = false, source = 'purchase_onetime', stripeData = {}, creditType = 'gmaps') {
    const expiresAt = neverExpires
      ? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000) // 100 years
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // For monthly credits from subscription, use specific type
    const finalCreditType = source === 'subscription' ? `${creditType}_monthly` : creditType;

    const result = await db.query(`
      INSERT INTO credit_packages (
        account_id,
        stripe_payment_intent_id,
        stripe_checkout_session_id,
        credit_type,
        initial_credits,
        remaining_credits,
        expires_at,
        never_expires,
        status,
        source
      ) VALUES ($1, $2, $3, $4, $5, $5, $6, $7, 'active', $8)
      RETURNING id
    `, [
      accountId,
      stripeData.paymentIntentId || null,
      stripeData.checkoutSessionId || null,
      finalCreditType,
      credits,
      expiresAt,
      neverExpires,
      source
    ]);

    console.log(`✅ Added ${credits} ${creditType} credits to account ${accountId} (expires: ${neverExpires ? 'never' : expiresAt})`);

    return result.rows[0];
  }

  /**
   * Add AI credits to account after successful purchase
   * AI credits purchased separately NEVER expire
   */
  async addAiCreditsToAccount(accountId, credits, source = 'purchase', stripeData = {}) {
    return this.addCreditsToAccount(accountId, credits, true, source, stripeData, 'ai');
  }

  /**
   * Add monthly AI credits from subscription
   * These expire in 30 days
   */
  async addMonthlyAiCredits(accountId, credits = 5000) {
    return this.addCreditsToAccount(
      accountId,
      credits,
      false, // Monthly credits expire
      'subscription',
      {},
      'ai'
    );
  }

  /**
   * Get available AI credits for an account
   */
  async getAvailableAiCredits(accountId) {
    const result = await db.query(
      'SELECT get_available_ai_credits($1) as credits',
      [accountId]
    );
    return result.rows[0]?.credits || 0;
  }

  /**
   * Consume AI credits for an agent message
   */
  async consumeAiCredits(accountId, amount, agentId, conversationId, userId, description = null) {
    const result = await db.query(
      'SELECT consume_ai_credits($1, $2, $3, $4, $5, $6) as success',
      [accountId, amount, 'agent_message', conversationId, userId, description || `Agent ${agentId} sent message`]
    );
    return result.rows[0]?.success || false;
  }

  /**
   * Get AI credit breakdown for an account
   */
  async getAiCreditBreakdown(accountId) {
    const result = await db.query(`
      SELECT
        id,
        credit_type,
        initial_credits,
        remaining_credits,
        expires_at,
        never_expires,
        source,
        created_at,
        status
      FROM credit_packages
      WHERE account_id = $1
        AND credit_type IN ('ai', 'ai_monthly')
        AND status = 'active'
        AND (never_expires = true OR expires_at > NOW())
      ORDER BY
        CASE WHEN credit_type = 'ai_monthly' THEN 0 ELSE 1 END,
        expires_at ASC NULLS LAST
    `, [accountId]);

    const monthly = result.rows.filter(pkg => pkg.credit_type === 'ai_monthly');
    const permanent = result.rows.filter(pkg => pkg.credit_type === 'ai');

    return {
      packages: result.rows,
      total: result.rows.reduce((sum, pkg) => sum + pkg.remaining_credits, 0),
      monthly: {
        remaining: monthly.reduce((sum, pkg) => sum + pkg.remaining_credits, 0),
        expiresAt: monthly[0]?.expires_at || null
      },
      permanent: permanent.reduce((sum, pkg) => sum + pkg.remaining_credits, 0)
    };
  }

  /**
   * Get GMaps credit breakdown for an account
   */
  async getGmapsCreditBreakdown(accountId) {
    const result = await db.query(`
      SELECT
        id,
        credit_type,
        initial_credits,
        remaining_credits,
        expires_at,
        never_expires,
        source,
        created_at,
        status
      FROM credit_packages
      WHERE account_id = $1
        AND credit_type IN ('gmaps', 'gmaps_monthly')
        AND status = 'active'
        AND (never_expires = true OR expires_at > NOW())
      ORDER BY
        CASE WHEN credit_type = 'gmaps_monthly' THEN 0 ELSE 1 END,
        expires_at ASC NULLS LAST
    `, [accountId]);

    const monthly = result.rows.filter(pkg => pkg.credit_type === 'gmaps_monthly');
    const permanent = result.rows.filter(pkg => pkg.credit_type === 'gmaps');

    return {
      packages: result.rows,
      total: result.rows.reduce((sum, pkg) => sum + pkg.remaining_credits, 0),
      monthly: {
        remaining: monthly.reduce((sum, pkg) => sum + pkg.remaining_credits, 0),
        expiresAt: monthly[0]?.expires_at || null
      },
      permanent: permanent.reduce((sum, pkg) => sum + pkg.remaining_credits, 0)
    };
  }

  /**
   * Check if account has enough AI credits
   */
  async hasEnoughAiCredits(accountId, amount = 1) {
    const available = await this.getAvailableAiCredits(accountId);
    return available >= amount;
  }

  /**
   * Add monthly credits from subscription renewal
   */
  async addMonthlyCredits(accountId, credits) {
    return this.addCreditsToAccount(
      accountId,
      credits,
      false, // Monthly credits expire
      'subscription',
      {}
    );
  }

  /**
   * Create Stripe Customer Portal session
   */
  async createPortalSession(customerId, returnUrl) {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    });

    return session;
  }

  /**
   * Get subscription from Stripe
   */
  async getSubscription(subscriptionId) {
    return stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price.product', 'latest_invoice']
    });
  }

  /**
   * Update subscription (upgrade/downgrade)
   */
  async updateSubscription(subscriptionId, newPriceId, options = {}) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const updateData = {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId
        }
      ],
      proration_behavior: options.prorate ? 'create_prorations' : 'none'
    };

    return stripe.subscriptions.update(subscriptionId, updateData);
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId, immediate = false) {
    if (immediate) {
      return stripe.subscriptions.cancel(subscriptionId);
    }

    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true
    });
  }

  /**
   * Reactivate canceled subscription
   */
  async reactivateSubscription(subscriptionId) {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
    });
  }

  /**
   * Add subscription item (add-on: channel or user)
   */
  async addSubscriptionItem(subscriptionId, priceId, quantity = 1) {
    return stripe.subscriptionItems.create({
      subscription: subscriptionId,
      price: priceId,
      quantity
    });
  }

  /**
   * Update subscription item quantity
   */
  async updateSubscriptionItemQuantity(itemId, quantity) {
    return stripe.subscriptionItems.update(itemId, { quantity });
  }

  /**
   * Remove subscription item
   */
  async removeSubscriptionItem(itemId) {
    return stripe.subscriptionItems.del(itemId, {
      proration_behavior: 'create_prorations'
    });
  }

  /**
   * Get invoices for a customer
   */
  async getInvoices(customerId, limit = 10) {
    return stripe.invoices.list({
      customer: customerId,
      limit,
      expand: ['data.subscription']
    });
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    try {
      return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      throw new Error('Invalid webhook signature');
    }
  }

  /**
   * Check if account has active subscription
   */
  async hasActiveSubscription(accountId) {
    const result = await db.query(
      `SELECT id FROM subscriptions
       WHERE account_id = $1
       AND status IN ('active', 'trialing')`,
      [accountId]
    );
    return result.rows.length > 0;
  }

  /**
   * Get available credits for an account
   */
  async getAvailableCredits(accountId) {
    const result = await db.query(
      'SELECT get_available_credits($1, $2) as credits',
      [accountId, 'gmaps']
    );
    return result.rows[0]?.credits || 0;
  }

  /**
   * Get credit breakdown for an account
   */
  async getCreditBreakdown(accountId) {
    const result = await db.query(`
      SELECT
        id,
        credit_type,
        initial_credits,
        remaining_credits,
        expires_at,
        never_expires,
        source,
        purchased_at,
        status
      FROM credit_packages
      WHERE account_id = $1
        AND status = 'active'
        AND (never_expires = true OR expires_at > NOW())
      ORDER BY never_expires ASC, expires_at ASC
    `, [accountId]);

    return {
      packages: result.rows,
      total: result.rows.reduce((sum, pkg) => sum + pkg.remaining_credits, 0),
      expiring: result.rows.filter(pkg => !pkg.never_expires).reduce((sum, pkg) => sum + pkg.remaining_credits, 0),
      permanent: result.rows.filter(pkg => pkg.never_expires).reduce((sum, pkg) => sum + pkg.remaining_credits, 0)
    };
  }

  /**
   * Get customer's payment methods
   */
  async getCustomerPaymentMethods(customerId) {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card'
      });
      return paymentMethods.data;
    } catch (error) {
      console.error('Error getting payment methods:', error);
      return [];
    }
  }

  /**
   * Get customer's default payment method
   */
  async getDefaultPaymentMethod(customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (customer.invoice_settings?.default_payment_method) {
        return customer.invoice_settings.default_payment_method;
      }
      // Fallback: get first available payment method
      const paymentMethods = await this.getCustomerPaymentMethods(customerId);
      return paymentMethods.length > 0 ? paymentMethods[0].id : null;
    } catch (error) {
      console.error('Error getting default payment method:', error);
      return null;
    }
  }

  /**
   * Create subscription using existing payment method (for resubscription)
   * This allows users who canceled to resubscribe without entering card again
   * Uses dynamic pricing from pricingService based on account's pricing table
   */
  async createSubscriptionWithPaymentMethod(options) {
    const {
      accountId,
      customerId,
      paymentMethodId,
      priceId, // Optional: if provided, uses this; otherwise fetches from pricingService
      extraChannels = 0,
      extraUsers = 0,
      metadata = {}
    } = options;

    // Get pricing from pricingService if priceId not provided
    let basePlanPriceId = priceId;
    let channelPriceId = ADDONS.channel?.priceId;
    let userPriceId = ADDONS.user?.priceId;
    let currency = 'BRL';

    if (accountId && !priceId) {
      try {
        const pricing = await pricingService.getBillingPricing(accountId);
        currency = pricing.currency;
        basePlanPriceId = pricing.basePlan.priceId;
        if (pricing.addons.channel) {
          channelPriceId = pricing.addons.channel.priceId;
        }
        if (pricing.addons.user) {
          userPriceId = pricing.addons.user.priceId;
        }
      } catch (error) {
        console.warn('createSubscriptionWithPaymentMethod: pricingService lookup failed', error.message);
        throw new Error('Could not determine pricing for account');
      }
    }

    // Build items array
    const items = [{ price: basePlanPriceId }];

    // Add extra channels if requested
    if (extraChannels > 0 && channelPriceId) {
      items.push({
        price: channelPriceId,
        quantity: extraChannels
      });
    }

    // Add extra users if requested
    if (extraUsers > 0 && userPriceId) {
      items.push({
        price: userPriceId,
        quantity: extraUsers
      });
    }

    // Set the payment method as default for the customer
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    // Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items,
      default_payment_method: paymentMethodId,
      trial_period_days: TRIAL_CONFIG.days,
      metadata: {
        ...metadata,
        account_id: accountId,
        extra_channels: extraChannels.toString(),
        extra_users: extraUsers.toString(),
        currency
      },
      expand: ['latest_invoice.payment_intent']
    });

    return subscription;
  }

  /**
   * Get plan details from price ID
   */
  getPlanFromPriceId(priceId) {
    return getPlanByPriceId(priceId);
  }

  /**
   * Get addon details from price ID
   */
  getAddonFromPriceId(priceId) {
    return getAddonByPriceId(priceId);
  }

  /**
   * Get credit package details from price ID
   */
  getCreditPackageFromPriceId(priceId) {
    return getCreditPackageByPriceId(priceId);
  }
}

module.exports = new StripeService();
