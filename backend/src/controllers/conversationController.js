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

// ================================
// 1. LISTAR CONVERSAS
// ================================
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      status,
      campaign_id,
      linkedin_account_id,
      search,
      page = 1,
      limit = 50
    } = req.query;

    console.log(`📋 Listando conversas do usuário ${userId}`);

    // Construir query
    let whereConditions = ['camp.user_id = $1'];
    let queryParams = [userId];
    let paramIndex = 2;

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
        ai.name as ai_agent_name
      FROM conversations conv
      INNER JOIN leads l ON conv.lead_id = l.id
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      INNER JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      LEFT JOIN ai_agents ai ON conv.ai_agent_id = ai.id
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

    console.log(`🔍 Buscando conversa ${id}`);

    // Buscar conversa
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
        ai.name as ai_agent_name
      FROM conversations conv
      INNER JOIN leads l ON conv.lead_id = l.id
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      INNER JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      LEFT JOIN ai_agents ai ON conv.ai_agent_id = ai.id
      WHERE conv.id = $1 AND camp.user_id = $2
    `;

    const convResult = await db.query(convQuery, [id, userId]);

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
    const { limit = 100 } = req.query;

    console.log(`📬 Buscando mensagens da conversa ${id} via Unipile API`);

    // Buscar conversa, conta LinkedIn e lead
    const convQuery = `
      SELECT
        conv.*,
        camp.user_id,
        la.unipile_account_id,
        l.provider_id as lead_provider_id
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      INNER JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      LEFT JOIN leads l ON conv.lead_id = l.id
      WHERE conv.id = $1 AND camp.user_id = $2
    `;

    const convResult = await db.query(convQuery, [id, userId]);

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
    const { content } = req.body;

    console.log(`📨 Enviando mensagem na conversa ${id}`);

    // Validação
    if (!content || content.trim().length === 0) {
      throw new ValidationError('Message content is required');
    }

    // Verificar se conversa pertence ao usuário
    const convQuery = `
      SELECT conv.*, la.unipile_account_id, camp.user_id
      FROM conversations conv
      INNER JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE conv.id = $1 AND camp.user_id = $2
    `;

    const convResult = await db.query(convQuery, [id, userId]);

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

    console.log(`👤 Assumindo controle manual da conversa ${id}`);

    // Verificar ownership
    const checkQuery = `
      SELECT conv.id
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE conv.id = $1 AND camp.user_id = $2
    `;

    const checkResult = await db.query(checkQuery, [id, userId]);

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

    console.log(`🤖 Liberando conversa ${id} para IA`);

    // Verificar ownership
    const checkQuery = `
      SELECT conv.id
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE conv.id = $1 AND camp.user_id = $2
    `;

    const checkResult = await db.query(checkQuery, [id, userId]);

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
    const { status } = req.body;

    console.log(`📝 Atualizando status da conversa ${id} para ${status}`);

    // Validar status
    if (!status || !['ai_active', 'manual'].includes(status)) {
      throw new ValidationError('Invalid status. Must be "ai_active" or "manual"');
    }

    // Verificar ownership
    const checkQuery = `
      SELECT conv.id
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE conv.id = $1 AND camp.user_id = $2
    `;

    const checkResult = await db.query(checkQuery, [id, userId]);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    // Atualizar status
    const updateQuery = status === 'manual'
      ? `UPDATE conversations
         SET status = $1, ai_paused_at = NOW(), updated_at = NOW()
         WHERE id = $2
         RETURNING *`
      : `UPDATE conversations
         SET status = $1, ai_paused_at = NULL, updated_at = NOW()
         WHERE id = $2
         RETURNING *`;

    const result = await db.query(updateQuery, [status, id]);

    console.log('✅ Status atualizado');

    sendSuccess(res, result.rows[0], status === 'manual'
      ? 'AI paused. Manual mode activated.'
      : 'AI activated. Manual mode disabled.');

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

    console.log(`👁️ Marcando conversa ${id} como lida`);

    // Verificar ownership
    const checkQuery = `
      SELECT conv.id
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE conv.id = $1 AND camp.user_id = $2
    `;

    const checkResult = await db.query(checkQuery, [id, userId]);

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

    console.log(`📊 Buscando estatísticas de conversas do usuário ${userId}`);

    // Stats por status
    const statusStatsQuery = `
      SELECT
        conv.status,
        COUNT(*) as count
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE camp.user_id = $1
      GROUP BY conv.status
    `;

    const statusStats = await db.query(statusStatsQuery, [userId]);

    // Total de conversas
    const totalQuery = `
      SELECT COUNT(*) as total
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE camp.user_id = $1
    `;

    const totalResult = await db.query(totalQuery, [userId]);

    // Conversas com mensagens não lidas
    const unreadQuery = `
      SELECT COUNT(*) as unread_conversations
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE camp.user_id = $1 AND conv.unread_count > 0
    `;

    const unreadResult = await db.query(unreadQuery, [userId]);

    // Organizar dados
    const stats = {
      total: parseInt(totalResult.rows[0].total),
      by_status: {
        ai_active: 0,
        manual: 0
      },
      unread_conversations: parseInt(unreadResult.rows[0].unread_conversations)
    };

    statusStats.rows.forEach(row => {
      stats.by_status[row.status] = parseInt(row.count);
    });

    console.log('✅ Estatísticas calculadas');

    sendSuccess(res, stats);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 10. DELETAR CONVERSA
// ================================
const deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`🗑️ Deletando conversa ${id}`);

    // Verificar ownership
    const checkQuery = `
      SELECT conv.id
      FROM conversations conv
      INNER JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE conv.id = $1 AND camp.user_id = $2
    `;

    const checkResult = await db.query(checkQuery, [id, userId]);

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
  deleteConversation
};
