/**
 * Affiliate Service
 *
 * Manages affiliate links, referrals, and commission earnings
 */

const db = require('../config/database');
const crypto = require('crypto');

class AffiliateService {
  /**
   * Generate a unique affiliate code
   */
  generateCode() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  /**
   * Get or create affiliate link for an account
   */
  async getOrCreateAffiliateLink(accountId) {
    // Check if link already exists
    const existing = await db.query(
      'SELECT * FROM affiliate_links WHERE account_id = $1',
      [accountId]
    );

    if (existing.rows[0]) {
      return existing.rows[0];
    }

    // Generate unique code
    let code = this.generateCode();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const codeExists = await db.query(
        'SELECT id FROM affiliate_links WHERE code = $1',
        [code]
      );

      if (!codeExists.rows[0]) {
        break;
      }

      code = this.generateCode();
      attempts++;
    }

    // Create new affiliate link
    const result = await db.query(
      `INSERT INTO affiliate_links (account_id, code)
       VALUES ($1, $2)
       RETURNING *`,
      [accountId, code]
    );

    return result.rows[0];
  }

  /**
   * Get affiliate link by code
   */
  async getAffiliateLinkByCode(code) {
    const result = await db.query(
      `SELECT al.*, a.name as account_name
       FROM affiliate_links al
       JOIN accounts a ON a.id = al.account_id
       WHERE al.code = $1 AND al.is_active = true`,
      [code.toUpperCase()]
    );

    return result.rows[0] || null;
  }

  /**
   * Track a click on affiliate link
   */
  async trackClick(code) {
    const result = await db.query(
      `UPDATE affiliate_links
       SET clicks = clicks + 1, updated_at = CURRENT_TIMESTAMP
       WHERE code = $1 AND is_active = true
       RETURNING *`,
      [code.toUpperCase()]
    );

    return result.rows[0] || null;
  }

  /**
   * Create a referral when someone starts checkout with affiliate code
   */
  async createReferral(affiliateLinkId, referredEmail, checkoutSessionId) {
    // Get affiliate link details
    const linkResult = await db.query(
      'SELECT * FROM affiliate_links WHERE id = $1',
      [affiliateLinkId]
    );

    const link = linkResult.rows[0];
    if (!link) {
      throw new Error('Affiliate link not found');
    }

    // Check if referral already exists for this email
    const existing = await db.query(
      'SELECT id FROM referrals WHERE referred_email = $1',
      [referredEmail]
    );

    if (existing.rows[0]) {
      // Update existing referral with checkout session
      await db.query(
        `UPDATE referrals
         SET stripe_checkout_session_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE referred_email = $2`,
        [checkoutSessionId, referredEmail]
      );
      return existing.rows[0];
    }

    // Create new referral
    const result = await db.query(
      `INSERT INTO referrals (
        affiliate_account_id, affiliate_link_id, referred_email,
        stripe_checkout_session_id, status
      ) VALUES ($1, $2, $3, $4, 'pending')
      RETURNING *`,
      [link.account_id, affiliateLinkId, referredEmail, checkoutSessionId]
    );

    return result.rows[0];
  }

  /**
   * Convert referral when payment is confirmed
   */
  async convertReferral(referredAccountId, subscriptionId) {
    const result = await db.query(
      `UPDATE referrals
       SET referred_account_id = $1,
           stripe_subscription_id = $2,
           status = 'converted',
           converted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE referred_account_id = $1 OR
             (referred_email = (SELECT email FROM accounts WHERE id = $1) AND status = 'pending')
       RETURNING *`,
      [referredAccountId, subscriptionId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get active referral for an account (to check if they were referred)
   */
  async getActiveReferralByAccount(referredAccountId) {
    const result = await db.query(
      `SELECT r.*, al.code as affiliate_code
       FROM referrals r
       JOIN affiliate_links al ON al.id = r.affiliate_link_id
       WHERE r.referred_account_id = $1 AND r.status = 'converted'`,
      [referredAccountId]
    );

    return result.rows[0] || null;
  }

  /**
   * Record an earning when referred account pays
   */
  async recordEarning(referralId, stripeInvoiceId, invoiceAmountCents, commissionPercent = 10) {
    // Check if earning already recorded for this invoice
    const existing = await db.query(
      'SELECT id FROM affiliate_earnings WHERE stripe_invoice_id = $1',
      [stripeInvoiceId]
    );

    if (existing.rows[0]) {
      return null; // Already recorded
    }

    // Get referral details
    const referral = await db.query(
      'SELECT * FROM referrals WHERE id = $1',
      [referralId]
    );

    if (!referral.rows[0]) {
      throw new Error('Referral not found');
    }

    const earningCents = Math.floor(invoiceAmountCents * (commissionPercent / 100));

    const result = await db.query(
      `INSERT INTO affiliate_earnings (
        affiliate_account_id, referral_id, stripe_invoice_id,
        invoice_amount_cents, commission_percent, earning_cents
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        referral.rows[0].affiliate_account_id,
        referralId,
        stripeInvoiceId,
        invoiceAmountCents,
        commissionPercent,
        earningCents
      ]
    );

    return result.rows[0];
  }

  /**
   * Cancel referral when referred account cancels subscription
   */
  async cancelReferral(referredAccountId) {
    const result = await db.query(
      `UPDATE referrals
       SET status = 'canceled',
           canceled_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE referred_account_id = $1 AND status = 'converted'
       RETURNING *`,
      [referredAccountId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get affiliate stats for dashboard
   */
  async getAffiliateStats(accountId) {
    // Get affiliate link
    const link = await this.getOrCreateAffiliateLink(accountId);

    // Get referral counts
    const referralsResult = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'converted') as converted_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'canceled') as canceled_count
       FROM referrals
       WHERE affiliate_account_id = $1`,
      [accountId]
    );

    const referralCounts = referralsResult.rows[0];

    // Get total earnings
    const earningsResult = await db.query(
      `SELECT
        COALESCE(SUM(earning_cents), 0) as total_earnings_cents
       FROM affiliate_earnings
       WHERE affiliate_account_id = $1`,
      [accountId]
    );

    const totalEarningsCents = earningsResult.rows[0]?.total_earnings_cents || 0;

    // Get monthly earnings (current month)
    const monthlyResult = await db.query(
      `SELECT
        COALESCE(SUM(earning_cents), 0) as monthly_earnings_cents
       FROM affiliate_earnings
       WHERE affiliate_account_id = $1
         AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
      [accountId]
    );

    const monthlyEarningsCents = monthlyResult.rows[0]?.monthly_earnings_cents || 0;

    return {
      link: {
        code: link.code,
        clicks: link.clicks,
        is_active: link.is_active,
        created_at: link.created_at
      },
      referrals: {
        converted: parseInt(referralCounts.converted_count) || 0,
        pending: parseInt(referralCounts.pending_count) || 0,
        canceled: parseInt(referralCounts.canceled_count) || 0
      },
      earnings: {
        total_cents: parseInt(totalEarningsCents),
        monthly_cents: parseInt(monthlyEarningsCents)
      }
    };
  }

  /**
   * Get referrals list for an affiliate
   */
  async getReferrals(accountId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT
        r.id,
        r.referred_email,
        r.status,
        r.converted_at,
        r.canceled_at,
        r.created_at,
        COALESCE(SUM(ae.earning_cents), 0) as total_earnings_cents
       FROM referrals r
       LEFT JOIN affiliate_earnings ae ON ae.referral_id = r.id
       WHERE r.affiliate_account_id = $1
       GROUP BY r.id
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [accountId, limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) FROM referrals WHERE affiliate_account_id = $1',
      [accountId]
    );

    return {
      referrals: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit
    };
  }

  /**
   * Get earnings history for an affiliate
   */
  async getEarnings(accountId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT
        ae.*,
        r.referred_email
       FROM affiliate_earnings ae
       JOIN referrals r ON r.id = ae.referral_id
       WHERE ae.affiliate_account_id = $1
       ORDER BY ae.created_at DESC
       LIMIT $2 OFFSET $3`,
      [accountId, limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) FROM affiliate_earnings WHERE affiliate_account_id = $1',
      [accountId]
    );

    return {
      earnings: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit
    };
  }
}

module.exports = new AffiliateService();
