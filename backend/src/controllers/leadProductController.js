// backend/src/controllers/leadProductController.js
// Uses opportunityId but maintains compatibility with leadId param name in routes

const db = require('../config/database');

// Get all products for an opportunity
exports.getLeadProducts = async (req, res) => {
  try {
    const { leadId } = req.params; // Actually opportunityId
    const accountId = req.user.account_id;

    // Verify opportunity belongs to account
    const oppCheck = await db.query(
      'SELECT id FROM opportunities WHERE id = $1 AND account_id = $2',
      [leadId, accountId]
    );

    if (oppCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity nao encontrada'
      });
    }

    const query = `
      SELECT
        op.id,
        op.opportunity_id,
        op.product_id,
        op.quantity,
        op.unit_price,
        op.total_price,
        op.payment_conditions,
        op.notes,
        op.created_at,
        p.name as product_name,
        p.description as product_description,
        p.currency,
        p.time_unit
      FROM opportunity_products op
      JOIN products p ON p.id = op.product_id
      WHERE op.opportunity_id = $1
      ORDER BY op.created_at ASC
    `;

    const result = await db.query(query, [leadId]);

    // Calculate total deal value
    const totalValue = result.rows.reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0);

    res.json({
      success: true,
      data: {
        products: result.rows,
        total_value: totalValue
      }
    });
  } catch (error) {
    console.error('Error getting opportunity products:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar produtos da opportunity',
      error: error.message
    });
  }
};

// Add product to opportunity
exports.addLeadProduct = async (req, res) => {
  try {
    const { leadId } = req.params; // Actually opportunityId
    const { product_id, quantity, unit_price, payment_conditions, notes } = req.body;
    const accountId = req.user.account_id;

    if (!product_id || !unit_price) {
      return res.status(400).json({
        success: false,
        message: 'Produto e valor unitario sao obrigatorios'
      });
    }

    // Verify opportunity belongs to account
    const oppCheck = await db.query(
      'SELECT id FROM opportunities WHERE id = $1 AND account_id = $2',
      [leadId, accountId]
    );

    if (oppCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity nao encontrada'
      });
    }

    // Verify product exists and belongs to account
    const productCheck = await db.query(
      'SELECT id, name FROM products WHERE id = $1 AND account_id = $2',
      [product_id, accountId]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produto nao encontrado'
      });
    }

    const qty = quantity || 1;
    const totalPrice = qty * parseFloat(unit_price);

    const query = `
      INSERT INTO opportunity_products (opportunity_id, product_id, quantity, unit_price, total_price, payment_conditions, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, opportunity_id, product_id, quantity, unit_price, total_price, payment_conditions, notes, created_at
    `;

    const result = await db.query(query, [
      leadId,
      product_id,
      qty,
      unit_price,
      totalPrice,
      payment_conditions || null,
      notes || null
    ]);

    // Get product info for response
    const responseProduct = {
      ...result.rows[0],
      product_name: productCheck.rows[0].name
    };

    res.status(201).json({
      success: true,
      data: {
        product: responseProduct
      }
    });
  } catch (error) {
    console.error('Error adding opportunity product:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao adicionar produto a opportunity',
      error: error.message
    });
  }
};

// Update product in opportunity
exports.updateLeadProduct = async (req, res) => {
  try {
    const { leadId, productItemId } = req.params; // leadId is actually opportunityId
    const { quantity, unit_price, payment_conditions, notes } = req.body;
    const accountId = req.user.account_id;

    // Verify opportunity belongs to account
    const oppCheck = await db.query(
      'SELECT id FROM opportunities WHERE id = $1 AND account_id = $2',
      [leadId, accountId]
    );

    if (oppCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity nao encontrada'
      });
    }

    const qty = quantity || 1;
    const totalPrice = qty * parseFloat(unit_price);

    const query = `
      UPDATE opportunity_products
      SET quantity = $1, unit_price = $2, total_price = $3, payment_conditions = $4, notes = $5
      WHERE id = $6 AND opportunity_id = $7
      RETURNING id, opportunity_id, product_id, quantity, unit_price, total_price, payment_conditions, notes, created_at
    `;

    const result = await db.query(query, [
      qty,
      unit_price,
      totalPrice,
      payment_conditions || null,
      notes || null,
      productItemId,
      leadId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item nao encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        product: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error updating opportunity product:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar produto da opportunity',
      error: error.message
    });
  }
};

// Remove product from opportunity
exports.removeLeadProduct = async (req, res) => {
  try {
    const { leadId, productItemId } = req.params; // leadId is actually opportunityId
    const accountId = req.user.account_id;

    // Verify opportunity belongs to account
    const oppCheck = await db.query(
      'SELECT id FROM opportunities WHERE id = $1 AND account_id = $2',
      [leadId, accountId]
    );

    if (oppCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity nao encontrada'
      });
    }

    const query = `
      DELETE FROM opportunity_products
      WHERE id = $1 AND opportunity_id = $2
      RETURNING id
    `;

    const result = await db.query(query, [productItemId, leadId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item nao encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Produto removido com sucesso'
    });
  } catch (error) {
    console.error('Error removing opportunity product:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao remover produto da opportunity',
      error: error.message
    });
  }
};

// Complete deal (mark as won with products)
exports.completeDeal = async (req, res) => {
  try {
    const { leadId } = req.params; // Actually opportunityId
    const { products, closure_notes } = req.body;
    const accountId = req.user.account_id;

    if (!products || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Pelo menos um produto e obrigatorio para fechar o negocio'
      });
    }

    // Verify opportunity belongs to account
    const oppCheck = await db.query(
      'SELECT id FROM opportunities WHERE id = $1 AND account_id = $2',
      [leadId, accountId]
    );

    if (oppCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity nao encontrada'
      });
    }

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Remove existing products (if any)
      await client.query('DELETE FROM opportunity_products WHERE opportunity_id = $1', [leadId]);

      // Insert new products
      let totalDealValue = 0;
      for (const product of products) {
        const qty = product.quantity || 1;
        const totalPrice = qty * parseFloat(product.unit_price);
        totalDealValue += totalPrice;

        await client.query(`
          INSERT INTO opportunity_products (opportunity_id, product_id, quantity, unit_price, total_price, payment_conditions, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          leadId,
          product.product_id,
          qty,
          product.unit_price,
          totalPrice,
          product.payment_conditions || null,
          product.notes || null
        ]);
      }

      // Update opportunity - mark as won
      await client.query(`
        UPDATE opportunities
        SET closure_notes = $1,
            won_at = CURRENT_TIMESTAMP,
            value = $2,
            qualified_at = COALESCE(qualified_at, CURRENT_TIMESTAMP)
        WHERE id = $3
      `, [closure_notes || null, totalDealValue, leadId]);

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Negocio fechado com sucesso',
        data: {
          opportunity_id: leadId,
          total_value: totalDealValue,
          products_count: products.length
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error completing deal:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao fechar negocio',
      error: error.message
    });
  }
};
