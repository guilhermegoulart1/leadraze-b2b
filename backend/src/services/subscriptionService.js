/**
 * Subscription Service
 *
 * Manages subscription records in the database
 */

const db = require('../config/database');
const { PLANS, getPlan, getPlanByPriceId, TRIAL_LIMITS } = require('../config/stripe');
const stripeService = require('./stripeService');
const billingService = require('./billingService');

class SubscriptionService {
  /**
   * Get subscription for an account
   */
  async getSubscription(accountId) {
    const result = await db.query(
      `SELECT s.*, a.stripe_customer_id
       FROM subscriptions s
       JOIN accounts a ON a.id = s.account_id
       WHERE s.account_id = $1`,
      [accountId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get subscription by Stripe subscription ID
   */
  async getByStripeId(stripeSubscriptionId) {
    const result = await db.query(
      'SELECT * FROM subscriptions WHERE stripe_subscription_id = $1',
      [stripeSubscriptionId]
    );
    return result.rows[0] || null;
  }

  /**
   * Create or update subscription from Stripe data
   */
  async syncFromStripe(stripeSubscription, accountId) {
    const planInfo = getPlanByPriceId(stripeSubscription.items.data[0]?.price?.id);
    const planType = planInfo?.slug || 'base';
    const planLimits = PLANS[planType]?.limits || PLANS.base.limits;

    const data = {
      account_id: accountId,
      stripe_customer_id: stripeSubscription.customer,
      stripe_subscription_id: stripeSubscription.id,
      stripe_price_id: stripeSubscription.items.data[0]?.price?.id,
      plan_type: planType,
      status: stripeSubscription.status,
      current_period_start: new Date(stripeSubscription.current_period_start * 1000),
      current_period_end: new Date(stripeSubscription.current_period_end * 1000),
      trial_start: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
      trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
      cancel_at_period_end: stripeSubscription.cancel_at_period_end,
      canceled_at: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
      ended_at: stripeSubscription.ended_at ? new Date(stripeSubscription.ended_at * 1000) : null,
      max_channels: planLimits.maxChannels,
      max_users: planLimits.maxUsers,
      monthly_gmaps_credits: planLimits.monthlyGmapsCredits,
      monthly_ai_credits: planLimits.monthlyAiCredits || 5000,
      metadata: stripeSubscription.metadata || {}
    };

    // Upsert subscription
    const result = await db.query(
      `INSERT INTO subscriptions (
        account_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
        plan_type, status, current_period_start, current_period_end,
        trial_start, trial_end, cancel_at_period_end, canceled_at, ended_at,
        max_channels, max_users, monthly_gmaps_credits, monthly_ai_credits, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (account_id) DO UPDATE SET
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        stripe_price_id = EXCLUDED.stripe_price_id,
        plan_type = EXCLUDED.plan_type,
        status = EXCLUDED.status,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        trial_start = EXCLUDED.trial_start,
        trial_end = EXCLUDED.trial_end,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        canceled_at = EXCLUDED.canceled_at,
        ended_at = EXCLUDED.ended_at,
        max_channels = EXCLUDED.max_channels,
        max_users = EXCLUDED.max_users,
        monthly_gmaps_credits = EXCLUDED.monthly_gmaps_credits,
        monthly_ai_credits = EXCLUDED.monthly_ai_credits,
        metadata = EXCLUDED.metadata,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        data.account_id, data.stripe_customer_id, data.stripe_subscription_id,
        data.stripe_price_id, data.plan_type, data.status,
        data.current_period_start, data.current_period_end,
        data.trial_start, data.trial_end, data.cancel_at_period_end,
        data.canceled_at, data.ended_at, data.max_channels,
        data.max_users, data.monthly_gmaps_credits, data.monthly_ai_credits, JSON.stringify(data.metadata)
      ]
    );

    // Update account subscription status
    await db.query(
      'UPDATE accounts SET subscription_status = $1 WHERE id = $2',
      [data.status, accountId]
    );

    return result.rows[0];
  }

  /**
   * Handle subscription deletion
   */
  async handleDeletion(stripeSubscriptionId) {
    const subscription = await this.getByStripeId(stripeSubscriptionId);
    if (!subscription) return null;

    await db.query(
      `UPDATE subscriptions
       SET status = 'canceled',
           ended_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE stripe_subscription_id = $1`,
      [stripeSubscriptionId]
    );

    await db.query(
      'UPDATE accounts SET subscription_status = $1 WHERE id = $2',
      ['canceled', subscription.account_id]
    );

    return subscription;
  }

  /**
   * Get subscription items (add-ons)
   */
  async getSubscriptionItems(subscriptionId) {
    const result = await db.query(
      'SELECT * FROM subscription_items WHERE subscription_id = $1 AND is_active = true',
      [subscriptionId]
    );
    return result.rows;
  }

  /**
   * Sync subscription item from Stripe
   */
  async syncSubscriptionItem(stripeItem, subscriptionId, addonType) {
    const result = await db.query(
      `INSERT INTO subscription_items (
        subscription_id, stripe_subscription_item_id, stripe_price_id,
        addon_type, quantity
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (stripe_subscription_item_id) DO UPDATE SET
        quantity = EXCLUDED.quantity,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [subscriptionId, stripeItem.id, stripeItem.price.id, addonType, stripeItem.quantity]
    );
    return result.rows[0];
  }

  /**
   * Remove subscription item
   */
  async removeSubscriptionItem(stripeItemId) {
    await db.query(
      'UPDATE subscription_items SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE stripe_subscription_item_id = $1',
      [stripeItemId]
    );
  }

  /**
   * Calculate total limits (base plan + add-ons)
   */
  async calculateLimits(accountId) {
    const subscription = await this.getSubscription(accountId);
    if (!subscription) {
      // Return base plan limits as default for users without subscription
      return PLANS.base.limits;
    }

    const items = await this.getSubscriptionItems(subscription.id);

    let totalChannels = subscription.max_channels;
    let totalUsers = subscription.max_users;

    for (const item of items) {
      if (item.addon_type === 'channel') {
        totalChannels += item.quantity;
      } else if (item.addon_type === 'user') {
        totalUsers += item.quantity;
      }
    }

    return {
      maxChannels: totalChannels,
      maxUsers: totalUsers,
      monthlyGmapsCredits: subscription.monthly_gmaps_credits,
      monthlyAiCredits: subscription.monthly_ai_credits || 5000
    };
  }

  /**
   * Check subscription status
   */
  async isActive(accountId) {
    const subscription = await this.getSubscription(accountId);
    if (!subscription) return false;
    return ['active', 'trialing'].includes(subscription.status);
  }

  /**
   * Get days until trial ends
   */
  async getDaysUntilTrialEnd(accountId) {
    const subscription = await this.getSubscription(accountId);
    if (!subscription || subscription.status !== 'trialing' || !subscription.trial_end) {
      return null;
    }

    const now = new Date();
    const trialEnd = new Date(subscription.trial_end);
    const diffTime = trialEnd - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }

  /**
   * Get days until data deletion (30 days after cancellation)
   */
  async getDaysUntilDataDeletion(accountId) {
    const subscription = await this.getSubscription(accountId);
    if (!subscription || subscription.status !== 'canceled') {
      return null;
    }

    const canceledAt = new Date(subscription.canceled_at || subscription.ended_at);
    const deletionDate = new Date(canceledAt);
    deletionDate.setDate(deletionDate.getDate() + 30);

    const now = new Date();
    const diffTime = deletionDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }

  /**
   * Get subscription status for frontend
   */
  async getStatus(accountId) {
    // ============================================
    // TEMPORARY BYPASS - Remove after testing
    // All users get full access temporarily
    // ============================================
    const TEMPORARY_BYPASS = false;

    if (TEMPORARY_BYPASS) {
      const usage = await billingService.getCurrentUsage(accountId);
      return {
        status: 'active',
        planType: 'professional',
        planName: 'Professional',
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        trialEnd: null,
        cancelAtPeriodEnd: false,
        daysUntilTrialEnd: null,
        daysUntilDeletion: null,
        canEdit: true,
        blockLevel: 'none',
        limits: {
          maxChannels: 100,
          maxUsers: 100,
          monthlyGmapsCredits: 10000
        },
        usage,
        message: null
      };
    }
    // ============================================

    const subscription = await this.getSubscription(accountId);
    const usage = await billingService.getCurrentUsage(accountId);
    const limits = await this.calculateLimits(accountId);

    if (!subscription) {
      return {
        status: 'none',
        planType: 'free',
        canEdit: true,
        blockLevel: 'none',
        limits,
        usage,
        message: null
      };
    }

    const daysUntilTrialEnd = await this.getDaysUntilTrialEnd(accountId);
    const daysUntilDeletion = await this.getDaysUntilDataDeletion(accountId);

    let blockLevel = 'none';
    let canEdit = true;
    let message = null;

    switch (subscription.status) {
      case 'trialing':
        if (daysUntilTrialEnd !== null && daysUntilTrialEnd <= 3) {
          blockLevel = 'warning';
          message = `Trial ends in ${daysUntilTrialEnd} days`;
        }
        break;

      case 'active':
        // Check if limits exceeded
        if (usage.users > limits.maxUsers || usage.channels > limits.maxChannels) {
          blockLevel = 'soft_block';
          canEdit = false;
          message = 'Plan limits exceeded. Please upgrade.';
        }
        break;

      case 'past_due':
        blockLevel = 'soft_block';
        canEdit = false;
        message = 'Payment failed. Please update your payment method.';
        break;

      case 'canceled':
        blockLevel = 'soft_block';
        canEdit = false;
        message = `Subscription canceled. Data will be deleted in ${daysUntilDeletion} days.`;
        break;

      case 'unpaid':
      case 'incomplete_expired':
        blockLevel = 'hard_block';
        canEdit = false;
        message = 'Account suspended. Please contact support.';
        break;
    }

    // Determine if user is on trial
    const isTrial = subscription.status === 'trialing';

    // For trial users, override limits with trial limits
    const effectiveLimits = isTrial ? {
      ...limits,
      maxChannels: TRIAL_LIMITS.maxChannels  // 0 for trial
    } : limits;

    return {
      status: subscription.status,
      planType: subscription.plan_type,
      planName: PLANS[subscription.plan_type]?.name || 'Unknown',
      currentPeriodEnd: subscription.current_period_end,
      trialEnd: subscription.trial_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      daysUntilTrialEnd,
      daysUntilDeletion,
      canEdit,
      blockLevel,
      limits: effectiveLimits,
      usage,
      message,
      // Trial-specific fields
      isTrial,
      trialDaysRemaining: isTrial ? daysUntilTrialEnd : null,
      trialFeatures: isTrial ? TRIAL_LIMITS.features : null
    };
  }
}

module.exports = new SubscriptionService();
