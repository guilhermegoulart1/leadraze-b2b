// backend/src/controllers/conversationController.js
const db = require('../config/database');
const unipileClient = require('../config/unipile');
const conversationSummaryService = require('../services/conversationSummaryService');
const storageService = require('../services/storageService');
const { sendSuccess, sendError } = require('../utils/responses');
const {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  UnipileError
} = require('../utils/errors');
const { getAccessibleSectorIds } = require('../middleware/permissions');

// ================================
// HELPER: Build sector filter for queries
// ================================
async function buildSectorFilter(userId, accountId, paramIndex = 4) {
  const accessibleSectorIds = await getAccessibleSectorIds(userId, accountId);

  if (accessibleSectorIds.length > 0) {
    return {
      filter: `AND (conv.sector_id = ANY($${paramIndex}) OR conv.sector_id IS NULL)`,
      params: [accessibleSectorIds]
    };
  } else {
    return {
      filter: 'AND conv.sector_id IS NULL',
      params: []
    };
  }
}

// ================================
// HELPER: Check if user has channel permissions configured
// ================================
async function hasUserChannelPermissions(userId, accountId) {
  const result = await db.query(
    'SELECT COUNT(*) as count FROM user_channel_permissions WHERE user_id = $1 AND account_id = $2',
    [userId, accountId]
  );
  return parseInt(result.rows[0].count) > 0;
}

// ================================
// HELPER: Build conversation access filter (user_id + sector)
// When user has channel permissions, skip user_id filter (channel permissions control access)
// When user has NO channel permissions, use user_id filter (backward compatibility)
// ================================
async function buildConversationAccessFilter(userId, accountId, baseParamIndex = 3) {
  const hasChannelPerms = await hasUserChannelPermissions(userId, accountId);
  const accessibleSectorIds = await getAccessibleSectorIds(userId, accountId);

  let userIdFilter = '';
  let params = [];
  let paramIndex = baseParamIndex;

  // Only apply user_id filter when NO channel permissions configured
  if (!hasChannelPerms) {
    userIdFilter = `AND conv.user_id = $${paramIndex}`;
    params.push(userId);
    paramIndex++;
  }

  // Build sector filter
  let sectorFilter = '';
  if (accessibleSectorIds.length > 0) {
    sectorFilter = `AND (conv.sector_id = ANY($${paramIndex}) OR conv.sector_id IS NULL)`;
    params.push(accessibleSectorIds);
    paramIndex++;
  } else {
    sectorFilter = 'AND conv.sector_id IS NULL';
  }

  return {
    filter: `${userIdFilter} ${sectorFilter}`,
    params,
    hasChannelPermissions: hasChannelPerms
  };
}

// ================================
// HELPER: Build channel permissions filter for queries
// ================================
async function buildChannelPermissionsFilter(userId, accountId, paramIndex = 4) {
  // First, check if user has ANY permissions configured (including 'none')
  const checkQuery = `
    SELECT COUNT(*) as count
    FROM user_channel_permissions
    WHERE user_id = $1 AND account_id = $2
  `;
  const checkResult = await db.query(checkQuery, [userId, accountId]);
  const hasAnyPermissions = parseInt(checkResult.rows[0].count) > 0;

  console.log(`🔍 [CHANNEL-PERMS] User ${userId}: hasAnyPermissions=${hasAnyPermissions}`);

  // If no permissions configured at all, allow all channels (backward compatibility)
  if (!hasAnyPermissions) {
    console.log(`🔍 [CHANNEL-PERMS] User ${userId}: No permissions configured, allowing all channels`);
    return {
      filter: '',
      params: [],
      hasPermissions: false
    };
  }

  // Get user's channel permissions that grant access
  const permQuery = `
    SELECT linkedin_account_id, access_type
    FROM user_channel_permissions
    WHERE user_id = $1 AND account_id = $2 AND access_type != 'none'
  `;
  const permResult = await db.query(permQuery, [userId, accountId]);

  console.log(`🔍 [CHANNEL-PERMS] User ${userId}: channels with access (not 'none'):`, permResult.rows);

  // User has permissions configured but all are 'none' - block all channels
  if (permResult.rows.length === 0) {
    console.log(`🔍 [CHANNEL-PERMS] User ${userId}: All permissions are 'none', BLOCKING all channels`);
    return {
      filter: 'AND FALSE',
      params: [],
      hasPermissions: true
    };
  }

  // Separate channels by access type
  const allAccessChannels = permResult.rows
    .filter(p => p.access_type === 'all')
    .map(p => p.linkedin_account_id);

  const assignedOnlyChannels = permResult.rows
    .filter(p => p.access_type === 'assigned_only')
    .map(p => p.linkedin_account_id);

  // Build filter:
  // - For 'all' channels: user sees all conversations
  // - For 'assigned_only' channels: user only sees assigned conversations
  const conditions = [];
  const params = [];

  if (allAccessChannels.length > 0) {
    conditions.push(`conv.linkedin_account_id = ANY($${paramIndex})`);
    params.push(allAccessChannels);
    paramIndex++;
  }

  if (assignedOnlyChannels.length > 0) {
    conditions.push(`(conv.linkedin_account_id = ANY($${paramIndex}) AND conv.assigned_user_id = $${paramIndex + 1})`);
    params.push(assignedOnlyChannels);
    params.push(userId);
    paramIndex += 2;
  }

  if (conditions.length === 0) {
    // User has no access to any channel
    console.log(`🔍 [CHANNEL-PERMS] User ${userId}: No conditions built, BLOCKING all channels`);
    return {
      filter: 'AND FALSE',
      params: [],
      hasPermissions: true
    };
  }

  const finalFilter = `AND (${conditions.join(' OR ')})`;
  console.log(`🔍 [CHANNEL-PERMS] User ${userId}: Final filter: ${finalFilter}`);
  console.log(`🔍 [CHANNEL-PERMS] User ${userId}: allAccessChannels=`, allAccessChannels, 'assignedOnlyChannels=', assignedOnlyChannels);

  return {
    filter: finalFilter,
    params,
    hasPermissions: true
  };
}

// ================================
// 1. LISTAR CONVERSAS
// ================================
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      status,
      campaign_id,
      linkedin_account_id,
      opportunity_id,
      search,
      page = 1,
      limit = 50
    } = req.query;

    console.log(`📋 Listando conversas do usuário ${userId}`);

    // Get contact_id from opportunity to also search conversations by contact
    // (conversations may be linked via contact_id instead of opportunity_id)
    let opportunityContactId = null;
    if (opportunity_id) {
      const oppQuery = await db.query(`SELECT contact_id FROM opportunities WHERE id = $1`, [opportunity_id]);
      if (oppQuery.rows.length > 0 && oppQuery.rows[0].contact_id) {
        opportunityContactId = oppQuery.rows[0].contact_id;
      }
    }

    // Get accessible sectors for this user
    const accessibleSectorIds = await getAccessibleSectorIds(userId, accountId);

    console.log(`🔍 [CONVERSATIONS] User ${userId}, Account ${accountId}: accessibleSectorIds=`, accessibleSectorIds);

    // Verificar contas LinkedIn disponíveis para diagnóstico
    const linkedinAccountsCheck = await db.query(`
      SELECT id, status, profile_name, provider_type, disconnected_at
      FROM linkedin_accounts
      WHERE account_id = $1
    `, [accountId]);
    console.log(`🔍 [CONVERSATIONS] LinkedIn accounts for account ${accountId}:`, linkedinAccountsCheck.rows);

    // Construir query - MULTI-TENANCY: Filter by account_id AND sector access
    // Usar conv.account_id para suportar conversas orgânicas (sem campaign)
    let whereConditions = ['conv.account_id = $1'];
    let queryParams = [accountId];
    let paramIndex = 2;

    // SECTOR FILTER: User can only see conversations from their accessible sectors
    // Include conversations without sector (NULL) for backward compatibility
    if (accessibleSectorIds.length > 0) {
      whereConditions.push(`(conv.sector_id = ANY($${paramIndex}) OR conv.sector_id IS NULL)`);
      queryParams.push(accessibleSectorIds);
      paramIndex++;
    } else {
      // User has no sectors assigned, can only see conversations without sector
      whereConditions.push('conv.sector_id IS NULL');
    }

    // CHANNEL PERMISSIONS FILTER: User can only see conversations from channels they have access to
    const channelFilter = await buildChannelPermissionsFilter(userId, accountId, paramIndex);
    console.log(`🔍 [CONVERSATIONS] User ${userId}: channelFilter=`, JSON.stringify(channelFilter));
    if (channelFilter.filter) {
      // Remove the leading 'AND ' since we'll join with AND
      whereConditions.push(channelFilter.filter.replace(/^AND /, ''));
      queryParams.push(...channelFilter.params);
      paramIndex += channelFilter.params.length;
    }

    // USER_ID FILTER: Only apply when user has NO channel permissions configured (backward compatibility)
    // When channel permissions exist, they already control access - no need for user_id filter
    // When fetching for a specific opportunity, also skip user_id filter
    if (!opportunity_id && !channelFilter.hasPermissions) {
      whereConditions.push(`conv.user_id = $${paramIndex}`);
      queryParams.push(userId);
      paramIndex++;
      console.log(`🔍 [CONVERSATIONS] User ${userId}: Applying user_id filter (no channel permissions configured)`);
    } else if (!opportunity_id && channelFilter.hasPermissions) {
      console.log(`🔍 [CONVERSATIONS] User ${userId}: Skipping user_id filter (channel permissions handle access)`);
    }

    // Filtro por status (ai_active ou manual)
    if (status) {
      whereConditions.push(`conv.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    // Filtro por campanha
    if (campaign_id) {
      whereConditions.push(`conv.campaign_id = $${paramIndex}`);
      queryParams.push(campaign_id);
      paramIndex++;
    }

    // Filtro por conta LinkedIn/Canal
    if (linkedin_account_id) {
      whereConditions.push(`conv.linkedin_account_id = $${paramIndex}`);
      queryParams.push(linkedin_account_id);
      paramIndex++;
    }

    // Filtro por opportunity_id - also search by contact_id from opportunity
    if (opportunity_id) {
      if (opportunityContactId) {
        // Search by opportunity_id OR by contact_id (conversation may be linked via contact)
        whereConditions.push(`(conv.opportunity_id = $${paramIndex} OR conv.contact_id = $${paramIndex + 1})`);
        queryParams.push(opportunity_id, opportunityContactId);
        paramIndex += 2;
      } else {
        whereConditions.push(`conv.opportunity_id = $${paramIndex}`);
        queryParams.push(opportunity_id);
        paramIndex++;
      }
    }

    // Busca por nome do contato
    if (search) {
      whereConditions.push(`(c.name ILIKE $${paramIndex} OR opp_contact.name ILIKE $${paramIndex} OR c.phone ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.join(' AND ');

    console.log(`🔍 [CONVERSATIONS] User ${userId}: Final WHERE clause: ${whereClause}`);
    console.log(`🔍 [CONVERSATIONS] User ${userId}: Query params (exceto limit/offset):`, queryParams);

    // Query principal - com suporte a contact_id (conversas orgânicas) e opportunity_id
    const query = `
      SELECT
        conv.*,
        -- Dados da opportunity (direta ou via contato)
        COALESCE(opp.id, (
          SELECT o.id FROM opportunities o
          WHERE o.contact_id = COALESCE(c.id, opp_contact.id)
          AND o.account_id = conv.account_id
          ORDER BY o.created_at DESC LIMIT 1
        )) as opportunity_id,
        COALESCE(opp.title, (
          SELECT o.title FROM opportunities o
          WHERE o.contact_id = COALESCE(c.id, opp_contact.id)
          AND o.account_id = conv.account_id
          ORDER BY o.created_at DESC LIMIT 1
        )) as opportunity_title,
        opp.value as opportunity_value,
        -- Dados do contato (via contact_id direto OU via opportunity)
        COALESCE(c.id, opp_contact.id) as contact_id,
        COALESCE(c.name, opp_contact.name) as contact_name,
        COALESCE(c.phone, opp_contact.phone) as contact_phone,
        COALESCE(c.title, opp_contact.title) as contact_title,
        COALESCE(c.company, opp_contact.company) as contact_company,
        COALESCE(c.profile_picture, opp_contact.profile_picture) as contact_picture,
        COALESCE(c.profile_url, opp_contact.profile_url) as contact_profile_url,
        -- Aliases para compatibilidade com frontend (usa lead_*)
        COALESCE(c.name, opp_contact.name) as lead_name,
        COALESCE(c.phone, opp_contact.phone) as lead_phone,
        COALESCE(c.profile_picture, opp_contact.profile_picture) as lead_picture,
        COALESCE(c.profile_url, opp_contact.profile_url) as lead_profile_url,
        -- Outros campos
        camp.name as campaign_name,
        la.linkedin_username,
        la.profile_name as account_name,
        la.profile_picture as account_picture,
        ai.name as ai_agent_name,
        assigned_user.name as assigned_user_name,
        assigned_user.email as assigned_user_email,
        s.id as sector_id,
        s.name as sector_name,
        s.color as sector_color
      FROM conversations conv
      LEFT JOIN opportunities opp ON conv.opportunity_id = opp.id
      LEFT JOIN contacts c ON conv.contact_id = c.id
      LEFT JOIN contacts opp_contact ON opp.contact_id = opp_contact.id
      LEFT JOIN campaigns camp ON conv.campaign_id = camp.id
      INNER JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      LEFT JOIN ai_agents ai ON conv.ai_agent_id = ai.id
      LEFT JOIN users assigned_user ON conv.assigned_user_id = assigned_user.id
      LEFT JOIN sectors s ON conv.sector_id = s.id
      WHERE ${whereClause}
      ORDER BY conv.last_message_at DESC NULLS LAST, conv.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const conversations = await db.query(query, queryParams);

    // Buscar tags para todas as conversas via contato (contact_tags)
    const contactIds = new Set();
    conversations.rows.forEach(conv => {
      if (conv.contact_id) contactIds.add(conv.contact_id);
    });

    // Buscar tags via contact_id
    let tagsByContactId = {};
    if (contactIds.size > 0) {
      const tagsQuery = `
        SELECT ct.contact_id, t.id, t.name, t.color
        FROM tags t
        JOIN contact_tags ct ON ct.tag_id = t.id
        WHERE ct.contact_id = ANY($1)
        ORDER BY t.name ASC
      `;
      const tagsResult = await db.query(tagsQuery, [Array.from(contactIds)]);
      tagsResult.rows.forEach(tag => {
        if (!tagsByContactId[tag.contact_id]) {
          tagsByContactId[tag.contact_id] = [];
        }
        tagsByContactId[tag.contact_id].push({ id: tag.id, name: tag.name, color: tag.color });
      });
    }

    // Processar conversas
    const processedConversations = conversations.rows.map(conv => ({
      ...conv,
      is_organic: !conv.opportunity_id && !!conv.contact_id,
      tags: tagsByContactId[conv.contact_id] || []
    }));

    // Contar total
    const countQuery = `
      SELECT COUNT(*)
      FROM conversations conv
      LEFT JOIN opportunities opp ON conv.opportunity_id = opp.id
      LEFT JOIN contacts c ON conv.contact_id = c.id
      LEFT JOIN contacts opp_contact ON opp.contact_id = opp_contact.id
      LEFT JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    // Log de diagnóstico: total de conversas no banco para esta conta (sem filtros)
    const totalConvsInDb = await db.query(`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE linkedin_account_id IS NOT NULL) as with_linkedin
      FROM conversations
      WHERE account_id = $1
    `, [accountId]);
    console.log(`🔍 [CONVERSATIONS] User ${userId}: Total convs in DB for account: ${totalConvsInDb.rows[0].total}, with LinkedIn account: ${totalConvsInDb.rows[0].with_linkedin}`);
    console.log(`🔍 [CONVERSATIONS] User ${userId}: After filters - found ${total} conversations`);

    console.log(`✅ Encontradas ${processedConversations.length} conversas`);

    sendSuccess(res, {
      conversations: processedConversations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 2. OBTER CONVERSA INDIVIDUAL
// ================================
const getConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // Get access filter (handles user_id + sector based on channel permissions)
    const { filter: accessFilter, params: accessParams } = await buildConversationAccessFilter(userId, accountId);

    // Buscar conversa - MULTI-TENANCY + SECTOR: Filter by account_id and accessible sectors
    const convQuery = `
      SELECT
        conv.*,
        -- Dados da opportunity (direta ou via contact_id)
        COALESCE(opp.id, (
          SELECT o.id FROM opportunities o
          WHERE o.contact_id = COALESCE(ct.id, opp_contact.id)
          AND o.account_id = conv.account_id
          ORDER BY o.created_at DESC LIMIT 1
        )) as opportunity_id,
        COALESCE(opp.title, (
          SELECT o.title FROM opportunities o
          WHERE o.contact_id = COALESCE(ct.id, opp_contact.id)
          AND o.account_id = conv.account_id
          ORDER BY o.created_at DESC LIMIT 1
        )) as opportunity_title,
        COALESCE(opp.value, (
          SELECT o.value FROM opportunities o
          WHERE o.contact_id = COALESCE(ct.id, opp_contact.id)
          AND o.account_id = conv.account_id
          ORDER BY o.created_at DESC LIMIT 1
        )) as opportunity_value,
        -- Dados do contato (via contact_id direto OU via opportunity)
        COALESCE(ct.id, opp_contact.id) as contact_id,
        COALESCE(ct.name, opp_contact.name) as contact_name,
        COALESCE(ct.phone, opp_contact.phone) as contact_phone,
        COALESCE(ct.email, opp_contact.email) as contact_email,
        COALESCE(ct.title, opp_contact.title) as contact_title,
        COALESCE(ct.company, opp_contact.company) as contact_company,
        COALESCE(ct.profile_picture, opp_contact.profile_picture) as contact_picture,
        COALESCE(ct.profile_url, opp_contact.profile_url) as contact_profile_url,
        COALESCE(ct.location, opp_contact.location) as contact_location,
        COALESCE(ct.linkedin_profile_id, opp_contact.linkedin_profile_id) as contact_linkedin_profile_id,
        COALESCE(ct.network_distance, opp_contact.network_distance) as contact_network_distance,
        -- Verificar se já existe convite pendente para este contato
        EXISTS(
          SELECT 1 FROM invitation_snapshots inv_snap
          WHERE inv_snap.linkedin_account_id = la.id
          AND inv_snap.invitation_type = 'sent'
          AND inv_snap.provider_id = COALESCE(ct.linkedin_profile_id, opp_contact.linkedin_profile_id)
        ) as has_pending_invitation,
        -- Aliases para compatibilidade com frontend (usa lead_*)
        COALESCE(ct.name, opp_contact.name) as lead_name,
        COALESCE(ct.phone, opp_contact.phone) as lead_phone,
        COALESCE(ct.profile_picture, opp_contact.profile_picture) as lead_picture,
        COALESCE(ct.profile_url, opp_contact.profile_url) as lead_profile_url,
        -- Outros campos
        camp.name as campaign_name,
        camp.id as campaign_id,
        la.linkedin_username,
        la.unipile_account_id,
        la.profile_name as account_name,
        la.profile_picture as account_picture,
        ai.name as ai_agent_name,
        assigned_user.name as assigned_user_name,
        s.id as sector_id,
        s.name as sector_name,
        s.color as sector_color
      FROM conversations conv
      LEFT JOIN opportunities opp ON conv.opportunity_id = opp.id
      LEFT JOIN contacts ct ON conv.contact_id = ct.id
      LEFT JOIN contacts opp_contact ON opp.contact_id = opp_contact.id
      LEFT JOIN campaigns camp ON conv.campaign_id = camp.id
      INNER JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      LEFT JOIN ai_agents ai ON conv.ai_agent_id = ai.id
      LEFT JOIN users assigned_user ON conv.assigned_user_id = assigned_user.id
      LEFT JOIN sectors s ON conv.sector_id = s.id
      WHERE conv.id = $1 AND conv.account_id = $2 ${accessFilter}
    `;

    const queryParams = [id, accountId, ...accessParams];
    const convResult = await db.query(convQuery, queryParams);

    if (convResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    const conv = convResult.rows[0];

    // Buscar tags do contato vinculado
    let tags = [];
    if (conv.contact_id) {
      const tagsQuery = `
        SELECT t.id, t.name, t.color
        FROM tags t
        JOIN contact_tags ct ON ct.tag_id = t.id
        WHERE ct.contact_id = $1
        ORDER BY t.name ASC
      `;
      const tagsResult = await db.query(tagsQuery, [conv.contact_id]);
      tags = tagsResult.rows;
    }

    // Processar conversa
    const conversation = {
      ...conv,
      is_organic: !conv.opportunity_id && !!conv.contact_id,
      tags
    };

    console.log(`✅ Conversa encontrada com ${tags.length} tags`);

    sendSuccess(res, conversation);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 3. OBTER MENSAGENS (DA API UNIPILE)
// ================================
const getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { limit = 100 } = req.query;

    console.log(`📬 Buscando mensagens da conversa ${id} via Unipile API`);

    // Check if user has channel permissions (to decide if user_id filter is needed)
    const permCheck = await db.query(
      'SELECT COUNT(*) as count FROM user_channel_permissions WHERE user_id = $1 AND account_id = $2',
      [userId, accountId]
    );
    const hasChannelPermissions = parseInt(permCheck.rows[0].count) > 0;

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildSectorFilter(userId, accountId);

    // Build user_id filter - only apply when no channel permissions (backward compatibility)
    let userIdFilter = '';
    let queryParams = [id, accountId];
    let paramIndex = 3;

    if (!hasChannelPermissions) {
      userIdFilter = `AND conv.user_id = $${paramIndex}`;
      queryParams.push(userId);
      paramIndex++;
    }

    // Add sector params
    const sectorFilterWithIndex = sectorFilter.replace(/\$4/g, `$${paramIndex}`);
    queryParams.push(...sectorParams);

    // Buscar conversa, conta LinkedIn e contato
    const convQuery = `
      SELECT
        conv.*,
        la.unipile_account_id,
        la.channel_identifier as own_number,
        la.provider_type as channel_provider_type,
        COALESCE(ct.linkedin_profile_id, opp_contact.linkedin_profile_id, opp.linkedin_profile_id) as provider_id
      FROM conversations conv
      INNER JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      LEFT JOIN opportunities opp ON conv.opportunity_id = opp.id
      LEFT JOIN contacts ct ON conv.contact_id = ct.id
      LEFT JOIN contacts opp_contact ON opp.contact_id = opp_contact.id
      WHERE conv.id = $1 AND conv.account_id = $2 ${userIdFilter} ${sectorFilterWithIndex}
    `;
    const convResult = await db.query(convQuery, queryParams);

    if (convResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    const conversation = convResult.rows[0];

    if (!conversation.unipile_chat_id) {
      throw new ValidationError('Conversation does not have a Unipile chat ID');
    }

    // ✅ Buscar mensagens da API UNIPILE (fonte da verdade)
    console.log(`📡 Buscando mensagens da Unipile...`);
    console.log(`   Account ID: ${conversation.unipile_account_id}`);
    console.log(`   Chat ID: ${conversation.unipile_chat_id}`);

    try {
      const unipileMessages = await unipileClient.messaging.getMessages({
        account_id: conversation.unipile_account_id,
        chat_id: conversation.unipile_chat_id,
        limit: parseInt(limit)
      });

      // Normalizar número do próprio usuário para comparação
      const ownNumberClean = conversation.own_number?.replace(/@s\.whatsapp\.net|@c\.us/gi, '') || '';

      // Detectar tipo de canal para aplicar lógica correta
      const isLinkedIn = conversation.channel_provider_type === 'LINKEDIN';

      // Para LinkedIn: usar lead_provider_id da conversa para comparação
      const leadProviderId = conversation.provider_id || '';

      // Processar mensagens para formato esperado pelo frontend
      const messages = (unipileMessages.items || []).map((msg, index) => {
        let senderType = 'lead'; // default

        // LINKEDIN: Comparar sender_id com lead_provider_id da conversa
        if (isLinkedIn) {
          const senderProviderId = msg.sender?.attendee_provider_id
            || msg.sender?.provider_id
            || msg.sender_id
            || '';

          // Comparar com lead_provider_id: se igual, é do lead; se diferente, é do user
          if (senderProviderId && leadProviderId) {
            senderType = (senderProviderId === leadProviderId) ? 'lead' : 'user';
          }

          // Fallback: verificar flag is_self
          if (msg.sender?.is_self === true) {
            senderType = 'user';
          }
        }
        // ========================================
        // WHATSAPP/OUTROS: Lógica existente
        // ========================================
        else {
          // Método 1: Usar original.key.fromMe (mais confiável para WhatsApp)
          if (msg.original) {
            try {
              const originalData = typeof msg.original === 'string'
                ? JSON.parse(msg.original)
                : msg.original;

              if (originalData?.key?.fromMe !== undefined) {
                senderType = originalData.key.fromMe ? 'user' : 'lead';
              } else if (originalData?.key?.senderPn) {
                // Método 2: Comparar senderPn com own_number
                const senderPn = originalData.key.senderPn?.replace(/@s\.whatsapp\.net|@c\.us/gi, '') || '';
                senderType = senderPn === ownNumberClean ? 'user' : 'lead';
              }
            } catch (e) {
              console.warn('Erro ao parsear original:', e.message);
            }
          }

          // Método 3 (fallback): Comparar sender.attendee_specifics.phone_number ou sender_id
          if (senderType === 'lead') {
            const senderPhone = msg.sender?.attendee_specifics?.phone_number
              || msg.sender_id
              || msg.sender?.attendee_provider_id
              || '';
            const senderPhoneClean = senderPhone.replace(/@s\.whatsapp\.net|@c\.us|@lid/gi, '');

            if (senderPhoneClean && senderPhoneClean === ownNumberClean) {
              senderType = 'user';
            }
          }
        }

        // Processar attachments da Unipile
        const attachments = (msg.attachments || []).map((att) => {
          // Extrair nome do arquivo - priorizar file_name (formato Unipile)
          const fileName = att.file_name || att.filename || att.name || att.original_filename || att.title || 'arquivo';

          // Extrair tipo/mimetype
          const mimeType = att.mimetype || att.mime_type || att.type || att.content_type || 'application/octet-stream';

          return {
            id: att.id,
            name: fileName,
            type: mimeType,
            size: att.file_size || att.size || 0,
            // URL só é útil se for HTTP - URLs att:// não funcionam no browser
            url: (att.url && att.url.startsWith('http')) ? att.url : null,
            // Info para download via proxy
            message_id: msg.id,
            conversation_id: id
          };
        });

        // Determinar categoria do LinkedIn (InMail ou Sponsored)
        const linkedinMsgType = msg.message_type; // INMAIL ou MESSAGE
        const msgSubject = msg.subject || null;
        let linkedinCategory = null;

        if (linkedinMsgType === 'INMAIL') {
          linkedinCategory = 'inmail';
        } else if (linkedinMsgType === 'MESSAGE' && msgSubject) {
          linkedinCategory = 'sponsored';
        }

        return {
          id: msg.id,
          conversation_id: id,
          unipile_message_id: msg.id,
          sender_type: senderType,
          content: msg.text || '',
          message_type: attachments.length > 0 ? 'attachment' : (msg.message_type || 'text'),
          attachments: attachments,
          sent_at: msg.timestamp || msg.date || msg.created_at,
          created_at: msg.created_at || msg.timestamp,
          // LinkedIn: categoria e subject para InMail/Sponsored
          linkedin_category: linkedinCategory,
          subject: msgSubject
        };
      });

      // Ordenar por data (mais antiga primeiro para exibição correta)
      messages.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));

      sendSuccess(res, {
        messages,
        pagination: {
          page: 1,
          limit: parseInt(limit),
          total: messages.length,
          pages: 1
        }
      });

    } catch (unipileError) {
      console.error('❌ Erro ao buscar mensagens da Unipile:', unipileError);

      // Fallback: buscar do cache local se Unipile falhar
      console.log('⚠️ Usando cache local como fallback...');

      const messagesQuery = `
        SELECT
          id,
          conversation_id,
          unipile_message_id,
          sender_type,
          content,
          message_type,
          sent_at,
          created_at,
          metadata
        FROM messages
        WHERE conversation_id = $1
        ORDER BY sent_at ASC, created_at ASC
        LIMIT $2
      `;

      const messagesResult = await db.query(messagesQuery, [id, limit]);

      console.log(`✅ ${messagesResult.rows.length} mensagens encontradas no cache local`);

      // Processar mensagens para incluir linkedin_category e subject do metadata
      const messagesWithCategory = messagesResult.rows.map(msg => ({
        ...msg,
        linkedin_category: msg.metadata?.linkedin_category || null,
        subject: msg.metadata?.subject || null
      }));

      sendSuccess(res, {
        messages: messagesWithCategory,
        fromCache: true,
        pagination: {
          page: 1,
          limit: parseInt(limit),
          total: messagesResult.rows.length,
          pages: 1
        }
      });
    }

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 4. ENVIAR MENSAGEM (VIA UNIPILE)
// ================================
const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { content } = req.body;

    // Verificar se há arquivos anexados (via multer)
    const files = req.files || [];
    const hasAttachments = files.length > 0;

    console.log(`📨 Enviando mensagem na conversa ${id}${hasAttachments ? ` com ${files.length} anexo(s)` : ''}`);

    // Validação - precisa ter texto OU attachments
    if ((!content || content.trim().length === 0) && !hasAttachments) {
      throw new ValidationError('Message content or attachment is required');
    }

    // Get access filter (handles user_id + sector based on channel permissions)
    const { filter: accessFilter, params: accessParams } = await buildConversationAccessFilter(userId, accountId);

    // Verificar se conversa pertence ao usuário E à conta (MULTI-TENANCY + SECTOR)
    const convQuery = `
      SELECT conv.*, la.unipile_account_id
      FROM conversations conv
      LEFT JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      WHERE conv.id = $1 AND conv.account_id = $2 ${accessFilter}
    `;

    const queryParams = [id, accountId, ...accessParams];
    const convResult = await db.query(convQuery, queryParams);

    if (convResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    const conversation = convResult.rows[0];

    if (!conversation.unipile_chat_id) {
      throw new ValidationError('Conversation does not have a Unipile chat ID');
    }

    // Enviar mensagem via Unipile
    try {
      console.log('📡 Enviando via Unipile...');

      let sentMessage;

      if (hasAttachments) {
        // Enviar com attachments
        const attachments = files.map(file => ({
          filename: file.originalname,
          buffer: file.buffer,
          mimetype: file.mimetype
        }));

        sentMessage = await unipileClient.messaging.sendMessageWithAttachment({
          account_id: conversation.unipile_account_id,
          chat_id: conversation.unipile_chat_id,
          text: content ? content.trim() : '',
          attachments: attachments
        });

        console.log('✅ Mensagem com anexo(s) enviada via Unipile');
      } else {
        // Enviar apenas texto
        sentMessage = await unipileClient.messaging.sendMessage({
          account_id: conversation.unipile_account_id,
          chat_id: conversation.unipile_chat_id,
          text: content.trim()
        });

        console.log('✅ Mensagem enviada via Unipile');
      }

      // Atualizar cache da conversa
      const preview = hasAttachments
        ? `📎 ${files.length} arquivo(s)${content ? ': ' + content.substring(0, 150) : ''}`
        : content.substring(0, 200);

      await db.query(`
        UPDATE conversations
        SET
          last_message_preview = $1,
          last_message_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
      `, [preview, id]);

      sendSuccess(res, sentMessage, 'Message sent successfully', 201);

    } catch (unipileError) {
      console.error('❌ Erro ao enviar via Unipile:', unipileError.message);
      if (unipileError.response?.data) {
        console.error('❌ Detalhes do erro Unipile:', JSON.stringify(unipileError.response.data));
      }
      if (unipileError.response?.status === 422) {
        throw new ValidationError('Não é possível enviar mensagem nesta conversa (Sponsored/InMail)');
      }
      throw new UnipileError('Failed to send message via Unipile');
    }

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 4.1 DOWNLOAD ATTACHMENT (PROXY UNIPILE)
// ================================
const downloadAttachment = async (req, res) => {
  try {
    const { id, messageId, attachmentId } = req.params;
    const { filename: queryFilename } = req.query; // Filename passado pelo frontend
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`📥 Baixando attachment ${attachmentId} da mensagem ${messageId}`);

    // Buscar conversa e unipile_account_id
    const convQuery = `
      SELECT
        conv.*,
        la.unipile_account_id
      FROM conversations conv
      LEFT JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      WHERE conv.id = $1
        AND conv.account_id = $2
    `;

    const convResult = await db.query(convQuery, [id, accountId]);

    if (convResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    const conversation = convResult.rows[0];
    const unipileAccountId = conversation.unipile_account_id;

    if (!unipileAccountId) {
      console.error('❌ Conversa sem unipile_account_id:', id);
      console.error('   linkedin_account_id:', conversation.linkedin_account_id);
      console.error('   channel:', conversation.channel);
      // Retornar 404 silencioso para não poluir logs do frontend
      return res.status(404).json({ error: 'Attachment not available', code: 'NO_UNIPILE_ACCOUNT' });
    }

    // Buscar attachment via Unipile
    try {
      const attachment = await unipileClient.messaging.getAttachment({
        account_id: unipileAccountId,
        message_id: messageId,
        attachment_id: attachmentId
      });

      // Extrair filename: prioridade para query param, depois content-disposition
      let filename = queryFilename || 'download';

      // Se não veio do frontend, tentar extrair do content-disposition
      if (!queryFilename && attachment.contentDisposition) {
        const match = attachment.contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          filename = match[1].replace(/['"]/g, '');
        }
      }

      // Sanitizar filename para evitar problemas com caracteres especiais
      const sanitizedFilename = filename.replace(/[<>:"/\\|?*]/g, '_');

      // Definir headers de resposta
      res.setHeader('Content-Type', attachment.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
      res.setHeader('Content-Length', attachment.data.length);

      // Enviar arquivo
      res.send(Buffer.from(attachment.data));

    } catch (unipileError) {
      // Logar detalhes mas não poluir console em produção
      console.warn('⚠️ Attachment não disponível via Unipile:', unipileError.response?.status || unipileError.message);
      // Retornar 404 silencioso - attachment pode ter expirado ou não existir mais
      return res.status(404).json({ error: 'Attachment not available', code: 'UNIPILE_ERROR' });
    }

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 4.2 GET ATTACHMENT INLINE (PROXY PARA EXIBIÇÃO DE IMAGENS)
// ================================
const getAttachmentInline = async (req, res) => {
  try {
    const { id, messageId, attachmentId } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // ✅ PASSO 1: Verificar primeiro se existe no R2 (nunca expira)
    try {
      const r2Attachment = await db.query(`
        SELECT storage_key, file_url, mime_type, original_filename
        FROM email_attachments
        WHERE conversation_id = $1
          AND unipile_attachment_id = $2
          AND account_id = $3
      `, [id, attachmentId, accountId]);

      if (r2Attachment.rows.length > 0) {
        const att = r2Attachment.rows[0];
        console.log(`📎 Attachment encontrado no R2: ${att.storage_key}`);

        // Buscar do R2
        const r2Data = await storageService.getFile(att.storage_key);

        if (r2Data && r2Data.Body) {
          const contentType = att.mime_type || 'application/octet-stream';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Disposition', 'inline');
          res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache de 24 horas (R2 é permanente)

          // R2 retorna um stream, converter para buffer
          const chunks = [];
          for await (const chunk of r2Data.Body) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);

          res.setHeader('Content-Length', buffer.length);
          return res.send(buffer);
        }
      }
    } catch (r2Error) {
      console.warn('⚠️ Erro ao buscar no R2 (tentando Unipile):', r2Error.message);
      // Continuar para tentar Unipile
    }

    // ✅ PASSO 2: Fallback para Unipile se não estiver no R2
    // Buscar conversa e unipile_account_id
    const convQuery = `
      SELECT
        conv.*,
        la.unipile_account_id
      FROM conversations conv
      LEFT JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      WHERE conv.id = $1
        AND conv.account_id = $2
    `;

    const convResult = await db.query(convQuery, [id, accountId]);

    if (convResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    const conversation = convResult.rows[0];
    const unipileAccountId = conversation.unipile_account_id;

    if (!unipileAccountId) {
      console.error('❌ Conversa sem unipile_account_id:', id);
      console.error('   linkedin_account_id:', conversation.linkedin_account_id);
      console.error('   channel:', conversation.channel);
      // Retornar 404 silencioso para não poluir logs do frontend
      return res.status(404).json({ error: 'Attachment not available', code: 'NO_UNIPILE_ACCOUNT' });
    }

    // Buscar attachment via Unipile
    try {
      const attachment = await unipileClient.messaging.getAttachment({
        account_id: unipileAccountId,
        message_id: messageId,
        attachment_id: attachmentId
      });

      // Definir headers para exibição inline (imagem no navegador)
      const contentType = attachment.contentType || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Content-Length', attachment.data.length);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache de 1 hora

      // Enviar arquivo
      res.send(Buffer.from(attachment.data));

    } catch (unipileError) {
      // Logar detalhes mas não poluir console em produção
      console.warn('⚠️ Attachment não disponível via Unipile:', unipileError.response?.status || unipileError.message);
      // Retornar 404 silencioso - attachment pode ter expirado ou não existir mais
      return res.status(404).json({ error: 'Attachment not available', code: 'UNIPILE_ERROR' });
    }

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 5. ASSUMIR CONTROLE MANUAL
// ================================
const takeControl = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`👤 Assumindo controle manual da conversa ${id}`);

    // Get access filter (handles user_id + sector based on channel permissions)
    const { filter: accessFilter, params: accessParams } = await buildConversationAccessFilter(userId, accountId);

    // Verificar ownership - MULTI-TENANCY + SECTOR
    const checkQuery = `
      SELECT conv.id
      FROM conversations conv
      WHERE conv.id = $1 AND conv.account_id = $2 ${accessFilter}
    `;

    const queryParams = [id, accountId, ...accessParams];
    const checkResult = await db.query(checkQuery, queryParams);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    // Atualizar para modo manual (desativar IA e marcar controle manual)
    const updateQuery = `
      UPDATE conversations
      SET status = 'manual', ai_active = false, manual_control_taken = true, ai_paused_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(updateQuery, [id]);

    // Cancelar todos os jobs agendados (follow-up flows, no_response checks, etc.)
    try {
      const { cancelScheduledJobs } = require('../workers/followUpWorker');
      const cancelled = await cancelScheduledJobs(id);
      if (cancelled > 0) {
        console.log(`🛑 [TAKE-CONTROL] Cancelled ${cancelled} scheduled job(s) for conversation ${id}`);
      }
    } catch (cancelErr) {
      console.error(`⚠️ [TAKE-CONTROL] Error cancelling scheduled jobs:`, cancelErr.message);
    }

    console.log('✅ Controle manual ativado, IA pausada');

    sendSuccess(res, result.rows[0], 'Manual control activated. AI paused.');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 6. LIBERAR PARA IA
// ================================
const releaseControl = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`🤖 Liberando conversa ${id} para IA`);

    // Get access filter (handles user_id + sector based on channel permissions)
    const { filter: accessFilter, params: accessParams } = await buildConversationAccessFilter(userId, accountId);

    // Verificar ownership - MULTI-TENANCY + SECTOR
    const checkQuery = `
      SELECT conv.id
      FROM conversations conv
      WHERE conv.id = $1 AND conv.account_id = $2 ${accessFilter}
    `;

    const queryParams = [id, accountId, ...accessParams];
    const checkResult = await db.query(checkQuery, queryParams);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    // Atualizar para modo IA (reativar IA e desmarcar controle manual)
    const updateQuery = `
      UPDATE conversations
      SET status = 'ai_active', ai_active = true, manual_control_taken = false, ai_paused_at = NULL, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(updateQuery, [id]);

    console.log('✅ IA reativada, controle liberado');

    sendSuccess(res, result.rows[0], 'AI control activated. Manual control released.');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 7. ATUALIZAR STATUS DA CONVERSA
// ================================
const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { status } = req.body;

    console.log(`📝 Atualizando status da conversa ${id} para ${status}`);

    // Validar status
    if (!status || !['ai_active', 'manual', 'closed'].includes(status)) {
      throw new ValidationError('Invalid status. Must be "ai_active", "manual", or "closed"');
    }

    // Get access filter (handles user_id + sector based on channel permissions)
    const { filter: accessFilter, params: accessParams } = await buildConversationAccessFilter(userId, accountId);

    // Verificar ownership - MULTI-TENANCY + SECTOR
    const checkQuery = `
      SELECT conv.id
      FROM conversations conv
      WHERE conv.id = $1 AND conv.account_id = $2 ${accessFilter}
    `;

    const queryParams = [id, accountId, ...accessParams];
    const checkResult = await db.query(checkQuery, queryParams);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    // Atualizar status
    let updateQuery;
    let message;

    if (status === 'manual') {
      updateQuery = `UPDATE conversations
         SET status = $1, ai_active = false, manual_control_taken = true, ai_paused_at = NOW(), closed_at = NULL, updated_at = NOW()
         WHERE id = $2
         RETURNING *`;
      message = 'AI paused. Manual mode activated.';
    } else if (status === 'closed') {
      updateQuery = `UPDATE conversations
         SET status = $1, ai_active = false, closed_at = NOW(), updated_at = NOW()
         WHERE id = $2
         RETURNING *`;
      message = 'Conversation closed successfully.';
    } else {
      updateQuery = `UPDATE conversations
         SET status = $1, ai_active = true, manual_control_taken = false, ai_paused_at = NULL, closed_at = NULL, updated_at = NOW()
         WHERE id = $2
         RETURNING *`;
      message = 'AI activated. Manual mode disabled.';
    }

    const result = await db.query(updateQuery, [status, id]);

    // Cancelar todos os jobs agendados quando mudar para manual ou closed
    if (status === 'manual' || status === 'closed') {
      try {
        const { cancelScheduledJobs } = require('../workers/followUpWorker');
        const cancelled = await cancelScheduledJobs(id);
        if (cancelled > 0) {
          console.log(`🛑 [STATUS] Cancelled ${cancelled} scheduled job(s) for conversation ${id}`);
        }
      } catch (cancelErr) {
        console.error(`⚠️ [STATUS] Error cancelling scheduled jobs:`, cancelErr.message);
      }
    }

    console.log('✅ Status atualizado');

    sendSuccess(res, result.rows[0], message);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 8. MARCAR COMO LIDA
// ================================
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`👁️ Marcando conversa ${id} como lida`);

    // Get access filter (handles user_id + sector based on channel permissions)
    const { filter: accessFilter, params: accessParams } = await buildConversationAccessFilter(userId, accountId);

    // Verificar ownership
    const checkQuery = `
      SELECT conv.id
      FROM conversations conv
      WHERE conv.id = $1 AND conv.account_id = $2 ${accessFilter}
    `;

    const queryParams = [id, accountId, ...accessParams];
    const checkResult = await db.query(checkQuery, queryParams);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    // Atualizar
    const updateQuery = `
      UPDATE conversations
      SET unread_count = 0, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(updateQuery, [id]);

    console.log('✅ Conversa marcada como lida');

    sendSuccess(res, result.rows[0], 'Conversation marked as read');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 9. OBTER ESTATÍSTICAS
// ================================
const getConversationStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`📊 Buscando estatísticas de conversas do usuário ${userId}`);

    // Get accessible sectors for this user
    const accessibleSectorIds = await getAccessibleSectorIds(userId, accountId);

    // Check if user has channel permissions configured FIRST (to decide paramIndex)
    const permCheck = await db.query(
      'SELECT COUNT(*) as count FROM user_channel_permissions WHERE user_id = $1 AND account_id = $2',
      [userId, accountId]
    );
    const hasChannelPermissions = parseInt(permCheck.rows[0].count) > 0;

    // Build query params - only include userId if no channel permissions configured
    let queryParams = [accountId];
    let userIdFilter = '';
    let paramIndex = 2;

    if (!hasChannelPermissions) {
      // No channel permissions configured - use user_id filter for backward compatibility
      queryParams.push(userId);
      userIdFilter = `AND conv.user_id = $2`;
      paramIndex = 3;
      console.log(`🔍 [STATS] User ${userId}: Applying user_id filter (no channel permissions)`);
    } else {
      // Channel permissions exist - they control access, no user_id filter needed
      console.log(`🔍 [STATS] User ${userId}: Skipping user_id filter (channel permissions handle access)`);
    }

    // Build sector filter
    let sectorFilter = '';
    if (accessibleSectorIds.length > 0) {
      sectorFilter = `AND (conv.sector_id = ANY($${paramIndex}) OR conv.sector_id IS NULL)`;
      queryParams.push(accessibleSectorIds);
      paramIndex++;
    } else {
      sectorFilter = 'AND conv.sector_id IS NULL';
    }

    // Build channel permissions filter with correct paramIndex
    const channelFilter = await buildChannelPermissionsFilter(userId, accountId, paramIndex);
    let channelFilterSQL = '';
    if (channelFilter.filter) {
      channelFilterSQL = channelFilter.filter;
      queryParams.push(...channelFilter.params);
      paramIndex += channelFilter.params.length;
    }

    // Total de conversas
    const totalQuery = `
      SELECT COUNT(*) as total
      FROM conversations conv
      WHERE conv.account_id = $1 ${userIdFilter} ${sectorFilter} ${channelFilterSQL}
    `;
    const totalResult = await db.query(totalQuery, queryParams);

    // Conversas atribuídas ao usuário atual (não fechadas)
    // Para "mine" sempre filtramos por assigned_user_id = userId
    const mineQueryParams = [...queryParams, userId];
    const mineQuery = `
      SELECT COUNT(*) as count
      FROM conversations conv
      WHERE conv.account_id = $1
        ${userIdFilter}
        AND conv.assigned_user_id = $${mineQueryParams.length}
        AND conv.status != 'closed'
        ${sectorFilter}
        ${channelFilterSQL}
    `;
    const mineResult = await db.query(mineQuery, mineQueryParams);

    // Conversas não atribuídas (não fechadas)
    const unassignedQuery = `
      SELECT COUNT(*) as count
      FROM conversations conv
      WHERE conv.account_id = $1
        ${userIdFilter}
        AND conv.assigned_user_id IS NULL
        AND conv.status != 'closed'
        ${sectorFilter}
        ${channelFilterSQL}
    `;
    const unassignedResult = await db.query(unassignedQuery, queryParams);

    // Conversas fechadas
    const closedQuery = `
      SELECT COUNT(*) as count
      FROM conversations conv
      WHERE conv.account_id = $1
        ${userIdFilter}
        AND conv.status = 'closed'
        ${sectorFilter}
        ${channelFilterSQL}
    `;
    const closedResult = await db.query(closedQuery, queryParams);

    // Conversas com mensagens não lidas
    const unreadQuery = `
      SELECT COUNT(*) as unread_conversations
      FROM conversations conv
      WHERE conv.account_id = $1 ${userIdFilter} AND conv.unread_count > 0 ${sectorFilter} ${channelFilterSQL}
    `;
    const unreadResult = await db.query(unreadQuery, queryParams);

    // Organizar dados
    const stats = {
      mine: parseInt(mineResult.rows[0].count),
      all: parseInt(totalResult.rows[0].total),
      unassigned: parseInt(unassignedResult.rows[0].count),
      closed: parseInt(closedResult.rows[0].count),
      unread_conversations: parseInt(unreadResult.rows[0].unread_conversations)
    };

    console.log('✅ Estatísticas calculadas:', stats);

    sendSuccess(res, stats);

  } catch (error) {
    console.error('❌ Erro ao calcular estatísticas:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 10. FECHAR CONVERSA
// ================================
const closeConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`🔒 Fechando conversa ${id}`);

    // Get access filter (handles user_id + sector based on channel permissions)
    const { filter: accessFilter, params: accessParams } = await buildConversationAccessFilter(userId, accountId);

    // Verificar ownership - MULTI-TENANCY + SECTOR
    const checkQuery = `
      SELECT conv.id
      FROM conversations conv
      WHERE conv.id = $1 AND conv.account_id = $2 ${accessFilter}
    `;

    const queryParams = [id, accountId, ...accessParams];
    const checkResult = await db.query(checkQuery, queryParams);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    // Atualizar para status 'closed' (desativar IA)
    const updateQuery = `
      UPDATE conversations
      SET status = 'closed', ai_active = false, closed_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(updateQuery, [id]);

    // Cancelar todos os jobs agendados
    try {
      const { cancelScheduledJobs } = require('../workers/followUpWorker');
      const cancelled = await cancelScheduledJobs(id);
      if (cancelled > 0) {
        console.log(`🛑 [CLOSE] Cancelled ${cancelled} scheduled job(s) for conversation ${id}`);
      }
    } catch (cancelErr) {
      console.error(`⚠️ [CLOSE] Error cancelling scheduled jobs:`, cancelErr.message);
    }

    console.log('✅ Conversa fechada');

    sendSuccess(res, result.rows[0], 'Conversation closed successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 11. REABRIR CONVERSA
// ================================
const reopenConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { status = 'ai_active' } = req.body;

    console.log(`🔓 Reabrindo conversa ${id} com status ${status}`);

    // Validar status
    if (!['ai_active', 'manual'].includes(status)) {
      throw new ValidationError('Invalid status. Must be "ai_active" or "manual"');
    }

    // Get access filter (handles user_id + sector based on channel permissions)
    const { filter: accessFilter, params: accessParams } = await buildConversationAccessFilter(userId, accountId);

    // Verificar ownership - MULTI-TENANCY + SECTOR
    const checkQuery = `
      SELECT conv.id
      FROM conversations conv
      WHERE conv.id = $1 AND conv.account_id = $2 ${accessFilter}
    `;

    const queryParams = [id, accountId, ...accessParams];
    const checkResult = await db.query(checkQuery, queryParams);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    // Atualizar status e limpar closed_at (sincronizar ai_active/manual_control_taken)
    const updateQuery = status === 'manual'
      ? `UPDATE conversations
         SET status = $1, ai_active = false, manual_control_taken = true, closed_at = NULL, ai_paused_at = NOW(), updated_at = NOW()
         WHERE id = $2
         RETURNING *`
      : `UPDATE conversations
         SET status = $1, ai_active = true, manual_control_taken = false, closed_at = NULL, ai_paused_at = NULL, updated_at = NOW()
         WHERE id = $2
         RETURNING *`;

    const result = await db.query(updateQuery, [status, id]);

    console.log('✅ Conversa reaberta');

    sendSuccess(res, result.rows[0], 'Conversation reopened successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 12. DELETAR CONVERSA
// ================================
const deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`🗑️ Deletando conversa ${id}`);

    // Get access filter (handles user_id + sector based on channel permissions)
    const { filter: accessFilter, params: accessParams } = await buildConversationAccessFilter(userId, accountId);

    // Verificar ownership - MULTI-TENANCY + SECTOR
    const checkQuery = `
      SELECT conv.id
      FROM conversations conv
      WHERE conv.id = $1 AND conv.account_id = $2 ${accessFilter}
    `;

    const queryParams = [id, accountId, ...accessParams];
    const checkResult = await db.query(checkQuery, queryParams);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    // Deletar
    await db.query('DELETE FROM conversations WHERE id = $1', [id]);

    console.log('✅ Conversa deletada');

    sendSuccess(res, null, 'Conversation deleted successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 13. ASSIGN CONVERSATION TO USER
// ================================
const assignConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    const accountId = req.user.account_id;
    const requestingUserId = req.user.id;

    if (!user_id) {
      throw new ValidationError('user_id é obrigatório');
    }

    console.log(`📌 Atribuindo conversa ${id} ao usuário ${user_id}`);

    // Get access filter (handles user_id + sector based on channel permissions)
    const { filter: accessFilter, params: accessParams } = await buildConversationAccessFilter(requestingUserId, accountId);

    // Verificar ownership
    const convQuery = `
      SELECT conv.*
      FROM conversations conv
      WHERE conv.id = $1
        AND conv.account_id = $2
        ${accessFilter}
    `;
    const convResult = await db.query(convQuery, [id, accountId, ...accessParams]);

    if (convResult.rows.length === 0) {
      throw new NotFoundError('Conversa não encontrada');
    }

    const conversation = convResult.rows[0];

    // Verify target user exists, belongs to same account, and has access to the sector
    const userQuery = `
      SELECT u.id, u.name
      FROM users u
      WHERE u.id = $1 AND u.account_id = $2
    `;
    const userResult = await db.query(userQuery, [user_id, accountId]);

    if (userResult.rows.length === 0) {
      throw new NotFoundError('Usuário não encontrado');
    }

    // If conversation has a sector, verify user has access to it
    if (conversation.sector_id) {
      const userSectorQuery = `
        SELECT 1 FROM user_sectors
        WHERE user_id = $1 AND sector_id = $2
      `;
      const userSectorResult = await db.query(userSectorQuery, [user_id, conversation.sector_id]);

      if (userSectorResult.rows.length === 0) {
        throw new ForbiddenError('Usuário não tem acesso ao setor desta conversa');
      }
    }

    // Assign conversation
    const updateQuery = `
      UPDATE conversations
      SET assigned_user_id = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(updateQuery, [user_id, id]);

    console.log(`✅ Conversa atribuída ao usuário ${user_id}`);

    sendSuccess(res, result.rows[0], 'Conversa atribuída com sucesso');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 14. UNASSIGN CONVERSATION
// ================================
const unassignConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;
    const userId = req.user.id;

    console.log(`📌 Desatribuindo conversa ${id}`);

    // Get access filter (handles user_id + sector based on channel permissions)
    const { filter: accessFilter, params: accessParams } = await buildConversationAccessFilter(userId, accountId);

    // Verificar ownership
    const convQuery = `
      SELECT conv.*
      FROM conversations conv
      WHERE conv.id = $1
        AND conv.account_id = $2
        ${accessFilter}
    `;
    const convResult = await db.query(convQuery, [id, accountId, ...accessParams]);

    if (convResult.rows.length === 0) {
      throw new NotFoundError('Conversa não encontrada');
    }

    // Unassign conversation
    const updateQuery = `
      UPDATE conversations
      SET assigned_user_id = NULL, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query(updateQuery, [id]);

    console.log(`✅ Conversa desatribuída`);

    sendSuccess(res, result.rows[0], 'Conversa desatribuída com sucesso');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 15. ASSIGN SECTOR TO CONVERSATION
// ================================
const assignSectorToConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const { sector_id } = req.body;
    const accountId = req.user.account_id;
    const userId = req.user.id;

    console.log(`📌 Atribuindo setor ${sector_id} à conversa ${id}`);

    // Validate sector_id
    if (!sector_id) {
      throw new ValidationError('sector_id é obrigatório');
    }

    // Verify sector exists and belongs to same account
    const sectorQuery = `
      SELECT s.id, s.name
      FROM sectors s
      WHERE s.id = $1 AND s.account_id = $2
    `;
    const sectorResult = await db.query(sectorQuery, [sector_id, accountId]);

    if (sectorResult.rows.length === 0) {
      throw new NotFoundError('Setor não encontrado');
    }

    // Get access filter (handles user_id + sector based on channel permissions)
    const { filter: accessFilter, params: accessParams } = await buildConversationAccessFilter(userId, accountId);

    // Verificar ownership
    const convQuery = `
      SELECT conv.*
      FROM conversations conv
      WHERE conv.id = $1
        AND conv.account_id = $2
        ${accessFilter}
    `;
    const convResult = await db.query(convQuery, [id, accountId, ...accessParams]);

    if (convResult.rows.length === 0) {
      throw new NotFoundError('Conversa não encontrada');
    }

    // Assign sector to conversation
    const updateQuery = `
      UPDATE conversations
      SET sector_id = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(updateQuery, [sector_id, id]);

    console.log(`✅ Setor atribuído à conversa`);

    sendSuccess(res, result.rows[0], 'Setor atribuído com sucesso');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 16. UNASSIGN SECTOR FROM CONVERSATION
// ================================
const unassignSectorFromConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;
    const userId = req.user.id;

    console.log(`📌 Desatribuindo setor da conversa ${id}`);

    // Get access filter (handles user_id + sector based on channel permissions)
    const { filter: accessFilter, params: accessParams } = await buildConversationAccessFilter(userId, accountId);

    // Verificar ownership
    const convQuery = `
      SELECT conv.*
      FROM conversations conv
      WHERE conv.id = $1
        AND conv.account_id = $2
        ${accessFilter}
    `;
    const convResult = await db.query(convQuery, [id, accountId, ...accessParams]);

    if (convResult.rows.length === 0) {
      throw new NotFoundError('Conversa não encontrada');
    }

    // Unassign sector from conversation
    const updateQuery = `
      UPDATE conversations
      SET sector_id = NULL, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query(updateQuery, [id]);

    console.log(`✅ Setor desatribuído da conversa`);

    sendSuccess(res, result.rows[0], 'Setor desatribuído com sucesso');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// GET ASSIGNABLE USERS (for conversation assignment)
// Returns list of active users in the account (no users:view permission required)
// ================================
const getAssignableUsers = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    console.log(`👥 Buscando usuários atribuíveis para conta ${accountId}`);

    const usersQuery = `
      SELECT id, name, email, avatar_url, profile_picture
      FROM users
      WHERE account_id = $1 AND is_active = true
      ORDER BY name ASC
    `;

    const usersResult = await db.query(usersQuery, [accountId]);

    console.log(`✅ Encontrados ${usersResult.rows.length} usuários atribuíveis`);

    sendSuccess(res, { users: usersResult.rows });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// GET ASSIGNABLE SECTORS (for conversation assignment)
// Returns list of sectors accessible to the user (no sectors:view permission required)
// ================================
const getAssignableSectors = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`🏷️ Buscando setores atribuíveis para usuário ${userId}`);

    // Get user's accessible sectors
    const accessibleSectorIds = await getAccessibleSectorIds(userId, accountId);

    let sectorsQuery;
    let queryParams;

    if (accessibleSectorIds.length > 0) {
      // User has specific sectors assigned - return only those
      sectorsQuery = `
        SELECT id, name, color, description
        FROM sectors
        WHERE account_id = $1 AND id = ANY($2)
        ORDER BY name ASC
      `;
      queryParams = [accountId, accessibleSectorIds];
    } else {
      // User has no sectors assigned - return all sectors for the account
      sectorsQuery = `
        SELECT id, name, color, description
        FROM sectors
        WHERE account_id = $1
        ORDER BY name ASC
      `;
      queryParams = [accountId];
    }

    const sectorsResult = await db.query(sectorsQuery, queryParams);

    console.log(`✅ Encontrados ${sectorsResult.rows.length} setores atribuíveis`);

    sendSuccess(res, { sectors: sectorsResult.rows });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// CONVERSATION SUMMARY ENDPOINTS
// ================================

/**
 * Get conversation summary and context stats
 * GET /api/conversations/:id/summary
 */
const getSummaryStats = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // Verify access to conversation
    const sectorFilter = await buildSectorFilter(userId, accountId, 3);
    const conversation = await db.findOne('conversations', {
      id,
      user_id: accountId,
      ...sectorFilter.conditions
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // Get context with summary
    const context = await conversationSummaryService.getContextForAI(id);

    return sendSuccess(res, {
      conversation_id: id,
      summary: context.summary,
      stats: context.stats,
      recent_messages_preview: context.recentMessages.slice(0, 5).map(m => ({
        sender_type: m.sender_type,
        content: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : ''),
        sent_at: m.sent_at
      }))
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Generate or regenerate summary for a conversation
 * POST /api/conversations/:id/summary/generate
 */
const generateSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const { force = false } = req.body;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // Verify access to conversation
    const sectorFilter = await buildSectorFilter(userId, accountId, 3);
    const conversation = await db.findOne('conversations', {
      id,
      user_id: accountId,
      ...sectorFilter.conditions
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // Check if summary already exists
    if (conversation.context_summary && !force) {
      return sendSuccess(res, {
        message: 'Summary already exists. Use force=true to regenerate.',
        summary: conversation.context_summary,
        stats: {
          tokenCount: conversation.summary_token_count,
          updatedAt: conversation.summary_updated_at,
          messagesCount: conversation.messages_count
        }
      });
    }

    // Generate summary
    console.log(`📝 Generating summary for conversation ${id} (forced: ${force})`);
    const result = await conversationSummaryService.generateInitialSummary(id);

    if (!result) {
      return sendSuccess(res, {
        message: 'Not enough messages to generate summary (minimum 20 required)',
        messagesCount: conversation.messages_count || 0
      });
    }

    return sendSuccess(res, {
      message: 'Summary generated successfully',
      summary: result.summary,
      stats: {
        tokenCount: result.tokenCount,
        messagesSummarized: result.messagesSummarized,
        lastMessageId: result.lastMessageId
      }
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Update summary incrementally (manually trigger)
 * POST /api/conversations/:id/summary/update
 */
const updateSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // Verify access to conversation
    const sectorFilter = await buildSectorFilter(userId, accountId, 3);
    const conversation = await db.findOne('conversations', {
      id,
      user_id: accountId,
      ...sectorFilter.conditions
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // Process conversation for summary update
    const result = await conversationSummaryService.processConversation(id);

    if (!result) {
      return sendSuccess(res, {
        message: 'Summary update not needed or not enough messages',
        current: {
          summary: conversation.context_summary,
          messagesCount: conversation.messages_count
        }
      });
    }

    return sendSuccess(res, {
      message: 'Summary updated successfully',
      summary: result.summary,
      stats: {
        tokenCount: result.tokenCount,
        messagesSummarized: result.messagesSummarized,
        wasCompressed: result.wasCompressed
      }
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 17. ATUALIZAR NOME DO CONTATO DA CONVERSA
// ================================
const updateContactName = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`✏️ Atualizando nome do contato da conversa ${id} para "${name}"`);

    if (!name || !name.trim()) {
      throw new ValidationError('Nome é obrigatório');
    }

    // Get access filter (handles user_id + sector based on channel permissions)
    const { filter: accessFilter, params: accessParams } = await buildConversationAccessFilter(userId, accountId);

    // Buscar conversa com contact_id (direto ou via opportunity)
    const convQuery = `
      SELECT
        conv.*,
        COALESCE(conv.contact_id, opp.contact_id) as effective_contact_id
      FROM conversations conv
      LEFT JOIN opportunities opp ON conv.opportunity_id = opp.id
      WHERE conv.id = $1 AND conv.account_id = $2 ${accessFilter}
    `;
    const convResult = await db.query(convQuery, [id, accountId, ...accessParams]);

    if (convResult.rows.length === 0) {
      throw new NotFoundError('Conversa não encontrada');
    }

    const conversation = convResult.rows[0];

    if (!conversation.effective_contact_id) {
      throw new ValidationError('Conversa não tem contato associado');
    }

    await db.query(
      'UPDATE contacts SET name = $1, updated_at = NOW() WHERE id = $2',
      [name.trim(), conversation.effective_contact_id]
    );
    console.log(`✅ Contato ${conversation.effective_contact_id} atualizado`);

    sendSuccess(res, {
      message: 'Nome atualizado com sucesso',
      name: name.trim()
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// START WHATSAPP CONVERSATION
// Inicia ou retorna conversa existente com um telefone
// ================================
const startWhatsAppConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      phone_number,           // Telefone de destino (formato internacional)
      whatsapp_account_id,    // ID da conta WhatsApp (linkedin_accounts.id)
      sector_id,              // Setor para atribuir
      user_id: assignedUserId,// Usuario responsavel
      contact_id,             // ID do contato (opcional)
      opportunity_id          // ID da oportunidade (opcional)
    } = req.body;

    if (!phone_number) {
      throw new ValidationError('phone_number is required');
    }

    if (!whatsapp_account_id) {
      throw new ValidationError('whatsapp_account_id is required');
    }

    console.log(`📱 [WhatsApp] Iniciando conversa: ${phone_number} via conta ${whatsapp_account_id}`);

    // 1. Verificar se a conta WhatsApp existe e esta ativa
    const accountResult = await db.query(`
      SELECT id, unipile_account_id, display_name, status, provider_type, attendant_id
      FROM linkedin_accounts
      WHERE id = $1 AND account_id = $2 AND provider_type = 'WHATSAPP' AND status = 'active'
    `, [whatsapp_account_id, accountId]);

    if (accountResult.rows.length === 0) {
      throw new NotFoundError('WhatsApp account not found or not active');
    }

    const whatsappAccount = accountResult.rows[0];
    const unipileAccountId = whatsappAccount.unipile_account_id;

    // 2. Formatar o telefone (remover caracteres especiais, manter apenas digitos e +)
    const formattedPhone = phone_number.replace(/[^\d+]/g, '');

    // 3. Verificar se ja existe uma conversa com esse telefone nesta conta
    const existingConversation = await db.query(`
      SELECT c.id, c.unipile_chat_id, c.status
      FROM conversations c
      WHERE c.linkedin_account_id = $1
        AND c.lead_phone = $2
        AND c.account_id = $3
      ORDER BY c.last_message_at DESC
      LIMIT 1
    `, [whatsapp_account_id, formattedPhone, accountId]);

    if (existingConversation.rows.length > 0) {
      const conv = existingConversation.rows[0];
      console.log(`✅ [WhatsApp] Conversa existente encontrada: ${conv.id}`);
      return sendSuccess(res, {
        conversation_id: conv.id,
        existing: true
      }, 'Existing conversation found');
    }

    // 4. Buscar o attendee_id do telefone via Unipile (ou construir)
    // Para WhatsApp, o attendee_id geralmente é no formato: phone_number@s.whatsapp.net
    const attendeeId = `${formattedPhone.replace('+', '')}@s.whatsapp.net`;

    // 5. Tentar iniciar um chat via Unipile (enviar mensagem inicial silenciosa ou apenas criar chat)
    // Nota: Dependendo da API Unipile, pode ser necessário enviar uma mensagem para criar o chat
    let unipileChatId;

    try {
      // Tentar obter ou criar chat via API
      // Primeiro, verificar se ja existe chat no Unipile
      const chatsResult = await unipileClient.messaging.getChats({
        account_id: unipileAccountId,
        limit: 1,
        attendee_id: attendeeId
      });

      if (chatsResult?.items?.length > 0) {
        unipileChatId = chatsResult.items[0].id;
        console.log(`📱 [WhatsApp] Chat existente no Unipile: ${unipileChatId}`);
      } else {
        // Chat nao existe - sera criado quando enviar a primeira mensagem
        // Por enquanto, criar um ID temporario
        unipileChatId = `pending_${formattedPhone}_${Date.now()}`;
        console.log(`📱 [WhatsApp] Chat sera criado ao enviar mensagem: ${unipileChatId}`);
      }
    } catch (unipileError) {
      console.error(`⚠️ [WhatsApp] Erro ao buscar chat Unipile:`, unipileError.message);
      // Usar ID temporario
      unipileChatId = `pending_${formattedPhone}_${Date.now()}`;
    }

    // 6. Criar a conversa no banco de dados
    const conversationResult = await db.query(`
      INSERT INTO conversations (
        unipile_chat_id,
        linkedin_account_id,
        lead_phone,
        lead_name,
        contact_id,
        opportunity_id,
        sector_id,
        assigned_user_id,
        status,
        account_id,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'manual', $9, NOW(), NOW())
      RETURNING id
    `, [
      unipileChatId,
      whatsapp_account_id,
      formattedPhone,
      formattedPhone, // lead_name = phone por enquanto
      contact_id || null,
      opportunity_id || null,
      sector_id || null,
      assignedUserId || userId,
      accountId
    ]);

    const newConversationId = conversationResult.rows[0].id;
    console.log(`✅ [WhatsApp] Nova conversa criada: ${newConversationId}`);

    sendSuccess(res, {
      conversation_id: newConversationId,
      existing: false,
      unipile_chat_id: unipileChatId
    }, 'Conversation created successfully');

  } catch (error) {
    console.error(`❌ [WhatsApp] Erro ao iniciar conversa:`, error);
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  getConversations,
  getConversation,
  getMessages,
  sendMessage,
  downloadAttachment,
  getAttachmentInline,
  takeControl,
  releaseControl,
  updateStatus,
  markAsRead,
  getConversationStats,
  closeConversation,
  reopenConversation,
  deleteConversation,
  assignConversation,
  unassignConversation,
  assignSectorToConversation,
  unassignSectorFromConversation,
  // Assignable users/sectors (no permission required)
  getAssignableUsers,
  getAssignableSectors,
  // Summary endpoints
  getSummaryStats,
  generateSummary,
  updateSummary,
  // Contact name update
  updateContactName,
  // WhatsApp conversation start
  startWhatsAppConversation
};
