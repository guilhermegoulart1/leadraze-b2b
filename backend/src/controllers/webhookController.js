// backend/src/controllers/webhookController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { LEAD_STATUS } = require('../utils/helpers');
const conversationAutomationService = require('../services/conversationAutomationService');
const conversationSummaryService = require('../services/conversationSummaryService');
const { addWebhookJob, isWebhookProcessed } = require('../queues/webhookQueue');
const { scheduleDelayedConversation, cancelDelayedConversation } = require('../workers/delayedConversationWorker');
const axios = require('axios');
const { publishNewMessage, publishNewConversation } = require('../services/socketService');
const unipileClient = require('../config/unipile');
const storageService = require('../services/storageService');

// ================================
// HELPER: PROCESSAR E SALVAR ATTACHMENTS NO R2
// ================================
async function processAndSaveAttachments(payload, conversationId, messageId, accountId, linkedinAccountId) {
  const attachments = payload.attachments || [];
  const savedAttachments = [];

  // Se não tem attachments mas é uma mensagem de mídia, tentar extrair do payload
  const messageType = payload.message_type || 'text';
  const isMediaMessage = ['image', 'video', 'audio', 'document', 'sticker', 'file'].includes(messageType);

  if (attachments.length === 0 && !isMediaMessage) {
    return savedAttachments;
  }

  console.log(`📎 Processando ${attachments.length} attachment(s) para mensagem ${messageId}`);

  for (const att of attachments) {
    try {
      const attachmentId = att.id || att.attachment_id;
      const mimeType = att.mime_type || att.mimetype || att.type || 'application/octet-stream';
      const filename = att.filename || att.name || `attachment_${attachmentId}.${getExtensionFromMime(mimeType)}`;
      const fileSize = att.size || att.file_size || 0;

      console.log(`   📥 Baixando attachment ${attachmentId} (${mimeType})`);

      // Baixar attachment via Unipile API
      const unipileAccountId = await getUnipileAccountId(linkedinAccountId);
      if (!unipileAccountId) {
        console.warn(`   ⚠️ Não foi possível obter unipile_account_id para download`);
        continue;
      }

      const attachmentData = await unipileClient.messaging.getAttachment({
        account_id: unipileAccountId,
        message_id: messageId,
        attachment_id: attachmentId
      });

      if (!attachmentData?.data) {
        console.warn(`   ⚠️ Attachment ${attachmentId} sem dados`);
        continue;
      }

      // Upload para R2
      console.log(`   📤 Enviando para R2...`);
      const r2Result = await storageService.uploadEmailAttachment(
        conversationId,
        Buffer.from(attachmentData.data),
        attachmentData.contentType || mimeType,
        filename
      );

      // Salvar registro no banco
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

      console.log(`   ✅ Attachment salvo no R2: ${r2Result.key}`);

    } catch (attError) {
      console.error(`   ❌ Erro ao processar attachment:`, attError.message);
      // Continuar com próximo attachment
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
  const dsn = process.env.UNIPILE_DSN;
  const token = process.env.UNIPILE_API_KEY || process.env.UNIPILE_ACCESS_TOKEN;

  if (!dsn || !token) {
    console.warn('⚠️ Unipile não configurado, usando dados básicos do webhook');
    return null;
  }

  try {
    console.log(`🔍 Buscando perfil completo via Unipile API...`);
    console.log(`   Account ID: ${accountId}`);
    console.log(`   User Provider ID: ${userProviderId}`);

    const url = `https://${dsn}/api/v1/users/${userProviderId}`;

    const response = await axios({
      method: 'GET',
      url,
      headers: {
        'X-API-KEY': token,
        'Accept': 'application/json'
      },
      params: {
        account_id: accountId
      },
      timeout: 10000
    });

    console.log('✅ Perfil obtido via API Unipile');
    return response.data;

  } catch (error) {
    console.warn('⚠️ Erro ao buscar perfil via API:', error.message);
    // Não falhar o webhook, apenas retornar null e usar dados básicos
    return null;
  }
}

// ================================
// HELPER: DETECTAR TIPO DE EVENTO E NORMALIZAR PAYLOAD
// ================================
// A Unipile envia o tipo como chave do objeto, ex: { "AccountStatus": { ... } }
// Precisamos detectar isso e normalizar para um formato consistente
function parseUnipileWebhook(rawPayload) {
  // Mapeamento de chaves do Unipile para tipos de evento internos
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

  // Verificar se é o formato com chave de evento (ex: { "AccountStatus": { ... } })
  const eventKeys = Object.keys(rawPayload);
  for (const key of eventKeys) {
    if (EVENT_KEY_MAP[key]) {
      const eventData = rawPayload[key];
      return {
        eventType: EVENT_KEY_MAP[key],
        payload: {
          ...eventData,
          _original_event_key: key
        }
      };
    }
  }

  // Fallback: formato antigo com payload.event ou payload.type
  const eventType = rawPayload.event || rawPayload.type;
  return {
    eventType,
    payload: rawPayload
  };
}

// ================================
// 1. RECEBER WEBHOOK DO UNIPILE
// ================================
const receiveWebhook = async (req, res) => {
  // ✅ LOGS DETALHADOS PARA DEBUG
  console.log('\n🔔 ======================================');
  console.log('📨 WEBHOOK RECEBIDO');
  console.log('======================================');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('🌐 Method:', req.method);
  console.log('🔗 URL:', req.originalUrl);
  console.log('📍 IP:', req.ip || req.connection.remoteAddress);
  console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
  console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  console.log('======================================\n');

  try {
    // O payload já vem parseado pelo middleware do app.js
    const rawPayload = req.body;
    const signature = req.headers['x-unipile-signature'];

    // ✅ DETECTAR TIPO DE EVENTO E NORMALIZAR PAYLOAD
    const { eventType, payload } = parseUnipileWebhook(rawPayload);

    console.log('📨 Processando webhook do Unipile');
    console.log('Event type:', eventType);
    console.log('Webhook name:', payload.webhook_name);
    console.log('Account type:', payload.account_type);
    console.log('Account ID:', payload.account_id);
    console.log('Chat ID:', payload.chat_id);

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
      console.log('⚠️ Webhook já processado, ignorando duplicata');
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

    // ✅ NOVO: Adicionar job à fila em vez de processar síncronamente
    const job = await addWebhookJob(eventType, payload, webhookLog.id);

    console.log(`✅ Webhook enfileirado - Job ID: ${job.id}`);

    // ✅ Retornar 200 IMEDIATAMENTE (sem aguardar processamento)
    res.status(200).json({
      success: true,
      message: 'Webhook queued for processing',
      jobId: job.id,
      eventType
    });

  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error);

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
      console.error('Erro ao salvar log:', logError);
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
    attendee.pushname,
    attendee.full_name
  ];

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
    // Verificar se já existe esse canal para o contato
    const existingChannel = await db.query(
      `SELECT id, metadata FROM contact_channels
       WHERE contact_id = $1 AND channel_type = $2
       LIMIT 1`,
      [contactId, channelType.toLowerCase()]
    );

    if (existingChannel.rows.length > 0) {
      // Atualizar last_interaction, message_count e attendee_id no metadata
      const existingMetadata = existingChannel.rows[0].metadata || {};
      const newMetadata = attendeeId
        ? { ...existingMetadata, attendee_id: attendeeId }
        : existingMetadata;

      await db.query(
        `UPDATE contact_channels
         SET last_interaction_at = NOW(),
             message_count = message_count + 1,
             is_active = true,
             metadata = $2
         WHERE id = $1`,
        [existingChannel.rows[0].id, JSON.stringify(newMetadata)]
      );
      console.log(`📱 Canal ${channelType} atualizado para contato`);
    } else {
      // Criar novo registro de canal com attendee_id no metadata
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
      console.log(`📱 Canal ${channelType} registrado para contato`);
    }
  } catch (error) {
    console.error('⚠️ Erro ao registrar canal do contato:', error.message);
    // Não falhar o webhook por erro de canal
  }
}

// ================================
// HELPER: BUSCAR E ATUALIZAR DADOS DO CONTATO VIA UNIPILE
// ================================
async function fetchAndUpdateContactFromAttendee(accountId, contactId, attendeeId, options = {}) {
  if (!attendeeId) {
    console.log('⚠️ Sem attendeeId para buscar dados do contato');
    return null;
  }

  const { fetchPicture = true, updateName = false } = options;
  const result = { updated: false, fields: [] };

  try {
    console.log(`🔄 Buscando dados do attendee: ${attendeeId}`);

    // 1. Buscar dados completos do attendee via API
    const attendeeData = await unipileClient.messaging.getAttendeeById(attendeeId);

    if (attendeeData) {
      console.log('📋 Dados do attendee recebidos:', JSON.stringify(attendeeData, null, 2));

      // Extrair campos úteis do attendee
      const updates = {};

      // Nome (só atualiza se solicitado ou se contato não tem nome válido)
      const attendeeName = attendeeData.name
        || attendeeData.display_name
        || attendeeData.full_name
        || attendeeData.pushname;

      if (updateName && attendeeName && !attendeeName.match(/^\+?\d+$/)) {
        updates.name = attendeeName;
        result.fields.push('name');
      }

      // Telefone (extrair de attendee_specifics se disponível)
      const phoneNumber = attendeeData.phone_number
        || attendeeData.attendee_specifics?.phone_number
        || attendeeData.identifier;

      // Headline/Bio (se disponível)
      if (attendeeData.headline || attendeeData.bio || attendeeData.about) {
        updates.headline = attendeeData.headline || attendeeData.bio || attendeeData.about;
        result.fields.push('headline');
      }

      // Atualizar contato com dados básicos
      if (Object.keys(updates).length > 0) {
        const setClause = Object.keys(updates)
          .map((key, i) => `${key} = $${i + 2}`)
          .join(', ');
        const values = [contactId, ...Object.values(updates)];

        await db.query(
          `UPDATE contacts SET ${setClause}, updated_at = NOW() WHERE id = $1`,
          values
        );
        result.updated = true;
        console.log(`✅ Dados do contato atualizados: ${result.fields.join(', ')}`);
      }
    }

    // 2. Buscar e salvar foto de perfil
    if (fetchPicture) {
      console.log(`📸 Buscando foto de perfil do attendee: ${attendeeId}`);

      const pictureResult = await unipileClient.messaging.getAttendeePicture(attendeeId);

      if (pictureResult && pictureResult.data) {
        console.log(`✅ Foto encontrada: ${pictureResult.contentType}, ${pictureResult.data.length} bytes`);

        // Determinar extensão do arquivo
        const mimeToExt = {
          'image/jpeg': '.jpg',
          'image/jpg': '.jpg',
          'image/png': '.png',
          'image/gif': '.gif',
          'image/webp': '.webp'
        };
        const ext = mimeToExt[pictureResult.contentType] || '.jpg';

        // Upload para R2
        const uploadResult = await storageService.uploadContactPicture(
          accountId,
          contactId,
          pictureResult.data,
          pictureResult.contentType,
          `profile${ext}`
        );

        console.log(`✅ Foto salva no R2: ${uploadResult.url}`);

        // Atualizar contato com a URL da foto
        await db.query(
          `UPDATE contacts SET profile_picture = $1, updated_at = NOW() WHERE id = $2`,
          [uploadResult.url, contactId]
        );

        result.updated = true;
        result.fields.push('profile_picture');
        result.pictureUrl = uploadResult.url;
        console.log(`✅ Contato atualizado com foto de perfil`);
      } else {
        console.log('⚠️ Nenhuma foto de perfil disponível no Unipile');
      }
    }

    return result;

  } catch (error) {
    console.error('⚠️ Erro ao buscar/atualizar dados do contato:', error.message);
    // Não falhar o processo por erro
    return result;
  }
}

// ================================
// HELPER: CRIAR OU BUSCAR CONTATO
// ================================
async function findOrCreateContact(userId, accountId, contactData) {
  const { phone, providerId, name, profileUrl, profilePicture, headline, location, source, attendeeId } = contactData;

  // Formatar telefone para busca
  const phoneClean = phone?.replace(/@s\.whatsapp\.net|@c\.us/gi, '') || '';
  const phoneFormatted = formatPhoneNumber(phone);

  console.log(`🔍 Buscando contato existente...`);
  console.log(`   Phone: ${phoneFormatted}`);
  console.log(`   Provider ID: ${providerId}`);
  console.log(`   Attendee ID: ${attendeeId}`);

  // Buscar contato existente pelo telefone ou provider_id
  let contact = null;
  let isNewContact = false;

  // Tentar buscar pelo telefone
  if (phoneFormatted) {
    const contactQuery = await db.query(
      `SELECT * FROM contacts
       WHERE account_id = $1
       AND (phone = $2 OR phone = $3 OR phone LIKE $4)
       LIMIT 1`,
      [accountId, phoneFormatted, phoneClean, `%${phoneClean}%`]
    );
    if (contactQuery.rows.length > 0) {
      contact = contactQuery.rows[0];
      console.log(`✅ Contato encontrado pelo telefone: ${contact.name}`);
    }
  }

  // Se não encontrou, buscar pelo linkedin_profile_id (que pode conter o provider_id do WhatsApp)
  if (!contact && providerId) {
    const contactQuery = await db.query(
      `SELECT * FROM contacts
       WHERE account_id = $1
       AND (linkedin_profile_id = $2 OR linkedin_profile_id = $3)
       LIMIT 1`,
      [accountId, providerId, phoneClean]
    );
    if (contactQuery.rows.length > 0) {
      contact = contactQuery.rows[0];
      console.log(`✅ Contato encontrado pelo provider_id: ${contact.name}`);
    }
  }

  // Se não encontrou, criar novo contato
  if (!contact) {
    console.log(`🆕 Criando novo contato...`);

    const newContact = await db.insert('contacts', {
      user_id: userId,
      account_id: accountId,
      name: name || phoneFormatted || 'Contato',
      phone: phoneFormatted,
      linkedin_profile_id: providerId, // Usar para guardar o provider_id do WhatsApp/IG
      profile_url: profileUrl || null,
      profile_picture: profilePicture || null,
      headline: headline || null,
      location: location || null,
      source: source || 'whatsapp'
    });

    contact = newContact;
    isNewContact = true;
    console.log(`✅ Contato criado: ${contact.name} (ID: ${contact.id})`);
  }

  // Buscar dados e foto do attendee se:
  // 1. É novo contato OU contato existente sem foto
  // 2. Temos attendeeId disponível
  const shouldFetchData = attendeeId && (!contact.profile_picture || isNewContact);
  if (shouldFetchData) {
    // Executar em background para não bloquear o webhook
    fetchAndUpdateContactFromAttendee(accountId, contact.id, attendeeId, {
      fetchPicture: true,
      updateName: isNewContact // Só atualiza nome se for contato novo
    })
      .then(result => {
        if (result?.pictureUrl) {
          contact.profile_picture = result.pictureUrl;
        }
      })
      .catch(err => console.error('⚠️ Erro ao buscar dados em background:', err.message));
  }

  return contact;
}

// ================================
// 2. MENSAGEM RECEBIDA
// ================================
async function handleMessageReceived(payload) {
  console.log('💬 Processando mensagem recebida');
  console.log('📋 Payload keys:', Object.keys(payload));

  // 🔍 LOG DETALHADO PARA ANÁLISE
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 PAYLOAD COMPLETO:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('═══════════════════════════════════════════════════════════════');

  // Log específico do sender
  if (payload.sender) {
    console.log('👤 SENDER DETALHADO:');
    console.log('   attendee_provider_id:', payload.sender.attendee_provider_id);
    console.log('   attendee_specifics:', JSON.stringify(payload.sender.attendee_specifics));
    console.log('   display_name:', payload.sender.display_name);
  }

  // Log dos attendees
  if (payload.attendees) {
    console.log('👥 ATTENDEES:');
    payload.attendees.forEach((att, i) => {
      console.log(`   [${i}] provider_id: ${att.attendee_provider_id}`);
      console.log(`       specifics: ${JSON.stringify(att.attendee_specifics)}`);
      console.log(`       display_name: ${att.display_name}`);
    });
  }

  const { account_id, chat_id, message, sender, message_id, timestamp } = payload;
  const providerType = payload.account_type || 'LINKEDIN'; // LINKEDIN, WHATSAPP, INSTAGRAM, etc.
  const attendeeCount = payload.attendees?.length || 2;
  const isGroup = isGroupChat(payload);

  console.log(`📱 Provider: ${providerType}`);
  console.log(`👥 Attendees: ${attendeeCount} | Is Group: ${isGroup}`);

  if (!account_id || !chat_id) {
    return { handled: false, reason: 'Missing required fields (account_id or chat_id)' };
  }

  // Message pode vir como string diretamente no payload
  const messageContent = typeof message === 'string' ? message : (message?.text || message?.content || '');

  console.log('📨 Message content:', messageContent);
  console.log('👤 Sender:', sender);

  try {
    // Buscar conta (LinkedIn ou outro canal)
    const connectedChannel = await db.findOne('linkedin_accounts', {
      unipile_account_id: account_id
    });

    if (!connectedChannel) {
      console.log('⚠️ Canal conectado não encontrado');
      return { handled: false, reason: 'Connected channel not found' };
    }

    // ✅ IGNORAR CANAIS DESCONECTADOS
    if (connectedChannel.status === 'disconnected') {
      console.log('⏭️ Ignorando mensagem - canal está desconectado');
      return {
        handled: true,
        skipped: true,
        reason: 'Channel is disconnected',
        channel_id: connectedChannel.id
      };
    }

    // ✅ VERIFICAR CONFIGURAÇÕES DO CANAL
    const channelSettings = await getChannelSettings(connectedChannel.id);

    // ✅ FILTRAR GRUPOS SE CONFIGURADO
    if (isGroup && channelSettings.ignore_groups) {
      console.log(`⏭️ Ignorando mensagem de grupo (${attendeeCount} participantes)`);
      console.log(`   Provider: ${providerType}`);
      console.log(`   Configuração ignore_groups: ${channelSettings.ignore_groups}`);
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

    // ✅ DETECTAR SE É MENSAGEM PRÓPRIA OU DO LEAD
    // Mensagens enviadas pelo próprio usuário (de outro dispositivo) também vêm em message_received
    // Usar channel_identifier da conta conectada (não account_info que não existe no payload)
    const ownIdentifier = connectedChannel.channel_identifier;
    const senderIdentifier = sender?.attendee_provider_id?.replace(/@s\.whatsapp\.net|@c\.us/gi, '') || '';
    const isOwnMessage = sender && ownIdentifier &&
                        (senderIdentifier === ownIdentifier || sender.attendee_provider_id === ownIdentifier);

    console.log('🔍 Comparando sender:', senderIdentifier, 'vs own:', ownIdentifier, '→', isOwnMessage ? 'PRÓPRIA' : 'LEAD');

    if (isOwnMessage) {
      console.log('📤 Mensagem própria detectada (enviada de outro dispositivo)');
      console.log('   Apenas logando, não processando IA');

      // Salvar mensagem mas marcar como 'user' ao invés de 'lead'
      // Não processar IA para mensagens próprias
      const isSelfMessage = true;
      var skipAI = true;
    } else {
      console.log('📨 Mensagem do lead detectada');
      var skipAI = false;
    }

    // Buscar ou criar conversa
    // ✅ IMPORTANTE: Buscar por chat_id OU pelo contact/lead para evitar duplicatas
    let conversation = await db.findOne('conversations', {
      unipile_chat_id: chat_id
    });

    // ✅ SE NÃO ENCONTROU POR CHAT_ID, BUSCAR POR CONTACT/LEAD
    // Isso evita duplicação quando o chat_id muda entre envio e recebimento
    if (!conversation) {
      console.log('🔍 Conversa não encontrada por chat_id, buscando por contact/lead...');

      // Identificar o provider_id do lead/contact para busca
      let searchProviderId = null;
      let attendeesData = payload.attendees || [];

      // Tentar pegar o provider_id do outro participante
      if (attendeesData.length > 0) {
        const ownIdentifierClean = ownIdentifier?.replace(/@s\.whatsapp\.net|@c\.us/gi, '') || '';

        // Encontrar o attendee que NÃO é o próprio usuário
        const otherAttendee = attendeesData.find(att => {
          const attId = att.attendee_provider_id?.replace(/@s\.whatsapp\.net|@c\.us/gi, '') || '';
          return attId !== ownIdentifierClean && att.attendee_provider_id !== ownIdentifier;
        });

        searchProviderId = otherAttendee?.attendee_provider_id;
      }

      // Se é mensagem do lead, o provider_id é o sender
      if (!isOwnMessage && sender?.attendee_provider_id) {
        searchProviderId = sender.attendee_provider_id;
      }

      if (searchProviderId) {
        const searchProviderIdClean = searchProviderId.replace(/@s\.whatsapp\.net|@c\.us/gi, '');
        const phoneFormatted = formatPhoneNumber(searchProviderId);

        console.log('🔍 Buscando conversa por provider_id:', searchProviderIdClean);

        // Buscar conversa pelo contact (telefone) ou lead (provider_id)
        const conversationQuery = await db.query(
          `SELECT conv.* FROM conversations conv
           LEFT JOIN contacts ct ON conv.contact_id = ct.id
           LEFT JOIN leads ld ON conv.lead_id = ld.id
           WHERE conv.linkedin_account_id = $1
           AND (
             -- Buscar por contact (telefone)
             ct.phone = $2 OR ct.phone = $3 OR ct.linkedin_profile_id = $4
             -- Buscar por lead (provider_id)
             OR ld.provider_id = $4 OR ld.provider_id = $5
           )
           ORDER BY conv.created_at DESC
           LIMIT 1`,
          [linkedinAccount.id, phoneFormatted, searchProviderIdClean, searchProviderIdClean, searchProviderId]
        );

        if (conversationQuery.rows.length > 0) {
          conversation = conversationQuery.rows[0];
          console.log('✅ Conversa encontrada por contact/lead! ID:', conversation.id);

          // ✅ ATUALIZAR O CHAT_ID DA CONVERSA EXISTENTE
          console.log('🔄 Atualizando chat_id da conversa...');
          console.log(`   Antigo: ${conversation.unipile_chat_id}`);
          console.log(`   Novo: ${chat_id}`);

          await db.update('conversations', {
            unipile_chat_id: chat_id
          }, { id: conversation.id });

          conversation.unipile_chat_id = chat_id;

          // ✅ REGISTRAR CANAL DO CONTATO (para conversas existentes)
          if (conversation.contact_id) {
            await registerContactChannel(
              conversation.contact_id,
              providerType, // 'WHATSAPP', 'INSTAGRAM', etc.
              searchProviderIdClean,
              sender?.display_name || null
            );
          }
        }
      }
    }

    if (!conversation) {
      console.log('🆕 Criando nova conversa');

      // ✅ Encontrar o lead correto baseado no attendee que NÃO é o sender
      // Se eu enviei a mensagem, o lead é o outro participante
      // Se o lead enviou, o lead é o sender
      let leadProviderId = null;
      let attendeesData = payload.attendees || [];

      // Se não temos attendees suficientes no payload, buscar via API
      if (attendeesData.length < 2 && isOwnMessage) {
        console.log('🔍 Buscando attendees do chat via Unipile API...');
        try {
          const chatUrl = `https://${process.env.UNIPILE_DSN}/api/v1/chats/${chat_id}?account_id=${account_id}`;
          const axios = require('axios');
          const chatResponse = await axios.get(chatUrl, {
            headers: {
              'X-API-KEY': process.env.UNIPILE_ACCESS_TOKEN,
              'Accept': 'application/json'
            },
            timeout: 10000
          });
          attendeesData = chatResponse.data?.attendees || attendeesData;
          console.log('✅ Attendees obtidos via API:', attendeesData.length);
          console.log('   Attendees completos:', JSON.stringify(attendeesData, null, 2));
        } catch (apiError) {
          console.warn('⚠️ Erro ao buscar chat via API:', apiError.message);
        }
      }

      if (attendeesData.length > 0) {
        // Se é mensagem própria, o lead é o attendee que não é o sender
        if (isOwnMessage) {
          // Comparar usando número limpo (sem @s.whatsapp.net)
          const otherAttendee = attendeesData.find(att => {
            const attId = att.attendee_provider_id?.replace(/@s\.whatsapp\.net|@c\.us/gi, '') || '';
            return attId !== ownIdentifier && att.attendee_provider_id !== sender?.attendee_provider_id;
          });
          leadProviderId = otherAttendee?.attendee_provider_id;
          console.log('📤 Mensagem própria - Lead é o outro participante:', leadProviderId);
        } else {
          // Se o lead enviou, o lead é o sender
          leadProviderId = sender?.attendee_provider_id;
          console.log('📨 Mensagem do lead - Lead é o sender:', leadProviderId);
        }
      }

      if (!leadProviderId) {
        console.log('⚠️ Não foi possível identificar o lead provider_id');
        console.log('   Attendees disponíveis:', JSON.stringify(attendeesData, null, 2));
        return { handled: false, reason: 'Lead provider_id not found' };
      }

      // ✅ VALIDAÇÃO CRÍTICA: Nunca criar lead/contato com o próprio número do usuário!
      const leadProviderIdClean = leadProviderId.replace(/@s\.whatsapp\.net|@c\.us/gi, '');
      if (leadProviderIdClean === ownIdentifier) {
        console.error('❌ ERRO CRÍTICO: leadProviderId é o próprio usuário!');
        console.error('   leadProviderId:', leadProviderId);
        console.error('   ownIdentifier:', ownIdentifier);
        console.error('   Isso não deveria acontecer. Abortando criação de conversa.');
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

      // ✅ PASSO 1: SEMPRE criar/buscar CONTATO primeiro (para WhatsApp/Instagram)
      console.log('📇 Buscando ou criando CONTATO...');
      console.log('   Provider ID:', leadProviderId);

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

      console.log('🔍 AttendeeData:', attendeeData ? JSON.stringify(attendeeData) : 'null');

      // Extrair melhor nome (evita "You" e formata telefone)
      const contactName = profileData?.display_name
        || profileData?.name
        || profileData?.full_name
        || extractBestName(attendeeData, leadProviderId)
        || formatPhoneNumber(leadProviderId)
        || 'Contato';

      const profileUrl = profileData?.profile_url
        || attendeeData?.attendee_profile_url
        || '';

      const profilePicture = profileData?.picture_url
        || profileData?.profile_picture_url
        || attendeeData?.attendee_picture_url
        || '';

      const headline = profileData?.headline || '';
      const location = profileData?.location || '';

      console.log('📋 Dados do contato:');
      console.log(`   Nome: ${contactName}`);
      console.log(`   Telefone: ${formatPhoneNumber(leadProviderId)}`);

      // CRIAR OU BUSCAR CONTATO
      contactData = await findOrCreateContact(
        linkedinAccount.user_id,
        linkedinAccount.account_id,
        {
          phone: leadProviderId,
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

      console.log(`✅ Contato: ${contactData.name} (ID: ${contactData.id})`);

      // ✅ REGISTRAR CANAL DO CONTATO (WhatsApp, Instagram, etc.)
      await registerContactChannel(
        contactData.id,
        providerType, // 'WHATSAPP', 'INSTAGRAM', etc.
        leadProviderId, // Número de telefone ou handle
        contactName, // Nome de exibição
        attendeeData?.id || null // Attendee ID para buscar foto
      );

      // ✅ PASSO 2: Verificar se existe LEAD (oportunidade) para este contato
      // Lead só existe se estiver em uma campanha ativa
      const leadQuery = await db.query(
        `SELECT l.*, c.automation_active, c.ai_agent_id as campaign_ai_agent_id
         FROM leads l
         JOIN campaigns c ON l.campaign_id = c.id
         WHERE c.linkedin_account_id = $1
         AND l.provider_id = $2
         LIMIT 1`,
        [linkedinAccount.id, leadProviderId]
      );

      if (leadQuery.rows.length > 0) {
        leadData = leadQuery.rows[0];
        console.log(`📊 Lead/Oportunidade encontrado: ${leadData.name} (Campanha ID: ${leadData.campaign_id})`);
        shouldActivateAI = leadData.automation_active === true;
        console.log(`🤖 IA: ${shouldActivateAI ? 'ATIVA' : 'DESATIVADA'}`);
      } else {
        console.log('📇 Conversa orgânica - sem oportunidade/lead associado');
      }

      // Criar conversa - SEMPRE com contact_id, lead_id é opcional
      conversation = await db.insert('conversations', {
        user_id: linkedinAccount.user_id,
        account_id: linkedinAccount.account_id, // Multi-tenancy
        linkedin_account_id: linkedinAccount.id,
        // ✅ NOVA ARQUITETURA: contact_id SEMPRE, lead_id opcional (se for oportunidade)
        contact_id: contactData.id, // SEMPRE presente
        lead_id: leadData?.id || null, // Opcional - só se tiver oportunidade/campanha
        campaign_id: leadData?.campaign_id || null,
        unipile_chat_id: chat_id,
        status: shouldActivateAI ? 'ai_active' : 'manual',
        ai_active: shouldActivateAI,
        ai_agent_id: leadData?.campaign_ai_agent_id || null,
        is_connection: true,
        // ✅ Só marcar como não lida se for mensagem DO LEAD (não enviada pelo usuário)
        unread_count: isOwnMessage ? 0 : 1,
        last_message_at: timestamp ? new Date(timestamp) : new Date(),
        last_message_preview: messageContent?.substring(0, 100) || '',
        // ✅ MULTI-CHANNEL: Novos campos
        provider_type: providerType,
        is_group: isGroup,
        attendee_count: attendeeCount,
        group_name: isGroup ? (payload.chat_name || payload.group_name || null) : null
      });

      // ✅ EMIT WEBSOCKET: Nova conversa criada
      publishNewConversation({
        accountId: linkedinAccount.account_id,
        conversation: {
          id: conversation.id,
          contact_name: contactData.name,
          last_message_preview: messageContent?.substring(0, 100) || '',
          last_message_at: conversation.last_message_at,
          unread_count: conversation.unread_count,
          provider_type: providerType,
          is_group: isGroup
        }
      });
      console.log(`📡 WebSocket: Evento new_conversation emitido para account:${linkedinAccount.account_id}`);

      // Atualizar lead para "accepted" se ainda não estiver (só se tiver lead)
      if (leadData && leadData.status === LEAD_STATUS.INVITE_SENT) {
        await db.update('leads', {
          status: LEAD_STATUS.ACCEPTED,
          accepted_at: new Date()
        }, { id: leadData.id });

        // Atualizar contadores da campanha
        await db.query(
          `UPDATE campaigns
           SET leads_sent = GREATEST(0, leads_sent - 1),
               leads_accepted = leads_accepted + 1
           WHERE id = $1`,
          [leadData.campaign_id]
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
    const messageData = {
      conversation_id: conversation.id,
      unipile_message_id: message_id || payload.provider_message_id || `unipile_${Date.now()}`,
      sender_type: isOwnMessage ? 'user' : 'lead',
      content: messageContent || '',
      message_type: payload.message_type || 'text',
      sent_at: timestamp ? new Date(timestamp) : new Date(),
      provider_type: providerType // ✅ MULTI-CHANNEL
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

    // ✅ EMIT WEBSOCKET: Nova mensagem em tempo real
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
    console.log(`📡 WebSocket: Evento new_message emitido (isOwnMessage: ${isOwnMessage})`)

    // ✅ CANCELAR JOB DE DELAY SE LEAD ENVIOU MENSAGEM
    // (cancela o início automático de conversa se lead responder antes dos 5 minutos)
    if (!isOwnMessage && conversation.lead_id) {
      try {
        console.log('🛑 Verificando job de delay para cancelar...');
        const canceled = await cancelDelayedConversation(conversation.lead_id);
        if (canceled) {
          console.log('✅ Job de delay cancelado (lead respondeu primeiro)');
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
// ⚠️ IMPORTANTE: Este webhook pode demorar até 8 horas (polling do Unipile)
async function handleNewRelation(payload) {
  console.log('\n🔗 ═══════════════════════════════════════════════════════════');
  console.log('🔗 [NEW-RELATION] CONVITE ACEITO - INICIANDO PROCESSAMENTO');
  console.log('🔗 ═══════════════════════════════════════════════════════════');
  console.log('🔗 ⏰ Timestamp:', new Date().toISOString());
  console.log('🔗 ⏰ Nota: Este evento pode ter delay de até 8h (polling do LinkedIn)');
  console.log('🔗 📋 Payload:', JSON.stringify(payload, null, 2));

  // Import services needed for invite system
  const inviteQueueService = require('../services/inviteQueueService');
  const notificationService = require('../services/notificationService');

  // ✅ CAMPOS CORRETOS SEGUNDO DOCUMENTAÇÃO UNIPILE
  const {
    account_id,
    user_provider_id, // ID do usuário no LinkedIn
    user_public_identifier, // Vanity URL (ex: "john-doe")
    user_profile_url, // URL completa do perfil
    user_full_name,
    user_picture_url
  } = payload;

  console.log('🔗 [1] Dados recebidos:');
  console.log(`🔗     account_id: ${account_id}`);
  console.log(`🔗     user_provider_id: ${user_provider_id}`);
  console.log(`🔗     user_public_identifier: ${user_public_identifier}`);
  console.log(`🔗     user_full_name: ${user_full_name}`);

  if (!account_id || !user_provider_id) {
    console.log('🔗 ❌ ERRO: Campos obrigatórios ausentes');
    return { handled: false, reason: 'Missing required fields (account_id or user_provider_id)' };
  }

  try {
    // Buscar conta LinkedIn
    console.log('🔗 [2] Buscando conta LinkedIn no banco...');
    const linkedinAccount = await db.findOne('linkedin_accounts', {
      unipile_account_id: account_id
    });

    if (!linkedinAccount) {
      console.log('🔗 ❌ ERRO: Conta LinkedIn não encontrada');
      return { handled: false, reason: 'LinkedIn account not found' };
    }
    console.log(`🔗 ✅ Conta encontrada: ${linkedinAccount.id}`);

    // ✅ IGNORAR CANAIS DESCONECTADOS
    if (linkedinAccount.status === 'disconnected') {
      console.log('⏭️ Ignorando nova relação - canal está desconectado');
      return {
        handled: true,
        skipped: true,
        reason: 'Channel is disconnected',
        channel_id: linkedinAccount.id
      };
    }

    // Buscar lead pelo provider_id ou linkedin_profile_id ou public_identifier
    // ✅ AMPLIADO: Busca leads com status 'invite_sent' OU na fila de convites
    console.log('🔗 [3] Buscando lead no banco...');
    const leadQuery = `
      SELECT l.*, c.user_id, c.ai_agent_id, c.automation_active, c.name as campaign_name,
             c.account_id,
             crc.sector_id, crc.round_robin_users, crc.ai_initiate_delay_min, crc.ai_initiate_delay_max
      FROM leads l
      JOIN campaigns c ON l.campaign_id = c.id
      LEFT JOIN campaign_review_config crc ON crc.campaign_id = c.id
      WHERE c.linkedin_account_id = $1
      AND (
        l.provider_id = $2
        OR l.linkedin_profile_id = $3
        OR l.profile_url LIKE $4
      )
      AND l.status IN ('invite_sent', 'invite_queued')
      LIMIT 1
    `;

    const leadResult = await db.query(leadQuery, [
      linkedinAccount.id,
      user_provider_id,
      user_public_identifier,
      `%${user_public_identifier}%`
    ]);

    if (leadResult.rows.length === 0) {
      console.log('🔗 ❌ Lead não encontrado para este convite');
      console.log('🔗    Buscou por:');
      console.log(`🔗    - provider_id = ${user_provider_id}`);
      console.log(`🔗    - linkedin_profile_id = ${user_public_identifier}`);
      console.log(`🔗    - profile_url LIKE %${user_public_identifier}%`);
      return { handled: false, reason: 'Lead not found' };
    }

    const lead = leadResult.rows[0];
    console.log('🔗 ✅ Lead encontrado!');
    console.log(`🔗     Lead ID: ${lead.id}`);
    console.log(`🔗     Nome: ${lead.name}`);
    console.log(`🔗     Campanha: ${lead.campaign_name} (${lead.campaign_id})`);
    console.log(`🔗     Status atual: ${lead.status}`);
    console.log(`🔗     Round Robin Config: sector_id=${lead.sector_id}, users=${lead.round_robin_users?.length || 0}`);

    // ✅ BUSCAR PERFIL COMPLETO VIA UNIPILE API
    console.log('🔗 [4] Buscando perfil completo via Unipile API...');
    const fullProfile = await fetchUserProfileFromUnipile(account_id, user_provider_id);
    if (fullProfile) {
      console.log('🔗 ✅ Perfil completo obtido');
      console.log(`🔗     Nome: ${fullProfile.first_name} ${fullProfile.last_name}`);
      console.log(`🔗     Headline: ${fullProfile.headline?.substring(0, 50)}...`);
    } else {
      console.log('🔗 ⚠️ Não foi possível obter perfil completo');
    }

    // ✅ ATUALIZAR LEAD COM DADOS COMPLETOS DO PERFIL
    console.log('🔗 [5] Preparando dados para atualização do lead...');
    const leadUpdateData = {
      status: LEAD_STATUS.ACCEPTED,
      accepted_at: new Date()
    };

    if (fullProfile) {
      console.log('✅ Perfil completo obtido, atualizando dados do lead...');

      // Dados básicos
      if (fullProfile.first_name) leadUpdateData.first_name = fullProfile.first_name;
      if (fullProfile.last_name) leadUpdateData.last_name = fullProfile.last_name;
      if (fullProfile.headline) leadUpdateData.headline = fullProfile.headline;
      if (fullProfile.about || fullProfile.summary) leadUpdateData.about = fullProfile.about || fullProfile.summary;
      if (fullProfile.location) leadUpdateData.location = fullProfile.location;
      if (fullProfile.industry) leadUpdateData.industry = fullProfile.industry;

      // Foto de perfil
      if (fullProfile.picture_url || fullProfile.profile_picture_url) {
        leadUpdateData.profile_picture = fullProfile.picture_url || fullProfile.profile_picture_url;
      }

      // Dados ricos (JSON)
      if (fullProfile.experience && Array.isArray(fullProfile.experience)) {
        leadUpdateData.experience = JSON.stringify(fullProfile.experience);
      }
      if (fullProfile.education && Array.isArray(fullProfile.education)) {
        leadUpdateData.education = JSON.stringify(fullProfile.education);
      }
      if (fullProfile.skills && Array.isArray(fullProfile.skills)) {
        leadUpdateData.skills = JSON.stringify(fullProfile.skills);
      }
      if (fullProfile.websites && Array.isArray(fullProfile.websites)) {
        leadUpdateData.websites = JSON.stringify(fullProfile.websites);
      }
      if (fullProfile.languages && Array.isArray(fullProfile.languages)) {
        leadUpdateData.languages = JSON.stringify(fullProfile.languages);
      }

      // Contatos (se disponíveis)
      if (fullProfile.email) leadUpdateData.email = fullProfile.email;
      if (fullProfile.phone) leadUpdateData.phone = fullProfile.phone;

      // Conexões
      if (fullProfile.connections_count) leadUpdateData.connections_count = fullProfile.connections_count;
      if (fullProfile.follower_count) leadUpdateData.follower_count = fullProfile.follower_count;
    }

    // ✅ DISTRIBUIÇÃO VIA ROUND ROBIN
    console.log('🔗 [6] Verificando distribuição Round Robin...');
    let responsibleUserId = null;
    if (lead.sector_id && lead.round_robin_users && lead.round_robin_users.length > 0) {
      console.log('🔗     Round Robin ATIVO');
      console.log(`🔗     Setor: ${lead.sector_id}`);
      console.log(`🔗     Usuários na rotação: ${lead.round_robin_users.length}`);

      // Buscar último usuário atribuído no setor
      const sectorResult = await db.query(
        `SELECT last_assigned_user_id FROM sectors WHERE id = $1`,
        [lead.sector_id]
      );

      const lastAssignedUserId = sectorResult.rows[0]?.last_assigned_user_id;
      let nextIndex = 0;

      if (lastAssignedUserId) {
        const lastIndex = lead.round_robin_users.indexOf(lastAssignedUserId);
        if (lastIndex !== -1) {
          nextIndex = (lastIndex + 1) % lead.round_robin_users.length;
        }
      }

      responsibleUserId = lead.round_robin_users[nextIndex];

      // Atualizar setor com último atribuído
      await db.query(
        `UPDATE sectors SET last_assigned_user_id = $1 WHERE id = $2`,
        [responsibleUserId, lead.sector_id]
      );

      leadUpdateData.responsible_user_id = responsibleUserId;
      leadUpdateData.round_robin_distributed_at = new Date();

      // Buscar nome do usuário para log
      const userResult = await db.query(
        `SELECT name FROM users WHERE id = $1`,
        [responsibleUserId]
      );
      console.log(`🔗 ✅ Lead distribuído para: ${userResult.rows[0]?.name || responsibleUserId}`);
    } else {
      console.log('🔗     Round Robin NÃO configurado para esta campanha');
    }

    // Atualizar lead
    console.log('🔗 [7] Atualizando lead no banco...');
    await db.update('leads', leadUpdateData, { id: lead.id });
    console.log('🔗 ✅ Lead atualizado com status ACCEPTED');

    // ✅ MARCAR CONVITE COMO ACEITO NA FILA
    console.log('🔗 [8] Marcando convite como aceito na fila...');
    try {
      await inviteQueueService.markInviteAsAccepted(lead.id);
      console.log('🔗 ✅ Convite marcado como aceito na fila');
    } catch (queueError) {
      console.warn('🔗 ⚠️ Erro ao atualizar fila de convites:', queueError.message);
      console.log('🔗    (Pode não existir na fila - fluxo legado)');
    }

    // 🆕 ATUALIZAR LOG DE CONVITE PARA 'ACCEPTED' (legado)
    try {
      await db.query(
        `UPDATE linkedin_invite_logs
         SET status = 'accepted',
             accepted_at = NOW()
         WHERE lead_id = $1
           AND linkedin_account_id = $2
           AND status = 'sent'`,
        [lead.id, linkedinAccount.id]
      );
      console.log('✅ Log de convite atualizado para "accepted"');
    } catch (logError) {
      console.warn('⚠️ Erro ao atualizar log de convite:', logError.message);
    }

    // Atualizar contadores da campanha
    console.log('🔗 [9] Atualizando contadores da campanha...');
    await db.query(
      `UPDATE campaigns
       SET leads_sent = GREATEST(0, leads_sent - 1),
           leads_accepted = leads_accepted + 1,
           pending_invites_count = GREATEST(0, pending_invites_count - 1)
       WHERE id = $1`,
      [lead.campaign_id]
    );
    console.log('🔗 ✅ Contadores atualizados');

    // ✅ CRIAR NOTIFICAÇÃO NA PLATAFORMA
    console.log('🔗 [10] Criando notificação na plataforma...');
    const notifyUserId = responsibleUserId || lead.user_id;
    try {
      await notificationService.notifyInviteAccepted({
        accountId: lead.account_id,
        userId: notifyUserId,
        leadName: lead.name || user_full_name || 'Lead',
        leadId: lead.id,
        campaignId: lead.campaign_id,
        campaignName: lead.campaign_name
      });
      console.log(`🔗 ✅ Notificação criada para usuário ${notifyUserId}`);
    } catch (notifError) {
      console.warn('🔗 ⚠️ Erro ao criar notificação:', notifError.message);
    }

    // ✅ IA ATIVA SOMENTE SE CAMPANHA TEM AUTOMAÇÃO ATIVA
    console.log('🔗 [11] Verificando configuração de IA...');
    const shouldActivateAI = lead.automation_active === true;

    console.log(`🔗     Automação da campanha: ${lead.automation_active ? 'ATIVA' : 'INATIVA'}`);
    console.log(`🔗     IA será ${shouldActivateAI ? 'ATIVADA' : 'DESATIVADA'} para esta conversa`);

    // Criar conversa automaticamente
    // ⚠️ NOTA: new_relation NÃO inclui chat_id, será criado quando primeira mensagem chegar
    console.log('🔗 [12] Criando conversa...');
    const conversationData = {
      user_id: lead.user_id,
      account_id: lead.account_id,
      linkedin_account_id: linkedinAccount.id,
      lead_id: lead.id,
      campaign_id: lead.campaign_id,
      unipile_chat_id: `temp_chat_${lead.id}`, // Temporário, atualizado em message_received
      status: shouldActivateAI ? 'ai_active' : 'manual',
      ai_active: shouldActivateAI,
      ai_agent_id: lead.ai_agent_id || null,
      is_connection: true,
      unread_count: 0
    };

    const conversation = await db.insert('conversations', conversationData);
    console.log(`🔗 ✅ Conversa criada: ${conversation.id}`);

    // ✅ AGENDAR INÍCIO DE CONVERSA COM DELAY RANDÔMICO DA CONFIG
    console.log('🔗 [13] Verificando agendamento de IA...');
    let delayedJobScheduled = false;
    try {
      if (shouldActivateAI) {
        // Usar delay configurado na campanha
        const delayMin = lead.ai_initiate_delay_min || 5;
        const delayMax = lead.ai_initiate_delay_max || 60;
        const randomDelay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;

        console.log(`🔗     Agendando início de conversa automático para daqui ${randomDelay} minutos`);
        console.log(`🔗     (Config: min=${delayMin}min, max=${delayMax}min)`);

        // scheduleDelayedConversation aceita delay opcional em ms
        await scheduleDelayedConversation(lead.id, conversation.id, randomDelay * 60 * 1000);
        delayedJobScheduled = true;

        console.log('🔗 ✅ Job de delay agendado com sucesso');
      } else {
        console.log('🔗     IA desativada - não agendando conversa automática');
      }
    } catch (automationError) {
      console.error('🔗 ❌ Erro ao agendar início de conversa:', automationError);
      // Não falhar o webhook se automação der erro
    }

    console.log('\n🔗 ═══════════════════════════════════════════════════════════');
    console.log('🔗 ✅ [NEW-RELATION] PROCESSAMENTO CONCLUÍDO COM SUCESSO!');
    console.log(`🔗     Lead: ${lead.name}`);
    console.log(`🔗     Status: ACCEPTED`);
    console.log(`🔗     Conversa: ${conversation.id}`);
    console.log(`🔗     Responsável: ${responsibleUserId || 'Não atribuído'}`);
    console.log(`🔗     IA Agendada: ${delayedJobScheduled ? 'SIM' : 'NÃO'}`);
    console.log(`🔗     Perfil Enriquecido: ${fullProfile ? 'SIM' : 'NÃO'}`);
    console.log('🔗 ═══════════════════════════════════════════════════════════\n');

    return {
      handled: true,
      lead_id: lead.id,
      conversation_id: conversation.id,
      lead_status: LEAD_STATUS.ACCEPTED,
      responsible_user_id: responsibleUserId,
      delayed_conversation_scheduled: delayedJobScheduled,
      profile_enriched: !!fullProfile
    };

  } catch (error) {
    console.error('\n🔗 ═══════════════════════════════════════════════════════════');
    console.error('🔗 ❌ [NEW-RELATION] ERRO NO PROCESSAMENTO');
    console.error('🔗     Erro:', error.message);
    console.error('🔗 ═══════════════════════════════════════════════════════════\n');
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

    console.log(`📋 Listando logs de webhooks`);

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
  console.log('🔗 Processando nova conta conectada');
  console.log('📋 Payload:', JSON.stringify(payload, null, 2));

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
  console.log('📊 Processando status de conta');
  console.log('📋 Payload:', JSON.stringify(payload, null, 2));

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

    const dsn = process.env.UNIPILE_DSN;
    const token = process.env.UNIPILE_API_KEY || process.env.UNIPILE_ACCESS_TOKEN;

    if (!dsn || !token) {
      console.log('⚠️ Unipile não configurado, não é possível criar conta automaticamente');
      return {
        handled: true,
        action: 'pending',
        reason: 'Account will be created when user returns from auth flow'
      };
    }

    // Buscar detalhes da conta na Unipile
    const accountResponse = await axios({
      method: 'GET',
      url: `https://${dsn}/api/v1/accounts/${account_id}`,
      headers: {
        'X-API-KEY': token,
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    const accountData = accountResponse.data;
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
  console.log('🔌 Processando conta desconectada');
  console.log('📋 Payload:', JSON.stringify(payload, null, 2));

  const { account_id } = payload;

  if (!account_id) {
    return { handled: false, reason: 'Missing account_id' };
  }

  try {
    // Atualizar status da conta
    const result = await db.query(
      `UPDATE linkedin_accounts
       SET status = 'disconnected', disconnected_at = NOW()
       WHERE unipile_account_id = $1
       RETURNING id, provider_type`,
      [account_id]
    );

    if (result.rows.length === 0) {
      console.log('⚠️ Conta não encontrada para desconectar');
      return { handled: false, reason: 'Account not found' };
    }

    console.log(`✅ Conta ${result.rows[0].id} marcada como desconectada`);

    return {
      handled: true,
      action: 'disconnected',
      account_id: result.rows[0].id,
      provider_type: result.rows[0].provider_type
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