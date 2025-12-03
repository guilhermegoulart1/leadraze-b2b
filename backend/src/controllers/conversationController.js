// backend/src/controllers/conversationController.js
const db = require('../config/database');
const unipileClient = require('../config/unipile');
const conversationSummaryService = require('../services/conversationSummaryService');
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
      lead_id,
      search,
      page = 1,
      limit = 50
    } = req.query;

    console.log(`📋 Listando conversas do usuário ${userId}`);

    // Get accessible sectors for this user
    const accessibleSectorIds = await getAccessibleSectorIds(userId, accountId);

    // Construir query - MULTI-TENANCY: Filter by account_id AND sector access
    // Usar conv.account_id para suportar conversas orgânicas (sem campaign)
    let whereConditions = ['conv.account_id = $1', 'conv.user_id = $2'];
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

    // Filtro por conta LinkedIn/Canal
    if (linkedin_account_id) {
      whereConditions.push(`conv.linkedin_account_id = $${paramIndex}`);
      queryParams.push(linkedin_account_id);
      paramIndex++;
    }

    // Filtro por lead_id (para modal de lead)
    if (lead_id) {
      whereConditions.push(`conv.lead_id = $${paramIndex}`);
      queryParams.push(lead_id);
      paramIndex++;
    }

    // Busca por nome do lead OU contato
    if (search) {
      whereConditions.push(`(l.name ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex} OR c.phone ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.join(' AND ');

    // Query principal - com suporte a contact_id (conversas orgânicas)
    const query = `
      SELECT
        conv.*,
        -- Dados do lead (se existir)
        l.name as lead_name,
        l.title as lead_title,
        l.company as lead_company,
        l.profile_picture as lead_picture,
        l.profile_url as lead_profile_url,
        l.status as lead_status,
        -- Dados do contato (se existir)
        c.id as contact_id,
        c.name as contact_name,
        c.phone as contact_phone,
        c.title as contact_title,
        c.company as contact_company,
        c.profile_picture as contact_picture,
        -- Outros campos
        camp.name as campaign_name,
        la.linkedin_username,
        la.profile_name as account_name,
        ai.name as ai_agent_name,
        assigned_user.name as assigned_user_name,
        assigned_user.email as assigned_user_email,
        s.id as sector_id,
        s.name as sector_name,
        s.color as sector_color
      FROM conversations conv
      LEFT JOIN leads l ON conv.lead_id = l.id
      LEFT JOIN contacts c ON conv.contact_id = c.id
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

    // Processar conversas para unificar lead_name/contact_name
    const processedConversations = conversations.rows.map(conv => ({
      ...conv,
      // Usar nome do lead se existir, senão do contato
      lead_name: conv.lead_name || conv.contact_name || 'Contato',
      lead_title: conv.lead_title || conv.contact_title,
      lead_company: conv.lead_company || conv.contact_company,
      lead_picture: conv.lead_picture || conv.contact_picture,
      lead_phone: conv.contact_phone, // Telefone só existe no contato
      is_organic: !conv.lead_id && !!conv.contact_id // Flag para conversas orgânicas
    }));

    // Contar total
    const countQuery = `
      SELECT COUNT(*)
      FROM conversations conv
      LEFT JOIN leads l ON conv.lead_id = l.id
      LEFT JOIN contacts c ON conv.contact_id = c.id
      LEFT JOIN campaigns camp ON conv.campaign_id = camp.id
      WHERE ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

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

    console.log(`🔍 Buscando conversa ${id}`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildSectorFilter(userId, accountId);

    // Buscar conversa - MULTI-TENANCY + SECTOR: Filter by account_id and accessible sectors
    // Suporte a conversas com contact_id (orgânicas) ou lead_id (campanhas)
    const convQuery = `
      SELECT
        conv.*,
        -- Dados do lead (se existir)
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
        -- Dados do contato (se existir)
        ct.id as contact_id,
        ct.name as contact_name,
        ct.phone as contact_phone,
        ct.title as contact_title,
        ct.company as contact_company,
        ct.profile_picture as contact_picture,
        ct.profile_url as contact_profile_url,
        ct.location as contact_location,
        -- Outros campos
        camp.name as campaign_name,
        camp.id as campaign_id,
        la.linkedin_username,
        la.unipile_account_id,
        ai.name as ai_agent_name,
        assigned_user.name as assigned_user_name,
        s.id as sector_id,
        s.name as sector_name,
        s.color as sector_color
      FROM conversations conv
      LEFT JOIN leads l ON conv.lead_id = l.id
      LEFT JOIN contacts ct ON conv.contact_id = ct.id
      LEFT JOIN campaigns camp ON conv.campaign_id = camp.id
      INNER JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      LEFT JOIN ai_agents ai ON conv.ai_agent_id = ai.id
      LEFT JOIN users assigned_user ON conv.assigned_user_id = assigned_user.id
      LEFT JOIN sectors s ON conv.sector_id = s.id
      WHERE conv.id = $1 AND conv.account_id = $2 AND conv.user_id = $3 ${sectorFilter}
    `;

    const queryParams = [id, accountId, userId, ...sectorParams];
    const convResult = await db.query(convQuery, queryParams);

    if (convResult.rows.length === 0) {
      throw new NotFoundError('Conversation not found');
    }

    const conv = convResult.rows[0];

    // Processar para unificar dados de lead/contato
    const conversation = {
      ...conv,
      // Usar dados do lead se existir, senão do contato
      lead_name: conv.lead_name || conv.contact_name || 'Contato',
      lead_title: conv.lead_title || conv.contact_title,
      lead_company: conv.lead_company || conv.contact_company,
      lead_picture: conv.lead_picture || conv.contact_picture,
      lead_profile_url: conv.lead_profile_url || conv.contact_profile_url,
      lead_location: conv.lead_location || conv.contact_location,
      lead_phone: conv.lead_phone || conv.contact_phone,
      is_organic: !conv.lead_id && !!conv.contact_id
    };

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
    // ✅ CORRIGIDO: LEFT JOIN em campaigns para suportar conversas orgânicas (sem campanha)
    // ✅ ADICIONADO: channel_identifier para detectar mensagens do próprio usuário
    const convQuery = `
      SELECT
        conv.*,
        la.unipile_account_id,
        la.channel_identifier as own_number,
        COALESCE(l.provider_id, ct.linkedin_profile_id) as lead_provider_id
      FROM conversations conv
      INNER JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      LEFT JOIN campaigns camp ON conv.campaign_id = camp.id
      LEFT JOIN leads l ON conv.lead_id = l.id
      LEFT JOIN contacts ct ON conv.contact_id = ct.id
      WHERE conv.id = $1 AND conv.account_id = $2 AND conv.user_id = $3 ${sectorFilter}
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
      console.log(`🔍 Own number (canal): ${conversation.own_number}`);

      // Normalizar número do próprio usuário para comparação
      const ownNumberClean = conversation.own_number?.replace(/@s\.whatsapp\.net|@c\.us/gi, '') || '';

      // 🔍 DEBUG: Contagem de mensagens por tipo
      const allMessages = unipileMessages.items || [];
      let userCount = 0;
      let leadCount = 0;
      let unknownCount = 0;

      allMessages.forEach((msg) => {
        try {
          const originalData = typeof msg.original === 'string' ? JSON.parse(msg.original) : msg.original;
          if (originalData?.key?.fromMe === true) userCount++;
          else if (originalData?.key?.fromMe === false) leadCount++;
          else unknownCount++;
        } catch (e) {
          unknownCount++;
        }
      });

      console.log('🔍 DEBUG - Own number clean:', ownNumberClean);
      console.log(`📊 CONTAGEM: Total=${allMessages.length} | USER(fromMe=true)=${userCount} | LEAD(fromMe=false)=${leadCount} | UNKNOWN=${unknownCount}`);

      // Log algumas mensagens do LEAD para debug
      const leadMessages = allMessages.filter(msg => {
        try {
          const originalData = typeof msg.original === 'string' ? JSON.parse(msg.original) : msg.original;
          return originalData?.key?.fromMe === false;
        } catch (e) { return false; }
      }).slice(0, 3);

      console.log(`🔍 DEBUG - Primeiras 3 mensagens do LEAD:`);
      leadMessages.forEach((msg, i) => {
        console.log(`   [${i}] sender_id=${msg.sender_id || ''} | "${(msg.text || '').substring(0, 40)}"`);
      });

      // Processar mensagens para formato esperado pelo frontend
      const messages = (unipileMessages.items || []).map((msg) => {
        // ✅ FIX: Usar campo 'original' que contém dados reais do WhatsApp
        // O WhatsApp introduziu novos IDs de privacidade (@lid) que não contêm o telefone
        let senderType = 'lead'; // default

        // Método 1: Usar original.key.fromMe (mais confiável)
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

        return {
          id: msg.id,
          conversation_id: id,
          unipile_message_id: msg.id,
          sender_type: senderType,
          content: msg.text || '',
          message_type: attachments.length > 0 ? 'attachment' : (msg.message_type || 'text'),
          attachments: attachments,
          sent_at: msg.timestamp || msg.date || msg.created_at,
          created_at: msg.created_at || msg.timestamp
        };
      });

      // Ordenar por data (mais antiga primeiro para exibição correta)
      messages.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));

      // 🔍 DEBUG: Verificar sender_type das mensagens mapeadas
      const userMapped = messages.filter(m => m.sender_type === 'user').length;
      const leadMapped = messages.filter(m => m.sender_type === 'lead').length;
      const otherMapped = messages.filter(m => m.sender_type !== 'user' && m.sender_type !== 'lead').length;
      console.log(`📊 MAPPED: user=${userMapped} | lead=${leadMapped} | other=${otherMapped}`);

      // Log primeiras 3 mensagens lead mapeadas
      const leadMappedMsgs = messages.filter(m => m.sender_type === 'lead').slice(0, 3);
      console.log(`🔍 Primeiras 3 msgs LEAD mapeadas:`);
      leadMappedMsgs.forEach((m, i) => {
        console.log(`   [${i}] sender_type=${m.sender_type} | content="${(m.content || '').substring(0, 40)}"`);
      });

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

    // Verificar se há arquivos anexados (via multer)
    const files = req.files || [];
    const hasAttachments = files.length > 0;

    console.log(`📨 Enviando mensagem na conversa ${id}${hasAttachments ? ` com ${files.length} anexo(s)` : ''}`);

    // Validação - precisa ter texto OU attachments
    if ((!content || content.trim().length === 0) && !hasAttachments) {
      throw new ValidationError('Message content or attachment is required');
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
      console.error('❌ Erro ao baixar attachment via Unipile:', unipileError.message);
      throw new UnipileError('Failed to download attachment');
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
      console.error('❌ Erro ao buscar attachment via Unipile:', unipileError.message);
      throw new UnipileError('Failed to get attachment');
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

    // ✅ FIX: Usar LEFT JOIN para suportar conversas orgânicas (sem campanha)
    const checkQuery = `
      SELECT conv.id
      FROM conversations conv
      LEFT JOIN campaigns camp ON conv.campaign_id = camp.id
      LEFT JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
      WHERE conv.id = $1
      AND (
        (camp.account_id = $2 AND camp.user_id = $3)
        OR
        (conv.campaign_id IS NULL AND la.account_id = $2)
      )
      ${sectorFilter}
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

    // Buscar conversa com contact_id
    const convQuery = `
      SELECT conv.*, conv.contact_id, conv.lead_id
      FROM conversations conv
      WHERE conv.id = $1 AND conv.account_id = $2 AND conv.user_id = $3
    `;
    const convResult = await db.query(convQuery, [id, accountId, userId]);

    if (convResult.rows.length === 0) {
      throw new NotFoundError('Conversa não encontrada');
    }

    const conversation = convResult.rows[0];

    // Se tem contact_id, atualizar o contato
    if (conversation.contact_id) {
      await db.query(
        'UPDATE contacts SET name = $1, updated_at = NOW() WHERE id = $2',
        [name.trim(), conversation.contact_id]
      );
      console.log(`✅ Contato ${conversation.contact_id} atualizado`);
    }
    // Se tem lead_id (e não contact_id), atualizar o lead
    else if (conversation.lead_id) {
      await db.query(
        'UPDATE leads SET name = $1 WHERE id = $2',
        [name.trim(), conversation.lead_id]
      );
      console.log(`✅ Lead ${conversation.lead_id} atualizado`);
    } else {
      throw new ValidationError('Conversa não tem contato ou lead associado');
    }

    sendSuccess(res, {
      message: 'Nome atualizado com sucesso',
      name: name.trim()
    });

  } catch (error) {
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
  // Summary endpoints
  getSummaryStats,
  generateSummary,
  updateSummary,
  // Contact name update
  updateContactName
};
