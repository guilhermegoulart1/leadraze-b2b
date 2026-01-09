const db = require('../config/database');

// Get all discard reasons for the account
exports.getDiscardReasons = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { active_only } = req.query;

    let query = `
      SELECT
        id,
        name,
        description,
        is_active,
        display_order,
        created_at,
        updated_at
      FROM discard_reasons
      WHERE account_id = $1
    `;

    const params = [accountId];

    if (active_only === 'true') {
      query += ' AND is_active = true';
    }

    query += ' ORDER BY display_order ASC, name ASC';

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: {
        reasons: result.rows
      }
    });
  } catch (error) {
    console.error('Error getting discard reasons:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar motivos de descarte',
      error: error.message
    });
  }
};

// Get a single discard reason by ID
exports.getDiscardReason = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    const query = `
      SELECT
        id,
        name,
        description,
        is_active,
        display_order,
        created_at,
        updated_at
      FROM discard_reasons
      WHERE id = $1 AND account_id = $2
    `;

    const result = await db.query(query, [id, accountId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Motivo de descarte nao encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        reason: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error getting discard reason:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar motivo de descarte',
      error: error.message
    });
  }
};

// Create a new discard reason
exports.createDiscardReason = async (req, res) => {
  const { name, description, display_order } = req.body;
  const accountId = req.user.account_id;

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Nome do motivo e obrigatorio'
    });
  }

  try {
    // Check if reason with same name already exists in this account
    const checkQuery = 'SELECT id FROM discard_reasons WHERE LOWER(name) = LOWER($1) AND account_id = $2';
    const checkResult = await db.query(checkQuery, [name.trim(), accountId]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ja existe um motivo com este nome'
      });
    }

    // Get max display_order for this account
    const orderQuery = 'SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM discard_reasons WHERE account_id = $1';
    const orderResult = await db.query(orderQuery, [accountId]);
    const nextOrder = display_order !== undefined ? display_order : orderResult.rows[0].next_order;

    const query = `
      INSERT INTO discard_reasons (account_id, name, description, display_order)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, description, is_active, display_order, created_at, updated_at
    `;

    const result = await db.query(query, [
      accountId,
      name.trim(),
      description || null,
      nextOrder
    ]);

    res.status(201).json({
      success: true,
      data: {
        reason: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error creating discard reason:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar motivo de descarte',
      error: error.message
    });
  }
};

// Update a discard reason
exports.updateDiscardReason = async (req, res) => {
  const { id } = req.params;
  const { name, description, is_active, display_order } = req.body;
  const accountId = req.user.account_id;

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Nome do motivo e obrigatorio'
    });
  }

  try {
    // Check if reason exists and belongs to this account
    const existsQuery = 'SELECT id FROM discard_reasons WHERE id = $1 AND account_id = $2';
    const existsResult = await db.query(existsQuery, [id, accountId]);

    if (existsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Motivo de descarte nao encontrado'
      });
    }

    // Check if another reason with the same name exists
    const checkQuery = 'SELECT id FROM discard_reasons WHERE LOWER(name) = LOWER($1) AND account_id = $2 AND id != $3';
    const checkResult = await db.query(checkQuery, [name.trim(), accountId, id]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ja existe um motivo com este nome'
      });
    }

    const query = `
      UPDATE discard_reasons
      SET name = $1, description = $2, is_active = $3, display_order = $4
      WHERE id = $5 AND account_id = $6
      RETURNING id, name, description, is_active, display_order, created_at, updated_at
    `;

    const result = await db.query(query, [
      name.trim(),
      description || null,
      is_active !== undefined ? is_active : true,
      display_order !== undefined ? display_order : 0,
      id,
      accountId
    ]);

    res.json({
      success: true,
      data: {
        reason: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error updating discard reason:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar motivo de descarte',
      error: error.message
    });
  }
};

// Delete a discard reason (hard delete)
exports.deleteDiscardReason = async (req, res) => {
  const { id } = req.params;
  const accountId = req.user.account_id;

  try {
    // Check if reason exists and belongs to this account
    const existsQuery = 'SELECT id FROM discard_reasons WHERE id = $1 AND account_id = $2';
    const existsResult = await db.query(existsQuery, [id, accountId]);

    if (existsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Motivo de descarte nao encontrado'
      });
    }

    // Check if reason is being used by any opportunities
    const usageQuery = 'SELECT COUNT(*) as count FROM opportunities WHERE discard_reason_id = $1';
    const usageResult = await db.query(usageQuery, [id]);

    if (parseInt(usageResult.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Este motivo esta sendo usado por oportunidades e nao pode ser excluido'
      });
    }

    // Hard delete
    const query = `
      DELETE FROM discard_reasons
      WHERE id = $1 AND account_id = $2
      RETURNING id
    `;

    await db.query(query, [id, accountId]);

    res.json({
      success: true,
      message: 'Motivo de descarte excluido com sucesso'
    });
  } catch (error) {
    console.error('Error deleting discard reason:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir motivo de descarte',
      error: error.message
    });
  }
};

// Seed default discard reasons for an account
exports.seedDefaultReasons = async (req, res) => {
  const accountId = req.user.account_id;

  const defaultReasons = [
    { name: 'Sem interesse', description: 'O lead nao demonstrou interesse', display_order: 0 },
    { name: 'Sem orcamento', description: 'O lead nao possui orcamento disponivel', display_order: 1 },
    { name: 'Concorrente', description: 'O lead escolheu um concorrente', display_order: 2 },
    { name: 'Timing inadequado', description: 'Momento nao e adequado para o lead', display_order: 3 },
    { name: 'Perfil inadequado', description: 'Lead nao se encaixa no perfil ideal', display_order: 4 },
    { name: 'Sem resposta', description: 'O lead nao responde as tentativas de contato', display_order: 5 },
    { name: 'Duplicado', description: 'Lead duplicado no sistema', display_order: 6 },
    { name: 'Outro', description: 'Outro motivo', display_order: 7 }
  ];

  try {
    // Check if account already has reasons
    const checkQuery = 'SELECT COUNT(*) as count FROM discard_reasons WHERE account_id = $1';
    const checkResult = await db.query(checkQuery, [accountId]);

    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.json({
        success: true,
        message: 'Motivos ja existem para esta conta',
        seeded: false
      });
    }

    // Insert default reasons
    for (const reason of defaultReasons) {
      await db.query(`
        INSERT INTO discard_reasons (account_id, name, description, display_order)
        VALUES ($1, $2, $3, $4)
      `, [accountId, reason.name, reason.description, reason.display_order]);
    }

    res.status(201).json({
      success: true,
      message: 'Motivos padrao criados com sucesso',
      seeded: true,
      count: defaultReasons.length
    });
  } catch (error) {
    console.error('Error seeding discard reasons:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar motivos padrao',
      error: error.message
    });
  }
};
