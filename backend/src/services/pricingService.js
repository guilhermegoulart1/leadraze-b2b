/**
 * Pricing Service
 *
 * Manages dynamic pricing tables per account and currency
 * Supports multiple currencies (BRL, USD, EUR) and custom pricing per account
 */

const db = require('../config/database');

class PricingService {
  /**
   * Get pricing table for an account
   * Falls back to default pricing table for account's currency
   * @param {string} accountId - Account UUID
   * @returns {object} Pricing table with items
   */
  async getPricingTableForAccount(accountId) {
    // Check if account has custom pricing table assigned
    const customResult = await db.query(`
      SELECT pt.*
      FROM account_pricing_tables apt
      JOIN pricing_tables pt ON pt.id = apt.pricing_table_id
      WHERE apt.account_id = $1
        AND pt.is_active = true
    `, [accountId]);

    if (customResult.rows.length > 0) {
      const pricingTable = customResult.rows[0];
      pricingTable.items = await this.getPricingTableItems(pricingTable.id);
      return pricingTable;
    }

    // Get account's preferred currency
    const accountResult = await db.query(
      'SELECT preferred_currency FROM accounts WHERE id = $1',
      [accountId]
    );

    const currency = accountResult.rows[0]?.preferred_currency || 'BRL';

    // Get default pricing table for currency
    return this.getDefaultPricingTable(currency);
  }

  /**
   * Get default pricing table for a currency
   * @param {string} currency - Currency code (BRL, USD, EUR)
   * @returns {object} Pricing table with items
   */
  async getDefaultPricingTable(currency = 'BRL') {
    const result = await db.query(`
      SELECT * FROM pricing_tables
      WHERE currency = $1 AND is_default = true AND is_active = true
    `, [currency]);

    if (result.rows.length === 0) {
      // Fallback to BRL if currency not found
      const fallbackResult = await db.query(`
        SELECT * FROM pricing_tables
        WHERE currency = 'BRL' AND is_default = true AND is_active = true
      `);

      if (fallbackResult.rows.length === 0) {
        throw new Error(`No default pricing table found for currency: ${currency}`);
      }

      const pricingTable = fallbackResult.rows[0];
      pricingTable.items = await this.getPricingTableItems(pricingTable.id);
      return pricingTable;
    }

    const pricingTable = result.rows[0];
    pricingTable.items = await this.getPricingTableItems(pricingTable.id);
    return pricingTable;
  }

  /**
   * Get pricing table by ID
   * @param {string} pricingTableId - Pricing table UUID
   * @returns {object} Pricing table with items
   */
  async getPricingTableById(pricingTableId) {
    const result = await db.query(
      'SELECT * FROM pricing_tables WHERE id = $1',
      [pricingTableId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const pricingTable = result.rows[0];
    pricingTable.items = await this.getPricingTableItems(pricingTable.id);
    return pricingTable;
  }

  /**
   * Get pricing table by slug
   * @param {string} slug - Pricing table slug
   * @returns {object} Pricing table with items
   */
  async getPricingTableBySlug(slug) {
    const result = await db.query(
      'SELECT * FROM pricing_tables WHERE slug = $1',
      [slug]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const pricingTable = result.rows[0];
    pricingTable.items = await this.getPricingTableItems(pricingTable.id);
    return pricingTable;
  }

  /**
   * Get all items for a pricing table
   * @param {string} pricingTableId - Pricing table UUID
   * @returns {array} Array of pricing items
   */
  async getPricingTableItems(pricingTableId) {
    const result = await db.query(`
      SELECT * FROM pricing_table_items
      WHERE pricing_table_id = $1 AND is_active = true
      ORDER BY display_order ASC
    `, [pricingTableId]);

    return result.rows;
  }

  /**
   * Get specific product price ID for an account
   * @param {string} accountId - Account UUID
   * @param {string} productType - Product type (base_plan, extra_channel, extra_user, credits_gmaps, credits_ai)
   * @param {object} options - Additional options (creditsAmount for credit packages)
   * @returns {object} Price item with stripe_price_id
   */
  async getProductPriceId(accountId, productType, options = {}) {
    const pricingTable = await this.getPricingTableForAccount(accountId);

    let item;
    if (productType === 'credits_gmaps' || productType === 'credits_ai') {
      // For credit packages, also match by credits_amount
      item = pricingTable.items.find(
        i => i.product_type === productType && i.credits_amount === options.creditsAmount
      );
    } else {
      item = pricingTable.items.find(i => i.product_type === productType);
    }

    if (!item) {
      throw new Error(`Product type ${productType} not found in pricing table`);
    }

    return {
      priceId: item.stripe_price_id,
      priceCents: item.price_cents,
      currency: pricingTable.currency,
      name: item.name,
      description: item.description,
      billingType: item.billing_type,
      billingInterval: item.billing_interval,
      creditsAmount: item.credits_amount
    };
  }

  /**
   * Get product price ID for guest (no account)
   * Uses default pricing table for currency
   * @param {string} currency - Currency code
   * @param {string} productType - Product type
   * @param {object} options - Additional options
   * @returns {object} Price item
   */
  async getProductPriceIdForGuest(currency, productType, options = {}) {
    const pricingTable = await this.getDefaultPricingTable(currency);

    let item;
    if (productType === 'credits_gmaps' || productType === 'credits_ai') {
      item = pricingTable.items.find(
        i => i.product_type === productType && i.credits_amount === options.creditsAmount
      );
    } else {
      item = pricingTable.items.find(i => i.product_type === productType);
    }

    if (!item) {
      throw new Error(`Product type ${productType} not found in pricing table for currency ${currency}`);
    }

    return {
      priceId: item.stripe_price_id,
      priceCents: item.price_cents,
      currency: pricingTable.currency,
      name: item.name,
      description: item.description,
      billingType: item.billing_type,
      billingInterval: item.billing_interval,
      creditsAmount: item.credits_amount
    };
  }

  /**
   * Get all available credit packages for an account
   * @param {string} accountId - Account UUID
   * @param {string} creditType - 'gmaps' or 'ai'
   * @returns {array} Array of credit packages
   */
  async getCreditPackagesForAccount(accountId, creditType = 'gmaps') {
    const pricingTable = await this.getPricingTableForAccount(accountId);
    const productType = creditType === 'ai' ? 'credits_ai' : 'credits_gmaps';

    return pricingTable.items
      .filter(item => item.product_type === productType)
      .map(item => ({
        key: `${creditType}_${item.credits_amount}`,
        priceId: item.stripe_price_id,
        name: item.name,
        description: item.description,
        price: item.price_cents,
        credits: item.credits_amount,
        currency: pricingTable.currency,
        billingType: item.billing_type
      }));
  }

  /**
   * Assign pricing table to account
   * @param {string} accountId - Account UUID
   * @param {string} pricingTableId - Pricing table UUID
   * @param {string} assignedBy - User UUID who assigned
   * @param {string} reason - Reason for assignment
   */
  async assignPricingTableToAccount(accountId, pricingTableId, assignedBy = null, reason = null) {
    // Remove existing assignment
    await db.query(
      'DELETE FROM account_pricing_tables WHERE account_id = $1',
      [accountId]
    );

    // Create new assignment
    const result = await db.query(`
      INSERT INTO account_pricing_tables (account_id, pricing_table_id, assigned_by, reason)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [accountId, pricingTableId, assignedBy, reason]);

    return result.rows[0];
  }

  /**
   * Remove pricing table assignment from account
   * Account will use default pricing
   */
  async removePricingTableFromAccount(accountId) {
    await db.query(
      'DELETE FROM account_pricing_tables WHERE account_id = $1',
      [accountId]
    );
  }

  /**
   * Update account's preferred currency
   */
  async updateAccountCurrency(accountId, currency) {
    await db.query(
      'UPDATE accounts SET preferred_currency = $1 WHERE id = $2',
      [currency, accountId]
    );
  }

  // ============================================
  // Admin Methods
  // ============================================

  /**
   * List all pricing tables
   * @param {object} filters - Optional filters (currency, is_active, is_default)
   * @returns {array} Array of pricing tables
   */
  async listPricingTables(filters = {}) {
    let query = 'SELECT * FROM pricing_tables WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.currency) {
      query += ` AND currency = $${paramIndex++}`;
      params.push(filters.currency);
    }

    if (filters.is_active !== undefined) {
      query += ` AND is_active = $${paramIndex++}`;
      params.push(filters.is_active);
    }

    if (filters.is_default !== undefined) {
      query += ` AND is_default = $${paramIndex++}`;
      params.push(filters.is_default);
    }

    query += ' ORDER BY currency ASC, is_default DESC, name ASC';

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Create new pricing table
   * @param {object} data - Pricing table data
   * @returns {object} Created pricing table
   */
  async createPricingTable(data) {
    const { name, slug, description, currency, is_default, metadata } = data;

    // If setting as default, unset other defaults for this currency
    if (is_default) {
      await db.query(
        'UPDATE pricing_tables SET is_default = false WHERE currency = $1',
        [currency]
      );
    }

    const result = await db.query(`
      INSERT INTO pricing_tables (name, slug, description, currency, is_default, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, slug, description, currency || 'BRL', is_default || false, metadata || {}]);

    return result.rows[0];
  }

  /**
   * Update pricing table
   * @param {string} id - Pricing table UUID
   * @param {object} data - Updated data
   * @returns {object} Updated pricing table
   */
  async updatePricingTable(id, data) {
    const { name, description, is_active, is_default, metadata } = data;

    // Get current pricing table to check currency
    const current = await this.getPricingTableById(id);
    if (!current) {
      throw new Error('Pricing table not found');
    }

    // If setting as default, unset other defaults for this currency
    if (is_default) {
      await db.query(
        'UPDATE pricing_tables SET is_default = false WHERE currency = $1 AND id != $2',
        [current.currency, id]
      );
    }

    const result = await db.query(`
      UPDATE pricing_tables
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          is_active = COALESCE($3, is_active),
          is_default = COALESCE($4, is_default),
          metadata = COALESCE($5, metadata),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [name, description, is_active, is_default, metadata, id]);

    return result.rows[0];
  }

  /**
   * Delete pricing table
   * Only allowed if no accounts are using it
   */
  async deletePricingTable(id) {
    // Check if any accounts are using this pricing table
    const usageResult = await db.query(
      'SELECT COUNT(*) as count FROM account_pricing_tables WHERE pricing_table_id = $1',
      [id]
    );

    if (parseInt(usageResult.rows[0].count) > 0) {
      throw new Error('Cannot delete pricing table: accounts are still using it');
    }

    // Delete items first (cascade should handle this, but being explicit)
    await db.query('DELETE FROM pricing_table_items WHERE pricing_table_id = $1', [id]);

    // Delete pricing table
    await db.query('DELETE FROM pricing_tables WHERE id = $1', [id]);
  }

  /**
   * Add item to pricing table
   */
  async addPricingTableItem(pricingTableId, itemData) {
    const {
      product_type,
      stripe_product_id,
      stripe_price_id,
      name,
      description,
      price_cents,
      billing_type,
      billing_interval,
      credits_amount,
      display_order
    } = itemData;

    const result = await db.query(`
      INSERT INTO pricing_table_items (
        pricing_table_id, product_type, stripe_product_id, stripe_price_id,
        name, description, price_cents, billing_type, billing_interval,
        credits_amount, display_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      pricingTableId, product_type, stripe_product_id, stripe_price_id,
      name, description, price_cents, billing_type, billing_interval,
      credits_amount, display_order || 0
    ]);

    return result.rows[0];
  }

  /**
   * Update pricing table item
   */
  async updatePricingTableItem(itemId, itemData) {
    const {
      stripe_product_id,
      stripe_price_id,
      name,
      description,
      price_cents,
      display_order,
      is_active
    } = itemData;

    const result = await db.query(`
      UPDATE pricing_table_items
      SET stripe_product_id = COALESCE($1, stripe_product_id),
          stripe_price_id = COALESCE($2, stripe_price_id),
          name = COALESCE($3, name),
          description = COALESCE($4, description),
          price_cents = COALESCE($5, price_cents),
          display_order = COALESCE($6, display_order),
          is_active = COALESCE($7, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [stripe_product_id, stripe_price_id, name, description, price_cents, display_order, is_active, itemId]);

    return result.rows[0];
  }

  /**
   * Delete pricing table item
   */
  async deletePricingTableItem(itemId) {
    await db.query('DELETE FROM pricing_table_items WHERE id = $1', [itemId]);
  }

  /**
   * Get accounts using a specific pricing table
   */
  async getAccountsWithPricingTable(pricingTableId) {
    const result = await db.query(`
      SELECT
        a.id,
        a.name,
        a.company_name,
        a.preferred_currency,
        apt.assigned_at,
        apt.reason,
        u.name as assigned_by_name
      FROM account_pricing_tables apt
      JOIN accounts a ON a.id = apt.account_id
      LEFT JOIN users u ON u.id = apt.assigned_by
      WHERE apt.pricing_table_id = $1
      ORDER BY apt.assigned_at DESC
    `, [pricingTableId]);

    return result.rows;
  }

  /**
   * Get all accounts with custom pricing (not using default)
   */
  async getAccountsWithCustomPricing() {
    const result = await db.query(`
      SELECT
        a.id,
        a.name,
        a.company_name,
        a.preferred_currency,
        pt.name as pricing_table_name,
        pt.slug as pricing_table_slug,
        pt.currency as pricing_currency,
        apt.assigned_at,
        apt.reason
      FROM account_pricing_tables apt
      JOIN accounts a ON a.id = apt.account_id
      JOIN pricing_tables pt ON pt.id = apt.pricing_table_id
      ORDER BY apt.assigned_at DESC
    `);

    return result.rows;
  }

  // ============================================
  // Lookup Methods (for webhook processing)
  // ============================================

  /**
   * Get plan details from Stripe price ID
   * Searches all pricing tables
   */
  async getPlanByPriceId(priceId) {
    const result = await db.query(`
      SELECT pti.*, pt.currency, pt.slug as pricing_table_slug
      FROM pricing_table_items pti
      JOIN pricing_tables pt ON pt.id = pti.pricing_table_id
      WHERE pti.stripe_price_id = $1
        AND pti.product_type = 'base_plan'
    `, [priceId]);

    if (result.rows.length === 0) {
      return null;
    }

    const item = result.rows[0];
    return {
      slug: 'base',
      name: item.name,
      priceIdMonthly: item.stripe_price_id,
      priceMonthly: item.price_cents,
      currency: item.currency,
      pricingTableSlug: item.pricing_table_slug,
      limits: {
        maxChannels: 1,
        maxUsers: 2,
        monthlyGmapsCredits: 200,
        monthlyAiCredits: 5000
      }
    };
  }

  /**
   * Get addon details from Stripe price ID
   */
  async getAddonByPriceId(priceId) {
    const result = await db.query(`
      SELECT pti.*, pt.currency
      FROM pricing_table_items pti
      JOIN pricing_tables pt ON pt.id = pti.pricing_table_id
      WHERE pti.stripe_price_id = $1
        AND pti.product_type IN ('extra_channel', 'extra_user')
    `, [priceId]);

    if (result.rows.length === 0) {
      return null;
    }

    const item = result.rows[0];
    const key = item.product_type === 'extra_channel' ? 'channel' : 'user';

    return {
      key,
      name: item.name,
      slug: item.product_type.replace('extra_', '') + '-extra',
      priceId: item.stripe_price_id,
      price: item.price_cents,
      currency: item.currency,
      billingType: 'recurring',
      unit: item.product_type.replace('extra_', '')
    };
  }

  /**
   * Get credit package details from Stripe price ID
   */
  async getCreditPackageByPriceId(priceId) {
    const result = await db.query(`
      SELECT pti.*, pt.currency
      FROM pricing_table_items pti
      JOIN pricing_tables pt ON pt.id = pti.pricing_table_id
      WHERE pti.stripe_price_id = $1
        AND pti.product_type IN ('credits_gmaps', 'credits_ai')
    `, [priceId]);

    if (result.rows.length === 0) {
      return null;
    }

    const item = result.rows[0];
    const creditType = item.product_type === 'credits_ai' ? 'ai' : 'gmaps';

    return {
      key: `${creditType}_${item.credits_amount}`,
      name: item.name,
      slug: `${creditType}-credits-${item.credits_amount}`,
      priceId: item.stripe_price_id,
      price: item.price_cents,
      credits: item.credits_amount,
      creditType,
      currency: item.currency,
      expires: false,
      billingType: 'onetime'
    };
  }

  /**
   * Get pricing info for display on billing page
   * Returns all products with their prices for an account
   */
  async getBillingPricing(accountId) {
    const pricingTable = await this.getPricingTableForAccount(accountId);

    const basePlan = pricingTable.items.find(i => i.product_type === 'base_plan');
    const extraChannel = pricingTable.items.find(i => i.product_type === 'extra_channel');
    const extraUser = pricingTable.items.find(i => i.product_type === 'extra_user');
    const gmapsPackages = pricingTable.items.filter(i => i.product_type === 'credits_gmaps');
    const aiPackages = pricingTable.items.filter(i => i.product_type === 'credits_ai');

    return {
      currency: pricingTable.currency,
      pricingTableId: pricingTable.id,
      pricingTableSlug: pricingTable.slug,
      basePlan: basePlan ? {
        priceId: basePlan.stripe_price_id,
        price: basePlan.price_cents,
        name: basePlan.name,
        description: basePlan.description
      } : null,
      addons: {
        channel: extraChannel ? {
          priceId: extraChannel.stripe_price_id,
          price: extraChannel.price_cents,
          name: extraChannel.name
        } : null,
        user: extraUser ? {
          priceId: extraUser.stripe_price_id,
          price: extraUser.price_cents,
          name: extraUser.name
        } : null
      },
      creditPackages: {
        gmaps: gmapsPackages.map(pkg => ({
          key: `gmaps_${pkg.credits_amount}`,
          priceId: pkg.stripe_price_id,
          price: pkg.price_cents,
          credits: pkg.credits_amount,
          name: pkg.name
        })),
        ai: aiPackages.map(pkg => ({
          key: `ai_${pkg.credits_amount}`,
          priceId: pkg.stripe_price_id,
          price: pkg.price_cents,
          credits: pkg.credits_amount,
          name: pkg.name
        }))
      }
    };
  }
}

module.exports = new PricingService();
