/**
 * Billing Service
 *
 * Manages credits, usage, and billing-related operations
 */

const db = require('../config/database');
const { PLANS, CREDIT_PACKAGES } = require('../config/stripe');

class BillingService {
  /**
   * Get available credits for an account
   */
  async getAvailableCredits(accountId, creditType = 'gmaps') {
    const result = await db.query(
      'SELECT get_available_credits($1, $2) as credits',
      [accountId, creditType]
    );
    return result.rows[0]?.credits || 0;
  }

  /**
   * Consume credits (uses FIFO from database function)
   */
  async consumeCredits(accountId, creditType, amount, context = {}) {
    const { resourceType, resourceId, userId, description } = context;

    const result = await db.query(
      'SELECT consume_credits($1, $2, $3, $4, $5, $6, $7) as success',
      [accountId, creditType, amount, resourceType || null, resourceId || null, userId || null, description || null]
    );

    return result.rows[0]?.success || false;
  }

  /**
   * Check if account has enough credits
   */
  async hasEnoughCredits(accountId, creditType, amount) {
    const available = await this.getAvailableCredits(accountId, creditType);
    return available >= amount;
  }

  /**
   * Add credit package (after purchase or subscription renewal)
   */
  async addCreditPackage(options) {
    const {
      accountId,
      creditType,
      credits,
      validityDays = 30,
      source = 'purchase',
      stripePaymentIntentId = null,
      stripeCheckoutSessionId = null,
      pricePaidCents = null,
      currency = 'USD'
    } = options;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validityDays);

    const result = await db.query(
      `INSERT INTO credit_packages (
        account_id, credit_type, initial_credits, remaining_credits,
        expires_at, source, stripe_payment_intent_id, stripe_checkout_session_id,
        price_paid_cents, currency
      ) VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        accountId, creditType, credits, expiresAt, source,
        stripePaymentIntentId, stripeCheckoutSessionId, pricePaidCents, currency
      ]
    );

    return result.rows[0];
  }

  /**
   * Add monthly credits from subscription
   */
  async addMonthlyCredits(accountId, planType) {
    const plan = PLANS[planType];
    if (!plan) return null;

    // Expire old monthly credits
    await db.query(
      `UPDATE credit_packages
       SET status = 'expired'
       WHERE account_id = $1
       AND credit_type = 'gmaps_monthly'
       AND status = 'active'`,
      [accountId]
    );

    // Add new monthly credits
    return this.addCreditPackage({
      accountId,
      creditType: 'gmaps_monthly',
      credits: plan.limits.monthlyGmapsCredits,
      validityDays: 30,
      source: 'subscription'
    });
  }

  /**
   * Get credit usage history
   */
  async getCreditUsageHistory(accountId, options = {}) {
    const { limit = 50, offset = 0, creditType = null } = options;

    let query = `
      SELECT
        cu.*,
        cp.credit_type as package_type,
        cp.expires_at as package_expires_at
      FROM credit_usage cu
      LEFT JOIN credit_packages cp ON cu.credit_package_id = cp.id
      WHERE cu.account_id = $1
    `;
    const params = [accountId];

    if (creditType) {
      query += ` AND cu.credit_type = $${params.length + 1}`;
      params.push(creditType);
    }

    query += ` ORDER BY cu.used_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get all credit packages for an account
   */
  async getCreditPackages(accountId, includeExpired = false) {
    let query = `
      SELECT * FROM credit_packages
      WHERE account_id = $1
    `;

    if (!includeExpired) {
      query += ` AND status = 'active' AND expires_at > NOW()`;
    }

    query += ` ORDER BY expires_at ASC`;

    const result = await db.query(query, [accountId]);
    return result.rows;
  }

  /**
   * Get billing summary for an account
   */
  async getBillingSummary(accountId) {
    const result = await db.query(
      'SELECT * FROM account_billing_summary WHERE account_id = $1',
      [accountId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get current usage for an account
   */
  async getCurrentUsage(accountId) {
    const [users, channels, credits] = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM users WHERE account_id = $1', [accountId]),
      db.query('SELECT COUNT(*) as count FROM linkedin_accounts WHERE account_id = $1', [accountId]),
      this.getAvailableCredits(accountId, 'gmaps')
    ]);

    return {
      users: parseInt(users.rows[0]?.count || 0),
      channels: parseInt(channels.rows[0]?.count || 0),
      gmapsCredits: credits
    };
  }

  /**
   * Check if account can add more users
   */
  async canAddUser(accountId) {
    const summary = await this.getBillingSummary(accountId);
    if (!summary) return false;

    const maxUsers = summary.max_users + summary.extra_users;
    return summary.current_users < maxUsers;
  }

  /**
   * Check if account can add more channels
   */
  async canAddChannel(accountId) {
    const summary = await this.getBillingSummary(accountId);
    if (!summary) return false;

    const maxChannels = summary.max_channels + summary.extra_channels;
    return summary.current_channels < maxChannels;
  }

  /**
   * Expire old credits (called by scheduled job)
   */
  async expireOldCredits() {
    const result = await db.query('SELECT expire_old_credits() as count');
    return result.rows[0]?.count || 0;
  }

  /**
   * Get credit package by checkout session ID
   */
  async getCreditPackageByCheckoutSession(sessionId) {
    const result = await db.query(
      'SELECT * FROM credit_packages WHERE stripe_checkout_session_id = $1',
      [sessionId]
    );
    return result.rows[0] || null;
  }
}

module.exports = new BillingService();
