// backend/src/services/conversationAutomationService.js

const db = require('../config/database');
const unipileClient = require('../config/unipile');
const aiResponseService = require('./aiResponseService');
const contactExtractionService = require('./contactExtractionService');
const { v4: uuidv4 } = require('uuid');

/**
 * Processar mensagem recebida e gerar resposta automática se necessário
 * @param {Object} params - Parâmetros da mensagem
 * @returns {Promise<Object>} Resultado do processamento
 */
async function processIncomingMessage(params) {
  const {
    conversation_id,
    message_content,
    sender_id,
    unipile_message_id
  } = params;

  try {
    console.log(`📨 Processando mensagem recebida na conversa ${conversation_id}`);

    // Buscar dados da conversa
    const conversation = await getConversationDetails(conversation_id);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Verificar se IA está ativa para esta conversa
    if (!conversation.ai_active) {
      console.log(`ℹ️ IA desativada para esta conversa. Ignorando.`);
      return {
        processed: false,
        reason: 'ai_inactive'
      };
    }

    // Verificar se usuário assumiu controle manual
    if (conversation.manual_control_taken) {
      console.log(`ℹ️ Controle manual ativo. Ignorando automação.`);
      return {
        processed: false,
        reason: 'manual_control'
      };
    }

    // Registrar mensagem do lead no banco
    await saveMessage({
      conversation_id,
      sender_type: 'lead',
      content: message_content,
      unipile_message_id,
      sent_at: new Date()
    });

    // Atualizar conversa com preview da última mensagem
    await db.update(
      'conversations',
      {
        last_message_at: new Date(),
        last_message_preview: message_content.substring(0, 100),
        unread_count: db.raw('unread_count + 1')
      },
      { id: conversation_id }
    );

    // 📧📞 Extrair email/telefone da mensagem se houver
    try {
      const extractionResult = await contactExtractionService.processMessageForContacts(
        conversation.lead_id,
        message_content
      );

      if (extractionResult.extracted) {
        console.log(`📧📞 Contatos capturados do lead ${conversation.lead_id}:`, extractionResult.contacts);
      }
    } catch (error) {
      // Não bloquear o fluxo se a extração falhar
      console.error('⚠️ Erro ao extrair contatos (continuando):', error.message);
    }

    // Buscar histórico da conversa
    const conversationHistory = await getConversationHistory(conversation_id);

    // Gerar resposta usando IA
    console.log(`🤖 Gerando resposta IA...`);

    const aiResponse = await aiResponseService.generateResponse({
      conversation_id,
      lead_message: message_content,
      conversation_history,
      ai_agent: conversation.ai_agent,
      lead_data: conversation.lead_data,
      context: {
        campaign: conversation.campaign_name
      }
    });

    console.log(`✅ Resposta gerada: "${aiResponse.response.substring(0, 50)}..."`);
    console.log(`🎯 Intenção detectada: ${aiResponse.intent}`);

    // Enviar resposta via Unipile
    await sendAutomatedReply({
      conversation_id,
      response: aiResponse.response,
      unipile_account_id: conversation.unipile_account_id,
      lead_unipile_id: conversation.lead_unipile_id
    });

    // Salvar resposta no banco
    await saveMessage({
      conversation_id,
      sender_type: 'ai',
      content: aiResponse.response,
      ai_intent: aiResponse.intent,
      sent_at: new Date()
    });

    // Atualizar conversa
    await db.update(
      'conversations',
      {
        last_message_at: new Date(),
        last_message_preview: aiResponse.response.substring(0, 100)
      },
      { id: conversation_id }
    );

    // Atualizar status do lead baseado na intenção
    if (aiResponse.intent) {
      await updateLeadStatusByIntent(conversation.lead_id, aiResponse.intent);
    }

    console.log(`✅ Resposta automática enviada com sucesso`);

    return {
      processed: true,
      response_sent: aiResponse.response,
      intent: aiResponse.intent,
      should_notify_user: ['ready_to_buy', 'objection'].includes(aiResponse.intent)
    };

  } catch (error) {
    console.error(`❌ Erro ao processar mensagem:`, error);
    throw error;
  }
}

/**
 * Processar quando um convite for aceito (enviar mensagem inicial)
 * @param {Object} params - Parâmetros do evento
 * @returns {Promise<Object>} Resultado do processamento
 */
async function processInviteAccepted(params) {
  const {
    lead_id,
    campaign_id,
    linkedin_account_id,
    lead_unipile_id
  } = params;

  try {
    console.log(`🎉 Processando convite aceito para lead ${lead_id}`);

    // Buscar dados do lead e campanha
    const leadData = await db.findOne('leads', { id: lead_id });
    const campaign = await db.findOne('campaigns', { id: campaign_id });
    const linkedinAccount = await db.findOne('linkedin_accounts', { id: linkedin_account_id });

    if (!leadData || !campaign || !linkedinAccount) {
      throw new Error('Lead, campaign or LinkedIn account not found');
    }

    // Buscar AI agent da campanha
    let aiAgent = null;
    if (campaign.ai_agent_id) {
      aiAgent = await db.findOne('ai_agents', { id: campaign.ai_agent_id });
    }

    // Criar conversa
    const conversationId = uuidv4();

    const conversationData = {
      id: conversationId,
      lead_id: lead_id,
      campaign_id: campaign_id,
      user_id: campaign.user_id,
      linkedin_account_id: linkedin_account_id,
      ai_agent_id: aiAgent?.id || null,
      status: 'active',
      ai_active: true,
      manual_control_taken: false,
      is_connection: true,
      unread_count: 0,
      created_at: new Date()
    };

    await db.insert('conversations', conversationData);

    console.log(`✅ Conversa criada: ${conversationId}`);

    // Atualizar status do lead
    await db.update(
      'leads',
      {
        status: 'connected',
        updated_at: new Date()
      },
      { id: lead_id }
    );

    // Atualizar log de convite
    await db.query(
      `UPDATE linkedin_invite_logs
       SET status = 'accepted'
       WHERE lead_id = $1
       AND status = 'sent'`,
      [lead_id]
    );

    // Verificar se deve enviar mensagem inicial automática
    if (aiAgent && campaign.automation_active) {
      console.log(`💬 Gerando mensagem inicial automática...`);

      // Gerar mensagem inicial
      const initialMessage = await aiResponseService.generateInitialMessage({
        ai_agent: aiAgent,
        lead_data: leadData,
        campaign
      });

      console.log(`✅ Mensagem gerada: "${initialMessage.substring(0, 50)}..."`);

      // Aguardar 3-8 segundos (comportamento mais humano)
      const delay = 3000 + Math.random() * 5000;
      await new Promise(resolve => setTimeout(resolve, delay));

      // Enviar mensagem inicial
      await sendAutomatedReply({
        conversation_id: conversationId,
        response: initialMessage,
        unipile_account_id: linkedinAccount.unipile_account_id,
        lead_unipile_id: lead_unipile_id
      });

      // Salvar mensagem no banco
      await saveMessage({
        conversation_id: conversationId,
        sender_type: 'ai',
        content: initialMessage,
        ai_intent: 'initial_contact',
        sent_at: new Date()
      });

      // Atualizar conversa
      await db.update(
        'conversations',
        {
          last_message_at: new Date(),
          last_message_preview: initialMessage.substring(0, 100)
        },
        { id: conversationId }
      );

      console.log(`✅ Mensagem inicial enviada automaticamente`);

      return {
        processed: true,
        conversation_id: conversationId,
        initial_message_sent: true,
        message: initialMessage
      };
    }

    return {
      processed: true,
      conversation_id: conversationId,
      initial_message_sent: false
    };

  } catch (error) {
    console.error(`❌ Erro ao processar convite aceito:`, error);
    throw error;
  }
}

/**
 * Buscar detalhes completos da conversa
 */
async function getConversationDetails(conversationId) {
  const result = await db.query(
    `SELECT
      conv.*,
      l.id as lead_id,
      l.name as lead_name,
      l.title as lead_title,
      l.company as lead_company,
      l.location as lead_location,
      l.industry as lead_industry,
      l.linkedin_profile_id as lead_unipile_id,
      l.profile_picture as lead_picture,
      c.name as campaign_name,
      c.automation_active,
      la.unipile_account_id,
      aa.id as ai_agent_id,
      aa.name as ai_agent_name,
      aa.system_prompt,
      aa.products_services,
      aa.behavioral_profile,
      aa.initial_approach,
      aa.auto_schedule,
      aa.scheduling_link,
      aa.intent_detection_enabled,
      aa.response_style_instructions
    FROM conversations conv
    JOIN leads l ON conv.lead_id = l.id
    JOIN campaigns c ON conv.campaign_id = c.id
    JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
    LEFT JOIN ai_agents aa ON conv.ai_agent_id = aa.id
    WHERE conv.id = $1`,
    [conversationId]
  );

  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    ...row,
    ai_agent: row.ai_agent_id ? {
      id: row.ai_agent_id,
      name: row.ai_agent_name,
      system_prompt: row.system_prompt,
      products_services: row.products_services,
      behavioral_profile: row.behavioral_profile,
      initial_approach: row.initial_approach,
      auto_schedule: row.auto_schedule,
      scheduling_link: row.scheduling_link,
      intent_detection_enabled: row.intent_detection_enabled,
      response_style_instructions: row.response_style_instructions
    } : null,
    lead_data: {
      name: row.lead_name,
      title: row.lead_title,
      company: row.lead_company,
      location: row.lead_location,
      industry: row.lead_industry
    }
  };
}

/**
 * Buscar histórico de mensagens da conversa
 */
async function getConversationHistory(conversationId, limit = 20) {
  const result = await db.query(
    `SELECT
      content,
      sender_type,
      ai_intent,
      sent_at
    FROM messages
    WHERE conversation_id = $1
    ORDER BY sent_at ASC
    LIMIT $2`,
    [conversationId, limit]
  );

  return result.rows || [];
}

/**
 * Salvar mensagem no banco de dados
 */
async function saveMessage(data) {
  const messageData = {
    id: uuidv4(),
    conversation_id: data.conversation_id,
    sender_type: data.sender_type,
    content: data.content,
    unipile_message_id: data.unipile_message_id || null,
    ai_intent: data.ai_intent || null,
    message_type: data.message_type || 'text',
    sent_at: data.sent_at || new Date(),
    created_at: new Date()
  };

  return await db.insert('messages', messageData);
}

/**
 * Enviar resposta automática via Unipile
 */
async function sendAutomatedReply(params) {
  const { conversation_id, response, unipile_account_id, lead_unipile_id } = params;

  try {
    console.log(`📤 Enviando resposta via Unipile...`);

    // Enviar mensagem via Unipile
    const result = await unipileClient.messaging.send({
      account_id: unipile_account_id,
      user_id: lead_unipile_id,
      text: response
    });

    console.log(`✅ Mensagem enviada via Unipile`);

    return result;

  } catch (error) {
    console.error(`❌ Erro ao enviar mensagem via Unipile:`, error);
    throw error;
  }
}

/**
 * Atualizar status do lead baseado na intenção detectada
 */
async function updateLeadStatusByIntent(leadId, intent) {
  const statusMap = {
    'interested': 'engaged',
    'ready_to_buy': 'qualified',
    'not_interested': 'not_interested',
    'objection': 'needs_attention'
  };

  const newStatus = statusMap[intent];

  if (newStatus) {
    await db.update(
      'leads',
      {
        status: newStatus,
        updated_at: new Date()
      },
      { id: leadId }
    );

    console.log(`✅ Status do lead atualizado para: ${newStatus}`);
  }
}

/**
 * Desativar IA para uma conversa (usuário assumiu controle)
 */
async function disableAIForConversation(conversationId, userId) {
  try {
    // Verificar se conversa pertence ao usuário
    const conversation = await db.findOne('conversations', {
      id: conversationId,
      user_id: userId
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Desativar IA
    await db.update(
      'conversations',
      {
        ai_active: false,
        manual_control_taken: true,
        updated_at: new Date()
      },
      { id: conversationId }
    );

    console.log(`✅ IA desativada para conversa ${conversationId}`);

    return { success: true };

  } catch (error) {
    console.error('❌ Erro ao desativar IA:', error);
    throw error;
  }
}

/**
 * Reativar IA para uma conversa
 */
async function enableAIForConversation(conversationId, userId) {
  try {
    // Verificar se conversa pertence ao usuário
    const conversation = await db.findOne('conversations', {
      id: conversationId,
      user_id: userId
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Reativar IA
    await db.update(
      'conversations',
      {
        ai_active: true,
        manual_control_taken: false,
        updated_at: new Date()
      },
      { id: conversationId }
    );

    console.log(`✅ IA reativada para conversa ${conversationId}`);

    return { success: true };

  } catch (error) {
    console.error('❌ Erro ao reativar IA:', error);
    throw error;
  }
}

module.exports = {
  processIncomingMessage,
  processInviteAccepted,
  disableAIForConversation,
  enableAIForConversation,
  getConversationDetails,
  getConversationHistory
};
