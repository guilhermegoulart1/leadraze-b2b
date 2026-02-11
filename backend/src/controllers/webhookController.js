// backend/src/controllers/webhookController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { LEAD_STATUS } = require('../utils/helpers');
const conversationAutomationService = require('../services/conversationAutomationService');
const conversationSummaryService = require('../services/conversationSummaryService');
const { addWebhookJob, isWebhookProcessed } = require('../queues/webhookQueue');
const { scheduleDelayedConversation, cancelDelayedConversation } = require('../workers/delayedConversationWorker');
const { publishNewMessage, publishNewConversation, publishAccountDisconnected } = require('../services/ablyService');
const notificationService = require('../services/notificationService');
const unipileClient = require('../config/unipile');
const storageService = require('../services/storageService');
const { enrichContactInBackground, shouldEnrichContact } = require('../services/contactEnrichmentService');
// @guilhermegoulart1/relay-core - webhook parsing
const { parseWebhook } = require('@guilhermegoulart1/relay-core');

// ================================
// HELPER: PROCESSAR E SALVAR ATTACHMENTS NO R2
// ================================
async function processAndSaveAttachments(payload, conversationId, messageId, accountId, linkedinAccountId) {
  const attachments = payload.attachments || [];
  const savedAttachments = [];

  const messageType = payload.message_type || 'text';
  const isMediaMessage = ['image', 'video', 'audio', 'document', 'sticker', 'file'].includes(messageType);

  if (attachments.length === 0 && !isMediaMessage) {
    return savedAttachments;
  }

  for (const att of attachments) {
    try {
      const attachmentId = att.id || att.attachment_id;
      const mimeType = att.mime_type || att.mimetype || att.type || 'application/octet-stream';
      const filename = att.filename || att.name || `attachment_${attachmentId}.${getExtensionFromMime(mimeType)}`;
      const fileSize = att.size || att.file_size || 0;

      const unipileAccountId = await getUnipileAccountId(linkedinAccountId);
      if (!unipileAccountId) continue;

      const attachmentData = await unipileClient.messaging.getAttachment({
        account_id: unipileAccountId,
        message_id: messageId,
        attachment_id: attachmentId
      });

      if (!attachmentData?.data) continue;

      const r2Result = await storageService.uploadEmailAttachment(
        conversationId,
        Buffer.from(attachmentData.data),
        attachmentData.contentType || mimeType,
        filename
      );

      const attachmentRecord = {
        account_id: accountId,
        conversation_id: conversationId,
        message_id: messageId,
        original_filename: filename,
        storage_key: r2Result.key,
        file_url: r2Result.url,
        mime_type: attachmentData.contentType || mimeType,
        file_size: attachmentData.data.length || fileSize,
        unipile_attachment_id: attachmentId
      };

      await db.insert('email_attachments', attachmentRecord);

      savedAttachments.push({
        id: attachmentId,
        r2_url: r2Result.url,
        storage_key: r2Result.key,
        filename,
        mime_type: attachmentData.contentType || mimeType,
        size: attachmentData.data.length
      });
    } catch (attError) {
      // Continue with next attachment
    }
  }

  return savedAttachments;
}

// Helper: Obter extensão de arquivo a partir do MIME type
function getExtensionFromMime(mimeType) {
  const mimeMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'text/plain': 'txt'
  };
  return mimeMap[mimeType] || 'bin';
}

// Helper: Obter unipile_account_id a partir do linkedin_account
async function getUnipileAccountId(linkedinAccountId) {
  if (!linkedinAccountId) return null;
  const account = await db.findOne('linkedin_accounts', { id: linkedinAccountId });
  return account?.unipile_account_id;
}

// ================================
// HELPER: BUSCAR DADOS DO PERFIL VIA UNIPILE API
// ================================
async function fetchUserProfileFromUnipile(accountId, userProviderId) {
  if (!unipileClient.isInitialized()) return null;

  try {
    return await unipileClient.users.getOne(accountId, userProviderId);
  } catch (error) {
    return null;
  }
}

// ================================
// HELPER: DETECTAR TIPO DE EVENTO E NORMALIZAR PAYLOAD
// ================================
// Usa parseWebhook do @relay/core e converte para formato interno do GetRaze
function parseUnipileWebhookLocal(rawPayload) {
  try {
    // Usar parseWebhook do @relay/core
    const normalizedEvent = parseWebhook('unipile', rawPayload);

    // Mapear tipos do Relay para tipos internos do GetRaze
    const RELAY_TO_GETRAZE_TYPE = {
      'message.received': 'message_received',
      'message.sent': 'message_sent',
      'message.delivered': 'message_delivered',
      'message.read': 'message_read',
      'message.edited': 'message_edited',
      'message.deleted': 'message_deleted',
      'message.reaction': 'message_reaction',
      'relation.created': 'new_relation',
      'relation.removed': 'relation_removed',
      'account.connected': 'account_connected',
      'account.disconnected': 'account_disconnected',
      'account.status_changed': 'account_status'
    };

    const eventType = RELAY_TO_GETRAZE_TYPE[normalizedEvent.type] || normalizedEvent.type;

    // Reconstruir payload no formato esperado pelo código existente
    const payload = {
      ...normalizedEvent.raw,
      account_id: normalizedEvent.accountId,
      chat_id: normalizedEvent.chatId,
      message_id: normalizedEvent.messageId,
      account_type: normalizedEvent.providerType,
      _normalized_event: normalizedEvent // Guardar evento normalizado para uso futuro
    };

    return { eventType, payload };
  } catch (error) {
    // Fallback: formato antigo se relay falhar
    const EVENT_KEY_MAP = {
      'AccountStatus': 'account_status',
      'AccountCreated': 'account_connected',
      'AccountDeleted': 'account_disconnected',
      'MessageReceived': 'message_received',
      'MessageSent': 'message_sent',
      'MessageDelivered': 'message_delivered',
      'MessageRead': 'message_read',
      'MessageEdited': 'message_edited',
      'MessageDeleted': 'message_deleted',
      'MessageReaction': 'message_reaction',
      'NewRelation': 'new_relation',
      'RelationCreated': 'new_relation',
    };

    const eventKeys = Object.keys(rawPayload);
    for (const key of eventKeys) {
      if (EVENT_KEY_MAP[key]) {
        const eventData = rawPayload[key];
        return {
          eventType: EVENT_KEY_MAP[key],
          payload: { ...eventData, _original_event_key: key }
        };
      }
    }

    const eventType = rawPayload.event || rawPayload.type;
    return { eventType, payload: rawPayload };
  }
}

// ================================
// 1. RECEBER WEBHOOK DO UNIPILE
// ================================
const receiveWebhook = async (req, res) => {
  try {
    const rawPayload = req.body;
    const signature = req.headers['x-unipile-signature'];

    // Detectar tipo de evento e normalizar payload (usando @relay/core)
    const { eventType, payload } = parseUnipileWebhookLocal(rawPayload);

    // Validar signature (se configurado)
    if (process.env.WEBHOOK_SECRET && signature) {
      // TODO: Implementar validação de signature
      // const isValid = validateSignature(payload, signature, process.env.WEBHOOK_SECRET);
      // if (!isValid) {
      //   throw new Error('Invalid webhook signature');
      // }
    }

    // Check for duplicate webhook (idempotency)
    const alreadyProcessed = await isWebhookProcessed(eventType, payload);
    if (alreadyProcessed) {
      return res.status(200).json({
        success: true,
        message: 'Webhook already processed (duplicate)',
        duplicate: true
      });
    }

    // Salvar log do webhook
    const webhookLog = await db.insert('webhook_logs', {
      event_type: eventType || 'unknown',
      account_id: payload.account_id || null,
      payload: JSON.stringify(payload),
      processed: false
    });

    // Adicionar job à fila em vez de processar síncronamente
    const job = await addWebhookJob(eventType, payload, webhookLog.id);

    // Retornar 200 IMEDIATAMENTE (sem aguardar processamento)
    res.status(200).json({
      success: true,
      message: 'Webhook queued for processing',
      jobId: job.id,
      eventType
    });

  } catch (error) {
    console.error('Webhook error:', error.message);

    // Salvar erro no log
    try {
      const eventType = req.body.event || req.body.type;
      await db.query(
        `UPDATE webhook_logs
         SET error = $1
         WHERE id = (
           SELECT id FROM webhook_logs
           WHERE event_type = $2
           ORDER BY created_at DESC
           LIMIT 1
         )`,
        [error.message, eventType]
      );
    } catch (logError) {
      // Silent fail for log errors
    }

    // Sempre retornar 200 para não reenviar webhook
    res.status(200).json({ 
      success: false, 
      message: 'Webhook received with errors',
      error: error.message 
    });
  }
};

// ================================
// HELPER: FORMATAR NÚMERO DE TELEFONE PARA EXIBIÇÃO
// ================================
function formatPhoneNumber(phone) {
  if (!phone) return null;

  // Remover sufixo @s.whatsapp.net ou @c.us
  let cleaned = phone.replace(/@s\.whatsapp\.net|@c\.us|@g\.us/gi, '');

  // Se já está formatado com +, retornar
  if (cleaned.startsWith('+')) return cleaned;

  // Adicionar + se começar com número
  if (/^\d/.test(cleaned)) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
}

// ================================
// HELPER: EXTRAIR MELHOR NOME DO ATTENDEE
// ================================
function extractBestName(attendee, fallbackPhone) {
  if (!attendee) return null;

  // Lista de nomes inválidos que devem ser ignorados
  const invalidNames = ['you', 'eu', 'me', 'self', 'próprio', 'unknown', 'desconhecido'];

  // Tentar vários campos de nome
  const possibleNames = [
    attendee.attendee_name,
    attendee.display_name,
    attendee.name,
    attendee.full_name,
    attendee.pushname
  ];

  // LinkedIn: Combinar first_name + last_name se disponíveis
  if (attendee.first_name || attendee.last_name) {
    const combinedName = [attendee.first_name, attendee.last_name].filter(Boolean).join(' ').trim();
    if (combinedName) {
      possibleNames.unshift(combinedName); // Adiciona no início como prioridade
    }
  }

  for (const name of possibleNames) {
    if (name && typeof name === 'string') {
      const trimmedName = name.trim();
      // Ignorar nomes inválidos e números de telefone disfarçados de nome
      if (trimmedName.length > 0 &&
          !invalidNames.includes(trimmedName.toLowerCase()) &&
          !trimmedName.includes('@s.whatsapp.net') &&
          !trimmedName.includes('@c.us')) {
        // Se o "nome" é apenas um número de telefone, formatá-lo
        if (/^\+?\d{8,}$/.test(trimmedName.replace(/[\s\-()]/g, ''))) {
          return formatPhoneNumber(trimmedName);
        }
        return trimmedName;
      }
    }
  }

  // Se não encontrou nome válido, usar telefone formatado
  if (fallbackPhone) {
    return formatPhoneNumber(fallbackPhone);
  }

  return null;
}

// ================================
// HELPER: DETECTAR SE É GRUPO
// ================================
function isGroupChat(payload) {
  // Método 1: Contar participantes (>2 = grupo)
  if (payload.attendees && payload.attendees.length > 2) {
    return true;
  }

  // Método 2: Verificar campo is_group (se Unipile enviar)
  if (payload.is_group === true) {
    return true;
  }

  // Método 3: Verificar campo chat_type
  if (payload.chat_type && payload.chat_type === 'group') {
    return true;
  }

  return false;
}

// ================================
// HELPER: OBTER CONFIGURAÇÕES DO CANAL
// ================================
async function getChannelSettings(channelId) {
  try {
    const channel = await db.findOne('linkedin_accounts', { id: channelId });
    if (channel && channel.channel_settings) {
      return typeof channel.channel_settings === 'string'
        ? JSON.parse(channel.channel_settings)
        : channel.channel_settings;
    }
    // Default settings
    return {
      ignore_groups: true,
      auto_read: false,
      ai_enabled: false,
      notify_on_message: true,
      business_hours_only: false
    };
  } catch (error) {
    console.warn('⚠️ Erro ao obter configurações do canal:', error.message);
    return { ignore_groups: true, ai_enabled: false };
  }
}

// ================================
// HELPER: REGISTRAR CANAL DO CONTATO
// ================================
async function registerContactChannel(contactId, channelType, channelId, channelUsername, attendeeId = null) {
  try {
    const existingChannel = await db.query(
      `SELECT id, metadata FROM contact_channels
       WHERE contact_id = $1 AND channel_type = $2 LIMIT 1`,
      [contactId, channelType.toLowerCase()]
    );

    if (existingChannel.rows.length > 0) {
      const existingMetadata = existingChannel.rows[0].metadata || {};
      const newMetadata = attendeeId ? { ...existingMetadata, attendee_id: attendeeId } : existingMetadata;

      await db.query(
        `UPDATE contact_channels
         SET last_interaction_at = NOW(), message_count = message_count + 1, is_active = true, metadata = $2
         WHERE id = $1`,
        [existingChannel.rows[0].id, JSON.stringify(newMetadata)]
      );
    } else {
      const metadata = attendeeId ? { attendee_id: attendeeId } : {};
      await db.insert('contact_channels', {
        contact_id: contactId,
        channel_type: channelType.toLowerCase(),
        channel_id: channelId || null,
        channel_username: channelUsername || null,
        is_primary: true,
        is_active: true,
        last_interaction_at: new Date(),
        message_count: 1,
        metadata: JSON.stringify(metadata)
      });
    }
  } catch (error) {
    // Silent fail - não falhar o webhook por erro de canal
  }
}

// ================================
// HELPER: BUSCAR E ATUALIZAR DADOS DO CONTATO VIA UNIPILE
// ================================
async function fetchAndUpdateContactFromAttendee(accountId, contactId, attendeeId, options = {}) {
  if (!attendeeId) return null;

  const { fetchPicture = true, updateName = false } = options;
  const result = { updated: false, fields: [] };

  try {
    const attendeeData = await unipileClient.messaging.getAttendeeById(attendeeId);

    if (attendeeData) {
      const updates = {};
      const attendeeName = attendeeData.name || attendeeData.display_name || attendeeData.full_name || attendeeData.pushname;

      if (updateName && attendeeName && !attendeeName.match(/^\+?\d+$/)) {
        updates.name = attendeeName;
        result.fields.push('name');
      }

      if (attendeeData.headline || attendeeData.bio || attendeeData.about) {
        updates.headline = attendeeData.headline || attendeeData.bio || attendeeData.about;
        result.fields.push('headline');
      }

      if (Object.keys(updates).length > 0) {
        const setClause = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`).join(', ');
        const values = [contactId, ...Object.values(updates)];
        await db.query(`UPDATE contacts SET ${setClause}, updated_at = NOW() WHERE id = $1`, values);
        result.updated = true;
      }
    }

    if (fetchPicture) {
      const pictureResult = await unipileClient.messaging.getAttendeePicture(attendeeId);

      if (pictureResult && pictureResult.data) {
        const mimeToExt = { 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' };
        const ext = mimeToExt[pictureResult.contentType] || '.jpg';

        const uploadResult = await storageService.uploadContactPicture(
          accountId, contactId, pictureResult.data, pictureResult.contentType, `profile${ext}`
        );

        await db.query(`UPDATE contacts SET profile_picture = $1, updated_at = NOW() WHERE id = $2`, [uploadResult.url, contactId]);
        result.updated = true;
        result.fields.push('profile_picture');
        result.pictureUrl = uploadResult.url;
      }
    }

    return result;
  } catch (error) {
    return result;
  }
}

// ================================
// HELPER: CRIAR OU BUSCAR CONTATO
// ================================
async function findOrCreateContact(userId, accountId, contactData) {
  const { phone, providerId, name, profileUrl, profilePicture, headline, location, source, attendeeId } = contactData;

  const phoneClean = phone?.replace(/@s\.whatsapp\.net|@c\.us/gi, '') || '';
  const phoneFormatted = formatPhoneNumber(phone);

  let contact = null;
  let isNewContact = false;

  // Tentar buscar pelo telefone
  if (phoneFormatted) {
    const contactQuery = await db.query(
      `SELECT * FROM contacts WHERE account_id = $1
       AND (phone = $2 OR phone = $3 OR phone LIKE $4) LIMIT 1`,
      [accountId, phoneFormatted, phoneClean, `%${phoneClean}%`]
    );
    if (contactQuery.rows.length > 0) {
      contact = contactQuery.rows[0];
    }
  }

  // Se não encontrou, buscar pelo linkedin_profile_id
  if (!contact && providerId) {
    const contactQuery = await db.query(
      `SELECT * FROM contacts WHERE account_id = $1
       AND (linkedin_profile_id = $2 OR linkedin_profile_id = $3) LIMIT 1`,
      [accountId, providerId, phoneClean]
    );
    if (contactQuery.rows.length > 0) {
      contact = contactQuery.rows[0];
    }
  }

  // Se não encontrou, criar novo contato
  if (!contact) {
    contact = await db.insert('contacts', {
      user_id: userId,
      account_id: accountId,
      name: name || phoneFormatted || 'Contato',
      phone: phoneFormatted,
      linkedin_profile_id: providerId,
      profile_url: profileUrl || null,
      profile_picture: profilePicture || null,
      headline: headline || null,
      location: location || null,
      source: source || 'whatsapp'
    });
    isNewContact = true;
  }

  // Buscar dados e foto do attendee em background
  const shouldFetchData = attendeeId && (!contact.profile_picture || isNewContact);
  if (shouldFetchData) {
    fetchAndUpdateContactFromAttendee(accountId, contact.id, attendeeId, {
      fetchPicture: true,
      updateName: isNewContact
    }).then(result => {
      if (result?.pictureUrl) contact.profile_picture = result.pictureUrl;
    }).catch(() => {});
  }

  return contact;
}

// ================================
// 2. MENSAGEM RECEBIDA
// ================================
async function handleMessageReceived(payload) {
  const { account_id, chat_id, message, sender, message_id, timestamp } = payload;
  const providerType = payload.account_type || 'LINKEDIN';
  const attendeeCount = payload.attendees?.length || 2;
  const isGroup = isGroupChat(payload);

  if (!account_id || !chat_id) {
    return { handled: false, reason: 'Missing required fields (account_id or chat_id)' };
  }

  // Message pode vir como string diretamente no payload
  const messageContent = typeof message === 'string' ? message : (message?.text || message?.content || '');

  try {
    // Buscar conta (LinkedIn ou outro canal)
    const connectedChannel = await db.findOne('linkedin_accounts', {
      unipile_account_id: account_id
    });

    if (!connectedChannel) {
      return { handled: false, reason: 'Connected channel not found' };
    }

    // Ignorar canais desconectados
    if (connectedChannel.status === 'disconnected') {
      return {
        handled: true,
        skipped: true,
        reason: 'Channel is disconnected',
        channel_id: connectedChannel.id
      };
    }

    // Verificar configurações do canal
    const channelSettings = await getChannelSettings(connectedChannel.id);

    // Filtrar grupos se configurado
    if (isGroup && channelSettings.ignore_groups) {
      return {
        handled: true,
        skipped: true,
        reason: 'Group messages are ignored by channel settings',
        provider_type: providerType,
        attendee_count: attendeeCount
      };
    }

    // Alias para compatibilidade com código existente
    const linkedinAccount = connectedChannel;

    // Detectar se é mensagem própria ou do lead
    const ownIdentifier = connectedChannel.channel_identifier;
    const senderProviderId = sender?.attendee_provider_id || sender?.provider_id || '';

    let isOwnMessage = false;

    if (providerType === 'LINKEDIN') {
      // LinkedIn: Detectar se é mensagem própria
      // PRIORIDADE 1: Verificar network_distance do sender (mais confiável!)
      // Unipile envia network_distance: "SELF" quando o remetente é o próprio usuário
      const senderNetworkDistance = sender?.attendee_specifics?.network_distance;
      if (senderNetworkDistance === 'SELF') {
        isOwnMessage = true;
      }
      // PRIORIDADE 2: Usar direction do evento normalizado do Relay
      else {
        const normalizedEvent = payload._normalized_event || {};
        const direction = normalizedEvent.metadata?.direction;
        const originalEventKey = normalizedEvent.metadata?.originalEventKey
          || payload._original_event_key;

        if (direction === 'outbound' || originalEventKey === 'MessageSent') {
          isOwnMessage = true;
        } else if (direction === 'inbound' || originalEventKey === 'MessageReceived') {
          isOwnMessage = false;
        }
        // PRIORIDADE 3: verificar flag is_self
        else if (sender?.is_self === true) {
          isOwnMessage = true;
        }
      }

    } else {
      // WhatsApp/outros: limpar sufixos para comparação
      if (sender && ownIdentifier) {
        const senderIdentifier = senderProviderId.replace(/@s\.whatsapp\.net|@c\.us/gi, '');
        isOwnMessage = senderIdentifier === ownIdentifier || senderProviderId === ownIdentifier;
      }
    }

    var skipAI = isOwnMessage;

    // Buscar ou criar conversa
    // ✅ IMPORTANTE: Buscar por chat_id OU pelo contact/lead para evitar duplicatas
    let conversation = await db.findOne('conversations', {
      unipile_chat_id: chat_id
    });

    // Se não encontrou por chat_id, buscar por contact/lead
    if (!conversation) {
      let searchProviderId = null;
      let attendeesData = payload.attendees || [];

      if (attendeesData.length > 0) {
        const ownIdentifierClean = ownIdentifier?.replace(/@s\.whatsapp\.net|@c\.us/gi, '') || '';
        const otherAttendee = attendeesData.find(att => {
          const attId = att.attendee_provider_id?.replace(/@s\.whatsapp\.net|@c\.us/gi, '') || '';
          return attId !== ownIdentifierClean && att.attendee_provider_id !== ownIdentifier;
        });
        searchProviderId = otherAttendee?.attendee_provider_id;
      }

      if (!isOwnMessage && sender?.attendee_provider_id) {
        searchProviderId = sender.attendee_provider_id;
      }

      if (searchProviderId) {
        const searchProviderIdClean = searchProviderId.replace(/@s\.whatsapp\.net|@c\.us/gi, '');
        const phoneFormatted = formatPhoneNumber(searchProviderId);

        const conversationQuery = await db.query(
          `SELECT conv.* FROM conversations conv
           LEFT JOIN contacts ct ON conv.contact_id = ct.id
           LEFT JOIN opportunities opp ON conv.opportunity_id = opp.id
           WHERE conv.linkedin_account_id = $1
           AND (
             ct.phone = $2 OR ct.phone = $3 OR ct.linkedin_profile_id = $4
             OR opp.linkedin_profile_id = $4 OR opp.linkedin_profile_id = $5
           )
           ORDER BY conv.created_at DESC
           LIMIT 1`,
          [linkedinAccount.id, phoneFormatted, searchProviderIdClean, searchProviderIdClean, searchProviderId]
        );

        if (conversationQuery.rows.length > 0) {
          conversation = conversationQuery.rows[0];

          await db.update('conversations', {
            unipile_chat_id: chat_id
          }, { id: conversation.id });

          conversation.unipile_chat_id = chat_id;

          if (conversation.contact_id) {
            await registerContactChannel(
              conversation.contact_id,
              providerType,
              searchProviderIdClean,
              sender?.display_name || null
            );
          }
        }
      }
    }

    if (!conversation) {
      // Encontrar o lead correto baseado no attendee
      let leadProviderId = null;
      let attendeesData = payload.attendees || [];

      // Se não temos attendees suficientes no payload, buscar via API
      if (attendeesData.length < 2 && isOwnMessage) {
        try {
          const chatData = await unipileClient.messaging.getChat({
            account_id: account_id,
            chat_id: chat_id
          });
          attendeesData = chatData?.attendees || attendeesData;
        } catch (apiError) {
          // Silently continue with payload attendees
        }
      }

      if (attendeesData.length > 0) {
        if (isOwnMessage) {
          // Encontrar o lead (attendee que NAO é o usuario)
          if (providerType === 'LINKEDIN') {
            // LinkedIn: identificar usuario por is_self flag ou sender.attendee_provider_id
            const userProviderId = sender?.attendee_provider_id;

            const otherAttendee = attendeesData.find(att => {
              // Se temos o ID do remetente (usuario), excluir esse attendee
              if (userProviderId && att.attendee_provider_id === userProviderId) {
                return false;
              }
              // Se attendee tem is_self = true, é o usuario - excluir
              if (att.is_self === true) {
                return false;
              }
              // Este é o lead
              return true;
            });

            leadProviderId = otherAttendee?.attendee_provider_id;
          } else {
            // WhatsApp/outros: logica original
            const otherAttendee = attendeesData.find(att => {
              const attId = att.attendee_provider_id?.replace(/@s\.whatsapp\.net|@c\.us/gi, '') || '';
              return attId !== ownIdentifier && att.attendee_provider_id !== sender?.attendee_provider_id;
            });
            leadProviderId = otherAttendee?.attendee_provider_id;
          }
        } else {
          leadProviderId = sender?.attendee_provider_id;
        }
      }

      if (!leadProviderId) {
        return { handled: false, reason: 'Lead provider_id not found' };
      }

      // Validação: Nunca criar lead/contato com o próprio número do usuário
      const leadProviderIdClean = leadProviderId.replace(/@s\.whatsapp\.net|@c\.us/gi, '');
      if (leadProviderIdClean === ownIdentifier) {
        return { handled: false, reason: 'Cannot create conversation with own number as lead' };
      }

      // =====================================================
      // NOVA ARQUITETURA: CONTATO primeiro, LEAD é opcional
      // =====================================================
      // CONTATO = Pessoa (sempre criado para conversas orgânicas)
      // LEAD = Oportunidade no CRM (só existe se estiver em campanha)
      // =====================================================

      let contactData = null;
      let leadData = null;
      let shouldActivateAI = false;

      // Buscar dados do perfil via API Unipile
      const profileData = await fetchUserProfileFromUnipile(account_id, leadProviderId);

      // Dados do attendee como fallback
      const leadIdClean = leadProviderId?.replace(/@s\.whatsapp\.net|@c\.us/gi, '') || '';
      const attendeeData = isOwnMessage
        ? attendeesData.find(att => {
            const attId = att.attendee_provider_id?.replace(/@s\.whatsapp\.net|@c\.us/gi, '') || '';
            return attId === leadIdClean || att.attendee_provider_id === leadProviderId;
          })
        : sender;

      // Extrair melhor nome - priorizar dados do perfil, depois attendeeData
      // IMPORTANTE: Quando isOwnMessage = true, sender é o usuario, NAO o lead!
      // attendeeData já foi determinado corretamente acima como o lead
      let contactName = profileData?.display_name
        || profileData?.name
        || profileData?.full_name;

      // Se não tem do perfil, tentar do attendeeData (dados do lead)
      if (!contactName && attendeeData) {
        contactName = attendeeData.attendee_name
          || attendeeData.display_name
          || attendeeData.name
          || attendeeData.full_name;

        // LinkedIn: combinar first_name + last_name
        if (!contactName && (attendeeData.first_name || attendeeData.last_name)) {
          contactName = [attendeeData.first_name, attendeeData.last_name].filter(Boolean).join(' ').trim();
        }
      }

      // Fallback para extractBestName do attendee
      if (!contactName) {
        contactName = extractBestName(attendeeData, leadProviderId);
      }

      // Ultimo fallback: formatar telefone ou 'Contato'
      if (!contactName) {
        contactName = (providerType === 'LINKEDIN')
          ? 'Contato LinkedIn'
          : (formatPhoneNumber(leadProviderId) || 'Contato');
      }

      // Construir URL do perfil
      let profileUrl = '';

      if (providerType === 'LINKEDIN') {
        // LinkedIn: PRIORIZAR public_identifier para construir URL limpa
        const publicIdentifier = profileData?.public_identifier
          || attendeeData?.public_identifier
          || attendeeData?.attendee_public_identifier;

        if (publicIdentifier) {
          // URL limpa com o username real (ex: luciana-paula-64a30431)
          profileUrl = `https://www.linkedin.com/in/${publicIdentifier}`;
        } else {
          // Fallback para URL que pode conter provider_id (funciona, mas é feia)
          profileUrl = profileData?.profile_url
            || attendeeData?.attendee_profile_url
            || '';
        }
      } else {
        // Outros providers
        profileUrl = profileData?.profile_url
          || attendeeData?.attendee_profile_url
          || '';
      }

      const profilePicture = profileData?.picture_url
        || profileData?.profile_picture_url
        || attendeeData?.attendee_picture_url
        || '';

      const headline = profileData?.headline || '';
      const location = profileData?.location || '';

      // Criar ou buscar contato
      // IMPORTANTE: Para LinkedIn, não salvar provider_id como telefone (não é número de telefone!)
      contactData = await findOrCreateContact(
        linkedinAccount.user_id,
        linkedinAccount.account_id,
        {
          phone: providerType === 'LINKEDIN' ? null : leadProviderId, // LinkedIn não tem telefone
          providerId: leadProviderId,
          name: contactName,
          profileUrl,
          profilePicture,
          headline,
          location,
          source: providerType.toLowerCase(), // 'whatsapp', 'instagram', etc.
          attendeeId: attendeeData?.id || null // ID do attendee para buscar foto
        }
      );

      // Registrar canal do contato
      await registerContactChannel(
        contactData.id,
        providerType, // 'WHATSAPP', 'INSTAGRAM', etc.
        leadProviderId, // Número de telefone ou handle
        contactName, // Nome de exibição
        attendeeData?.id || null // Attendee ID para buscar foto
      );

      // ✅ PASSO 2: Verificar se existe LEAD (oportunidade) para este contato
      // Opportunity só existe se estiver em uma campanha ativa
      const opportunityQuery = await db.query(
        `SELECT o.*, c.automation_active, c.ai_agent_id as campaign_ai_agent_id
         FROM opportunities o
         JOIN campaigns c ON o.campaign_id = c.id
         WHERE c.linkedin_account_id = $1
         AND o.linkedin_profile_id = $2
         LIMIT 1`,
        [linkedinAccount.id, leadProviderId]
      );

      let opportunityData = null;
      if (opportunityQuery.rows.length > 0) {
        opportunityData = opportunityQuery.rows[0];
        shouldActivateAI = opportunityData.automation_active === true;
      }

      // Criar conversa - SEMPRE com contact_id, opportunity_id é opcional
      conversation = await db.insert('conversations', {
        user_id: linkedinAccount.user_id,
        account_id: linkedinAccount.account_id, // Multi-tenancy
        linkedin_account_id: linkedinAccount.id,
        // NOVA ARQUITETURA: contact_id SEMPRE, opportunity_id opcional (se for oportunidade)
        contact_id: contactData.id, // SEMPRE presente
        opportunity_id: opportunityData?.id || null, // Opcional - só se tiver oportunidade/campanha
        campaign_id: opportunityData?.campaign_id || null,
        unipile_chat_id: chat_id,
        status: shouldActivateAI ? 'ai_active' : 'manual',
        ai_active: shouldActivateAI,
        ai_agent_id: opportunityData?.campaign_ai_agent_id || null,
        is_connection: true,
        // Só marcar como não lida se for mensagem DO contato (não enviada pelo usuário)
        unread_count: isOwnMessage ? 0 : 1,
        last_message_at: timestamp ? new Date(timestamp) : new Date(),
        last_message_preview: messageContent?.substring(0, 100) || '',
        // MULTI-CHANNEL: Novos campos
        provider_type: providerType,
        is_group: isGroup,
        attendee_count: attendeeCount,
        group_name: isGroup ? (payload.chat_name || payload.group_name || null) : null
      });

      // Emit Ably: Nova conversa criada
      publishNewConversation({
        accountId: linkedinAccount.account_id,
        conversation: {
          id: conversation.id,
          contact_name: contactData.name,
          lead_name: contactData.name,
          lead_picture: contactData.profile_picture || null,
          last_message_preview: messageContent?.substring(0, 100) || '',
          last_message_at: conversation.last_message_at,
          unread_count: conversation.unread_count,
          provider_type: providerType,
          is_group: isGroup
        }
      });

      // =====================================================
      // 📸 DETECÇÃO DE CONVITE ACEITO EM TEMPO REAL
      // Se é LinkedIn + mensagem própria + nova conversa = possível convite com mensagem aceito
      // =====================================================
      if (providerType === 'LINKEDIN' && isOwnMessage) {
        try {
          // Verificar se tínhamos enviado um convite para esse usuário
          const invitationResult = await db.query(
            `SELECT * FROM invitation_snapshots
             WHERE linkedin_account_id = $1
             AND provider_id = $2
             AND invitation_type = 'sent'
             LIMIT 1`,
            [linkedinAccount.id, leadProviderId]
          );

          if (invitationResult.rows.length > 0) {
            const sentInvitation = invitationResult.rows[0];
            console.log(`🎉 [Invitations] Convite aceito detectado em TEMPO REAL! Usuário: ${contactData.name}`);

            // Criar notificação de convite aceito
            await notificationService.create({
              account_id: linkedinAccount.account_id,
              user_id: linkedinAccount.user_id,
              type: 'invite_accepted',
              title: 'Convite aceito',
              message: `${contactData.name || 'Usuário LinkedIn'} aceitou seu convite de conexão`,
              conversation_id: conversation.id,
              metadata: {
                contact_name: contactData.name,
                profile_picture: contactData.profile_picture || profilePicture || null,
                linkedin_account_id: linkedinAccount.id,
                provider_id: leadProviderId,
                detected_via: 'message_received_realtime'
              }
            });

            // Remover do snapshot (já processado)
            await db.query(
              `DELETE FROM invitation_snapshots WHERE id = $1`,
              [sentInvitation.id]
            );
            console.log(`📸 [Invitations] Snapshot removido após detecção de aceitação`);
          }
        } catch (invitationError) {
          console.error('⚠️ [Invitations] Erro ao detectar convite aceito:', invitationError.message);
          // Não falhar webhook por erro de detecção de convite
        }
      }

      // =====================================================
      // ENRIQUECIMENTO: Se é conexão de 1º grau do LinkedIn,
      // buscar perfil completo e dados da empresa
      // =====================================================
      if (providerType === 'LINKEDIN' && contactData.id) {
        // Detectar network_distance do lead (não do sender quando isOwnMessage)
        let leadNetworkDistance = attendeeData?.attendee_specifics?.network_distance
          || attendeeData?.network_distance
          || (isOwnMessage ? null : sender?.attendee_specifics?.network_distance);

        // Se não tem network_distance, buscar do perfil antes de enriquecer
        // (não assumir 1º grau pois pode ser InMail de recrutador)
        if (!leadNetworkDistance && leadProviderId) {
          try {
            const profileCheck = await unipileClient.users.getOne(
              connectedChannel.unipile_account_id,
              leadProviderId
            );
            leadNetworkDistance = profileCheck?.network_distance;
          } catch (err) {
            // Se falhar, não enriquece (seguro)
          }
        }

        // Enriquecer se for conexão de 1º grau e não foi enriquecido recentemente
        if (shouldEnrichContact(leadNetworkDistance, contactData.full_profile_fetched_at)) {
          enrichContactInBackground(
            contactData.id,
            connectedChannel.unipile_account_id,
            leadProviderId,
            { enrichCompanyData: true }
          );
        }
      }

      // Atualizar opportunity para "accepted" se ainda não estiver (só se tiver opportunity)
      if (opportunityData && !opportunityData.accepted_at) {
        await db.query(
          `UPDATE opportunities SET accepted_at = NOW() WHERE id = $1`,
          [opportunityData.id]
        );

        // Atualizar contadores da campanha
        await db.query(
          `UPDATE campaigns
           SET leads_sent = GREATEST(0, leads_sent - 1),
               leads_accepted = leads_accepted + 1
           WHERE id = $1`,
          [opportunityData.campaign_id]
        );
      }
    } else {
      console.log('📝 Conversa existente encontrada');

      // Atualizar conversa
      // ✅ Só incrementar unread_count se for mensagem DO LEAD (não enviada pelo usuário)
      await db.update('conversations', {
        last_message_preview: messageContent?.substring(0, 100) || '',
        last_message_at: new Date(),
        unread_count: isOwnMessage ? conversation.unread_count : conversation.unread_count + 1
      }, { id: conversation.id });
    }

    // Salvar mensagem
    // ✅ Usar sender_type correto: 'user' se for mensagem própria, 'lead' se for do lead

    // Extrair tipo de mensagem do LinkedIn (INMAIL, MESSAGE) e subject
    const linkedinMessageType = message?.message_type || payload.message_type_linkedin || null;
    const messageSubject = message?.subject || payload.subject || null;

    // Determinar se é InMail ou Sponsored
    // - INMAIL: message_type === "INMAIL"
    // - Sponsored: message_type === "MESSAGE" + tem subject
    let linkedinCategory = null;
    if (linkedinMessageType === 'INMAIL') {
      linkedinCategory = 'inmail';
    } else if (linkedinMessageType === 'MESSAGE' && messageSubject) {
      linkedinCategory = 'sponsored';
    }

    // Construir metadata se houver informações extras
    const messageMetadata = (linkedinCategory || messageSubject) ? {
      linkedin_category: linkedinCategory,
      subject: messageSubject
    } : null;

    const messageData = {
      conversation_id: conversation.id,
      unipile_message_id: message_id || payload.provider_message_id || `unipile_${Date.now()}`,
      sender_type: isOwnMessage ? 'user' : 'lead',
      content: messageContent || '',
      message_type: payload.message_type || 'text',
      sent_at: timestamp ? new Date(timestamp) : new Date(),
      provider_type: providerType, // ✅ MULTI-CHANNEL
      metadata: messageMetadata
    };

    await db.insert('messages', messageData);

    // ✅ PROCESSAR E SALVAR ATTACHMENTS NO R2
    // Baixa do Unipile e salva permanentemente no R2 para evitar expiração
    try {
      const savedAttachments = await processAndSaveAttachments(
        payload,
        conversation.id,
        messageData.unipile_message_id,
        linkedinAccount.account_id,
        linkedinAccount.id
      );

      if (savedAttachments.length > 0) {
        console.log(`📎 ${savedAttachments.length} attachment(s) salvos no R2`);
      }
    } catch (attachmentError) {
      console.error('⚠️ Erro ao processar attachments (não falhou webhook):', attachmentError.message);
      // Não falhar o webhook por erro de attachment
    }

    console.log(`✅ Mensagem salva:`);
    console.log(`   - Sender type: ${messageData.sender_type}`);
    console.log(`   - Content: ${messageData.content}`);
    console.log(`   - Sent at: ${messageData.sent_at}`);

    // ✅ EMIT ABLY: Nova mensagem em tempo real
    // Sempre emitir - mensagens enviadas pelo celular precisam aparecer na plataforma
    // A deduplicação é feita no frontend usando unipile_message_id
    const newUnreadCount = isOwnMessage ? conversation.unread_count : (conversation.unread_count || 0) + 1;
    publishNewMessage({
      conversationId: conversation.id,
      accountId: linkedinAccount.account_id,
      message: {
        ...messageData,
        id: messageData.id || Date.now()
      },
      unreadCount: newUnreadCount,
      isOwnMessage // Flag para frontend identificar mensagens próprias
    });
    console.log(`📡 Ably: Evento new_message emitido (isOwnMessage: ${isOwnMessage})`)

    // CANCELAR JOB DE DELAY SE CONTATO ENVIOU MENSAGEM
    // (cancela o início automático de conversa se contato responder antes do delay)
    if (!isOwnMessage && conversation.id) {
      try {
        console.log('🛑 Verificando job de delay para cancelar...');
        const canceled = await cancelDelayedConversation(conversation.id);
        if (canceled) {
          console.log('✅ Job de delay cancelado (contato respondeu primeiro)');
        }
      } catch (cancelError) {
        console.error('⚠️ Erro ao cancelar job de delay:', cancelError.message);
        // Não falhar o webhook se cancelamento der erro
      }
    }

    // ✅ ATUALIZAR RESUMO DA CONVERSA (se necessário)
    try {
      await conversationSummaryService.processConversation(conversation.id);
    } catch (summaryError) {
      console.error('⚠️ Erro ao processar resumo da conversa:', summaryError.message);
      // Não falhar o webhook se resumo der erro
    }

    // Se IA estiver ativa, processar resposta automática
    // ✅ NÃO PROCESSAR IA PARA MENSAGENS PRÓPRIAS
    // ✅ VERIFICAR SE CAMPANHA TEM AUTOMAÇÃO ATIVA
    let aiResponse = null;
    if (!skipAI && conversation.ai_active && !conversation.manual_control_taken) {
      // Verificar se a campanha ainda tem automação ativa
      let campaignAutomationActive = true;

      if (conversation.campaign_id) {
        const campaign = await db.findOne('campaigns', { id: conversation.campaign_id });
        campaignAutomationActive = campaign?.automation_active === true;

        if (!campaignAutomationActive) {
          console.log('⚠️ Automação da campanha está DESATIVADA - pulando IA');
        }
      } else {
        console.log('⚠️ Conversa sem campanha associada - pulando IA');
        campaignAutomationActive = false;
      }

      if (campaignAutomationActive) {
        console.log('🤖 Processando resposta automática com IA...');

        try {
          aiResponse = await conversationAutomationService.processIncomingMessage({
            conversation_id: conversation.id,
            message_content: messageContent || '',
            sender_id: sender?.attendee_provider_id,
            unipile_message_id: message_id || payload.provider_message_id || `unipile_${Date.now()}`
          });

          console.log('✅ Resposta automática processada:', aiResponse);
        } catch (aiError) {
          console.error('❌ Erro ao gerar resposta automática:', aiError);
          // Não falhar o webhook se IA der erro
        }
      }
    } else if (skipAI) {
      console.log('⏭️ Pulando processamento IA (mensagem própria)');
    } else if (!conversation.ai_active) {
      console.log('⏭️ Pulando processamento IA (IA desativada na conversa)');
    } else if (conversation.manual_control_taken) {
      console.log('⏭️ Pulando processamento IA (controle manual ativado)');
    }

    return {
      handled: true,
      conversation_id: conversation.id,
      message_saved: true,
      ai_response: aiResponse
    };

  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
    return { handled: false, reason: error.message };
  }
}

// ================================
// 3. NOVA RELAÇÃO (new_relation) - CONVITE ACEITO
// ================================
async function handleNewRelation(payload) {
  const inviteQueueService = require('../services/inviteQueueService');
  const notificationService = require('../services/notificationService');

  const {
    account_id,
    user_provider_id,
    user_public_identifier,
    user_profile_url,
    user_full_name,
    user_picture_url
  } = payload;

  if (!account_id || !user_provider_id) {
    return { handled: false, reason: 'Missing required fields (account_id or user_provider_id)' };
  }

  try {
    const linkedinAccount = await db.findOne('linkedin_accounts', {
      unipile_account_id: account_id
    });

    if (!linkedinAccount) {
      return { handled: false, reason: 'LinkedIn account not found' };
    }

    if (linkedinAccount.status === 'disconnected') {
      return {
        handled: true,
        skipped: true,
        reason: 'Channel is disconnected',
        channel_id: linkedinAccount.id
      };
    }

    // Busca campaign_contact com convite enviado (invite_sent)
    // Use campaign_invite_queue to match the correct sender account, with fallback to campaigns.linkedin_account_id
    const campaignContactQuery = `
      SELECT cc.id as campaign_contact_id, cc.contact_id, cc.campaign_id, cc.linkedin_profile_id,
             ct.name as contact_name, ct.profile_url as contact_profile_url,
             c.user_id as campaign_user_id, c.ai_agent_id, c.automation_active,
             c.name as campaign_name, c.account_id,
             aa.connection_strategy, aa.wait_time_after_accept, aa.require_lead_reply
      FROM campaign_contacts cc
      JOIN contacts ct ON ct.id = cc.contact_id
      JOIN campaigns c ON c.id = cc.campaign_id
      LEFT JOIN ai_agents aa ON c.ai_agent_id = aa.id
      LEFT JOIN campaign_invite_queue ciq ON ciq.campaign_contact_id = cc.id AND ciq.status = 'sent'
      WHERE cc.status = 'invite_sent'
      AND (
        ciq.linkedin_account_id = $1
        OR (ciq.id IS NULL AND c.linkedin_account_id = $1)
        OR EXISTS (SELECT 1 FROM campaign_linkedin_accounts cla WHERE cla.campaign_id = c.id AND cla.linkedin_account_id = $1 AND cla.is_active = true)
      )
      AND (
        cc.linkedin_profile_id = $2
        OR cc.linkedin_profile_id = $3
        OR ct.linkedin_profile_id = $2
        OR ct.linkedin_profile_id = $3
        OR ct.profile_url LIKE $4
      )
      LIMIT 1
    `;

    const campaignContactResult = await db.query(campaignContactQuery, [
      linkedinAccount.id,
      user_provider_id,
      user_public_identifier,
      `%${user_public_identifier}%`
    ]);

    if (campaignContactResult.rows.length === 0) {
      return { handled: false, reason: 'Campaign contact not found' };
    }

    const cc = campaignContactResult.rows[0];

    // Buscar perfil completo via Unipile API
    const fullProfile = await fetchUserProfileFromUnipile(account_id, user_provider_id);

    // Dados para atualizar o contact (dados enriquecidos do perfil)
    const contactUpdateData = {
      updated_at: new Date()
    };

    if (fullProfile) {
      // Dados básicos → contact
      if (fullProfile.first_name) contactUpdateData.first_name = fullProfile.first_name;
      if (fullProfile.last_name) contactUpdateData.last_name = fullProfile.last_name;
      if (fullProfile.headline) contactUpdateData.headline = fullProfile.headline;
      if (fullProfile.about || fullProfile.summary) contactUpdateData.about = fullProfile.about || fullProfile.summary;
      if (fullProfile.location) contactUpdateData.location = fullProfile.location;
      if (fullProfile.industry) contactUpdateData.industry = fullProfile.industry;

      // Foto de perfil (preferir a maior disponível)
      const profilePic = fullProfile.profile_picture_url_large ||
                        fullProfile.profile_picture_url ||
                        fullProfile.picture_url ||
                        fullProfile.profile_picture;
      if (profilePic) contactUpdateData.profile_picture = profilePic;

      // Dados ricos (JSON) - MÁXIMO de informações → contact
      if (fullProfile.experience && Array.isArray(fullProfile.experience)) {
        contactUpdateData.experience = JSON.stringify(fullProfile.experience);
      }
      if (fullProfile.education && Array.isArray(fullProfile.education)) {
        contactUpdateData.education = JSON.stringify(fullProfile.education);
      }
      if (fullProfile.skills && Array.isArray(fullProfile.skills)) {
        contactUpdateData.skills = JSON.stringify(fullProfile.skills);
      }
      if (fullProfile.websites && Array.isArray(fullProfile.websites)) {
        contactUpdateData.websites = JSON.stringify(fullProfile.websites);
      }
      if (fullProfile.languages && Array.isArray(fullProfile.languages)) {
        contactUpdateData.languages = JSON.stringify(fullProfile.languages);
      }
      if (fullProfile.certifications && Array.isArray(fullProfile.certifications)) {
        contactUpdateData.certifications = JSON.stringify(fullProfile.certifications);
      }
      if (fullProfile.publications && Array.isArray(fullProfile.publications)) {
        contactUpdateData.publications = JSON.stringify(fullProfile.publications);
      }
      if (fullProfile.volunteer_experience && Array.isArray(fullProfile.volunteer_experience)) {
        contactUpdateData.volunteer_experience = JSON.stringify(fullProfile.volunteer_experience);
      }
      if (fullProfile.honors_awards && Array.isArray(fullProfile.honors_awards)) {
        contactUpdateData.honors_awards = JSON.stringify(fullProfile.honors_awards);
      }
      if (fullProfile.projects && Array.isArray(fullProfile.projects)) {
        contactUpdateData.projects = JSON.stringify(fullProfile.projects);
      }
      if (fullProfile.courses && Array.isArray(fullProfile.courses)) {
        contactUpdateData.courses = JSON.stringify(fullProfile.courses);
      }
      if (fullProfile.patents && Array.isArray(fullProfile.patents)) {
        contactUpdateData.patents = JSON.stringify(fullProfile.patents);
      }
      if (fullProfile.recommendations && Array.isArray(fullProfile.recommendations)) {
        contactUpdateData.recommendations = JSON.stringify(fullProfile.recommendations);
      }

      // Contatos (se disponíveis - MUITO importante para conexões de 1º grau!)
      if (fullProfile.email) contactUpdateData.email = fullProfile.email;
      if (fullProfile.phone) contactUpdateData.phone = fullProfile.phone;

      // Conexões e seguidores
      if (fullProfile.connections_count) contactUpdateData.connections_count = fullProfile.connections_count;
      if (fullProfile.follower_count) contactUpdateData.follower_count = fullProfile.follower_count;

      // Status e flags
      if (fullProfile.is_premium !== undefined) contactUpdateData.is_premium = fullProfile.is_premium;
      if (fullProfile.is_creator !== undefined) contactUpdateData.is_creator = fullProfile.is_creator;
      if (fullProfile.is_influencer !== undefined) contactUpdateData.is_influencer = fullProfile.is_influencer;
      if (fullProfile.is_open_to_work !== undefined) contactUpdateData.is_open_to_work = fullProfile.is_open_to_work;
      if (fullProfile.is_hiring !== undefined) contactUpdateData.is_hiring = fullProfile.is_hiring;

      // Identificadores
      if (fullProfile.public_identifier) {
        contactUpdateData.public_identifier = fullProfile.public_identifier;
        // Construir URL do perfil correta usando public_identifier
        contactUpdateData.profile_url = `https://www.linkedin.com/in/${fullProfile.public_identifier}`;
      }
      if (fullProfile.member_urn) contactUpdateData.member_urn = fullProfile.member_urn;
      if (fullProfile.primary_locale) contactUpdateData.primary_locale = JSON.stringify(fullProfile.primary_locale);

      // Marcar que foi enriquecido
      contactUpdateData.full_profile_fetched_at = new Date();
      contactUpdateData.network_distance = 'FIRST_DEGREE';
    }

    // Atualizar contact com dados enriquecidos
    if (cc.contact_id && Object.keys(contactUpdateData).length > 1) {
      await db.update('contacts', contactUpdateData, { id: cc.contact_id });
    }

    // Marcar convite como aceito na fila (atualiza campaign_invite_queue + campaign_contacts + campaigns.pending_invites_count)
    try {
      await inviteQueueService.markInviteAsAccepted(cc.campaign_contact_id);
    } catch (queueError) {
      // Silent fail - pode não existir na fila
    }

    // Atualizar log de convite para 'accepted'
    try {
      await db.query(
        `UPDATE linkedin_invite_logs
         SET status = 'accepted', accepted_at = NOW()
         WHERE campaign_id = $1 AND linkedin_account_id = $2 AND status = 'sent'
         ORDER BY sent_at DESC LIMIT 1`,
        [cc.campaign_id, linkedinAccount.id]
      );
    } catch (logError) {
      // Silent fail
    }

    // Criar notificação na plataforma
    const userId = cc.campaign_user_id || linkedinAccount.user_id;
    const contactProfilePicture = contactUpdateData.profile_picture || user_picture_url || null;
    try {
      await notificationService.notifyInviteAccepted({
        accountId: cc.account_id,
        userId,
        opportunityName: cc.contact_name || user_full_name || 'Contato',
        opportunityId: null,
        campaignId: cc.campaign_id,
        campaignName: cc.campaign_name || 'Busca LinkedIn',
        profilePicture: contactProfilePicture,
        linkedinAccountId: linkedinAccount.id,
        providerId: user_provider_id
      });
    } catch (notifError) {
      // Silent fail
    }

    // Limpar snapshot do convite (já foi aceito)
    try {
      await db.query(
        `DELETE FROM invitation_snapshots
         WHERE linkedin_account_id = $1
         AND provider_id = $2
         AND invitation_type = 'sent'`,
        [linkedinAccount.id, user_provider_id]
      );
      console.log(`📸 [Invitations] Snapshot limpo após NewRelation`);
    } catch (snapshotError) {
      // Silent fail - pode não existir snapshot
    }

    // IA ativa somente se campanha tem automação ativa
    const shouldActivateAI = cc.campaign_id && cc.automation_active === true;

    // Criar conversa automaticamente (sem opportunity_id - oportunidade será criada pelo agente)
    const conversationData = {
      user_id: userId,
      account_id: cc.account_id,
      linkedin_account_id: linkedinAccount.id,
      contact_id: cc.contact_id,
      campaign_id: cc.campaign_id,
      unipile_chat_id: `temp_chat_${cc.campaign_contact_id}`,
      status: shouldActivateAI ? 'ai_active' : 'manual',
      ai_active: shouldActivateAI,
      ai_agent_id: cc.ai_agent_id || null,
      is_connection: true,
      unread_count: 0
    };

    const conversation = await db.insert('conversations', conversationData);

    // Agendar início de conversa baseado na estratégia de conexão
    let delayedJobScheduled = false;
    let connectionStrategy = cc.connection_strategy || 'with-intro';

    try {
      if (shouldActivateAI) {
        // Se estratégia é 'icebreaker', não agenda - só responde se contato falar primeiro
        if (cc.require_lead_reply === true) {
          console.log('🔗 [CONNECTION STRATEGY] Icebreaker: aguardando contato iniciar conversa');
          delayedJobScheduled = false;
        } else {
          // Calcular delay baseado na estratégia
          let delayMinutes;

          if (cc.wait_time_after_accept != null) {
            delayMinutes = cc.wait_time_after_accept;
          } else {
            const strategyDefaults = {
              'silent': 5,        // 5 minutos
              'with-intro': 60,   // 1 hora
              'icebreaker': 0     // Não aplica
            };
            delayMinutes = strategyDefaults[connectionStrategy] || 5;
          }

          // Adicionar variação randômica de ±20% para parecer mais natural
          const variance = Math.floor(delayMinutes * 0.2);
          const randomVariance = Math.floor(Math.random() * (variance * 2 + 1)) - variance;
          const finalDelay = Math.max(1, delayMinutes + randomVariance);

          console.log(`🔗 [CONNECTION STRATEGY] ${connectionStrategy}: agendando início em ${finalDelay} minutos`);

          await scheduleDelayedConversation(conversation.id, finalDelay * 60 * 1000);
          delayedJobScheduled = true;
        }
      }
    } catch (automationError) {
      console.error('🔗 [CONNECTION STRATEGY] Erro ao agendar conversa:', automationError.message);
      // Silent fail - não falhar o webhook se automação der erro
    }

    return {
      handled: true,
      campaign_contact_id: cc.campaign_contact_id,
      conversation_id: conversation.id,
      accepted: true,
      delayed_conversation_scheduled: delayedJobScheduled,
      connection_strategy: connectionStrategy,
      require_contact_reply: cc.require_lead_reply || false,
      profile_enriched: !!fullProfile
    };

  } catch (error) {
    console.error('[NEW_RELATION] Error:', error.message);
    return { handled: false, reason: error.message };
  }
}

// ================================
// 4. REAÇÃO A MENSAGEM
// ================================
async function handleMessageReaction(payload) {
  console.log('👍 Processando reação a mensagem');

  const { account_id, message_id, reaction } = payload;

  if (!account_id || !message_id) {
    return { handled: false, reason: 'Missing required fields' };
  }

  try {
    // TODO: Implementar salvamento de reações em tabela message_reactions
    console.log('⚠️ Reação recebida mas não implementado salvamento ainda');
    console.log('Reaction data:', reaction);

    return { handled: true, message: 'Reaction logged but not persisted yet' };
  } catch (error) {
    console.error('❌ Erro ao processar reação:', error);
    return { handled: false, reason: error.message };
  }
}

// ================================
// 5. MENSAGEM LIDA
// ================================
async function handleMessageRead(payload) {
  console.log('👁️ Processando mensagem lida');

  const { account_id, message_id, chat_id } = payload;

  if (!account_id || !chat_id) {
    return { handled: false, reason: 'Missing required fields' };
  }

  try {
    // Buscar conversa
    const conversation = await db.findOne('conversations', {
      unipile_chat_id: chat_id
    });

    if (conversation) {
      // Marcar conversa como lida
      await db.update('conversations', {
        unread_count: 0
      }, { id: conversation.id });

      console.log('✅ Conversa marcada como lida');
    }

    return { handled: true, conversation_id: conversation?.id };
  } catch (error) {
    console.error('❌ Erro ao processar mensagem lida:', error);
    return { handled: false, reason: error.message };
  }
}

// ================================
// 6. MENSAGEM EDITADA
// ================================
async function handleMessageEdited(payload) {
  console.log('✏️ Processando mensagem editada');

  const { account_id, message_id, message } = payload;

  if (!account_id || !message_id) {
    return { handled: false, reason: 'Missing required fields' };
  }

  try {
    // Atualizar mensagem no banco
    const result = await db.query(
      'UPDATE messages SET content = $1, updated_at = NOW() WHERE unipile_message_id = $2',
      [message?.text || '', message_id]
    );

    console.log('✅ Mensagem atualizada');

    return { handled: true, updated: result.rowCount > 0 };
  } catch (error) {
    console.error('❌ Erro ao processar mensagem editada:', error);
    return { handled: false, reason: error.message };
  }
}

// ================================
// 7. MENSAGEM DELETADA
// ================================
async function handleMessageDeleted(payload) {
  console.log('🗑️ Processando mensagem deletada');

  const { account_id, message_id } = payload;

  if (!account_id || !message_id) {
    return { handled: false, reason: 'Missing required fields' };
  }

  try {
    // Soft delete - marcar como deletada sem remover do banco
    const result = await db.query(
      'UPDATE messages SET content = \'[Mensagem deletada]\', deleted_at = NOW() WHERE unipile_message_id = $1',
      [message_id]
    );

    console.log('✅ Mensagem marcada como deletada (soft delete)');

    return { handled: true, deleted: result.rowCount > 0 };
  } catch (error) {
    console.error('❌ Erro ao processar mensagem deletada:', error);
    return { handled: false, reason: error.message };
  }
}

// ================================
// 8. MENSAGEM ENTREGUE
// ================================
async function handleMessageDelivered(payload) {
  console.log('✉️ Processando mensagem entregue');

  const { account_id, message_id } = payload;

  if (!account_id || !message_id) {
    return { handled: false, reason: 'Missing required fields' };
  }

  try {
    // TODO: Adicionar coluna delivered_at na tabela messages
    console.log('⚠️ Mensagem entregue mas não implementado salvamento ainda');

    return { handled: true, message: 'Delivery status logged but not persisted yet' };
  } catch (error) {
    console.error('❌ Erro ao processar mensagem entregue:', error);
    return { handled: false, reason: error.message };
  }
}

// ================================
// 7. LISTAR WEBHOOK LOGS
// ================================
const getWebhookLogs = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 50, processed } = req.query;

    // Construir query
    let whereConditions = ['1=1']; // Sempre verdadeiro para facilitar
    let queryParams = [];
    let paramIndex = 1;

    // Filtro por processado
    if (processed !== undefined) {
      whereConditions.push(`processed = $${paramIndex}`);
      queryParams.push(processed === 'true');
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.join(' AND ');

    const query = `
      SELECT *
      FROM webhook_logs
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const logs = await db.query(query, queryParams);

    // Contar total
    const countQuery = `SELECT COUNT(*) FROM webhook_logs WHERE ${whereClause}`;
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    console.log(`✅ Encontrados ${logs.rows.length} logs`);

    sendSuccess(res, {
      logs: logs.rows,
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
// 8. ESTATÍSTICAS DE WEBHOOKS
// ================================
const getWebhookStats = async (req, res) => {
  try {
    console.log('📊 Calculando estatísticas de webhooks');

    // Total e por tipo
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = true) as processed,
        COUNT(*) FILTER (WHERE processed = false) as pending,
        COUNT(*) FILTER (WHERE error IS NOT NULL) as with_errors
      FROM webhook_logs
    `;

    const statsResult = await db.query(statsQuery);

    // Por tipo de evento
    const byTypeQuery = `
      SELECT 
        event_type,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE processed = true) as processed,
        COUNT(*) FILTER (WHERE error IS NOT NULL) as errors
      FROM webhook_logs
      GROUP BY event_type
      ORDER BY count DESC
    `;

    const byTypeResult = await db.query(byTypeQuery);

    // Últimos 7 dias
    const recentQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM webhook_logs
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    const recentResult = await db.query(recentQuery);

    const stats = {
      totals: statsResult.rows[0],
      by_type: byTypeResult.rows,
      recent_activity: recentResult.rows
    };

    console.log('✅ Estatísticas calculadas');

    sendSuccess(res, stats);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 9. CONTA CONECTADA (MULTI-CHANNEL)
// ================================
async function handleAccountConnected(payload) {
  const {
    account_id,
    account_type, // LINKEDIN, WHATSAPP, INSTAGRAM, etc.
    provider,     // Alias para account_type em alguns casos
    user_name,
    user_id,
    phone_number, // Para WhatsApp
    email         // Para contas de email
  } = payload;

  const providerType = account_type || provider || 'UNKNOWN';

  if (!account_id) {
    console.log('⚠️ account_id não fornecido no webhook');
    return { handled: false, reason: 'Missing account_id' };
  }

  try {
    // Verificar se a conta já existe
    const existingAccount = await db.findOne('linkedin_accounts', {
      unipile_account_id: account_id
    });

    if (existingAccount) {
      console.log('✅ Conta já existe, atualizando provider_type');
      await db.update('linkedin_accounts', {
        provider_type: providerType,
        channel_identifier: phone_number || email || user_name || null,
        status: 'active'
      }, { id: existingAccount.id });

      return {
        handled: true,
        action: 'updated',
        account_id: existingAccount.id,
        provider_type: providerType
      };
    }

    // Conta não existe - isso pode acontecer se o webhook chegar antes do redirect
    // Nesse caso, vamos criar uma conta pendente que será atualizada depois
    console.log('⚠️ Conta não encontrada no banco - webhook chegou antes do callback');
    console.log('   Isso é normal, a conta será criada quando o usuário voltar ao app');

    return {
      handled: true,
      action: 'pending',
      reason: 'Account will be created when user returns from auth flow',
      provider_type: providerType,
      unipile_account_id: account_id
    };

  } catch (error) {
    console.error('❌ Erro ao processar conta conectada:', error);
    return { handled: false, reason: error.message };
  }
}

// ================================
// 10. STATUS DA CONTA (webhook Account da Unipile)
// ================================
async function handleAccountStatus(payload) {
  const { account_id, account_type, message } = payload;

  if (!account_id) {
    return { handled: false, reason: 'Missing account_id' };
  }

  try {
    // Verificar se a conta já existe
    const existingAccount = await db.findOne('linkedin_accounts', {
      unipile_account_id: account_id
    });

    if (existingAccount) {
      console.log('✅ Conta já existe no banco:', existingAccount.id);

      // Atualizar status se necessário
      if (message === 'OK' && existingAccount.status !== 'active') {
        await db.update('linkedin_accounts', {
          status: 'active',
          provider_type: account_type || existingAccount.provider_type
        }, { id: existingAccount.id });
        console.log('✅ Status atualizado para active');
      }

      return {
        handled: true,
        action: 'status_checked',
        account_id: existingAccount.id,
        status: message
      };
    }

    // Conta não existe - tentar buscar dados via API Unipile e criar
    console.log('⚠️ Conta não encontrada no banco - buscando dados via API Unipile...');

    if (!unipileClient.isInitialized()) {
      console.log('⚠️ Unipile não configurado, não é possível criar conta automaticamente');
      return {
        handled: true,
        action: 'pending',
        reason: 'Account will be created when user returns from auth flow'
      };
    }

    // Buscar detalhes da conta na Unipile (usando @relay/core)
    const accountData = await unipileClient.account.getAccountById(account_id);
    console.log('✅ Dados da conta obtidos via API:', accountData);

    // Verificar se temos user_id associado (precisamos saber qual usuário associar)
    // Por enquanto, apenas logamos que a conta foi detectada
    // A criação real acontecerá quando o usuário retornar do auth flow

    return {
      handled: true,
      action: 'detected',
      unipile_account_id: account_id,
      account_type: account_type,
      message: 'Account detected via webhook, awaiting user association'
    };

  } catch (error) {
    console.error('❌ Erro ao processar status de conta:', error);
    return { handled: false, reason: error.message };
  }
}

// ================================
// 11. CONTA DESCONECTADA
// ================================
async function handleAccountDisconnected(payload) {
  const { account_id } = payload;

  if (!account_id) {
    return { handled: false, reason: 'Missing account_id' };
  }

  try {
    // Atualizar status da conta e buscar dados necessários para notificação
    const result = await db.query(
      `UPDATE linkedin_accounts
       SET status = 'disconnected', disconnected_at = NOW()
       WHERE unipile_account_id = $1
       RETURNING id, account_id, user_id, provider_type, channel_name, profile_name`,
      [account_id]
    );

    if (result.rows.length === 0) {
      console.log('⚠️ Conta não encontrada para desconectar');
      return { handled: false, reason: 'Account not found' };
    }

    const channel = result.rows[0];
    const channelDisplayName = channel.channel_name || channel.profile_name || channel.provider_type;
    console.log(`✅ Conta ${channel.id} marcada como desconectada`);

    // Criar notificação no banco de dados
    try {
      await notificationService.notifyChannelDisconnected({
        accountId: channel.account_id,
        userId: channel.user_id,
        channelName: channelDisplayName,
        channelId: channel.id,
        providerType: channel.provider_type
      });
      console.log(`📬 Notificação de desconexão criada para user ${channel.user_id}`);
    } catch (notifError) {
      console.error('⚠️ Erro ao criar notificação:', notifError.message);
      // Continue - não falhar webhook por erro de notificação
    }

    // Emitir evento Ably para atualização em tempo real no frontend
    try {
      publishAccountDisconnected({
        accountId: channel.account_id,
        channelId: channel.id,
        channelName: channelDisplayName,
        providerType: channel.provider_type
      });
      console.log(`📡 Ably: Evento account_disconnected emitido`);
    } catch (ablyError) {
      console.error('⚠️ Erro ao emitir evento Ably:', ablyError.message);
      // Continue - não falhar webhook por erro de Ably
    }

    return {
      handled: true,
      action: 'disconnected',
      account_id: channel.id,
      provider_type: channel.provider_type,
      notification_created: true
    };

  } catch (error) {
    console.error('❌ Erro ao processar desconexão:', error);
    return { handled: false, reason: error.message };
  }
}

module.exports = {
  receiveWebhook,
  getWebhookLogs,
  getWebhookStats,
  // Export handler functions for webhook worker
  handleMessageReceived,
  handleNewRelation,
  handleMessageReaction,
  handleMessageRead,
  handleMessageEdited,
  handleMessageDeleted,
  handleMessageDelivered,
  // ✅ MULTI-CHANNEL handlers
  handleAccountConnected,
  handleAccountDisconnected,
  handleAccountStatus
};