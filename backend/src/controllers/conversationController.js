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
const { CONVERSATION_STATUS } = require('../utils/helpers');

// ================================
// 1. LISTAR CONVERSAS
// ================================
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      status, 
      ai_active,
      linkedin_account_id,
      search,
      page = 1, 
      limit = 20 
    } = req.query;

    console.log(`📋 Listando conversas do usuário ${userId}`);

    // Construir query
    let whereConditions = ['conv.user_id = $1'];
    let queryParams = [userId];
    let paramIndex = 2;

    // Filtro por status
    if (status) {
      whereConditions.push(`conv.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    // Filtro por IA ativa/inativa
    if (ai_active !== undefined) {
      whereConditions.push(`conv.ai_active = $${paramIndex}`);
      queryParams.push(ai_active === 'true');
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
        l.status as lead_status,
        c.name as campaign_name,
        la.linkedin_username,
        aa.name as ai_agent_name
      FROM conversations conv
      JOIN leads l ON conv.lead_id = l.id
      JOIN campaigns c ON l.campaign_id = c.id
      JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      LEFT JOIN ai_agents aa ON conv.ai_agent_id = aa.id
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
      JOIN leads l ON conv.lead_id = l.id
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
// 2. OBTER CONVERSA COM MENSAGENS
// ================================
const getConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { limit = 50 } = req.query;

    console.log(`🔍 Buscando conversa ${id}`);

    // Buscar conversa
    const convQuery = `
      SELECT 
        conv.*,
        l.name as lead_name,
        l.title as lead_title,
        l.company as lead_company,
        l.profile_picture as lead_picture,
        l.profile_url as lead_profile_url,
        l.status as lead_status,
        l.score as lead_score,
        c.name as campaign_name,
        c.id as campaign_id,
        la.linkedin_username,
        aa.name as ai_agent_name,
        aa.personality_tone
      FROM conversations conv
      JOIN leads l ON conv.lead_id = l.id
      JOIN campaigns c ON l.campaign_id = c.id
      JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      LEFT JOIN ai_agents aa ON conv.ai_agent_id = aa.id
      WHERE conv.id = $1 AND conv.user_id = $2
    `;

    const convResult = await db.query(convQuery, [id, userId]);

    if (convResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    const conversation = convResult.rows[0];

    // Buscar mensagens
    const messagesQuery = `
      SELECT *
      FROM messages
      WHERE conversation_id = $1
      ORDER BY sent_at DESC
      LIMIT $2
    `;

    const messagesResult = await db.query(messagesQuery, [id, limit]);

    // Inverter ordem para mostrar mais antigas primeiro
    const messages = messagesResult.rows.reverse();

    console.log(`✅ Conversa encontrada com ${messages.length} mensagens`);

    sendSuccess(res, {
      ...conversation,
      messages
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 3. ENVIAR MENSAGEM
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
      SELECT conv.*, la.unipile_account_id
      FROM conversations conv
      JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      WHERE conv.id = $1 AND conv.user_id = $2
    `;

    const convResult = await db.query(convQuery, [id, userId]);

    if (convResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    const conversation = convResult.rows[0];

    // Enviar mensagem via Unipile
    let unipileMessageId = null;

    try {
      if (unipileClient.isInitialized() && conversation.unipile_chat_id) {
        console.log('📡 Enviando via Unipile...');
        
        const unipileResponse = await unipileClient.messaging.sendMessage({
          account_id: conversation.unipile_account_id,
          chat_id: conversation.unipile_chat_id,
          text: content
        });

        unipileMessageId = unipileResponse.id || unipileResponse.message_id;
        console.log('✅ Mensagem enviada via Unipile:', unipileMessageId);
      } else {
        console.warn('⚠️ Unipile não disponível, salvando apenas localmente');
      }
    } catch (unipileError) {
      console.error('❌ Erro ao enviar via Unipile:', unipileError.message);
      // Continuar mesmo se Unipile falhar
    }

    // Salvar mensagem no banco
    const messageData = {
      conversation_id: id,
      unipile_message_id: unipileMessageId || `local_${Date.now()}`,
      sender_type: 'user',
      content: content.trim(),
      message_type: 'text',
      sent_at: new Date()
    };

    const message = await db.insert('messages', messageData);

    // Atualizar conversa
    await db.update('conversations', {
      last_message_preview: content.substring(0, 100),
      last_message_at: new Date(),
      manual_control_taken: true,
      ai_active: false // Desativar IA quando usuário envia mensagem
    }, { id });

    console.log('✅ Mensagem salva no banco');

    sendSuccess(res, message, 'Message sent successfully', 201);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 4. ASSUMIR CONTROLE MANUAL
// ================================
const takeControl = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`👤 Assumindo controle manual da conversa ${id}`);

    // Verificar se conversa pertence ao usuário
    const conversation = await db.query(
      'SELECT * FROM conversations WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (conversation.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    // Atualizar
    const updated = await db.update('conversations', {
      manual_control_taken: true,
      ai_active: false
    }, { id });

    console.log('✅ Controle manual ativado, IA desativada');

    sendSuccess(res, updated, 'Manual control activated. AI disabled.');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 5. LIBERAR PARA IA
// ================================
const releaseControl = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`🤖 Liberando conversa ${id} para IA`);

    // Verificar se conversa pertence ao usuário
    const conversation = await db.query(
      'SELECT * FROM conversations WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (conversation.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    // Atualizar
    const updated = await db.update('conversations', {
      manual_control_taken: false,
      ai_active: true
    }, { id });

    console.log('✅ IA reativada, controle liberado');

    sendSuccess(res, updated, 'AI control activated. Manual control released.');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 6. ATUALIZAR STATUS DA CONVERSA
// ================================
const updateConversationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { status } = req.body;

    console.log(`📝 Atualizando status da conversa ${id} para ${status}`);

    // Validar status
    const validStatuses = Object.values(CONVERSATION_STATUS);
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Verificar se conversa pertence ao usuário
    const conversation = await db.query(
      'SELECT * FROM conversations WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (conversation.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    // Atualizar
    const updated = await db.update('conversations', { status }, { id });

    console.log('✅ Status atualizado');

    sendSuccess(res, updated, 'Conversation status updated');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 7. MARCAR COMO LIDA
// ================================
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`👁️ Marcando conversa ${id} como lida`);

    // Verificar se conversa pertence ao usuário
    const conversation = await db.query(
      'SELECT * FROM conversations WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (conversation.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    // Atualizar
    const updated = await db.update('conversations', {
      unread_count: 0
    }, { id });

    console.log('✅ Conversa marcada como lida');

    sendSuccess(res, updated, 'Conversation marked as read');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 8. OBTER ESTATÍSTICAS
// ================================
const getConversationStats = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`📊 Buscando estatísticas de conversas do usuário ${userId}`);

    // Stats por status
    const statusStatsQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM conversations
      WHERE user_id = $1
      GROUP BY status
    `;

    const statusStats = await db.query(statusStatsQuery, [userId]);

    // Stats de IA
    const aiStatsQuery = `
      SELECT 
        ai_active,
        COUNT(*) as count
      FROM conversations
      WHERE user_id = $1
      GROUP BY ai_active
    `;

    const aiStats = await db.query(aiStatsQuery, [userId]);

    // Total de mensagens
    const messagesQuery = `
      SELECT COUNT(*) as total_messages
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.user_id = $1
    `;

    const messagesResult = await db.query(messagesQuery, [userId]);

    // Conversas com mensagens não lidas
    const unreadQuery = `
      SELECT COUNT(*) as unread_conversations
      FROM conversations
      WHERE user_id = $1 AND unread_count > 0
    `;

    const unreadResult = await db.query(unreadQuery, [userId]);

    // Organizar dados
    const stats = {
      by_status: {
        hot: 0,
        warm: 0,
        cold: 0
      },
      by_ai: {
        ai_active: 0,
        manual_control: 0
      },
      total_messages: parseInt(messagesResult.rows[0].total_messages),
      unread_conversations: parseInt(unreadResult.rows[0].unread_conversations)
    };

    statusStats.rows.forEach(row => {
      stats.by_status[row.status] = parseInt(row.count);
    });

    aiStats.rows.forEach(row => {
      if (row.ai_active) {
        stats.by_ai.ai_active = parseInt(row.count);
      } else {
        stats.by_ai.manual_control = parseInt(row.count);
      }
    });

    console.log('✅ Estatísticas calculadas');

    sendSuccess(res, stats);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 9. DELETAR CONVERSA
// ================================
const deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`🗑️ Deletando conversa ${id}`);

    // Verificar se conversa pertence ao usuário
    const conversation = await db.query(
      'SELECT * FROM conversations WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (conversation.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    // Deletar (CASCADE vai deletar mensagens)
    await db.delete('conversations', { id });

    console.log('✅ Conversa deletada');

    sendSuccess(res, null, 'Conversation deleted successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  getConversations,
  getConversation,
  sendMessage,
  takeControl,
  releaseControl,
  updateConversationStatus,
  markAsRead,
  getConversationStats,
  deleteConversation
};