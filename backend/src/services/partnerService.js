/**
 * Partner Service
 *
 * Manages partners, referrals, earnings and account access
 */

const db = require('../config/database');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

class PartnerService {
  /**
   * Generate a unique affiliate code
   */
  generateAffiliateCode() {
    return 'P' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  /**
   * Hash password
   */
  async hashPassword(password) {
    return bcrypt.hash(password, 10);
  }

  /**
   * Compare password
   */
  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  // ==========================================
  // REGISTRATION & AUTH
  // ==========================================

  /**
   * Register a new partner (status = pending)
   */
  async register(data) {
    const { name, email, phone, type, country } = data;

    // Check if email already exists
    const existing = await db.query(
      'SELECT id FROM partners WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existing.rows[0]) {
      throw new Error('Email já cadastrado');
    }

    const result = await db.query(
      `INSERT INTO partners (name, email, phone, type, country, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [name, email.toLowerCase(), phone, type, country]
    );

    return result.rows[0];
  }

  /**
   * Get partner by email
   */
  async getByEmail(email) {
    const result = await db.query(
      'SELECT * FROM partners WHERE email = $1',
      [email.toLowerCase()]
    );
    return result.rows[0] || null;
  }

  /**
   * Get partner by ID
   */
  async getById(id) {
    const result = await db.query(
      'SELECT * FROM partners WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get partner by affiliate code
   */
  async getByAffiliateCode(code) {
    const result = await db.query(
      'SELECT * FROM partners WHERE affiliate_code = $1 AND status = $2',
      [code.toUpperCase(), 'approved']
    );
    return result.rows[0] || null;
  }

  /**
   * Set partner password (after approval)
   */
  async setPassword(partnerId, password) {
    const hash = await this.hashPassword(password);

    const result = await db.query(
      `UPDATE partners
       SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [hash, partnerId]
    );

    return result.rows[0];
  }

  /**
   * Validate partner login
   */
  async validateLogin(email, password) {
    const partner = await this.getByEmail(email);

    if (!partner) {
      return null;
    }

    if (partner.status !== 'approved') {
      throw new Error('Conta não aprovada');
    }

    if (!partner.password_hash) {
      throw new Error('Senha não definida. Verifique seu email.');
    }

    const valid = await this.comparePassword(password, partner.password_hash);
    if (!valid) {
      return null;
    }

    return partner;
  }

  // ==========================================
  // ADMIN OPERATIONS
  // ==========================================

  /**
   * List partners with filters
   */
  async list(options = {}) {
    const { status, page = 1, limit = 20, search } = options;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM partners WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Count total
    let countQuery = 'SELECT COUNT(*) FROM partners WHERE 1=1';
    const countParams = [];
    let countIndex = 1;

    if (status) {
      countQuery += ` AND status = $${countIndex++}`;
      countParams.push(status);
    }

    if (search) {
      countQuery += ` AND (name ILIKE $${countIndex} OR email ILIKE $${countIndex})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await db.query(countQuery, countParams);

    return {
      partners: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit
    };
  }

  /**
   * Approve partner
   */
  async approve(partnerId, approvedBy) {
    // Generate unique affiliate code
    let code = this.generateAffiliateCode();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const codeExists = await db.query(
        'SELECT id FROM partners WHERE affiliate_code = $1',
        [code]
      );

      if (!codeExists.rows[0]) {
        break;
      }

      code = this.generateAffiliateCode();
      attempts++;
    }

    const result = await db.query(
      `UPDATE partners
       SET status = 'approved',
           affiliate_code = $1,
           approved_at = CURRENT_TIMESTAMP,
           approved_by = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND status = 'pending'
       RETURNING *`,
      [code, approvedBy, partnerId]
    );

    return result.rows[0] || null;
  }

  /**
   * Reject partner
   */
  async reject(partnerId) {
    const result = await db.query(
      `UPDATE partners
       SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [partnerId]
    );

    return result.rows[0] || null;
  }

  /**
   * Suspend partner
   */
  async suspend(partnerId) {
    const result = await db.query(
      `UPDATE partners
       SET status = 'suspended', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'approved'
       RETURNING *`,
      [partnerId]
    );

    return result.rows[0] || null;
  }

  /**
   * Reactivate partner
   */
  async reactivate(partnerId) {
    const result = await db.query(
      `UPDATE partners
       SET status = 'approved', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'suspended'
       RETURNING *`,
      [partnerId]
    );

    return result.rows[0] || null;
  }

  /**
   * Delete partner
   */
  async delete(partnerId) {
    const result = await db.query(
      'DELETE FROM partners WHERE id = $1 RETURNING *',
      [partnerId]
    );

    return result.rows[0] || null;
  }

  // ==========================================
  // CLICK TRACKING
  // ==========================================

  /**
   * Track a click on partner affiliate link
   */
  async trackClick(code) {
    const result = await db.query(
      `UPDATE partners
       SET clicks = clicks + 1, updated_at = CURRENT_TIMESTAMP
       WHERE affiliate_code = $1 AND status = 'approved'
       RETURNING *`,
      [code.toUpperCase()]
    );

    return result.rows[0] || null;
  }

  // ==========================================
  // REFERRALS
  // ==========================================

  /**
   * Create a referral when someone starts checkout with partner code
   */
  async createReferral(partnerId, referredEmail, checkoutSessionId) {
    // Check if referral already exists for this email
    const existing = await db.query(
      'SELECT id FROM partner_referrals WHERE referred_email = $1',
      [referredEmail]
    );

    if (existing.rows[0]) {
      // Update existing referral with checkout session
      await db.query(
        `UPDATE partner_referrals
         SET stripe_checkout_session_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE referred_email = $2`,
        [checkoutSessionId, referredEmail]
      );
      return existing.rows[0];
    }

    // Create new referral
    const result = await db.query(
      `INSERT INTO partner_referrals (
        partner_id, referred_email, stripe_checkout_session_id, status
      ) VALUES ($1, $2, $3, 'pending')
      RETURNING *`,
      [partnerId, referredEmail, checkoutSessionId]
    );

    return result.rows[0];
  }

  /**
   * Convert referral when payment is confirmed
   */
  async convertReferral(referredAccountId, subscriptionId) {
    // Get account email from owner user
    const accountResult = await db.query(
      'SELECT email FROM users WHERE account_id = $1 AND role = $2 LIMIT 1',
      [referredAccountId, 'owner']
    );

    if (!accountResult.rows[0]) {
      return null;
    }

    const result = await db.query(
      `UPDATE partner_referrals
       SET referred_account_id = $1,
           stripe_subscription_id = $2,
           status = 'converted',
           converted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE (referred_account_id = $1 OR referred_email = $3) AND status = 'pending'
       RETURNING *`,
      [referredAccountId, subscriptionId, accountResult.rows[0].email]
    );

    return result.rows[0] || null;
  }

  /**
   * Get active referral for an account
   */
  async getActiveReferralByAccount(referredAccountId) {
    const result = await db.query(
      `SELECT pr.*, p.name as partner_name, p.email as partner_email, p.affiliate_code
       FROM partner_referrals pr
       JOIN partners p ON p.id = pr.partner_id
       WHERE pr.referred_account_id = $1 AND pr.status = 'converted'`,
      [referredAccountId]
    );

    return result.rows[0] || null;
  }

  /**
   * Cancel referral when account cancels subscription
   */
  async cancelReferral(referredAccountId) {
    const result = await db.query(
      `UPDATE partner_referrals
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
   * Get referrals for a partner
   */
  async getReferrals(partnerId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT
        pr.id,
        pr.referred_email,
        pr.status,
        pr.converted_at,
        pr.canceled_at,
        pr.created_at,
        COALESCE(SUM(pe.earning_cents), 0) as total_earnings_cents
       FROM partner_referrals pr
       LEFT JOIN partner_earnings pe ON pe.referral_id = pr.id
       WHERE pr.partner_id = $1
       GROUP BY pr.id
       ORDER BY pr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [partnerId, limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) FROM partner_referrals WHERE partner_id = $1',
      [partnerId]
    );

    return {
      referrals: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit
    };
  }

  // ==========================================
  // EARNINGS
  // ==========================================

  /**
   * Record an earning when referred account pays
   */
  async recordEarning(referralId, stripeInvoiceId, invoiceAmountCents, commissionPercent = 10) {
    // Check if earning already recorded for this invoice
    const existing = await db.query(
      'SELECT id FROM partner_earnings WHERE stripe_invoice_id = $1',
      [stripeInvoiceId]
    );

    if (existing.rows[0]) {
      return null; // Already recorded
    }

    // Get referral details
    const referral = await db.query(
      'SELECT * FROM partner_referrals WHERE id = $1',
      [referralId]
    );

    if (!referral.rows[0]) {
      throw new Error('Referral not found');
    }

    const earningCents = Math.floor(invoiceAmountCents * (commissionPercent / 100));

    const result = await db.query(
      `INSERT INTO partner_earnings (
        partner_id, referral_id, stripe_invoice_id,
        invoice_amount_cents, commission_percent, earning_cents
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        referral.rows[0].partner_id,
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
   * Get earnings for a partner
   */
  async getEarnings(partnerId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT
        pe.*,
        pr.referred_email
       FROM partner_earnings pe
       JOIN partner_referrals pr ON pr.id = pe.referral_id
       WHERE pe.partner_id = $1
       ORDER BY pe.created_at DESC
       LIMIT $2 OFFSET $3`,
      [partnerId, limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) FROM partner_earnings WHERE partner_id = $1',
      [partnerId]
    );

    return {
      earnings: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit
    };
  }

  // ==========================================
  // STATS
  // ==========================================

  /**
   * Get partner stats for dashboard
   */
  async getStats(partnerId) {
    const partner = await this.getById(partnerId);

    if (!partner) {
      throw new Error('Partner not found');
    }

    // Get referral counts
    const referralsResult = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'converted') as converted_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'canceled') as canceled_count
       FROM partner_referrals
       WHERE partner_id = $1`,
      [partnerId]
    );

    const referralCounts = referralsResult.rows[0];

    // Get total earnings
    const earningsResult = await db.query(
      `SELECT
        COALESCE(SUM(earning_cents), 0) as total_earnings_cents
       FROM partner_earnings
       WHERE partner_id = $1`,
      [partnerId]
    );

    const totalEarningsCents = earningsResult.rows[0]?.total_earnings_cents || 0;

    // Get monthly earnings
    const monthlyResult = await db.query(
      `SELECT
        COALESCE(SUM(earning_cents), 0) as monthly_earnings_cents
       FROM partner_earnings
       WHERE partner_id = $1
         AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
      [partnerId]
    );

    const monthlyEarningsCents = monthlyResult.rows[0]?.monthly_earnings_cents || 0;

    return {
      link: {
        code: partner.affiliate_code,
        clicks: partner.clicks,
        created_at: partner.created_at
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

  // ==========================================
  // ACCOUNT ACCESS
  // ==========================================

  /**
   * Grant access to an account
   */
  async grantAccess(partnerId, accountId, grantedBy) {
    // Check if partner exists and is approved
    const partner = await this.getById(partnerId);
    if (!partner || partner.status !== 'approved') {
      throw new Error('Partner não encontrado ou não aprovado');
    }

    // Check if access already exists
    const existing = await db.query(
      'SELECT * FROM partner_account_access WHERE partner_id = $1 AND account_id = $2',
      [partnerId, accountId]
    );

    if (existing.rows[0]) {
      if (existing.rows[0].is_active) {
        throw new Error('Acesso já concedido');
      }

      // Reactivate access
      const result = await db.query(
        `UPDATE partner_account_access
         SET is_active = true,
             granted_by = $1,
             granted_at = CURRENT_TIMESTAMP,
             revoked_at = NULL,
             revoked_by = NULL
         WHERE partner_id = $2 AND account_id = $3
         RETURNING *`,
        [grantedBy, partnerId, accountId]
      );

      return result.rows[0];
    }

    // Create new access
    const result = await db.query(
      `INSERT INTO partner_account_access (partner_id, account_id, granted_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [partnerId, accountId, grantedBy]
    );

    return result.rows[0];
  }

  /**
   * Revoke access to an account
   */
  async revokeAccess(partnerId, accountId, revokedBy) {
    const result = await db.query(
      `UPDATE partner_account_access
       SET is_active = false,
           revoked_at = CURRENT_TIMESTAMP,
           revoked_by = $1
       WHERE partner_id = $2 AND account_id = $3 AND is_active = true
       RETURNING *`,
      [revokedBy, partnerId, accountId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get accounts a partner has access to
   */
  async getAccessibleAccounts(partnerId) {
    const result = await db.query(
      `SELECT
        paa.*,
        a.name as account_name,
        a.email as account_email
       FROM partner_account_access paa
       JOIN accounts a ON a.id = paa.account_id
       WHERE paa.partner_id = $1 AND paa.is_active = true
       ORDER BY paa.granted_at DESC`,
      [partnerId]
    );

    return result.rows;
  }

  /**
   * Get partners with access to an account
   */
  async getPartnersWithAccess(accountId) {
    const result = await db.query(
      `SELECT
        paa.*,
        p.name as partner_name,
        p.email as partner_email,
        p.type as partner_type
       FROM partner_account_access paa
       JOIN partners p ON p.id = paa.partner_id
       WHERE paa.account_id = $1 AND paa.is_active = true
       ORDER BY paa.granted_at DESC`,
      [accountId]
    );

    return result.rows;
  }

  /**
   * Check if partner has access to account
   */
  async hasAccess(partnerId, accountId) {
    const result = await db.query(
      `SELECT id FROM partner_account_access
       WHERE partner_id = $1 AND account_id = $2 AND is_active = true`,
      [partnerId, accountId]
    );

    return !!result.rows[0];
  }

  /**
   * Get partner by email for granting access
   */
  async getApprovedPartnerByEmail(email) {
    const result = await db.query(
      'SELECT id, name, email, type FROM partners WHERE email = $1 AND status = $2',
      [email.toLowerCase(), 'approved']
    );
    return result.rows[0] || null;
  }
}

module.exports = new PartnerService();
