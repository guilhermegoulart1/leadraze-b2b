/**
 * Admin Pricing Controller
 *
 * Handles admin operations for pricing tables management
 * Supports multi-currency (BRL, USD, EUR) and custom pricing per account
 */

const pricingService = require('../services/pricingService');

/**
 * List all pricing tables
 * GET /api/admin/pricing/tables
 */
exports.listPricingTables = async (req, res) => {
  try {
    const { currency, is_active, is_default } = req.query;

    const filters = {};
    if (currency) filters.currency = currency;
    if (is_active !== undefined) filters.is_active = is_active === 'true';
    if (is_default !== undefined) filters.is_default = is_default === 'true';

    const tables = await pricingService.listPricingTables(filters);

    res.json({
      success: true,
      data: tables
    });
  } catch (error) {
    console.error('Error listing pricing tables:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar pricing tables'
    });
  }
};

/**
 * Get pricing table by ID
 * GET /api/admin/pricing/tables/:id
 */
exports.getPricingTable = async (req, res) => {
  try {
    const { id } = req.params;

    const table = await pricingService.getPricingTableById(id);

    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Pricing table não encontrada'
      });
    }

    res.json({
      success: true,
      data: table
    });
  } catch (error) {
    console.error('Error getting pricing table:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar pricing table'
    });
  }
};

/**
 * Create new pricing table
 * POST /api/admin/pricing/tables
 */
exports.createPricingTable = async (req, res) => {
  try {
    const { name, slug, description, currency, is_default, metadata } = req.body;

    if (!name || !slug || !currency) {
      return res.status(400).json({
        success: false,
        message: 'Nome, slug e currency são obrigatórios'
      });
    }

    const table = await pricingService.createPricingTable({
      name,
      slug,
      description,
      currency,
      is_default,
      metadata
    });

    res.status(201).json({
      success: true,
      data: table,
      message: 'Pricing table criada com sucesso'
    });
  } catch (error) {
    console.error('Error creating pricing table:', error);

    // Check for unique constraint violation
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Já existe uma pricing table com esse slug'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro ao criar pricing table'
    });
  }
};

/**
 * Update pricing table
 * PUT /api/admin/pricing/tables/:id
 */
exports.updatePricingTable = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_active, is_default, metadata } = req.body;

    const table = await pricingService.updatePricingTable(id, {
      name,
      description,
      is_active,
      is_default,
      metadata
    });

    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Pricing table não encontrada'
      });
    }

    res.json({
      success: true,
      data: table,
      message: 'Pricing table atualizada com sucesso'
    });
  } catch (error) {
    console.error('Error updating pricing table:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro ao atualizar pricing table'
    });
  }
};

/**
 * Delete pricing table
 * DELETE /api/admin/pricing/tables/:id
 */
exports.deletePricingTable = async (req, res) => {
  try {
    const { id } = req.params;

    await pricingService.deletePricingTable(id);

    res.json({
      success: true,
      message: 'Pricing table deletada com sucesso'
    });
  } catch (error) {
    console.error('Error deleting pricing table:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro ao deletar pricing table'
    });
  }
};

/**
 * Get pricing table items
 * GET /api/admin/pricing/tables/:id/items
 */
exports.getPricingTableItems = async (req, res) => {
  try {
    const { id } = req.params;

    const items = await pricingService.getPricingTableItems(id);

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Error getting pricing table items:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar itens da pricing table'
    });
  }
};

/**
 * Add item to pricing table
 * POST /api/admin/pricing/tables/:id/items
 */
exports.addPricingTableItem = async (req, res) => {
  try {
    const { id } = req.params;
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
    } = req.body;

    if (!product_type || !stripe_price_id || !name || !price_cents || !billing_type) {
      return res.status(400).json({
        success: false,
        message: 'product_type, stripe_price_id, name, price_cents e billing_type são obrigatórios'
      });
    }

    const item = await pricingService.addPricingTableItem(id, {
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
    });

    res.status(201).json({
      success: true,
      data: item,
      message: 'Item adicionado com sucesso'
    });
  } catch (error) {
    console.error('Error adding pricing table item:', error);

    // Check for unique constraint violation
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Este produto já existe nesta pricing table'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro ao adicionar item'
    });
  }
};

/**
 * Update pricing table item
 * PUT /api/admin/pricing/items/:itemId
 */
exports.updatePricingTableItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const {
      stripe_product_id,
      stripe_price_id,
      name,
      description,
      price_cents,
      display_order,
      is_active
    } = req.body;

    const item = await pricingService.updatePricingTableItem(itemId, {
      stripe_product_id,
      stripe_price_id,
      name,
      description,
      price_cents,
      display_order,
      is_active
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item não encontrado'
      });
    }

    res.json({
      success: true,
      data: item,
      message: 'Item atualizado com sucesso'
    });
  } catch (error) {
    console.error('Error updating pricing table item:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar item'
    });
  }
};

/**
 * Delete pricing table item
 * DELETE /api/admin/pricing/items/:itemId
 */
exports.deletePricingTableItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    await pricingService.deletePricingTableItem(itemId);

    res.json({
      success: true,
      message: 'Item deletado com sucesso'
    });
  } catch (error) {
    console.error('Error deleting pricing table item:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar item'
    });
  }
};

/**
 * Get accounts with custom pricing
 * GET /api/admin/pricing/accounts
 */
exports.getAccountsWithCustomPricing = async (req, res) => {
  try {
    const accounts = await pricingService.getAccountsWithCustomPricing();

    res.json({
      success: true,
      data: accounts
    });
  } catch (error) {
    console.error('Error getting accounts with custom pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar contas com pricing customizado'
    });
  }
};

/**
 * Assign pricing table to account
 * POST /api/admin/pricing/accounts/:accountId
 */
exports.assignPricingTableToAccount = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { pricing_table_id, reason } = req.body;

    if (!pricing_table_id) {
      return res.status(400).json({
        success: false,
        message: 'pricing_table_id é obrigatório'
      });
    }

    const assignment = await pricingService.assignPricingTableToAccount(
      accountId,
      pricing_table_id,
      req.user?.id,
      reason
    );

    res.json({
      success: true,
      data: assignment,
      message: 'Pricing table atribuída com sucesso'
    });
  } catch (error) {
    console.error('Error assigning pricing table to account:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atribuir pricing table'
    });
  }
};

/**
 * Remove pricing table from account (revert to default)
 * DELETE /api/admin/pricing/accounts/:accountId
 */
exports.removePricingTableFromAccount = async (req, res) => {
  try {
    const { accountId } = req.params;

    await pricingService.removePricingTableFromAccount(accountId);

    res.json({
      success: true,
      message: 'Pricing table removida. Conta usará pricing default.'
    });
  } catch (error) {
    console.error('Error removing pricing table from account:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao remover pricing table da conta'
    });
  }
};

/**
 * Get accounts using a specific pricing table
 * GET /api/admin/pricing/tables/:id/accounts
 */
exports.getAccountsUsingPricingTable = async (req, res) => {
  try {
    const { id } = req.params;

    const accounts = await pricingService.getAccountsWithPricingTable(id);

    res.json({
      success: true,
      data: accounts
    });
  } catch (error) {
    console.error('Error getting accounts using pricing table:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar contas usando esta pricing table'
    });
  }
};

/**
 * Update account currency preference
 * PUT /api/admin/pricing/accounts/:accountId/currency
 */
exports.updateAccountCurrency = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { currency } = req.body;

    if (!currency || !['BRL', 'USD', 'EUR'].includes(currency)) {
      return res.status(400).json({
        success: false,
        message: 'Currency inválida. Use BRL, USD ou EUR.'
      });
    }

    await pricingService.updateAccountCurrency(accountId, currency);

    res.json({
      success: true,
      message: `Currency da conta atualizada para ${currency}`
    });
  } catch (error) {
    console.error('Error updating account currency:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar currency da conta'
    });
  }
};
