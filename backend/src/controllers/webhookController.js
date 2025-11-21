// backend/src/controllers/webhookController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { LEAD_STATUS } = require('../utils/helpers');
const conversationAutomationService = require('../services/conversationAutomationService');
const { addWebhookJob, isWebhookProcessed } = require('../queues/webhookQueue');
const axios = require('axios');

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
    const payload = req.body;
    const signature = req.headers['x-unipile-signature'];

    // ✅ UNIPILE ENVIA EVENTO EM payload.event (não payload.type)
    const eventType = payload.event || payload.type; // Fallback para retrocompatibilidade

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
// 2. MENSAGEM RECEBIDA
// ================================
async function handleMessageReceived(payload) {
  console.log('💬 Processando mensagem recebida');
  console.log('📋 Payload keys:', Object.keys(payload));

  const { account_id, chat_id, message, sender, account_info, message_id, timestamp } = payload;

  if (!account_id || !chat_id) {
    return { handled: false, reason: 'Missing required fields (account_id or chat_id)' };
  }

  // Message pode vir como string diretamente no payload
  const messageContent = typeof message === 'string' ? message : (message?.text || message?.content || '');

  console.log('📨 Message content:', messageContent);
  console.log('👤 Sender:', sender);
  console.log('👤 Account info:', account_info);

  try {
    // Buscar conta LinkedIn
    const linkedinAccount = await db.findOne('linkedin_accounts', {
      unipile_account_id: account_id
    });

    if (!linkedinAccount) {
      console.log('⚠️ Conta LinkedIn não encontrada');
      return { handled: false, reason: 'LinkedIn account not found' };
    }

    // ✅ DETECTAR SE É MENSAGEM PRÓPRIA OU DO LEAD
    // Mensagens enviadas pelo próprio usuário (de outro dispositivo) também vêm em message_received
    const isOwnMessage = sender && account_info &&
                        (sender.attendee_provider_id === account_info.user_id);

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
    let conversation = await db.findOne('conversations', {
      unipile_chat_id: chat_id
    });

    if (!conversation) {
      console.log('🆕 Criando nova conversa');

      // ✅ Encontrar o lead correto baseado no attendee que NÃO é o sender
      // Se eu enviei a mensagem, o lead é o outro participante
      // Se o lead enviou, o lead é o sender
      let leadProviderId = null;

      if (payload.attendees && payload.attendees.length > 0) {
        // Se é mensagem própria, o lead é o attendee que não é o sender
        if (isOwnMessage) {
          const otherAttendee = payload.attendees.find(
            att => att.attendee_provider_id !== sender?.attendee_provider_id
          );
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
        return { handled: false, reason: 'Lead provider_id not found' };
      }

      // Buscar lead pelo provider_id
      const leadQuery = await db.query(
        `SELECT l.*, c.automation_active, c.ai_agent_id as campaign_ai_agent_id
         FROM leads l
         JOIN campaigns c ON l.campaign_id = c.id
         WHERE c.linkedin_account_id = $1
         AND l.provider_id = $2
         LIMIT 1`,
        [linkedinAccount.id, leadProviderId]
      );

      let leadData;
      let shouldActivateAI = false;

      if (leadQuery.rows.length === 0) {
        console.log('⚠️ Lead não encontrado - criando automaticamente (conversa orgânica)');
        console.log('   Provider ID:', leadProviderId);

        // ✅ CRIAR LEAD AUTOMATICAMENTE para conversas orgânicas
        // Primeiro, buscar dados completos do perfil via API Unipile
        const profileData = await fetchUserProfileFromUnipile(account_id, leadProviderId);

        // Dados do attendee como fallback
        const attendeeData = isOwnMessage
          ? payload.attendees.find(att => att.attendee_provider_id === leadProviderId)
          : sender;

        // Extrair dados do perfil completo (preferência) ou attendee (fallback)
        const leadName = profileData?.display_name
          || profileData?.name
          || profileData?.full_name
          || attendeeData?.attendee_name
          || 'Unknown';

        const profileUrl = profileData?.profile_url
          || attendeeData?.attendee_profile_url
          || '';

        const profilePicture = profileData?.picture_url
          || profileData?.profile_picture_url
          || attendeeData?.attendee_picture_url
          || '';

        const headline = profileData?.headline || '';
        const location = profileData?.location || '';

        console.log('📋 Dados do perfil coletados:');
        console.log(`   Nome: ${leadName}`);
        console.log(`   URL: ${profileUrl}`);
        console.log(`   Headline: ${headline}`);
        console.log(`   Location: ${location}`);

        // Criar ou buscar campanha "Organic"
        let organicCampaign = await db.findOne('campaigns', {
          user_id: linkedinAccount.user_id,
          name: 'Organic Conversations'
        });

        if (!organicCampaign) {
          console.log('🆕 Criando campanha "Organic Conversations"');
          organicCampaign = await db.insert('campaigns', {
            user_id: linkedinAccount.user_id,
            linkedin_account_id: linkedinAccount.id,
            name: 'Organic Conversations',
            description: 'Conversas orgânicas recebidas no LinkedIn',
            status: 'active',
            automation_active: false,
            is_system: true
          });
        }

        // Criar lead com dados completos da API
        leadData = await db.insert('leads', {
          campaign_id: organicCampaign.id,
          linkedin_profile_id: leadProviderId,
          name: leadName,
          profile_url: profileUrl,
          profile_picture: profilePicture,
          headline: headline || null,
          location: location || null,
          provider_id: leadProviderId,
          status: 'accepted',
          accepted_at: new Date()
        });

        leadData.automation_active = false;
        leadData.campaign_ai_agent_id = null;
        leadData.campaign_id = organicCampaign.id;

        console.log('✅ Lead criado automaticamente com dados completos:', leadData.name);
        shouldActivateAI = false; // Orgânico nunca tem IA
      } else {
        leadData = leadQuery.rows[0];
        console.log('✅ Lead encontrado:', leadData.name);

        // ✅ IA ATIVA SOMENTE SE CAMPANHA TEM AUTOMAÇÃO ATIVA
        shouldActivateAI = leadData.automation_active === true;
      }

      console.log(`🤖 Automação da campanha: ${leadData.automation_active ? 'ATIVA' : 'INATIVA'}`);
      console.log(`🤖 IA será ${shouldActivateAI ? 'ATIVADA' : 'DESATIVADA'} para esta conversa`);

      // Criar conversa
      conversation = await db.insert('conversations', {
        user_id: linkedinAccount.user_id,
        linkedin_account_id: linkedinAccount.id,
        lead_id: leadData.id,
        campaign_id: leadData.campaign_id,
        unipile_chat_id: chat_id,
        status: shouldActivateAI ? 'ai_active' : 'manual',
        ai_active: shouldActivateAI,
        ai_agent_id: leadData.campaign_ai_agent_id || null,
        is_connection: true,
        // ✅ Só marcar como não lida se for mensagem DO LEAD (não enviada pelo usuário)
        unread_count: isOwnMessage ? 0 : 1,
        last_message_at: timestamp ? new Date(timestamp) : new Date(),
        last_message_preview: messageContent?.substring(0, 100) || ''
      });

      // Atualizar lead para "accepted" se ainda não estiver
      if (leadData.status === LEAD_STATUS.INVITE_SENT) {
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
      sent_at: timestamp ? new Date(timestamp) : new Date()
    };

    await db.insert('messages', messageData);

    console.log(`✅ Mensagem salva:`);
    console.log(`   - Sender type: ${messageData.sender_type}`);
    console.log(`   - Content: ${messageData.content}`);
    console.log(`   - Sent at: ${messageData.sent_at}`);

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
  console.log('✅ Processando nova relação (convite aceito)');
  console.log('⏰ Nota: Este evento pode ter delay de até 8h (polling do LinkedIn)');

  // ✅ CAMPOS CORRETOS SEGUNDO DOCUMENTAÇÃO UNIPILE
  const {
    account_id,
    user_provider_id, // ID do usuário no LinkedIn
    user_public_identifier, // Vanity URL (ex: "john-doe")
    user_profile_url, // URL completa do perfil
    user_full_name,
    user_picture_url
  } = payload;

  if (!account_id || !user_provider_id) {
    return { handled: false, reason: 'Missing required fields (account_id or user_provider_id)' };
  }

  try {
    // Buscar conta LinkedIn
    const linkedinAccount = await db.findOne('linkedin_accounts', {
      unipile_account_id: account_id
    });

    if (!linkedinAccount) {
      return { handled: false, reason: 'LinkedIn account not found' };
    }

    // Buscar lead pelo provider_id ou linkedin_profile_id ou public_identifier
    const leadQuery = `
      SELECT l.*, c.user_id, c.ai_agent_id, c.automation_active
      FROM leads l
      JOIN campaigns c ON l.campaign_id = c.id
      WHERE c.linkedin_account_id = $1
      AND (
        l.provider_id = $2
        OR l.linkedin_profile_id = $3
        OR l.profile_url LIKE $4
      )
      AND l.status = 'invite_sent'
      LIMIT 1
    `;

    const leadResult = await db.query(leadQuery, [
      linkedinAccount.id,
      user_provider_id,
      user_public_identifier,
      `%${user_public_identifier}%`
    ]);

    if (leadResult.rows.length === 0) {
      console.log('⚠️ Lead não encontrado para este convite');
      return { handled: false, reason: 'Lead not found' };
    }

    const lead = leadResult.rows[0];

    // Atualizar lead para "accepted"
    await db.update('leads', {
      status: LEAD_STATUS.ACCEPTED,
      accepted_at: new Date()
    }, { id: lead.id });

    // 🆕 ATUALIZAR LOG DE CONVITE PARA 'ACCEPTED'
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
      // Não falhar se der erro no log
    }

    // Atualizar contadores da campanha
    await db.query(
      `UPDATE campaigns
       SET leads_sent = GREATEST(0, leads_sent - 1),
           leads_accepted = leads_accepted + 1
       WHERE id = $1`,
      [lead.campaign_id]
    );

    // ✅ IA ATIVA SOMENTE SE CAMPANHA TEM AUTOMAÇÃO ATIVA
    const shouldActivateAI = lead.automation_active === true;

    console.log(`🤖 Automação da campanha: ${lead.automation_active ? 'ATIVA' : 'INATIVA'}`);
    console.log(`🤖 IA será ${shouldActivateAI ? 'ATIVADA' : 'DESATIVADA'} para esta conversa`);

    // Criar conversa automaticamente
    // ⚠️ NOTA: new_relation NÃO inclui chat_id, será criado quando primeira mensagem chegar
    const conversationData = {
      user_id: lead.user_id,
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

    console.log('✅ Lead atualizado para "accepted" e conversa criada');

    // Processar envio de mensagem inicial automática se campanha tiver automação ativa
    let initialMessageResult = null;
    try {
      if (shouldActivateAI) {
        console.log('🤖 Processando mensagem inicial automática...');

        initialMessageResult = await conversationAutomationService.processInviteAccepted({
          lead_id: lead.id,
          campaign_id: lead.campaign_id,
          linkedin_account_id: linkedinAccount.id,
          lead_unipile_id: user_provider_id // ✅ Usar campo correto
        });

        console.log('✅ Mensagem inicial processada:', initialMessageResult);
      }
    } catch (automationError) {
      console.error('❌ Erro ao processar automação de convite aceito:', automationError);
      // Não falhar o webhook se automação der erro
    }

    return {
      handled: true,
      lead_id: lead.id,
      conversation_id: conversation.id,
      lead_status: LEAD_STATUS.ACCEPTED,
      initial_message_sent: initialMessageResult?.initial_message_sent || false
    };

  } catch (error) {
    console.error('❌ Erro ao processar convite aceito:', error);
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
  handleMessageDelivered
};