// backend/src/controllers/connectionController.js
const db = require('../config/database');
const unipileClient = require('../config/unipile');
const { sendSuccess, sendError } = require('../utils/responses');
const { ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Extrai primeiro nome de um nome completo
 * @param {string} fullName - Nome completo
 * @returns {string} Primeiro nome
 */
function extractFirstName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  return parts[0] || fullName;
}

/**
 * Normaliza dados do perfil da Unipile para formato padronizado
 * @param {Object} profile - Perfil retornado pela Unipile
 * @returns {Object} Perfil normalizado
 */
function normalizeProfile(profile) {
  return {
    // Identificadores
    provider_id: profile.provider_id || profile.id,
    public_identifier: profile.public_identifier || profile.public_id,

    // Dados básicos
    name: profile.name || profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
    first_name: profile.first_name || extractFirstName(profile.name),
    last_name: profile.last_name || '',
    headline: profile.headline || profile.title || '',
    location: profile.location || profile.location_name || '',
    profile_picture: profile.profile_picture || profile.picture_url || profile.profile_picture_url || null,

    // Profissional
    company: profile.company || profile.current_company || profile.experience?.[0]?.company || '',
    title: profile.title || profile.current_title || profile.experience?.[0]?.title || '',
    industry: profile.industry || '',

    // Conexões
    connections_count: profile.connections_count || profile.connections || 0,
    followers_count: profile.followers_count || profile.followers || 0,

    // Sobre
    about: profile.about || profile.summary || '',

    // Experiência
    experience: profile.experience || profile.positions || [],

    // Educação
    education: profile.education || [],

    // Skills
    skills: profile.skills || [],

    // Idiomas
    languages: profile.languages || [],

    // Certificações
    certifications: profile.certifications || [],

    // URLs
    profile_url: profile.profile_url || profile.linkedin_url || (profile.public_identifier ? `https://linkedin.com/in/${profile.public_identifier}` : null),

    // Network
    network_distance: profile.network_distance || 'FIRST_DEGREE',
    is_connection: profile.is_relationship || profile.network_distance === 'FIRST_DEGREE'
  };
}

// ================================
// 1. LISTAR CONEXÕES DE 1º GRAU
// ================================
const getConnections = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      linkedin_account_id,
      limit = 50,
      cursor,
      keywords,
      job_title,
      industry,
      location
    } = req.query;

    console.log(`🔗 [Connections] Buscando conexões para usuário ${userId}`);

    if (!linkedin_account_id) {
      throw new ValidationError('linkedin_account_id é obrigatório');
    }

    // Buscar conta LinkedIn do usuário
    const linkedinResult = await db.query(
      `SELECT id, unipile_account_id, profile_name, linkedin_username, daily_limit
       FROM linkedin_accounts
       WHERE id = $1 AND account_id = $2`,
      [linkedin_account_id, accountId]
    );

    if (linkedinResult.rows.length === 0) {
      throw new NotFoundError('Conta LinkedIn não encontrada');
    }

    const linkedinAccount = linkedinResult.rows[0];

    if (!linkedinAccount.unipile_account_id) {
      throw new ValidationError('Conta LinkedIn não está conectada à Unipile');
    }

    // Buscar conexões via Unipile
    const connectionsData = await unipileClient.connections.search({
      account_id: linkedinAccount.unipile_account_id,
      limit: Math.min(parseInt(limit), 100),
      cursor,
      keywords,
      job_title,
      industry,
      location
    });

    // Processar e normalizar conexões
    const connections = (connectionsData.items || []).map(profile => {
      const normalized = normalizeProfile(profile);
      return {
        ...normalized,
        // Flag para indicar se já existe no CRM
        in_crm: false, // Será preenchido abaixo
        // Campanhas anteriores (será preenchido abaixo)
        previous_campaigns: []
      };
    });

    // Buscar quais conexões já estão no CRM e suas campanhas
    if (connections.length > 0) {
      const providerIds = connections.map(c => c.provider_id).filter(Boolean);

      if (providerIds.length > 0) {
        // Buscar contatos existentes no CRM
        const existingContacts = await db.query(
          `SELECT
            c.id,
            c.linkedin_profile_id,
            c.name,
            array_agg(DISTINCT jsonb_build_object(
              'id', ac.id,
              'name', ac.name,
              'status', ac.status,
              'type', 'activation'
            )) FILTER (WHERE ac.id IS NOT NULL) as campaigns
          FROM contacts c
          LEFT JOIN activation_campaign_contacts acc ON acc.contact_id = c.id
          LEFT JOIN activation_campaigns ac ON acc.campaign_id = ac.id
          WHERE c.account_id = $1
            AND c.linkedin_profile_id = ANY($2)
          GROUP BY c.id, c.linkedin_profile_id, c.name`,
          [accountId, providerIds]
        );

        // Criar mapa de contatos existentes
        const contactMap = new Map();
        existingContacts.rows.forEach(contact => {
          contactMap.set(contact.linkedin_profile_id, {
            contact_id: contact.id,
            campaigns: contact.campaigns || []
          });
        });

        // Atualizar conexões com info do CRM
        connections.forEach(conn => {
          const existingInfo = contactMap.get(conn.provider_id);
          if (existingInfo) {
            conn.in_crm = true;
            conn.contact_id = existingInfo.contact_id;
            conn.previous_campaigns = existingInfo.campaigns.filter(c => c.id !== null);
          }
        });
      }
    }

    console.log(`✅ [Connections] Encontradas ${connections.length} conexões`);

    sendSuccess(res, {
      connections,
      cursor: connectionsData.cursor || null,
      has_more: !!connectionsData.cursor,
      total_in_page: connections.length
    });

  } catch (error) {
    console.error('❌ [Connections] Erro ao buscar conexões:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 2. BUSCAR PERFIL COMPLETO
// ================================
const getFullProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { provider_id } = req.params;
    const { linkedin_account_id } = req.query;

    console.log(`👤 [Connections] Buscando perfil completo: ${provider_id}`);

    if (!linkedin_account_id) {
      throw new ValidationError('linkedin_account_id é obrigatório');
    }

    // Buscar conta LinkedIn
    const linkedinResult = await db.query(
      `SELECT id, unipile_account_id FROM linkedin_accounts
       WHERE id = $1 AND account_id = $2`,
      [linkedin_account_id, accountId]
    );

    if (linkedinResult.rows.length === 0) {
      throw new NotFoundError('Conta LinkedIn não encontrada');
    }

    const linkedinAccount = linkedinResult.rows[0];

    // Buscar perfil completo via Unipile
    const profileData = await unipileClient.users.getFullProfile(
      linkedinAccount.unipile_account_id,
      provider_id
    );

    // Normalizar perfil
    const profile = normalizeProfile(profileData);

    // Verificar se já existe no CRM e buscar campanhas
    const existingContact = await db.query(
      `SELECT
        c.*,
        array_agg(DISTINCT jsonb_build_object(
          'id', ac.id,
          'name', ac.name,
          'status', ac.status,
          'activated_at', acc.message_sent_at
        )) FILTER (WHERE ac.id IS NOT NULL) as campaigns
      FROM contacts c
      LEFT JOIN activation_campaign_contacts acc ON acc.contact_id = c.id
      LEFT JOIN activation_campaigns ac ON acc.campaign_id = ac.id
      WHERE c.account_id = $1 AND c.linkedin_profile_id = $2
      GROUP BY c.id`,
      [accountId, provider_id]
    );

    if (existingContact.rows.length > 0) {
      profile.in_crm = true;
      profile.contact_id = existingContact.rows[0].id;
      profile.previous_campaigns = existingContact.rows[0].campaigns?.filter(c => c.id !== null) || [];
      profile.crm_data = existingContact.rows[0];
    } else {
      profile.in_crm = false;
      profile.previous_campaigns = [];
    }

    console.log(`✅ [Connections] Perfil carregado: ${profile.name}`);

    sendSuccess(res, { profile });

  } catch (error) {
    console.error('❌ [Connections] Erro ao buscar perfil:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 3. SALVAR CONEXÃO NO CRM
// ================================
const saveConnectionToCRM = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { linkedin_account_id, profile } = req.body;

    console.log(`💾 [Connections] Salvando conexão no CRM: ${profile.name}`);

    if (!profile || !profile.provider_id) {
      throw new ValidationError('Dados do perfil são obrigatórios');
    }

    // Verificar se já existe
    const existingResult = await db.query(
      `SELECT id FROM contacts WHERE account_id = $1 AND linkedin_profile_id = $2`,
      [accountId, profile.provider_id]
    );

    if (existingResult.rows.length > 0) {
      // Atualizar contato existente
      const updateResult = await db.query(
        `UPDATE contacts SET
          name = COALESCE($3, name),
          title = COALESCE($4, title),
          company = COALESCE($5, company),
          headline = COALESCE($6, headline),
          location = COALESCE($7, location),
          industry = COALESCE($8, industry),
          about = COALESCE($9, about),
          profile_picture = COALESCE($10, profile_picture),
          profile_url = COALESCE($11, profile_url),
          connections_count = COALESCE($12, connections_count),
          custom_fields = COALESCE($13, custom_fields),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND account_id = $2
        RETURNING *`,
        [
          existingResult.rows[0].id,
          accountId,
          profile.name,
          profile.title,
          profile.company,
          profile.headline,
          profile.location,
          profile.industry,
          profile.about,
          profile.profile_picture,
          profile.profile_url,
          profile.connections_count,
          JSON.stringify({
            experience: profile.experience,
            education: profile.education,
            skills: profile.skills,
            languages: profile.languages,
            certifications: profile.certifications,
            first_name: profile.first_name,
            last_name: profile.last_name
          })
        ]
      );

      console.log(`✅ [Connections] Contato atualizado: ${updateResult.rows[0].id}`);
      sendSuccess(res, { contact: updateResult.rows[0], action: 'updated' });

    } else {
      // Criar novo contato
      const insertResult = await db.query(
        `INSERT INTO contacts (
          account_id, user_id, name, title, company, headline,
          location, industry, about, profile_picture, profile_url,
          linkedin_profile_id, connections_count, source, custom_fields
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'linkedin', $14)
        RETURNING *`,
        [
          accountId,
          userId,
          profile.name,
          profile.title,
          profile.company,
          profile.headline,
          profile.location,
          profile.industry,
          profile.about,
          profile.profile_picture,
          profile.profile_url,
          profile.provider_id,
          profile.connections_count,
          JSON.stringify({
            experience: profile.experience,
            education: profile.education,
            skills: profile.skills,
            languages: profile.languages,
            certifications: profile.certifications,
            first_name: profile.first_name,
            last_name: profile.last_name
          })
        ]
      );

      console.log(`✅ [Connections] Novo contato criado: ${insertResult.rows[0].id}`);
      sendSuccess(res, { contact: insertResult.rows[0], action: 'created' }, 201);
    }

  } catch (error) {
    console.error('❌ [Connections] Erro ao salvar no CRM:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 4. OBTER LIMITE DIÁRIO DO USUÁRIO
// ================================
const getDailyLimit = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT
        COALESCE(daily_connection_activation_limit, 100) as daily_limit,
        COALESCE(today_connection_activations, 0) as today_sent,
        last_connection_activation_date
      FROM users WHERE id = $1`,
      [userId]
    );

    const user = result.rows[0] || { daily_limit: 100, today_sent: 0 };

    // Resetar contagem se for um novo dia
    const today = new Date().toDateString();
    const lastDate = user.last_connection_activation_date
      ? new Date(user.last_connection_activation_date).toDateString()
      : null;

    if (lastDate !== today) {
      user.today_sent = 0;
    }

    sendSuccess(res, {
      daily_limit: user.daily_limit,
      today_sent: user.today_sent,
      remaining: Math.max(0, user.daily_limit - user.today_sent)
    });

  } catch (error) {
    console.error('❌ [Connections] Erro ao buscar limite:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 5. ATUALIZAR LIMITE DIÁRIO
// ================================
const updateDailyLimit = async (req, res) => {
  try {
    const userId = req.user.id;
    const { daily_limit } = req.body;

    if (!daily_limit || daily_limit < 1 || daily_limit > 500) {
      throw new ValidationError('Limite diário deve estar entre 1 e 500');
    }

    await db.query(
      `UPDATE users SET daily_connection_activation_limit = $1 WHERE id = $2`,
      [daily_limit, userId]
    );

    console.log(`✅ [Connections] Limite atualizado para ${daily_limit}`);

    sendSuccess(res, { daily_limit });

  } catch (error) {
    console.error('❌ [Connections] Erro ao atualizar limite:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  getConnections,
  getFullProfile,
  saveConnectionToCRM,
  getDailyLimit,
  updateDailyLimit,
  extractFirstName,
  normalizeProfile
};
