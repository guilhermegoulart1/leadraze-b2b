const pool = require('../config/database');

// Get all tags (conta uso via contact_tags - fonte única de verdade)
// IMPORTANTE: Filtrar por account_id para multi-tenancy
exports.getTags = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    const query = `
      SELECT
        t.id,
        t.name,
        t.color,
        t.created_at,
        COUNT(DISTINCT ct.contact_id) as usage_count
      FROM tags t
      LEFT JOIN contact_tags ct ON ct.tag_id = t.id
      WHERE t.account_id = $1
      GROUP BY t.id, t.name, t.color, t.created_at
      ORDER BY t.name ASC
    `;

    const result = await pool.query(query, [accountId]);

    res.json({
      success: true,
      data: {
        tags: result.rows
      }
    });
  } catch (error) {
    console.error('Error getting tags:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar etiquetas',
      error: error.message
    });
  }
};

// Create a new tag
// IMPORTANTE: Incluir account_id para multi-tenancy
exports.createTag = async (req, res) => {
  const { name, color = 'purple' } = req.body;
  const userId = req.user.id;
  const accountId = req.user.account_id;

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Nome da etiqueta é obrigatório'
    });
  }

  try {
    // Check if tag already exists FOR THIS ACCOUNT
    const checkQuery = 'SELECT id FROM tags WHERE LOWER(name) = LOWER($1) AND account_id = $2';
    const checkResult = await pool.query(checkQuery, [name.trim(), accountId]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Já existe uma etiqueta com este nome'
      });
    }

    const query = `
      INSERT INTO tags (name, color, created_by, account_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, color, created_at
    `;

    const result = await pool.query(query, [name.trim(), color, userId, accountId]);

    res.status(201).json({
      success: true,
      data: {
        tag: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar etiqueta',
      error: error.message
    });
  }
};

// Update a tag
// IMPORTANTE: Filtrar por account_id para multi-tenancy
exports.updateTag = async (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;
  const accountId = req.user.account_id;

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Nome da etiqueta é obrigatório'
    });
  }

  try {
    // Check if another tag with the same name exists FOR THIS ACCOUNT
    const checkQuery = 'SELECT id FROM tags WHERE LOWER(name) = LOWER($1) AND id != $2 AND account_id = $3';
    const checkResult = await pool.query(checkQuery, [name.trim(), id, accountId]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Já existe uma etiqueta com este nome'
      });
    }

    const query = `
      UPDATE tags
      SET name = $1, color = $2
      WHERE id = $3 AND account_id = $4
      RETURNING id, name, color, created_at
    `;

    const result = await pool.query(query, [name.trim(), color, id, accountId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Etiqueta não encontrada'
      });
    }

    res.json({
      success: true,
      data: {
        tag: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error updating tag:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar etiqueta',
      error: error.message
    });
  }
};

// Delete a tag
// IMPORTANTE: Filtrar por account_id para multi-tenancy
exports.deleteTag = async (req, res) => {
  const { id } = req.params;
  const accountId = req.user.account_id;

  try {
    // Verificar se a tag pertence a esta conta antes de deletar
    const checkQuery = 'SELECT id FROM tags WHERE id = $1 AND account_id = $2';
    const checkResult = await pool.query(checkQuery, [id, accountId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Etiqueta não encontrada'
      });
    }

    // Deletar associações em contact_tags (fonte única de verdade)
    await pool.query('DELETE FROM contact_tags WHERE tag_id = $1', [id]);

    // Deletar também de lead_tags (deprecated, mas mantido para limpeza)
    await pool.query('DELETE FROM lead_tags WHERE tag_id = $1', [id]);

    // Then delete the tag
    const query = 'DELETE FROM tags WHERE id = $1 AND account_id = $2 RETURNING id';
    const result = await pool.query(query, [id, accountId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Etiqueta não encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Etiqueta excluída com sucesso'
    });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir etiqueta',
      error: error.message
    });
  }
};

// Add tag to lead (via contato vinculado - tags centralizadas no contato)
exports.addTagToLead = async (req, res) => {
  const { leadId } = req.params;
  const { tag_id } = req.body;

  if (!tag_id) {
    return res.status(400).json({
      success: false,
      message: 'ID da etiqueta é obrigatório'
    });
  }

  try {
    // Buscar contato vinculado à opportunity diretamente
    const contactQuery = `
      SELECT contact_id FROM opportunities WHERE id = $1 LIMIT 1
    `;
    const contactResult = await pool.query(contactQuery, [leadId]);

    if (contactResult.rows.length === 0 || !contactResult.rows[0].contact_id) {
      return res.status(400).json({
        success: false,
        message: 'Esta oportunidade não possui um contato vinculado. Vincule um contato primeiro.'
      });
    }

    const contactId = contactResult.rows[0].contact_id;

    // Verificar se a tag já está no contato
    const checkQuery = 'SELECT id FROM contact_tags WHERE contact_id = $1 AND tag_id = $2';
    const checkResult = await pool.query(checkQuery, [contactId, tag_id]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Etiqueta já adicionada a este contato'
      });
    }

    // Inserir na tabela contact_tags (fonte única de verdade)
    const query = `
      INSERT INTO contact_tags (contact_id, tag_id)
      VALUES ($1, $2)
      RETURNING id, created_at
    `;

    await pool.query(query, [contactId, tag_id]);

    res.status(201).json({
      success: true,
      message: 'Etiqueta adicionada com sucesso'
    });
  } catch (error) {
    console.error('Error adding tag to lead:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao adicionar etiqueta',
      error: error.message
    });
  }
};

// Remove tag from lead (via contato vinculado - tags centralizadas no contato)
exports.removeTagFromLead = async (req, res) => {
  const { leadId, tagId } = req.params;

  try {
    // Buscar contato vinculado à opportunity diretamente
    const contactQuery = `
      SELECT contact_id FROM opportunities WHERE id = $1 LIMIT 1
    `;
    const contactResult = await pool.query(contactQuery, [leadId]);

    if (contactResult.rows.length === 0 || !contactResult.rows[0].contact_id) {
      return res.status(400).json({
        success: false,
        message: 'Esta oportunidade não possui um contato vinculado'
      });
    }

    const contactId = contactResult.rows[0].contact_id;

    // Remover da tabela contact_tags (fonte única de verdade)
    const query = `
      DELETE FROM contact_tags
      WHERE contact_id = $1 AND tag_id = $2
      RETURNING id
    `;

    const result = await pool.query(query, [contactId, tagId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Associação não encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Etiqueta removida com sucesso'
    });
  } catch (error) {
    console.error('Error removing tag from lead:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao remover etiqueta',
      error: error.message
    });
  }
};

// Add tag to opportunity (alias for addTagToLead - route uses opportunityId param)
exports.addTagToOpportunity = async (req, res) => {
  // Map opportunityId to leadId for the existing function
  req.params.leadId = req.params.opportunityId;
  return exports.addTagToLead(req, res);
};

// Remove tag from opportunity (alias for removeTagFromLead - route uses opportunityId param)
exports.removeTagFromOpportunity = async (req, res) => {
  // Map opportunityId to leadId for the existing function
  req.params.leadId = req.params.opportunityId;
  return exports.removeTagFromLead(req, res);
};
