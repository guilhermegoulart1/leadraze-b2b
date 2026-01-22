const db = require('../config/database');

// Default sources to seed
const DEFAULT_SOURCES = [
  { name: 'linkedin', label: 'LinkedIn', color: '#0077b5', icon: 'in', display_order: 0 },
  { name: 'google_maps', label: 'Google Maps', color: '#34a853', icon: 'G', display_order: 1 },
  { name: 'lista', label: 'Lista', color: '#7c3aed', icon: 'L', display_order: 2 },
  { name: 'trafego_pago', label: 'Tráfego Pago', color: '#f59e0b', icon: '$', display_order: 3 },
  { name: 'manual', label: 'Manual', color: '#3b82f6', icon: 'M', display_order: 4 },
  { name: 'indicacao', label: 'Indicação', color: '#10b981', icon: 'R', display_order: 5 },
  { name: 'outro', label: 'Outro', color: '#6b7280', icon: '?', display_order: 6 }
];

// Mapping from old source values to new names
const SOURCE_MIGRATION_MAP = {
  'list': 'lista',
  'paid_traffic': 'trafego_pago',
  'referral': 'indicacao',
  'other': 'outro'
};

// Get all lead sources for the account
exports.getLeadSources = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { active_only } = req.query;

    let query = `
      SELECT
        id,
        name,
        label,
        description,
        color,
        icon,
        is_default,
        is_active,
        display_order,
        created_at,
        updated_at
      FROM lead_sources
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
        sources: result.rows
      }
    });
  } catch (error) {
    console.error('Error getting lead sources:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar fontes de lead',
      error: error.message
    });
  }
};

// Get a single lead source by ID
exports.getLeadSource = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    const query = `
      SELECT
        id,
        name,
        label,
        description,
        color,
        icon,
        is_default,
        is_active,
        display_order,
        created_at,
        updated_at
      FROM lead_sources
      WHERE id = $1 AND account_id = $2
    `;

    const result = await db.query(query, [id, accountId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fonte de lead nao encontrada'
      });
    }

    res.json({
      success: true,
      data: {
        source: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error getting lead source:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar fonte de lead',
      error: error.message
    });
  }
};

// Create a new lead source
exports.createLeadSource = async (req, res) => {
  const { name, label, description, color, icon, display_order } = req.body;
  const accountId = req.user.account_id;

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Nome da fonte e obrigatorio'
    });
  }

  if (!label || !label.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Label da fonte e obrigatorio'
    });
  }

  try {
    // Check if source with same name already exists in this account
    const checkQuery = 'SELECT id FROM lead_sources WHERE LOWER(name) = LOWER($1) AND account_id = $2';
    const checkResult = await db.query(checkQuery, [name.trim(), accountId]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ja existe uma fonte com este nome'
      });
    }

    // Get max display_order for this account
    const orderQuery = 'SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM lead_sources WHERE account_id = $1';
    const orderResult = await db.query(orderQuery, [accountId]);
    const nextOrder = display_order !== undefined ? display_order : orderResult.rows[0].next_order;

    const query = `
      INSERT INTO lead_sources (account_id, name, label, description, color, icon, display_order, is_default)
      VALUES ($1, $2, $3, $4, $5, $6, $7, false)
      RETURNING id, name, label, description, color, icon, is_default, is_active, display_order, created_at, updated_at
    `;

    const result = await db.query(query, [
      accountId,
      name.trim().toLowerCase(),
      label.trim(),
      description || null,
      color || '#6b7280',
      icon || '?',
      nextOrder
    ]);

    res.status(201).json({
      success: true,
      data: {
        source: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error creating lead source:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar fonte de lead',
      error: error.message
    });
  }
};

// Update a lead source
exports.updateLeadSource = async (req, res) => {
  const { id } = req.params;
  const { name, label, description, color, icon, is_active, display_order } = req.body;
  const accountId = req.user.account_id;

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Nome da fonte e obrigatorio'
    });
  }

  if (!label || !label.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Label da fonte e obrigatorio'
    });
  }

  try {
    // Check if source exists and belongs to this account
    const existsQuery = 'SELECT id, name as old_name FROM lead_sources WHERE id = $1 AND account_id = $2';
    const existsResult = await db.query(existsQuery, [id, accountId]);

    if (existsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fonte de lead nao encontrada'
      });
    }

    const oldName = existsResult.rows[0].old_name;

    // Check if another source with the same name exists
    const checkQuery = 'SELECT id FROM lead_sources WHERE LOWER(name) = LOWER($1) AND account_id = $2 AND id != $3';
    const checkResult = await db.query(checkQuery, [name.trim(), accountId, id]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ja existe uma fonte com este nome'
      });
    }

    const query = `
      UPDATE lead_sources
      SET name = $1, label = $2, description = $3, color = $4, icon = $5, is_active = $6, display_order = $7
      WHERE id = $8 AND account_id = $9
      RETURNING id, name, label, description, color, icon, is_default, is_active, display_order, created_at, updated_at
    `;

    const newName = name.trim().toLowerCase();
    const result = await db.query(query, [
      newName,
      label.trim(),
      description || null,
      color || '#6b7280',
      icon || '?',
      is_active !== undefined ? is_active : true,
      display_order !== undefined ? display_order : 0,
      id,
      accountId
    ]);

    // If the name changed, update opportunities.source references
    if (oldName !== newName) {
      await db.query(`
        UPDATE opportunities
        SET source = $1
        WHERE account_id = $2 AND source = $3
      `, [newName, accountId, oldName]);
    }

    res.json({
      success: true,
      data: {
        source: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error updating lead source:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar fonte de lead',
      error: error.message
    });
  }
};

// Delete a lead source (hard delete)
exports.deleteLeadSource = async (req, res) => {
  const { id } = req.params;
  const accountId = req.user.account_id;

  try {
    // Check if source exists and belongs to this account
    const existsQuery = 'SELECT id, is_default, name FROM lead_sources WHERE id = $1 AND account_id = $2';
    const existsResult = await db.query(existsQuery, [id, accountId]);

    if (existsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fonte de lead nao encontrada'
      });
    }

    // Prevent deletion of default sources
    if (existsResult.rows[0].is_default) {
      return res.status(400).json({
        success: false,
        message: 'Fontes padrao nao podem ser excluidas. Desative-a se nao quiser usa-la.'
      });
    }

    const sourceName = existsResult.rows[0].name;

    // Check if source is being used by any opportunities
    const usageQuery = 'SELECT COUNT(*) as count FROM opportunities WHERE lead_source_id = $1 OR source = $2';
    const usageResult = await db.query(usageQuery, [id, sourceName]);

    if (parseInt(usageResult.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Esta fonte esta sendo usada por oportunidades e nao pode ser excluida'
      });
    }

    // Hard delete
    const query = `
      DELETE FROM lead_sources
      WHERE id = $1 AND account_id = $2
      RETURNING id
    `;

    await db.query(query, [id, accountId]);

    res.json({
      success: true,
      message: 'Fonte de lead excluida com sucesso'
    });
  } catch (error) {
    console.error('Error deleting lead source:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir fonte de lead',
      error: error.message
    });
  }
};

// Seed default lead sources for an account
exports.seedDefaultSources = async (req, res) => {
  const accountId = req.user.account_id;

  try {
    // Check if account already has sources
    const checkQuery = 'SELECT COUNT(*) as count FROM lead_sources WHERE account_id = $1';
    const checkResult = await db.query(checkQuery, [accountId]);

    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.json({
        success: true,
        message: 'Fontes ja existem para esta conta',
        seeded: false
      });
    }

    // Insert default sources
    for (const source of DEFAULT_SOURCES) {
      await db.query(`
        INSERT INTO lead_sources (account_id, name, label, color, icon, is_default, display_order)
        VALUES ($1, $2, $3, $4, $5, true, $6)
      `, [accountId, source.name, source.label, source.color, source.icon, source.display_order]);
    }

    // Migrate existing opportunities.source to lead_source_id
    const migrateQuery = `
      UPDATE opportunities o
      SET lead_source_id = ls.id
      FROM lead_sources ls
      WHERE o.account_id = $1
        AND ls.account_id = $1
        AND o.lead_source_id IS NULL
        AND o.source IS NOT NULL
        AND (
          LOWER(o.source) = ls.name
          OR (LOWER(o.source) = 'list' AND ls.name = 'lista')
          OR (LOWER(o.source) = 'paid_traffic' AND ls.name = 'trafego_pago')
          OR (LOWER(o.source) = 'referral' AND ls.name = 'indicacao')
          OR (LOWER(o.source) = 'other' AND ls.name = 'outro')
        )
    `;
    const migrateResult = await db.query(migrateQuery, [accountId]);

    res.status(201).json({
      success: true,
      message: 'Fontes padrao criadas com sucesso',
      seeded: true,
      count: DEFAULT_SOURCES.length,
      migrated: migrateResult.rowCount || 0
    });
  } catch (error) {
    console.error('Error seeding lead sources:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar fontes padrao',
      error: error.message
    });
  }
};
