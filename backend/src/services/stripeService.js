/**
 * Stripe Service
 *
 * Wrapper for Stripe SDK operations
 * Handles customer creation, subscriptions, checkout sessions, and webhooks
 */

const { stripe, PLANS, ADDONS, CREDIT_PACKAGES, TRIAL_CONFIG, getPlanByPriceId } = require('../config/stripe');
const db = require('../config/database');

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
   * Create checkout session for subscription
   */
  async createCheckoutSession(options) {
    const {
      accountId,
      customerId,
      priceId,
      successUrl,
      cancelUrl,
      mode = 'subscription',
      trialDays = TRIAL_CONFIG.days,
      metadata = {}
    } = options;

    const sessionConfig = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        account_id: accountId,
        ...metadata
      },
      // Allow customer to change currency at checkout
      currency_options: {
        usd: { enabled: true },
        eur: { enabled: true },
        brl: { enabled: true }
      },
      // Allow promotion codes
      allow_promotion_codes: true,
      // Billing address collection
      billing_address_collection: 'auto'
    };

    // Add trial for subscriptions if not already subscribed
    if (mode === 'subscription' && trialDays > 0) {
      const hasSubscription = await this.hasActiveSubscription(accountId);
      if (!hasSubscription) {
        sessionConfig.subscription_data = {
          trial_period_days: trialDays,
          metadata: {
            account_id: accountId
          }
        };
      }
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return session;
  }

  /**
   * Create checkout session for one-time credit purchase
   */
  async createCreditsCheckoutSession(options) {
    const {
      accountId,
      customerId,
      packageKey,
      successUrl,
      cancelUrl
    } = options;

    const creditPackage = CREDIT_PACKAGES[packageKey];
    if (!creditPackage) {
      throw new Error(`Invalid credit package: ${packageKey}`);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: creditPackage.priceId,
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        account_id: accountId,
        credit_package: packageKey,
        credits: creditPackage.credits.toString(),
        validity_days: creditPackage.validityDays.toString()
      }
    });

    return session;
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
   * Add subscription item (add-on)
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
   * Get plan details from price ID
   */
  getPlanFromPriceId(priceId) {
    return getPlanByPriceId(priceId);
  }
}

module.exports = new StripeService();
