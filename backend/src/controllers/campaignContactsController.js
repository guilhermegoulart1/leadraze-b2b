// backend/src/controllers/campaignContactsController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { NotFoundError, ForbiddenError } = require('../utils/errors');

// ================================
// 1. LISTAR CONTATOS DE UMA CAMPANHA
// ================================
const getCampaignContacts = async (req, res) => {
  try {
    const { id: campaignId } = req.params;
    const accountId = req.user.account_id;
    const { status, page = 1, limit = 50, search } = req.query;

    console.log(`📋 Listando contatos da campanha ${campaignId}`);

    // Verificar se campanha pertence à conta
    const campaignCheck = await db.query(
      'SELECT id FROM campaigns WHERE id = $1 AND account_id = $2',
      [campaignId, accountId]
    );

    if (campaignCheck.rows.length === 0) {
      throw new NotFoundError('Campanha não encontrada');
    }

    // Construir query
    let whereConditions = ['cc.campaign_id = $1', 'cc.account_id = $2'];
    let queryParams = [campaignId, accountId];
    let paramIndex = 3;

    // Filtro por status
    if (status) {
      whereConditions.push(`cc.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    // Filtro por busca (nome, empresa, cargo)
    if (search) {
      whereConditions.push(`(
        c.name ILIKE $${paramIndex} OR
        c.company ILIKE $${paramIndex} OR
        c.title ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.join(' AND ');

    // Query principal com join no contacts
    const query = `
      SELECT
        cc.id,
        cc.campaign_id,
        cc.contact_id,
        cc.status,
        cc.linkedin_profile_id,
        cc.invite_sent_at,
        cc.invite_accepted_at,
        cc.invite_expires_at,
        cc.created_at,
        cc.updated_at,
        c.name,
        c.title,
        c.company,
        c.location,
        c.profile_picture,
        c.profile_url,
        c.headline,
        c.email,
        c.phone
      FROM campaign_contacts cc
      JOIN contacts c ON cc.contact_id = c.id
      WHERE ${whereClause}
      ORDER BY cc.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);

    // Contar total
    const countQuery = `
      SELECT COUNT(*)
      FROM campaign_contacts cc
      JOIN contacts c ON cc.contact_id = c.id
      WHERE ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    console.log(`✅ Encontrados ${result.rows.length} contatos`);

    sendSuccess(res, {
      contacts: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Erro ao listar contatos da campanha:', error);
    sendError(res, error);
  }
};

// ================================
// 2. ESTATÍSTICAS DE CONTATOS
// ================================
const getCampaignContactsStats = async (req, res) => {
  try {
    const { id: campaignId } = req.params;
    const accountId = req.user.account_id;

    // Verificar se campanha pertence à conta
    const campaignCheck = await db.query(
      'SELECT id FROM campaigns WHERE id = $1 AND account_id = $2',
      [campaignId, accountId]
    );

    if (campaignCheck.rows.length === 0) {
      throw new NotFoundError('Campanha não encontrada');
    }

    // Contar por status
    const statsQuery = await db.query(`
      SELECT
        status,
        COUNT(*) as count
      FROM campaign_contacts
      WHERE campaign_id = $1 AND account_id = $2
      GROUP BY status
    `, [campaignId, accountId]);

    // Transformar em objeto
    const stats = {
      total: 0,
      collected: 0,
      approved: 0,
      rejected: 0,
      invite_sent: 0,
      invite_accepted: 0,
      invite_expired: 0,
      conversation_started: 0,
      conversation_ended: 0
    };

    statsQuery.rows.forEach(row => {
      stats[row.status] = parseInt(row.count);
      stats.total += parseInt(row.count);
    });

    sendSuccess(res, { stats });

  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    sendError(res, error);
  }
};

// ================================
// 3. APROVAR CONTATOS (BULK)
// ================================
const approveContacts = async (req, res) => {
  try {
    const { id: campaignId } = req.params;
    const accountId = req.user.account_id;
    const { contact_ids, approve_all } = req.body;

    console.log(`✅ Aprovando contatos da campanha ${campaignId}`);

    // Verificar se campanha pertence à conta
    const campaignCheck = await db.query(
      'SELECT id FROM campaigns WHERE id = $1 AND account_id = $2',
      [campaignId, accountId]
    );

    if (campaignCheck.rows.length === 0) {
      throw new NotFoundError('Campanha não encontrada');
    }

    let result;

    if (approve_all) {
      // Aprovar todos os coletados
      result = await db.query(`
        UPDATE campaign_contacts
        SET status = 'approved', updated_at = NOW()
        WHERE campaign_id = $1
        AND account_id = $2
        AND status = 'collected'
        RETURNING id
      `, [campaignId, accountId]);
    } else if (contact_ids && contact_ids.length > 0) {
      // Aprovar contatos específicos
      result = await db.query(`
        UPDATE campaign_contacts
        SET status = 'approved', updated_at = NOW()
        WHERE campaign_id = $1
        AND account_id = $2
        AND id = ANY($3)
        AND status = 'collected'
        RETURNING id
      `, [campaignId, accountId, contact_ids]);
    } else {
      return sendSuccess(res, { approved_count: 0 });
    }

    console.log(`✅ ${result.rowCount} contatos aprovados`);

    sendSuccess(res, {
      approved_count: result.rowCount
    });

  } catch (error) {
    console.error('❌ Erro ao aprovar contatos:', error);
    sendError(res, error);
  }
};

// ================================
// 4. REJEITAR CONTATOS (BULK)
// ================================
const rejectContacts = async (req, res) => {
  try {
    const { id: campaignId } = req.params;
    const accountId = req.user.account_id;
    const { contact_ids, reject_all } = req.body;

    console.log(`❌ Rejeitando contatos da campanha ${campaignId}`);

    // Verificar se campanha pertence à conta
    const campaignCheck = await db.query(
      'SELECT id FROM campaigns WHERE id = $1 AND account_id = $2',
      [campaignId, accountId]
    );

    if (campaignCheck.rows.length === 0) {
      throw new NotFoundError('Campanha não encontrada');
    }

    let result;

    if (reject_all) {
      // Rejeitar todos os coletados
      result = await db.query(`
        UPDATE campaign_contacts
        SET status = 'rejected', updated_at = NOW()
        WHERE campaign_id = $1
        AND account_id = $2
        AND status = 'collected'
        RETURNING id
      `, [campaignId, accountId]);
    } else if (contact_ids && contact_ids.length > 0) {
      // Rejeitar contatos específicos
      result = await db.query(`
        UPDATE campaign_contacts
        SET status = 'rejected', updated_at = NOW()
        WHERE campaign_id = $1
        AND account_id = $2
        AND id = ANY($3)
        AND status = 'collected'
        RETURNING id
      `, [campaignId, accountId, contact_ids]);
    } else {
      return sendSuccess(res, { rejected_count: 0 });
    }

    console.log(`✅ ${result.rowCount} contatos rejeitados`);

    sendSuccess(res, {
      rejected_count: result.rowCount
    });

  } catch (error) {
    console.error('❌ Erro ao rejeitar contatos:', error);
    sendError(res, error);
  }
};

// ================================
// 5. ATUALIZAR STATUS DE UM CONTATO
// ================================
const updateContactStatus = async (req, res) => {
  try {
    const { id: campaignId, contactId } = req.params;
    const accountId = req.user.account_id;
    const { status } = req.body;

    const validStatuses = [
      'collected', 'approved', 'rejected', 'invite_queued', 'invite_sent',
      'invite_accepted', 'invite_expired', 'conversation_started', 'conversation_ended'
    ];

    if (!validStatuses.includes(status)) {
      return sendError(res, { message: 'Status inválido' }, 400);
    }

    // Verificar se campanha pertence à conta
    const campaignCheck = await db.query(
      'SELECT id FROM campaigns WHERE id = $1 AND account_id = $2',
      [campaignId, accountId]
    );

    if (campaignCheck.rows.length === 0) {
      throw new NotFoundError('Campanha não encontrada');
    }

    // Atualizar status
    const result = await db.query(`
      UPDATE campaign_contacts
      SET status = $1, updated_at = NOW()
      WHERE campaign_id = $2
      AND account_id = $3
      AND id = $4
      RETURNING *
    `, [status, campaignId, accountId, contactId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Contato não encontrado nesta campanha');
    }

    sendSuccess(res, {
      contact: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar status:', error);
    sendError(res, error);
  }
};

module.exports = {
  getCampaignContacts,
  getCampaignContactsStats,
  approveContacts,
  rejectContacts,
  updateContactStatus
};
