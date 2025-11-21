// backend/src/controllers/conversationController.js
const db = require('../config/database');
const unipileClient = require('../config/unipile');
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
      search,
      page = 1,
      limit = 50
    } = req.query;

    console.log(`📋 Listando conversas do usuário ${userId}`);

    // Get accessible sectors for this user
    const accessibleSectorIds = await getAccessibleSectorIds(userId, accountId);

    // Construir query - MULTI-TENANCY: Filter by account_id AND sector access
    let whereConditions = ['camp.account_id = $1', 'camp.user_id = $2'];
    let queryParams = [accountId, userId];
    let paramIndex = 3;

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

    // Filtro por conta LinkedIn
    if (linkedin_account_id) {
      whereConditions.push(`conv.linkedin_account_id = $${paramIndex}`);
      queryParams.push(linkedin_account_id);
      paramIndex++;
    }

    // Busca por nome do lead
    if (search) {
      whereConditions.push(`l.name ILIKE $${paramIndex}`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.join(' AND ');

    // Query principal
    const query = `
      SELECT
        conv.*,
        l.name as lead_name,
        l.title as lead_title,
        l.company as lead_company,
        l.profile_picture as lead_picture,
        l.profile_url as lead_profile_url,
        l.status as lead_status,
        camp.name as campaign_name,
        la.linkedin_username,
        la.profile_name as account_name,
        ai.name as ai_agent_name,
        assigned_user.name as assigned_user_name,
        assigned_user.email as assigned_user_email
      FROM conversations conv
      INNER JOIN leads l ON conv.lead_id = l.id
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      INNER JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      LEFT JOIN ai_agents ai ON conv.ai_agent_id = ai.id
      LEFT JOIN users assigned_user ON conv.assigned_user_id = assigned_user.id
      WHERE ${whereClause}
      ORDER BY conv.last_message_at DESC NULLS LAST, conv.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const conversations = await db.query(query, queryParams);

    // Contar total
    const countQuery = `
      SELECT COUNT(*)
      FROM conversations conv
      INNER JOIN leads l ON conv.lead_id = l.id
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    console.log(`✅ Encontradas ${conversations.rows.length} conversas`);

    sendSuccess(res, {
      conversations: conversations.rows,
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

    console.log(`🔍 Buscando conversa ${id}`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildSectorFilter(userId, accountId);

    // Buscar conversa - MULTI-TENANCY + SECTOR: Filter by account_id and accessible sectors
    const convQuery = `
      SELECT
        conv.*,
        l.name as lead_name,
        l.title as lead_title,
        l.company as lead_company,
        l.location as lead_location,
        l.email as lead_email,
        l.phone as lead_phone,
        l.profile_picture as lead_picture,
        l.profile_url as lead_profile_url,
        l.status as lead_status,
        l.score as lead_score,
        camp.name as campaign_name,
        camp.id as campaign_id,
        la.linkedin_username,
        la.unipile_account_id,
        ai.name as ai_agent_name,
        assigned_user.name as assigned_user_name
      FROM conversations conv
      INNER JOIN leads l ON conv.lead_id = l.id
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      INNER JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      LEFT JOIN ai_agents ai ON conv.ai_agent_id = ai.id
      LEFT JOIN users assigned_user ON conv.assigned_user_id = assigned_user.id
      WHERE conv.id = $1 AND camp.account_id = $2 AND camp.user_id = $3 ${sectorFilter}
    `;

    const queryParams = [id, accountId, userId, ...sectorParams];
    const convResult = await db.query(convQuery, queryParams);

    if (convResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    const conversation = convResult.rows[0];

    console.log(`✅ Conversa encontrada`);

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

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildSectorFilter(userId, accountId);

    // Buscar conversa, conta LinkedIn e lead - MULTI-TENANCY + SECTOR: Filter by account_id and sectors
    const convQuery = `
      SELECT
        conv.*,
        camp.user_id,
        camp.account_id,
        la.unipile_account_id,
        l.provider_id as lead_provider_id
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      INNER JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      LEFT JOIN leads l ON conv.lead_id = l.id
      WHERE conv.id = $1 AND camp.account_id = $2 AND camp.user_id = $3 ${sectorFilter}
    `;

    const queryParams = [id, accountId, userId, ...sectorParams];
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

      console.log(`✅ ${unipileMessages.items?.length || 0} mensagens obtidas da Unipile`);

      // Log para debug
      console.log(`🔍 Lead provider_id da conversa: ${conversation.lead_provider_id}`);

      // Processar mensagens para formato esperado pelo frontend
      const messages = (unipileMessages.items || []).map((msg) => {
        // ✅ Usar is_sender para determinar quem enviou
        // is_sender === 1 → mensagem do usuário
        // is_sender === 0 → mensagem do lead
        const senderType = msg.is_sender === 1 ? 'user' : 'lead';

        return {
          id: msg.id,
          conversation_id: id,
          unipile_message_id: msg.id,
          sender_type: senderType,
          content: msg.text || '',
          message_type: msg.message_type || 'text',
          sent_at: msg.timestamp || msg.date || msg.created_at,
          created_at: msg.created_at || msg.timestamp
        };
      });

      // Ordenar por data (mais antiga primeiro para exibição correta)
      messages.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));

      console.log(`✅ ${messages.length} mensagens processadas`);

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
          created_at
        FROM messages
        WHERE conversation_id = $1
        ORDER BY sent_at ASC, created_at ASC
        LIMIT $2
      `;

      const messagesResult = await db.query(messagesQuery, [id, limit]);

      console.log(`✅ ${messagesResult.rows.length} mensagens encontradas no cache local`);

      sendSuccess(res, {
        messages: messagesResult.rows,
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

    console.log(`📨 Enviando mensagem na conversa ${id}`);

    // Validação
    if (!content || content.trim().length === 0) {
      throw new ValidationError('Message content is required');
    }

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildSectorFilter(userId, accountId);

    // Verificar se conversa pertence ao usuário E à conta (MULTI-TENANCY + SECTOR)
    const convQuery = `
      SELECT conv.*, la.unipile_account_id, camp.user_id, camp.account_id
      FROM conversations conv
      INNER JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE conv.id = $1 AND camp.account_id = $2 AND camp.user_id = $3 ${sectorFilter}
    `;

    const queryParams = [id, accountId, userId, ...sectorParams];
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

      const sentMessage = await unipileClient.messaging.sendMessage({
        account_id: conversation.unipile_account_id,
        chat_id: conversation.unipile_chat_id,
        text: content.trim()
      });

      console.log('✅ Mensagem enviada via Unipile');

      // Atualizar cache da conversa
      await db.query(`
        UPDATE conversations
        SET
          last_message_preview = $1,
          last_message_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
      `, [content.substring(0, 200), id]);

      sendSuccess(res, sentMessage, 'Message sent successfully', 201);

    } catch (unipileError) {
      console.error('❌ Erro ao enviar via Unipile:', unipileError.message);
      throw new UnipileError('Failed to send message via Unipile');
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

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildSectorFilter(userId, accountId);

    // Verificar ownership - MULTI-TENANCY + SECTOR: Filter by account_id and sectors
    const checkQuery = `
      SELECT conv.id
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE conv.id = $1 AND camp.account_id = $2 AND camp.user_id = $3 ${sectorFilter}
    `;

    const queryParams = [id, accountId, userId, ...sectorParams];
    const checkResult = await db.query(checkQuery, queryParams);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    // Atualizar para modo manual
    const updateQuery = `
      UPDATE conversations
      SET status = 'manual', ai_paused_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(updateQuery, [id]);

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

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildSectorFilter(userId, accountId);

    // Verificar ownership - MULTI-TENANCY + SECTOR: Filter by account_id and sectors
    const checkQuery = `
      SELECT conv.id
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE conv.id = $1 AND camp.account_id = $2 AND camp.user_id = $3 ${sectorFilter}
    `;

    const queryParams = [id, accountId, userId, ...sectorParams];
    const checkResult = await db.query(checkQuery, queryParams);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    // Atualizar para modo IA
    const updateQuery = `
      UPDATE conversations
      SET status = 'ai_active', ai_paused_at = NULL, updated_at = NOW()
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

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildSectorFilter(userId, accountId);

    // Verificar ownership - MULTI-TENANCY + SECTOR: Filter by account_id and sectors
    const checkQuery = `
      SELECT conv.id
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE conv.id = $1 AND camp.account_id = $2 AND camp.user_id = $3 ${sectorFilter}
    `;

    const queryParams = [id, accountId, userId, ...sectorParams];
    const checkResult = await db.query(checkQuery, queryParams);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    // Atualizar status
    let updateQuery;
    let message;

    if (status === 'manual') {
      updateQuery = `UPDATE conversations
         SET status = $1, ai_paused_at = NOW(), closed_at = NULL, updated_at = NOW()
         WHERE id = $2
         RETURNING *`;
      message = 'AI paused. Manual mode activated.';
    } else if (status === 'closed') {
      updateQuery = `UPDATE conversations
         SET status = $1, closed_at = NOW(), updated_at = NOW()
         WHERE id = $2
         RETURNING *`;
      message = 'Conversation closed successfully.';
    } else {
      updateQuery = `UPDATE conversations
         SET status = $1, ai_paused_at = NULL, closed_at = NULL, updated_at = NOW()
         WHERE id = $2
         RETURNING *`;
      message = 'AI activated. Manual mode disabled.';
    }

    const result = await db.query(updateQuery, [status, id]);

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

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildSectorFilter(userId, accountId);

    // Verificar ownership - MULTI-TENANCY + SECTOR: Filter by account_id and sectors
    const checkQuery = `
      SELECT conv.id
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE conv.id = $1 AND camp.account_id = $2 AND camp.user_id = $3 ${sectorFilter}
    `;

    const queryParams = [id, accountId, userId, ...sectorParams];
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

    // Build sector filter for aggregate queries
    let sectorFilter = '';
    let sectorParams = [];
    if (accessibleSectorIds.length > 0) {
      sectorFilter = 'AND (conv.sector_id = ANY($3) OR conv.sector_id IS NULL)';
      sectorParams = [accessibleSectorIds];
    } else {
      sectorFilter = 'AND conv.sector_id IS NULL';
    }

    const queryParams = [accountId, userId, ...sectorParams];

    // Total de conversas
    const totalQuery = `
      SELECT COUNT(*) as total
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE camp.account_id = $1 AND camp.user_id = $2 ${sectorFilter}
    `;
    const totalResult = await db.query(totalQuery, queryParams);

    // Conversas atribuídas ao usuário atual (não fechadas)
    const mineQuery = `
      SELECT COUNT(*) as count
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE camp.account_id = $1
        AND camp.user_id = $2
        AND conv.assigned_user_id = $2
        AND conv.status != 'closed'
        ${sectorFilter}
    `;
    const mineResult = await db.query(mineQuery, queryParams);

    // Conversas não atribuídas (não fechadas)
    const unassignedQuery = `
      SELECT COUNT(*) as count
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE camp.account_id = $1
        AND camp.user_id = $2
        AND conv.assigned_user_id IS NULL
        AND conv.status != 'closed'
        ${sectorFilter}
    `;
    const unassignedResult = await db.query(unassignedQuery, queryParams);

    // Conversas fechadas
    const closedQuery = `
      SELECT COUNT(*) as count
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE camp.account_id = $1
        AND camp.user_id = $2
        AND conv.status = 'closed'
        ${sectorFilter}
    `;
    const closedResult = await db.query(closedQuery, queryParams);

    // Conversas com mensagens não lidas
    const unreadQuery = `
      SELECT COUNT(*) as unread_conversations
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE camp.account_id = $1 AND camp.user_id = $2 AND conv.unread_count > 0 ${sectorFilter}
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

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildSectorFilter(userId, accountId);

    // Verificar ownership - MULTI-TENANCY + SECTOR: Filter by account_id and sectors
    const checkQuery = `
      SELECT conv.id
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE conv.id = $1 AND camp.account_id = $2 AND camp.user_id = $3 ${sectorFilter}
    `;

    const queryParams = [id, accountId, userId, ...sectorParams];
    const checkResult = await db.query(checkQuery, queryParams);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    // Atualizar para status 'closed'
    const updateQuery = `
      UPDATE conversations
      SET status = 'closed', closed_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(updateQuery, [id]);

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

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildSectorFilter(userId, accountId);

    // Verificar ownership - MULTI-TENANCY + SECTOR: Filter by account_id and sectors
    const checkQuery = `
      SELECT conv.id
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE conv.id = $1 AND camp.account_id = $2 AND camp.user_id = $3 ${sectorFilter}
    `;

    const queryParams = [id, accountId, userId, ...sectorParams];
    const checkResult = await db.query(checkQuery, queryParams);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    // Atualizar status e limpar closed_at
    const updateQuery = status === 'manual'
      ? `UPDATE conversations
         SET status = $1, closed_at = NULL, ai_paused_at = NOW(), updated_at = NOW()
         WHERE id = $2
         RETURNING *`
      : `UPDATE conversations
         SET status = $1, closed_at = NULL, ai_paused_at = NULL, updated_at = NOW()
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

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildSectorFilter(userId, accountId);

    // Verificar ownership - MULTI-TENANCY + SECTOR: Filter by account_id and sectors
    const checkQuery = `
      SELECT conv.id
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE conv.id = $1 AND camp.account_id = $2 AND camp.user_id = $3 ${sectorFilter}
    `;

    const queryParams = [id, accountId, userId, ...sectorParams];
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

    // Verify conversation exists and user has access to it
    const { filter: sectorFilter, params: sectorParams } = await buildSectorFilter(
      requestingUserId,
      accountId,
      4
    );

    const convQuery = `
      SELECT conv.*
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE conv.id = $1
        AND camp.account_id = $2
        AND camp.user_id = $3
        ${sectorFilter}
    `;
    const convResult = await db.query(convQuery, [id, accountId, requestingUserId, ...sectorParams]);

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

    // Verify conversation exists and user has access to it
    const { filter: sectorFilter, params: sectorParams } = await buildSectorFilter(
      userId,
      accountId,
      4
    );

    const convQuery = `
      SELECT conv.*
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE conv.id = $1
        AND camp.account_id = $2
        AND camp.user_id = $3
        ${sectorFilter}
    `;
    const convResult = await db.query(convQuery, [id, accountId, userId, ...sectorParams]);

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

module.exports = {
  getConversations,
  getConversation,
  getMessages,
  sendMessage,
  takeControl,
  releaseControl,
  updateStatus,
  markAsRead,
  getConversationStats,
  closeConversation,
  reopenConversation,
  deleteConversation,
  assignConversation,
  unassignConversation
};
