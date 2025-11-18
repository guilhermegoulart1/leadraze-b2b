// backend/src/controllers/webhookController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { LEAD_STATUS } = require('../utils/helpers');
const conversationAutomationService = require('../services/conversationAutomationService');

// ================================
// 1. RECEBER WEBHOOK DO UNIPILE
// ================================
const receiveWebhook = async (req, res) => {
  try {
    const payload = req.body;
    const signature = req.headers['x-unipile-signature'];

    console.log('📨 Webhook recebido do Unipile');
    console.log('Event type:', payload.type);

    // Validar signature (se configurado)
    if (process.env.WEBHOOK_SECRET && signature) {
      // TODO: Implementar validação de signature
      // const isValid = validateSignature(payload, signature, process.env.WEBHOOK_SECRET);
      // if (!isValid) {
      //   throw new Error('Invalid webhook signature');
      // }
    }

    // Salvar log do webhook
    await db.insert('webhook_logs', {
      event_type: payload.type || 'unknown',
      account_id: payload.account_id || null,
      payload: JSON.stringify(payload),
      processed: false
    });

    // Processar webhook de acordo com o tipo
    let result;
    switch (payload.type) {
      case 'message.received':
        result = await handleMessageReceived(payload);
        break;
      
      case 'invitation.accepted':
        result = await handleInvitationAccepted(payload);
        break;
      
      case 'invitation.sent':
        result = await handleInvitationSent(payload);
        break;
      
      case 'connection.created':
        result = await handleConnectionCreated(payload);
        break;
      
      case 'message.sent':
        result = await handleMessageSent(payload);
        break;
      
      default:
        console.log(`⚠️ Tipo de evento não tratado: ${payload.type}`);
        result = { handled: false, reason: 'Event type not handled' };
    }

    // Marcar webhook como processado
    await db.query(
      'UPDATE webhook_logs SET processed = true WHERE event_type = $1 AND account_id = $2 ORDER BY created_at DESC LIMIT 1',
      [payload.type, payload.account_id]
    );

    console.log('✅ Webhook processado:', result);

    // Sempre retornar 200 para o Unipile
    res.status(200).json({ 
      success: true, 
      message: 'Webhook received',
      result 
    });

  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error);

    // Salvar erro no log
    try {
      await db.query(
        'UPDATE webhook_logs SET error = $1 WHERE event_type = $2 ORDER BY created_at DESC LIMIT 1',
        [error.message, req.body.type]
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

  const { account_id, chat_id, message } = payload;

  if (!account_id || !chat_id || !message) {
    return { handled: false, reason: 'Missing required fields' };
  }

  try {
    // Buscar conta LinkedIn
    const linkedinAccount = await db.findOne('linkedin_accounts', {
      unipile_account_id: account_id
    });

    if (!linkedinAccount) {
      console.log('⚠️ Conta LinkedIn não encontrada');
      return { handled: false, reason: 'LinkedIn account not found' };
    }

    // Buscar ou criar conversa
    let conversation = await db.findOne('conversations', {
      unipile_chat_id: chat_id
    });

    if (!conversation) {
      console.log('🆕 Criando nova conversa');

      // Tentar encontrar lead pelo chat_id ou provider_id
      const lead = await db.query(
        `SELECT l.* FROM leads l 
         JOIN campaigns c ON l.campaign_id = c.id 
         WHERE c.linkedin_account_id = $1 
         AND l.provider_id IS NOT NULL
         LIMIT 1`,
        [linkedinAccount.id]
      );

      if (lead.rows.length === 0) {
        console.log('⚠️ Lead não encontrado para esta conversa');
        return { handled: false, reason: 'Lead not found' };
      }

      const leadData = lead.rows[0];

      // Criar conversa
      conversation = await db.insert('conversations', {
        user_id: linkedinAccount.user_id,
        linkedin_account_id: linkedinAccount.id,
        lead_id: leadData.id,
        unipile_chat_id: chat_id,
        status: 'warm',
        ai_active: true,
        is_connection: true,
        unread_count: 1
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
      await db.update('conversations', {
        last_message_preview: message.text?.substring(0, 100) || '',
        last_message_at: new Date(),
        unread_count: conversation.unread_count + 1
      }, { id: conversation.id });
    }

    // Salvar mensagem
    const messageData = {
      conversation_id: conversation.id,
      unipile_message_id: message.id || `unipile_${Date.now()}`,
      sender_type: 'lead',
      content: message.text || '',
      message_type: message.type || 'text',
      sent_at: message.timestamp ? new Date(message.timestamp) : new Date()
    };

    await db.insert('messages', messageData);

    console.log('✅ Mensagem salva');

    // Se IA estiver ativa, processar resposta automática
    let aiResponse = null;
    if (conversation.ai_active && !conversation.manual_control_taken) {
      console.log('🤖 Processando resposta automática com IA...');

      try {
        aiResponse = await conversationAutomationService.processIncomingMessage({
          conversation_id: conversation.id,
          message_content: message.text || '',
          sender_id: message.sender_id,
          unipile_message_id: message.id || `unipile_${Date.now()}`
        });

        console.log('✅ Resposta automática processada:', aiResponse);
      } catch (aiError) {
        console.error('❌ Erro ao gerar resposta automática:', aiError);
        // Não falhar o webhook se IA der erro
      }
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
// 3. CONVITE ACEITO
// ================================
async function handleInvitationAccepted(payload) {
  console.log('✅ Processando convite aceito');

  const { account_id, invitation } = payload;

  if (!account_id || !invitation) {
    return { handled: false, reason: 'Missing required fields' };
  }

  try {
    // Buscar conta LinkedIn
    const linkedinAccount = await db.findOne('linkedin_accounts', {
      unipile_account_id: account_id
    });

    if (!linkedinAccount) {
      return { handled: false, reason: 'LinkedIn account not found' };
    }

    // Buscar lead pelo provider_id ou linkedin_profile_id
    const leadQuery = `
      SELECT l.*, c.user_id, c.ai_agent_id
      FROM leads l
      JOIN campaigns c ON l.campaign_id = c.id
      WHERE c.linkedin_account_id = $1
      AND (l.provider_id = $2 OR l.linkedin_profile_id = $3)
      AND l.status = 'invite_sent'
      LIMIT 1
    `;

    const leadResult = await db.query(leadQuery, [
      linkedinAccount.id,
      invitation.profile_id,
      invitation.profile_id
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

    // Criar conversa automaticamente
    const conversationData = {
      user_id: lead.user_id,
      linkedin_account_id: linkedinAccount.id,
      lead_id: lead.id,
      unipile_chat_id: invitation.chat_id || `chat_${lead.id}`,
      status: 'warm',
      ai_active: true,
      ai_agent_id: lead.ai_agent_id || null,
      is_connection: true,
      unread_count: 0
    };

    const conversation = await db.insert('conversations', conversationData);

    console.log('✅ Lead atualizado para "accepted" e conversa criada');

    // Processar envio de mensagem inicial automática se campanha tiver automação ativa
    let initialMessageResult = null;
    try {
      // Buscar campaign_id do lead
      const leadCampaign = await db.findOne('campaigns', { id: lead.campaign_id });

      if (leadCampaign && leadCampaign.automation_active) {
        console.log('🤖 Processando mensagem inicial automática...');

        initialMessageResult = await conversationAutomationService.processInviteAccepted({
          lead_id: lead.id,
          campaign_id: lead.campaign_id,
          linkedin_account_id: linkedinAccount.id,
          lead_unipile_id: invitation.profile_id
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
// 4. CONVITE ENVIADO
// ================================
async function handleInvitationSent(payload) {
  console.log('📤 Processando convite enviado');

  const { account_id, invitation } = payload;

  if (!account_id || !invitation) {
    return { handled: false, reason: 'Missing required fields' };
  }

  try {
    // Buscar conta LinkedIn
    const linkedinAccount = await db.findOne('linkedin_accounts', {
      unipile_account_id: account_id
    });

    if (!linkedinAccount) {
      return { handled: false, reason: 'LinkedIn account not found' };
    }

    // Atualizar contador de envios
    await db.update('linkedin_accounts', {
      today_sent: linkedinAccount.today_sent + 1
    }, { id: linkedinAccount.id });

    console.log('✅ Contador de envios atualizado');

    return { 
      handled: true, 
      account_id: linkedinAccount.id,
      today_sent: linkedinAccount.today_sent + 1
    };

  } catch (error) {
    console.error('❌ Erro ao processar convite enviado:', error);
    return { handled: false, reason: error.message };
  }
}

// ================================
// 5. CONEXÃO CRIADA
// ================================
async function handleConnectionCreated(payload) {
  console.log('🤝 Processando conexão criada');

  const { account_id, connection } = payload;

  if (!account_id || !connection) {
    return { handled: false, reason: 'Missing required fields' };
  }

  try {
    // Similar ao handleInvitationAccepted
    // Apenas logando por enquanto
    console.log('✅ Conexão criada registrada');

    return { 
      handled: true,
      connection_id: connection.id
    };

  } catch (error) {
    console.error('❌ Erro ao processar conexão:', error);
    return { handled: false, reason: error.message };
  }
}

// ================================
// 6. MENSAGEM ENVIADA
// ================================
async function handleMessageSent(payload) {
  console.log('📨 Processando mensagem enviada');

  const { account_id, message } = payload;

  if (!account_id || !message) {
    return { handled: false, reason: 'Missing required fields' };
  }

  try {
    // Apenas logar - mensagens enviadas já são salvas no sendMessage
    console.log('✅ Mensagem enviada registrada');

    return { 
      handled: true,
      message_id: message.id
    };

  } catch (error) {
    console.error('❌ Erro ao processar mensagem enviada:', error);
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
  getWebhookStats
};