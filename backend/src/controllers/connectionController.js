// backend/src/controllers/connectionController.js
const db = require('../config/database');
const unipileClient = require('../config/unipile');
const { sendSuccess, sendError } = require('../utils/responses');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { enrichContactInBackground } = require('../services/contactEnrichmentService');

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
// CONVITES DO LINKEDIN
// ================================

/**
 * Listar convites enviados pendentes
 */
const getSentInvitations = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { linkedin_account_id, limit, cursor } = req.query;

    console.log(`📤 [Invitations] Buscando convites enviados`);

    if (!linkedin_account_id) {
      throw new ValidationError('linkedin_account_id é obrigatório');
    }

    // Buscar conta LinkedIn do usuário
    const linkedinResult = await db.query(
      `SELECT id, unipile_account_id FROM linkedin_accounts
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

    // Buscar convites enviados via Unipile
    const invitationsData = await unipileClient.users.listSentInvitations({
      account_id: linkedinAccount.unipile_account_id,
      limit: limit ? parseInt(limit) : undefined,
      cursor
    });

    // Normalizar dados dos convites enviados
    const invitations = (invitationsData.items || []).map(invite => ({
      id: invite.id,
      provider_id: invite.invited_user_id,
      name: invite.invited_user || 'Usuário LinkedIn',
      first_name: extractFirstName(invite.invited_user),
      headline: invite.invited_user_description || '',
      profile_picture: invite.invited_user_profile_picture_url || null,
      profile_url: invite.invited_user_public_id ? `https://linkedin.com/in/${invite.invited_user_public_id}` : null,
      sent_at: invite.parsed_datetime || null,
      message: invite.invitation_text || null
    }));

    console.log(`✅ [Invitations] Encontrados ${invitations.length} convites enviados`);

    sendSuccess(res, {
      invitations,
      cursor: invitationsData.cursor || null,
      has_more: !!invitationsData.cursor
    });

  } catch (error) {
    console.error('❌ [Invitations] Erro ao buscar convites enviados:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Listar convites recebidos pendentes
 */
const getReceivedInvitations = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { linkedin_account_id, limit, cursor } = req.query;

    console.log(`📥 [Invitations] Buscando convites recebidos`);

    if (!linkedin_account_id) {
      throw new ValidationError('linkedin_account_id é obrigatório');
    }

    // Buscar conta LinkedIn do usuário
    const linkedinResult = await db.query(
      `SELECT id, unipile_account_id FROM linkedin_accounts
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

    // Buscar convites recebidos via Unipile
    const invitationsData = await unipileClient.users.listReceivedInvitations({
      account_id: linkedinAccount.unipile_account_id,
      limit: limit ? parseInt(limit) : undefined,
      cursor
    });

    // Normalizar dados dos convites recebidos
    // Estrutura real da Unipile: dados do remetente estão em invite.inviter
    // - inviter.inviter_id, inviter.inviter_name, inviter.inviter_public_identifier
    // - inviter.inviter_description, inviter.inviter_profile_picture_url
    const invitations = (invitationsData.items || []).map(invite => {
      const inviter = invite.inviter || {};
      const specifics = invite.specifics || {};
      return {
        id: invite.id,
        provider_id: inviter.inviter_id || null,
        name: inviter.inviter_name || 'Usuário LinkedIn',
        first_name: extractFirstName(inviter.inviter_name),
        headline: inviter.inviter_description || '',
        profile_picture: inviter.inviter_profile_picture_url || null,
        profile_url: inviter.inviter_public_identifier
          ? `https://linkedin.com/in/${inviter.inviter_public_identifier}`
          : null,
        received_at: invite.parsed_datetime || null,
        message: invite.invitation_text || null,
        // Dados necessários para aceitar/rejeitar o convite
        provider: specifics.provider || 'LINKEDIN',
        shared_secret: specifics.shared_secret || null
      };
    });

    console.log(`✅ [Invitations] Encontrados ${invitations.length} convites recebidos`);

    sendSuccess(res, {
      invitations,
      cursor: invitationsData.cursor || null,
      has_more: !!invitationsData.cursor
    });

  } catch (error) {
    console.error('❌ [Invitations] Erro ao buscar convites recebidos:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Aceitar convite recebido
 * Também cria/atualiza o contato e dispara enriquecimento (igual ao fluxo de mensagens)
 */
const acceptInvitation = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const userId = req.user.id;
    const { invitation_id } = req.params;
    const { linkedin_account_id, provider, shared_secret, inviter } = req.body;

    console.log(`✅ [Invitations] Aceitando convite: ${invitation_id}`);

    if (!linkedin_account_id) {
      throw new ValidationError('linkedin_account_id é obrigatório');
    }

    if (!shared_secret) {
      throw new ValidationError('shared_secret é obrigatório para aceitar convites do LinkedIn');
    }

    // Buscar conta LinkedIn do usuário
    const linkedinResult = await db.query(
      `SELECT id, unipile_account_id FROM linkedin_accounts
       WHERE id = $1 AND account_id = $2`,
      [linkedin_account_id, accountId]
    );

    if (linkedinResult.rows.length === 0) {
      throw new NotFoundError('Conta LinkedIn não encontrada');
    }

    const linkedinAccount = linkedinResult.rows[0];

    // Aceitar convite via Unipile (requer provider e shared_secret para LinkedIn)
    const result = await unipileClient.users.handleReceivedInvitation({
      account_id: linkedinAccount.unipile_account_id,
      invitation_id,
      action: 'accept',
      provider: provider || 'LINKEDIN',
      shared_secret
    });

    console.log(`✅ [Invitations] Convite aceito com sucesso`);

    // =====================================================
    // CRIAR/ATUALIZAR CONTATO E ENRIQUECER
    // Ao aceitar o convite, a pessoa vira conexão de 1º grau
    // =====================================================
    let contactId = null;
    const inviterProviderId = inviter?.provider_id;

    if (inviterProviderId) {
      try {
        // Verificar se já existe contato com este provider_id
        const existingContact = await db.query(
          `SELECT id, full_profile_fetched_at FROM contacts
           WHERE account_id = $1 AND linkedin_profile_id = $2 LIMIT 1`,
          [accountId, inviterProviderId]
        );

        if (existingContact.rows.length > 0) {
          // Atualizar contato existente
          contactId = existingContact.rows[0].id;
          const updateData = {
            updated_at: new Date(),
            network_distance: 'DISTANCE_1' // Agora é 1º grau
          };
          if (inviter?.name) updateData.name = inviter.name;
          if (inviter?.headline) updateData.headline = inviter.headline;
          if (inviter?.profile_picture) updateData.profile_picture = inviter.profile_picture;
          if (inviter?.public_identifier) {
            updateData.public_identifier = inviter.public_identifier;
            updateData.profile_url = `https://www.linkedin.com/in/${inviter.public_identifier}`;
          }

          await db.update('contacts', updateData, { id: contactId });
          console.log(`✅ [Invitations] Contato atualizado: ${contactId}`);
        } else {
          // Criar novo contato
          const newContact = await db.insert('contacts', {
            user_id: userId,
            account_id: accountId,
            linkedin_profile_id: inviterProviderId,
            name: inviter?.name || 'Usuário LinkedIn',
            headline: inviter?.headline || null,
            profile_picture: inviter?.profile_picture || null,
            public_identifier: inviter?.public_identifier || null,
            profile_url: inviter?.public_identifier
              ? `https://www.linkedin.com/in/${inviter.public_identifier}`
              : null,
            network_distance: 'DISTANCE_1', // Ao aceitar, vira 1º grau
            source: 'linkedin_invitation'
          });
          contactId = newContact.id;
          console.log(`✅ [Invitations] Novo contato criado: ${contactId}`);
        }

        // Disparar enriquecimento em background (igual ao fluxo de mensagens)
        // Como acabou de aceitar, é 1º grau e podemos buscar perfil completo + empresa
        if (contactId && inviterProviderId) {
          console.log(`🔄 [Invitations] Iniciando enriquecimento do contato ${contactId}`);
          enrichContactInBackground(
            contactId,
            linkedinAccount.unipile_account_id,
            inviterProviderId,
            { enrichCompanyData: true }
          );
        }

      } catch (contactError) {
        // Erro ao criar contato não deve falhar a aceitação do convite
        console.error('⚠️ [Invitations] Erro ao criar/atualizar contato (não crítico):', contactError.message);
      }
    } else {
      console.log('⚠️ [Invitations] Dados do inviter não fornecidos, pulando criação de contato');
    }

    sendSuccess(res, { success: true, result, contact_id: contactId });

  } catch (error) {
    console.error('❌ [Invitations] Erro ao aceitar convite:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Rejeitar convite recebido
 */
const rejectInvitation = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { invitation_id } = req.params;
    const { linkedin_account_id, provider, shared_secret } = req.body;

    console.log(`❌ [Invitations] Rejeitando convite: ${invitation_id}`);

    if (!linkedin_account_id) {
      throw new ValidationError('linkedin_account_id é obrigatório');
    }

    if (!shared_secret) {
      throw new ValidationError('shared_secret é obrigatório para rejeitar convites do LinkedIn');
    }

    // Buscar conta LinkedIn do usuário
    const linkedinResult = await db.query(
      `SELECT id, unipile_account_id FROM linkedin_accounts
       WHERE id = $1 AND account_id = $2`,
      [linkedin_account_id, accountId]
    );

    if (linkedinResult.rows.length === 0) {
      throw new NotFoundError('Conta LinkedIn não encontrada');
    }

    const linkedinAccount = linkedinResult.rows[0];

    // Rejeitar convite via Unipile (requer provider e shared_secret para LinkedIn)
    const result = await unipileClient.users.handleReceivedInvitation({
      account_id: linkedinAccount.unipile_account_id,
      invitation_id,
      action: 'decline',
      provider: provider || 'LINKEDIN',
      shared_secret
    });

    console.log(`✅ [Invitations] Convite rejeitado com sucesso`);

    sendSuccess(res, { success: true, result });

  } catch (error) {
    console.error('❌ [Invitations] Erro ao rejeitar convite:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Cancelar/retirar convite enviado
 */
const cancelInvitation = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { invitation_id } = req.params;
    const { linkedin_account_id } = req.query;

    console.log(`🚫 [Invitations] Cancelando convite: ${invitation_id}`);

    if (!linkedin_account_id) {
      throw new ValidationError('linkedin_account_id é obrigatório');
    }

    // Buscar conta LinkedIn do usuário
    const linkedinResult = await db.query(
      `SELECT id, unipile_account_id FROM linkedin_accounts
       WHERE id = $1 AND account_id = $2`,
      [linkedin_account_id, accountId]
    );

    if (linkedinResult.rows.length === 0) {
      throw new NotFoundError('Conta LinkedIn não encontrada');
    }

    const linkedinAccount = linkedinResult.rows[0];

    // Cancelar convite via Unipile
    const result = await unipileClient.users.cancelInvitation({
      account_id: linkedinAccount.unipile_account_id,
      invitation_id
    });

    console.log(`✅ [Invitations] Convite cancelado com sucesso`);

    sendSuccess(res, { success: true, result });

  } catch (error) {
    console.error('❌ [Invitations] Erro ao cancelar convite:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Enviar convite para um usuário (usado nas conversas)
 */
const sendInvitation = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { linkedin_account_id, provider_id, message } = req.body;

    console.log(`📨 [Invitations] Enviando convite para: ${provider_id}`);

    if (!linkedin_account_id) {
      throw new ValidationError('linkedin_account_id é obrigatório');
    }

    if (!provider_id) {
      throw new ValidationError('provider_id é obrigatório');
    }

    // Buscar conta LinkedIn do usuário
    const linkedinResult = await db.query(
      `SELECT id, unipile_account_id FROM linkedin_accounts
       WHERE id = $1 AND account_id = $2`,
      [linkedin_account_id, accountId]
    );

    if (linkedinResult.rows.length === 0) {
      throw new NotFoundError('Conta LinkedIn não encontrada');
    }

    const linkedinAccount = linkedinResult.rows[0];

    // Enviar convite via Unipile
    const result = await unipileClient.users.sendConnectionRequest({
      account_id: linkedinAccount.unipile_account_id,
      user_id: provider_id,
      message: message || undefined
    });

    console.log(`✅ [Invitations] Convite enviado com sucesso`);

    // Salvar no snapshot para detectar aceitação
    // Se tem mensagem, podemos detectar via MessageReceived webhook (tempo real)
    // Se não tem mensagem, detectamos via NewRelation webhook (delay até 8h)
    try {
      await db.query(
        `INSERT INTO invitation_snapshots
         (account_id, linkedin_account_id, invitation_type, invitation_id, provider_id, invitation_message, detected_at)
         VALUES ($1, $2, 'sent', $3, $4, $5, NOW())
         ON CONFLICT (linkedin_account_id, invitation_id) DO NOTHING`,
        [
          accountId,
          linkedinAccount.id,
          result?.invitation_id || `sent_${provider_id}_${Date.now()}`,
          provider_id,
          message || null
        ]
      );
      console.log(`📸 [Invitations] Snapshot salvo para detectar aceitação`);
    } catch (snapshotError) {
      // Silent fail - não deve bloquear o envio
      console.error('⚠️ [Invitations] Erro ao salvar snapshot:', snapshotError.message);
    }

    sendSuccess(res, { success: true, result });

  } catch (error) {
    console.error('❌ [Invitations] Erro ao enviar convite:', error);
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
  normalizeProfile,
  // Invitations
  getSentInvitations,
  getReceivedInvitations,
  acceptInvitation,
  rejectInvitation,
  cancelInvitation,
  sendInvitation
};
