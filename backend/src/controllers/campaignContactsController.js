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
      // Aprovar todos os coletados/rejeitados
      result = await db.query(`
        UPDATE campaign_contacts
        SET status = 'approved', updated_at = NOW()
        WHERE campaign_id = $1
        AND account_id = $2
        AND status IN ('collected', 'rejected')
        RETURNING id
      `, [campaignId, accountId]);
    } else if (contact_ids && contact_ids.length > 0) {
      // Aprovar contatos específicos (collected ou rejected)
      result = await db.query(`
        UPDATE campaign_contacts
        SET status = 'approved', updated_at = NOW()
        WHERE campaign_id = $1
        AND account_id = $2
        AND id = ANY($3)
        AND status IN ('collected', 'rejected')
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
      // Rejeitar todos os coletados/aprovados
      result = await db.query(`
        UPDATE campaign_contacts
        SET status = 'rejected', updated_at = NOW()
        WHERE campaign_id = $1
        AND account_id = $2
        AND status IN ('collected', 'approved')
        RETURNING id
      `, [campaignId, accountId]);
    } else if (contact_ids && contact_ids.length > 0) {
      // Rejeitar contatos específicos (collected ou approved)
      result = await db.query(`
        UPDATE campaign_contacts
        SET status = 'rejected', updated_at = NOW()
        WHERE campaign_id = $1
        AND account_id = $2
        AND id = ANY($3)
        AND status IN ('collected', 'approved')
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

// ================================
// 6. ADICIONAR PERFIS DA BUSCA A UMA CAMPANHA (BULK)
// ================================
const bulkAddSearchProfiles = async (req, res) => {
  try {
    const { id: campaignId } = req.params;
    const accountId = req.user.account_id;
    const userId = req.user.id;
    const { profiles } = req.body;

    console.log(`➕ Adicionando ${profiles?.length || 0} perfis à campanha ${campaignId}`);

    if (!profiles || !Array.isArray(profiles) || profiles.length === 0) {
      return sendError(res, { message: 'Nenhum perfil fornecido' }, 400);
    }

    // Verificar se campanha pertence à conta
    const campaignCheck = await db.query(
      'SELECT id, name FROM campaigns WHERE id = $1 AND account_id = $2',
      [campaignId, accountId]
    );

    if (campaignCheck.rows.length === 0) {
      throw new NotFoundError('Campanha não encontrada');
    }

    let added = 0;
    let duplicates = 0;
    const errors = [];

    for (const profile of profiles) {
      try {
        // Construir/normalizar URL do LinkedIn
        let normalizedUrl = null;
        let linkedinProfileId = null;

        if (profile.profile_url) {
          normalizedUrl = profile.profile_url.split('?')[0].replace(/\/+$/, '');
        } else if (profile.provider_id) {
          normalizedUrl = `https://www.linkedin.com/in/${profile.provider_id}`;
        }

        if (normalizedUrl) {
          const profileIdMatch = normalizedUrl.match(/\/in\/([^/]+)$/);
          linkedinProfileId = profileIdMatch ? profileIdMatch[1] : null;
        }

        if (!linkedinProfileId && profile.provider_id) {
          linkedinProfileId = profile.provider_id;
        }

        // Buscar contato existente
        let contact;
        const existingContact = await db.query(
          `SELECT id FROM contacts
           WHERE account_id = $1 AND (
             ($2::text IS NOT NULL AND linkedin_profile_id = $2::text)
             OR ($3::text IS NOT NULL AND profile_url = $3::text)
           )`,
          [accountId, linkedinProfileId, normalizedUrl]
        );

        if (existingContact.rows.length > 0) {
          contact = existingContact.rows[0];
        } else {
          // Criar novo contato
          const newContact = await db.query(
            `INSERT INTO contacts
              (account_id, user_id, name, profile_url, linkedin_profile_id, title, company, location, profile_picture, headline, source)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'search')
            RETURNING id`,
            [
              accountId,
              userId,
              (profile.name || '').trim(),
              normalizedUrl,
              linkedinProfileId,
              profile.title || profile.headline || null,
              profile.company || profile.current_company || null,
              profile.location || null,
              profile.profile_picture || profile.profile_picture_url || null,
              profile.headline || null
            ]
          );
          contact = newContact.rows[0];
        }

        // Verificar duplicata na campanha
        const existingCampaignContact = await db.query(
          'SELECT id FROM campaign_contacts WHERE campaign_id = $1 AND contact_id = $2',
          [campaignId, contact.id]
        );

        if (existingCampaignContact.rows.length > 0) {
          duplicates++;
          continue;
        }

        // Inserir na campanha com status 'approved'
        await db.query(
          `INSERT INTO campaign_contacts
            (campaign_id, contact_id, account_id, status, linkedin_profile_id, provider_id)
          VALUES ($1, $2, $3, 'approved', $4, $5)`,
          [campaignId, contact.id, accountId, linkedinProfileId, profile.provider_id || null]
        );

        added++;
      } catch (profileError) {
        console.error(`❌ Erro ao adicionar perfil ${profile.name}:`, profileError.message);
        errors.push({ name: profile.name, error: profileError.message });
      }
    }

    console.log(`✅ Resultado: ${added} adicionados, ${duplicates} duplicatas, ${errors.length} erros`);

    sendSuccess(res, {
      added,
      duplicates,
      errors: errors.length,
      total: profiles.length
    });

  } catch (error) {
    console.error('❌ Erro ao adicionar perfis à campanha:', error);
    sendError(res, error);
  }
};

module.exports = {
  getCampaignContacts,
  getCampaignContactsStats,
  approveContacts,
  rejectContacts,
  updateContactStatus,
  bulkAddSearchProfiles
};
