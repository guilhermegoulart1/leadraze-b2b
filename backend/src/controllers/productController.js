const db = require('../config/database');

// Get all products for the account
exports.getProducts = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { active_only } = req.query;

    let query = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.default_price,
        p.currency,
        p.time_unit,
        p.payment_conditions,
        p.is_active,
        p.created_by,
        p.created_at,
        p.updated_at,
        u.name as created_by_name
      FROM products p
      LEFT JOIN users u ON u.id = p.created_by
      WHERE p.account_id = $1
    `;

    const params = [accountId];

    if (active_only === 'true') {
      query += ' AND p.is_active = true';
    }

    query += ' ORDER BY p.name ASC';

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: {
        products: result.rows
      }
    });
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar produtos',
      error: error.message
    });
  }
};

// Get a single product by ID
exports.getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    const query = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.default_price,
        p.currency,
        p.time_unit,
        p.payment_conditions,
        p.is_active,
        p.created_by,
        p.created_at,
        p.updated_at,
        u.name as created_by_name
      FROM products p
      LEFT JOIN users u ON u.id = p.created_by
      WHERE p.id = $1 AND p.account_id = $2
    `;

    const result = await db.query(query, [id, accountId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produto nao encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        product: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error getting product:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar produto',
      error: error.message
    });
  }
};

// Create a new product
exports.createProduct = async (req, res) => {
  const { name, description, default_price, currency, time_unit, payment_conditions } = req.body;
  const userId = req.user.id;
  const accountId = req.user.account_id;

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Nome do produto e obrigatorio'
    });
  }

  try {
    // Check if product with same name already exists in this account
    const checkQuery = 'SELECT id FROM products WHERE LOWER(name) = LOWER($1) AND account_id = $2';
    const checkResult = await db.query(checkQuery, [name.trim(), accountId]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ja existe um produto com este nome'
      });
    }

    const query = `
      INSERT INTO products (account_id, name, description, default_price, currency, time_unit, payment_conditions, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, description, default_price, currency, time_unit, payment_conditions, is_active, created_at, updated_at
    `;

    const result = await db.query(query, [
      accountId,
      name.trim(),
      description || null,
      default_price || 0,
      currency || 'BRL',
      time_unit || null,
      payment_conditions || null,
      userId
    ]);

    res.status(201).json({
      success: true,
      data: {
        product: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar produto',
      error: error.message
    });
  }
};

// Update a product
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, description, default_price, currency, time_unit, payment_conditions, is_active } = req.body;
  const accountId = req.user.account_id;

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Nome do produto e obrigatorio'
    });
  }

  try {
    // Check if product exists and belongs to this account
    const existsQuery = 'SELECT id FROM products WHERE id = $1 AND account_id = $2';
    const existsResult = await db.query(existsQuery, [id, accountId]);

    if (existsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produto nao encontrado'
      });
    }

    // Check if another product with the same name exists
    const checkQuery = 'SELECT id FROM products WHERE LOWER(name) = LOWER($1) AND account_id = $2 AND id != $3';
    const checkResult = await db.query(checkQuery, [name.trim(), accountId, id]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ja existe um produto com este nome'
      });
    }

    const query = `
      UPDATE products
      SET name = $1, description = $2, default_price = $3, currency = $4, time_unit = $5, payment_conditions = $6, is_active = $7
      WHERE id = $8 AND account_id = $9
      RETURNING id, name, description, default_price, currency, time_unit, payment_conditions, is_active, created_at, updated_at
    `;

    const result = await db.query(query, [
      name.trim(),
      description || null,
      default_price || 0,
      currency || 'BRL',
      time_unit || null,
      payment_conditions || null,
      is_active !== undefined ? is_active : true,
      id,
      accountId
    ]);

    res.json({
      success: true,
      data: {
        product: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar produto',
      error: error.message
    });
  }
};

// Delete a product (soft delete - set is_active = false)
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  const accountId = req.user.account_id;

  try {
    // Check if product exists and belongs to this account
    const existsQuery = 'SELECT id FROM products WHERE id = $1 AND account_id = $2';
    const existsResult = await db.query(existsQuery, [id, accountId]);

    if (existsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produto nao encontrado'
      });
    }

    // Soft delete - set is_active = false
    const query = `
      UPDATE products
      SET is_active = false
      WHERE id = $1 AND account_id = $2
      RETURNING id
    `;

    await db.query(query, [id, accountId]);

    res.json({
      success: true,
      message: 'Produto desativado com sucesso'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir produto',
      error: error.message
    });
  }
};

// Reactivate a product
exports.reactivateProduct = async (req, res) => {
  const { id } = req.params;
  const accountId = req.user.account_id;

  try {
    const query = `
      UPDATE products
      SET is_active = true
      WHERE id = $1 AND account_id = $2
      RETURNING id, name, description, default_price, currency, time_unit, payment_conditions, is_active, created_at, updated_at
    `;

    const result = await db.query(query, [id, accountId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produto nao encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        product: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error reactivating product:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao reativar produto',
      error: error.message
    });
  }
};
