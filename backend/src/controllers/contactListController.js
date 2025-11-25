// backend/src/controllers/contactListController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const {
  ValidationError,
  NotFoundError,
  ForbiddenError
} = require('../utils/errors');
const { getAccessibleSectorIds } = require('../middleware/permissions');

// ================================
// HELPER: Build sector filter for contact list queries
// ================================
async function buildContactListSectorFilter(userId, accountId, paramIndex = 3) {
  const accessibleSectorIds = await getAccessibleSectorIds(userId, accountId);

  if (accessibleSectorIds.length > 0) {
    return {
      filter: `AND (cl.sector_id = ANY($${paramIndex}) OR cl.sector_id IS NULL)`,
      params: [accessibleSectorIds]
    };
  } else {
    return {
      filter: 'AND cl.sector_id IS NULL',
      params: []
    };
  }
}

// ================================
// 1. LISTAR LISTAS DE CONTATOS
// ================================
const getContactLists = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { search, list_type, page = 1, limit = 20 } = req.query;

    console.log(`📋 Listando listas de contatos do usuário ${userId} (conta ${accountId})`);

    // Construir query - MULTI-TENANCY + SECTOR filtering
    let whereConditions = ['cl.account_id = $1', 'cl.user_id = $2'];
    let queryParams = [accountId, userId];
    let paramIndex = 3;

    // SECTOR FILTER: Add sector filtering
    const { filter: sectorFilter, params: sectorParams } = await buildContactListSectorFilter(userId, accountId, paramIndex);
    if (sectorParams.length > 0) {
      whereConditions.push(sectorFilter.replace(/^AND /, ''));
      queryParams.push(...sectorParams);
      paramIndex += sectorParams.length;
    } else if (sectorFilter) {
      whereConditions.push(sectorFilter.replace(/^AND /, ''));
    }

    // Filtro por busca
    if (search) {
      whereConditions.push(`(cl.name ILIKE $${paramIndex} OR cl.description ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Filtro por tipo
    if (list_type) {
      whereConditions.push(`cl.list_type = $${paramIndex}`);
      queryParams.push(list_type);
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.join(' AND ');

    // Query com estatísticas
    const query = `
      SELECT
        cl.*,
        u.name as creator_name,
        u.email as creator_email,
        s.name as sector_name,
        COALESCE(COUNT(DISTINCT cli.id), 0) as item_count,
        COALESCE(SUM(CASE WHEN cli.status = 'activated' THEN 1 ELSE 0 END), 0) as activated_count,
        COALESCE(SUM(CASE WHEN cli.status = 'pending' THEN 1 ELSE 0 END), 0) as pending_count,
        COALESCE(SUM(CASE WHEN cli.status = 'failed' THEN 1 ELSE 0 END), 0) as failed_count,
        COALESCE(COUNT(DISTINCT ac.id), 0) as campaigns_count
      FROM contact_lists cl
      LEFT JOIN users u ON cl.user_id = u.id
      LEFT JOIN sectors s ON cl.sector_id = s.id
      LEFT JOIN contact_list_items cli ON cl.id = cli.list_id
      LEFT JOIN activation_campaigns ac ON cl.id = ac.list_id
      WHERE ${whereClause}
      GROUP BY cl.id, u.name, u.email, s.name
      ORDER BY cl.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);

    // Contar total
    const countQuery = `
      SELECT COUNT(DISTINCT cl.id)
      FROM contact_lists cl
      WHERE ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    console.log(`✅ Encontradas ${result.rows.length} listas de contatos`);

    sendSuccess(res, {
      lists: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Erro ao listar listas de contatos:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 2. OBTER LISTA ESPECÍFICA
// ================================
const getContactList = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`🔍 Buscando lista de contatos ${id} (conta ${accountId})`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildContactListSectorFilter(userId, accountId, 4);

    const query = `
      SELECT
        cl.*,
        u.name as creator_name,
        u.email as creator_email,
        s.name as sector_name,
        COALESCE(COUNT(DISTINCT cli.id), 0) as item_count,
        COALESCE(SUM(CASE WHEN cli.status = 'activated' THEN 1 ELSE 0 END), 0) as activated_count,
        COALESCE(SUM(CASE WHEN cli.status = 'pending' THEN 1 ELSE 0 END), 0) as pending_count,
        COALESCE(SUM(CASE WHEN cli.status = 'failed' THEN 1 ELSE 0 END), 0) as failed_count
      FROM contact_lists cl
      LEFT JOIN users u ON cl.user_id = u.id
      LEFT JOIN sectors s ON cl.sector_id = s.id
      LEFT JOIN contact_list_items cli ON cl.id = cli.list_id
      WHERE cl.id = $1 AND cl.account_id = $3 AND cl.user_id = $2 ${sectorFilter}
      GROUP BY cl.id, u.name, u.email, s.name
    `;

    const result = await db.query(query, [id, userId, accountId, ...sectorParams]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Lista de contatos não encontrada');
    }

    console.log(`✅ Lista de contatos encontrada: ${result.rows[0].name}`);

    sendSuccess(res, { list: result.rows[0] });

  } catch (error) {
    console.error('❌ Erro ao buscar lista de contatos:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 3. CRIAR LISTA DE CONTATOS
// ================================
const createContactList = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      name,
      description,
      list_type = 'manual',
      sector_id
    } = req.body;

    console.log(`➕ Criando nova lista de contatos para usuário ${userId}`);

    // Validação
    if (!name || name.trim() === '') {
      throw new ValidationError('Nome da lista é obrigatório');
    }

    // Verificar se o setor existe e pertence à conta
    if (sector_id) {
      const sectorCheck = await db.query(
        'SELECT id FROM sectors WHERE id = $1 AND account_id = $2',
        [sector_id, accountId]
      );

      if (sectorCheck.rows.length === 0) {
        throw new ValidationError('Setor inválido');
      }
    }

    // Criar lista
    const query = `
      INSERT INTO contact_lists (
        account_id,
        user_id,
        name,
        description,
        list_type,
        sector_id,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING *
    `;

    const result = await db.query(query, [
      accountId,
      userId,
      name.trim(),
      description?.trim() || null,
      list_type,
      sector_id || null
    ]);

    console.log(`✅ Lista de contatos criada com sucesso: ${result.rows[0].id}`);

    sendSuccess(res, { list: result.rows[0] }, 201);

  } catch (error) {
    console.error('❌ Erro ao criar lista de contatos:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 4. ATUALIZAR LISTA DE CONTATOS
// ================================
const updateContactList = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      name,
      description,
      list_type,
      sector_id,
      is_active
    } = req.body;

    console.log(`📝 Atualizando lista de contatos ${id}`);

    // Verificar se a lista existe e pertence ao usuário
    const { filter: sectorFilter, params: sectorParams } = await buildContactListSectorFilter(userId, accountId, 4);

    const checkQuery = `
      SELECT * FROM contact_lists
      WHERE id = $1 AND account_id = $3 AND user_id = $2 ${sectorFilter}
    `;

    const checkResult = await db.query(checkQuery, [id, userId, accountId, ...sectorParams]);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Lista de contatos não encontrada');
    }

    // Verificar setor se fornecido
    if (sector_id) {
      const sectorCheck = await db.query(
        'SELECT id FROM sectors WHERE id = $1 AND account_id = $2',
        [sector_id, accountId]
      );

      if (sectorCheck.rows.length === 0) {
        throw new ValidationError('Setor inválido');
      }
    }

    // Construir query de atualização
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      if (!name || name.trim() === '') {
        throw new ValidationError('Nome da lista não pode ser vazio');
      }
      updates.push(`name = $${paramIndex}`);
      values.push(name.trim());
      paramIndex++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(description?.trim() || null);
      paramIndex++;
    }

    if (list_type !== undefined) {
      updates.push(`list_type = $${paramIndex}`);
      values.push(list_type);
      paramIndex++;
    }

    if (sector_id !== undefined) {
      updates.push(`sector_id = $${paramIndex}`);
      values.push(sector_id);
      paramIndex++;
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      values.push(is_active);
      paramIndex++;
    }

    if (updates.length === 0) {
      throw new ValidationError('Nenhum campo para atualizar');
    }

    // Adicionar updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // Adicionar ID e account_id aos valores
    values.push(id, accountId, userId);

    const updateQuery = `
      UPDATE contact_lists
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND account_id = $${paramIndex + 1} AND user_id = $${paramIndex + 2}
      RETURNING *
    `;

    const result = await db.query(updateQuery, values);

    console.log(`✅ Lista de contatos atualizada com sucesso`);

    sendSuccess(res, { list: result.rows[0] });

  } catch (error) {
    console.error('❌ Erro ao atualizar lista de contatos:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 5. DELETAR LISTA DE CONTATOS
// ================================
const deleteContactList = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`🗑️ Deletando lista de contatos ${id}`);

    // Verificar se a lista existe e pertence ao usuário
    const { filter: sectorFilter, params: sectorParams } = await buildContactListSectorFilter(userId, accountId, 4);

    const checkQuery = `
      SELECT * FROM contact_lists
      WHERE id = $1 AND account_id = $3 AND user_id = $2 ${sectorFilter}
    `;

    const checkResult = await db.query(checkQuery, [id, userId, accountId, ...sectorParams]);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Lista de contatos não encontrada');
    }

    // Verificar se há campanhas ativas usando esta lista
    const campaignsCheck = await db.query(
      `SELECT COUNT(*) as count FROM activation_campaigns
       WHERE list_id = $1 AND status IN ('active', 'scheduled')`,
      [id]
    );

    if (parseInt(campaignsCheck.rows[0].count) > 0) {
      throw new ValidationError('Não é possível deletar lista com campanhas ativas');
    }

    // Deletar lista (items serão deletados em cascata)
    await db.query(
      'DELETE FROM contact_lists WHERE id = $1 AND account_id = $2 AND user_id = $3',
      [id, accountId, userId]
    );

    console.log(`✅ Lista de contatos deletada com sucesso`);

    sendSuccess(res, { message: 'Lista de contatos deletada com sucesso' });

  } catch (error) {
    console.error('❌ Erro ao deletar lista de contatos:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 6. OBTER ITENS DA LISTA
// ================================
const getContactListItems = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { status, page = 1, limit = 50 } = req.query;

    console.log(`📋 Buscando itens da lista ${id}`);

    // Verificar se a lista existe e pertence ao usuário
    const { filter: sectorFilter, params: sectorParams } = await buildContactListSectorFilter(userId, accountId, 4);

    const listCheck = await db.query(
      `SELECT * FROM contact_lists WHERE id = $1 AND account_id = $3 AND user_id = $2 ${sectorFilter}`,
      [id, userId, accountId, ...sectorParams]
    );

    if (listCheck.rows.length === 0) {
      throw new NotFoundError('Lista de contatos não encontrada');
    }

    // Construir query para itens
    let whereConditions = ['cli.list_id = $1'];
    let queryParams = [id];
    let paramIndex = 2;

    if (status) {
      whereConditions.push(`cli.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.join(' AND ');

    const query = `
      SELECT
        cli.*,
        c.name as contact_name,
        c.email as contact_email,
        c.phone as contact_phone,
        c.linkedin_url as contact_linkedin_url,
        c.company as contact_company,
        ac.name as campaign_name
      FROM contact_list_items cli
      LEFT JOIN contacts c ON cli.contact_id = c.id
      LEFT JOIN activation_campaigns ac ON cli.activation_campaign_id = ac.id
      WHERE ${whereClause}
      ORDER BY cli.added_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);

    // Contar total
    const countQuery = `SELECT COUNT(*) FROM contact_list_items cli WHERE ${whereClause}`;
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    console.log(`✅ Encontrados ${result.rows.length} itens`);

    sendSuccess(res, {
      items: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar itens da lista:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 7. ADICIONAR CONTATO À LISTA
// ================================
const addContactToList = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      contact_id,
      name,
      email,
      phone,
      linkedin_url,
      company,
      position
    } = req.body;

    console.log(`➕ Adicionando contato à lista ${id}`);

    // Verificar se a lista existe e pertence ao usuário
    const { filter: sectorFilter, params: sectorParams } = await buildContactListSectorFilter(userId, accountId, 4);

    const listCheck = await db.query(
      `SELECT * FROM contact_lists WHERE id = $1 AND account_id = $3 AND user_id = $2 ${sectorFilter}`,
      [id, userId, accountId, ...sectorParams]
    );

    if (listCheck.rows.length === 0) {
      throw new NotFoundError('Lista de contatos não encontrada');
    }

    // Validar que pelo menos um identificador foi fornecido
    if (!contact_id && !email && !phone && !linkedin_url) {
      throw new ValidationError('Forneça ao menos um: contact_id, email, phone ou linkedin_url');
    }

    // Se contact_id fornecido, verificar se existe e pertence à conta
    if (contact_id) {
      const contactCheck = await db.query(
        'SELECT id FROM contacts WHERE id = $1 AND account_id = $2',
        [contact_id, accountId]
      );

      if (contactCheck.rows.length === 0) {
        throw new ValidationError('Contato não encontrado');
      }

      // Verificar se já existe na lista
      const duplicateCheck = await db.query(
        'SELECT id FROM contact_list_items WHERE list_id = $1 AND contact_id = $2',
        [id, contact_id]
      );

      if (duplicateCheck.rows.length > 0) {
        throw new ValidationError('Contato já existe nesta lista');
      }
    }

    // Adicionar item à lista
    const query = `
      INSERT INTO contact_list_items (
        list_id,
        contact_id,
        name,
        email,
        phone,
        linkedin_url,
        company,
        position,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      RETURNING *
    `;

    const result = await db.query(query, [
      id,
      contact_id || null,
      name?.trim() || null,
      email?.trim() || null,
      phone?.trim() || null,
      linkedin_url?.trim() || null,
      company?.trim() || null,
      position?.trim() || null
    ]);

    console.log(`✅ Contato adicionado à lista com sucesso`);

    sendSuccess(res, { item: result.rows[0] }, 201);

  } catch (error) {
    console.error('❌ Erro ao adicionar contato à lista:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 8. REMOVER CONTATO DA LISTA
// ================================
const removeContactFromList = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`🗑️ Removendo contato ${itemId} da lista ${id}`);

    // Verificar se a lista existe e pertence ao usuário
    const { filter: sectorFilter, params: sectorParams } = await buildContactListSectorFilter(userId, accountId, 4);

    const listCheck = await db.query(
      `SELECT * FROM contact_lists WHERE id = $1 AND account_id = $3 AND user_id = $2 ${sectorFilter}`,
      [id, userId, accountId, ...sectorParams]
    );

    if (listCheck.rows.length === 0) {
      throw new NotFoundError('Lista de contatos não encontrada');
    }

    // Verificar se o item existe na lista
    const itemCheck = await db.query(
      'SELECT * FROM contact_list_items WHERE id = $1 AND list_id = $2',
      [itemId, id]
    );

    if (itemCheck.rows.length === 0) {
      throw new NotFoundError('Item não encontrado nesta lista');
    }

    // Verificar se o item está em campanha ativa
    if (itemCheck.rows[0].activation_campaign_id) {
      const campaignCheck = await db.query(
        'SELECT status FROM activation_campaigns WHERE id = $1',
        [itemCheck.rows[0].activation_campaign_id]
      );

      if (campaignCheck.rows.length > 0 && campaignCheck.rows[0].status === 'active') {
        throw new ValidationError('Não é possível remover contato de campanha ativa');
      }
    }

    // Remover item
    await db.query('DELETE FROM contact_list_items WHERE id = $1', [itemId]);

    console.log(`✅ Contato removido da lista com sucesso`);

    sendSuccess(res, { message: 'Contato removido da lista com sucesso' });

  } catch (error) {
    console.error('❌ Erro ao remover contato da lista:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 9. IMPORTAR CONTATOS CSV
// ================================
const importContactsFromCSV = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { contacts, fileName } = req.body;

    console.log(`📥 Importando ${contacts?.length || 0} contatos para lista ${id}`);

    // Verificar se a lista existe e pertence ao usuário
    const { filter: sectorFilter, params: sectorParams } = await buildContactListSectorFilter(userId, accountId, 4);

    const listCheck = await db.query(
      `SELECT * FROM contact_lists WHERE id = $1 AND account_id = $3 AND user_id = $2 ${sectorFilter}`,
      [id, userId, accountId, ...sectorParams]
    );

    if (listCheck.rows.length === 0) {
      throw new NotFoundError('Lista de contatos não encontrada');
    }

    // Validar dados
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      throw new ValidationError('Lista de contatos vazia ou inválida');
    }

    // Atualizar informações de importação
    await db.query(
      `UPDATE contact_lists
       SET import_file_name = $1, import_date = CURRENT_TIMESTAMP, list_type = 'import'
       WHERE id = $2`,
      [fileName || 'imported.csv', id]
    );

    // Inserir contatos em lote
    let imported = 0;
    let errors = 0;

    for (const contact of contacts) {
      try {
        // Validar que tem pelo menos um campo
        if (!contact.name && !contact.email && !contact.phone && !contact.linkedin_url) {
          errors++;
          continue;
        }

        await db.query(
          `INSERT INTO contact_list_items (
            list_id, name, email, phone, linkedin_url, company, position, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
          [
            id,
            contact.name?.trim() || null,
            contact.email?.trim() || null,
            contact.phone?.trim() || null,
            contact.linkedin_url?.trim() || null,
            contact.company?.trim() || null,
            contact.position?.trim() || null
          ]
        );

        imported++;
      } catch (err) {
        console.error('Erro ao importar contato:', err);
        errors++;
      }
    }

    console.log(`✅ Importados ${imported} contatos, ${errors} erros`);

    sendSuccess(res, {
      message: `Importação concluída`,
      imported,
      errors,
      total: contacts.length
    });

  } catch (error) {
    console.error('❌ Erro ao importar contatos:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// EXPORTS
// ================================
module.exports = {
  getContactLists,
  getContactList,
  createContactList,
  updateContactList,
  deleteContactList,
  getContactListItems,
  addContactToList,
  removeContactFromList,
  importContactsFromCSV
};
