// backend/src/services/conversationAutomationService.js

const db = require('../config/database');
const unipileClient = require('../config/unipile');
const aiResponseService = require('./aiResponseService');
const contactExtractionService = require('./contactExtractionService');
const conversationSummaryService = require('./conversationSummaryService');
const stripeService = require('./stripeService');
const handoffService = require('./handoffService');
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

    // Buscar account_id da conversa
    const accountResult = await db.query(
      `SELECT c.user_id, u.account_id
       FROM conversations c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = $1`,
      [conversation_id]
    );
    const accountId = accountResult.rows[0]?.account_id;

    // Verificar se tem créditos de IA disponíveis
    if (accountId) {
      const hasCredits = await stripeService.hasEnoughAiCredits(accountId, 1);
      if (!hasCredits) {
        console.log(`⚠️ Conta ${accountId} sem créditos de IA. Desativando automação.`);

        // Desativar IA para esta conversa
        await db.update(
          'conversations',
          {
            ai_active: false,
            updated_at: new Date()
          },
          { id: conversation_id }
        );

        return {
          processed: false,
          reason: 'insufficient_ai_credits'
        };
      }
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

    // Buscar contexto otimizado da conversa (resumo + mensagens recentes)
    const conversationContext = await getConversationContext(conversation_id);

    console.log(`📊 Context stats: ${conversationContext.stats.totalMessages} total messages, ` +
                `${conversationContext.stats.recentMessagesCount} recent, ` +
                `${conversationContext.stats.totalTokens} tokens ` +
                `(summary: ${conversationContext.stats.hasSummary ? 'YES' : 'NO'})`);

    // Gerar resposta usando IA
    // Usar current_step da conversa para tracking de etapas
    const currentStep = conversation.current_step || 0;
    console.log(`🤖 Gerando resposta IA... (etapa atual: ${currentStep + 1})`);

    const aiResponse = await aiResponseService.generateResponse({
      conversation_id,
      lead_message: message_content,
      conversation_context: conversationContext, // New format with summary
      ai_agent: conversation.ai_agent,
      lead_data: conversation.lead_data,
      current_step: currentStep, // Pass current step for stage tracking
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

    // Atualizar conversa (incluindo step se avançou)
    const conversationUpdate = {
      last_message_at: new Date(),
      last_message_preview: aiResponse.response.substring(0, 100)
    };

    // Persistir current_step se houve avanço de etapa
    if (aiResponse.step_advanced) {
      conversationUpdate.current_step = aiResponse.current_step;
      conversationUpdate.step_advanced_at = new Date();

      // Atualizar step_history
      const stepHistoryEntry = {
        from_step: currentStep,
        to_step: aiResponse.current_step,
        advanced_at: new Date().toISOString(),
        trigger: 'ai_detected_completion'
      };

      await db.query(
        `UPDATE conversations
         SET step_history = COALESCE(step_history, '[]'::jsonb) || $1::jsonb
         WHERE id = $2`,
        [JSON.stringify([stepHistoryEntry]), conversation_id]
      );

      console.log(`📈 Etapa avançada: ${currentStep + 1} → ${aiResponse.current_step + 1}`);
    }

    await db.update('conversations', conversationUpdate, { id: conversation_id });

    // Atualizar status do lead baseado na intenção
    if (aiResponse.intent) {
      await updateLeadStatusByIntent(conversation.lead_id, aiResponse.intent);
    }

    // Consumir 1 crédito de IA após envio bem-sucedido
    if (accountId) {
      const consumed = await stripeService.consumeAiCredits(
        accountId,
        1,
        conversation.ai_agent_id,
        conversation_id,
        conversation.user_id,
        `AI response sent to ${conversation.lead_name}`
      );

      if (consumed) {
        console.log(`💰 1 crédito de IA consumido para conta ${accountId}`);
      } else {
        console.warn(`⚠️ Falha ao consumir crédito de IA (mensagem já enviada)`);
      }
    }

    // ========================================
    // HANDOFF LOGIC: Check if we should transfer to human
    // ========================================
    let handoffExecuted = false;
    const agent = conversation.ai_agent;

    // Increment exchange count (1 exchange = lead message + AI response)
    const newExchangeCount = await handoffService.incrementExchangeCount(conversation_id);

    // Priority 1: Check if AI requested transfer via [TRANSFER] tag
    if (aiResponse.aiRequestedTransfer) {
      console.log(`🔄 Handoff triggered: AI detected transfer trigger and requested transfer`);
      await handoffService.executeHandoff(conversation_id, agent, 'trigger_ai_requested');
      handoffExecuted = true;
    }

    // Priority 2: Check transfer triggers from lead's message (new system)
    if (!handoffExecuted && agent && agent.transfer_triggers && agent.transfer_triggers.length > 0) {
      const triggerResult = handoffService.checkTransferTriggers(message_content, agent);

      if (triggerResult.shouldTransfer) {
        console.log(`🔄 Handoff triggered: ${triggerResult.reasonText} (triggers: ${triggerResult.matchedTriggers.join(', ')})`);
        await handoffService.executeHandoff(conversation_id, agent, triggerResult.reason);
        handoffExecuted = true;
      }
    }

    // Priority 3: Check legacy handoff_after_exchanges (for backward compatibility)
    if (!handoffExecuted && agent && agent.handoff_after_exchanges) {
      const shouldHandoff = await handoffService.shouldTriggerHandoff(
        conversation_id,
        agent.handoff_after_exchanges
      );

      if (shouldHandoff) {
        console.log(`🔄 Handoff triggered: exchange count (${newExchangeCount}) >= limit (${agent.handoff_after_exchanges})`);

        await handoffService.executeHandoff(conversation_id, agent, 'exchange_limit');
        handoffExecuted = true;
      }
    }

    // Priority 4: Check for escalation triggers (sentiment/keywords - legacy system)
    if (!handoffExecuted && aiResponse.shouldEscalate) {
      const escalationReason = aiResponse.escalationReasons?.[0] || 'escalation_detected';
      console.log(`🔄 Escalation handoff triggered: ${escalationReason}`);

      await handoffService.executeHandoff(conversation_id, agent, escalationReason.includes('keyword') ? 'escalation_keyword' : 'escalation_sentiment');
      handoffExecuted = true;
    }

    console.log(`✅ Resposta automática enviada com sucesso${handoffExecuted ? ' (handoff executado)' : ''}`);

    return {
      processed: true,
      response_sent: aiResponse.response,
      intent: aiResponse.intent,
      should_notify_user: ['ready_to_buy', 'objection'].includes(aiResponse.intent),
      handoff_executed: handoffExecuted,
      exchange_count: newExchangeCount
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
      const connectionStrategy = aiAgent.connection_strategy || 'silent';
      console.log(`💬 Processando convite aceito com estratégia: ${connectionStrategy}`);

      // ESTRATÉGIA SILENCIOSA: Se tiver post_accept_message, enviar. Senão, aguardar lead iniciar
      if (connectionStrategy === 'silent') {
        // Se não tem post_accept_message, aguardar lead iniciar
        if (!aiAgent.post_accept_message) {
          console.log(`🔇 Estratégia silenciosa: aguardando lead iniciar conversa`);
          return {
            processed: true,
            conversation_id: conversationId,
            initial_message_sent: false,
            reason: 'silent_strategy'
          };
        }
        // Se tem post_accept_message, prosseguir para enviar (vai usar a lógica de with-intro abaixo)
        console.log(`🔇 Estratégia silenciosa com mensagem pós-aceite configurada`);
      }

      // ESTRATÉGIA ICEBREAKER COM require_lead_reply: Aguardar lead responder
      // (O convite já foi enviado com mensagem curta, agora aguarda resposta do lead)
      if (connectionStrategy === 'icebreaker') {
        // Para icebreaker, o convite já tinha uma mensagem curta
        // Aguardamos o lead responder antes de enviar mais mensagens
        console.log(`❄️ Estratégia icebreaker: aguardando lead responder ao convite`);
        return {
          processed: true,
          conversation_id: conversationId,
          initial_message_sent: false,
          reason: 'icebreaker_awaiting_reply'
        };
      }

      // ESTRATÉGIA WITH-INTRO ou SILENT com post_accept_message: Enviar mensagem pós-aceite
      console.log(`📝 Estratégia ${connectionStrategy}: gerando mensagem pós-aceite...`);

      // Buscar account_id do usuário
      const userResult = await db.query(
        'SELECT account_id FROM users WHERE id = $1',
        [campaign.user_id]
      );
      const accountId = userResult.rows[0]?.account_id;

      // Verificar se tem créditos de IA disponíveis
      if (accountId) {
        const hasCredits = await stripeService.hasEnoughAiCredits(accountId, 1);
        if (!hasCredits) {
          console.log(`⚠️ Conta ${accountId} sem créditos de IA. Não enviando mensagem inicial.`);
          return {
            processed: true,
            conversation_id: conversationId,
            initial_message_sent: false,
            reason: 'insufficient_ai_credits'
          };
        }
      }

      // Determinar a mensagem a enviar:
      // 1. Se há post_accept_message configurado, usar ele
      // 2. Caso contrário, gerar com IA (diferente do convite)
      let postAcceptMessage = aiAgent.post_accept_message;

      if (!postAcceptMessage) {
        // Gerar mensagem com IA (garantindo que seja diferente do convite)
        postAcceptMessage = await aiResponseService.generateInitialMessage({
          ai_agent: aiAgent,
          lead_data: leadData,
          campaign
        });
      } else {
        // Processar variáveis no template
        const TemplateProcessor = require('../utils/templateProcessor');
        const leadDataProcessed = TemplateProcessor.extractLeadData(leadData);
        postAcceptMessage = TemplateProcessor.processTemplate(postAcceptMessage, leadDataProcessed);
      }

      console.log(`✅ Mensagem pós-aceite: "${postAcceptMessage.substring(0, 50)}..."`);

      // Aguardar tempo configurado (mais longo para with-intro: 30-60 segundos)
      // Isso simula comportamento humano de não responder imediatamente
      const delay = 30000 + Math.random() * 30000; // 30-60 segundos
      console.log(`⏳ Aguardando ${Math.round(delay/1000)}s antes de enviar (comportamento humano)...`);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Enviar mensagem pós-aceite
      await sendAutomatedReply({
        conversation_id: conversationId,
        response: postAcceptMessage,
        unipile_account_id: linkedinAccount.unipile_account_id,
        lead_unipile_id: lead_unipile_id
      });

      // Salvar mensagem no banco
      await saveMessage({
        conversation_id: conversationId,
        sender_type: 'ai',
        content: postAcceptMessage,
        ai_intent: 'initial_contact',
        sent_at: new Date()
      });

      // Atualizar conversa
      await db.update(
        'conversations',
        {
          last_message_at: new Date(),
          last_message_preview: postAcceptMessage.substring(0, 100)
        },
        { id: conversationId }
      );

      // Consumir 1 crédito de IA após envio bem-sucedido
      if (accountId) {
        const consumed = await stripeService.consumeAiCredits(
          accountId,
          1,
          aiAgent.id,
          conversationId,
          campaign.user_id,
          `Post-accept AI message sent to ${leadData.name}`
        );

        if (consumed) {
          console.log(`💰 1 crédito de IA consumido para conta ${accountId}`);
        }
      }

      console.log(`✅ Mensagem pós-aceite enviada automaticamente`);

      return {
        processed: true,
        conversation_id: conversationId,
        initial_message_sent: true,
        message: postAcceptMessage,
        connection_strategy: connectionStrategy
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
      conv.current_step,
      conv.step_history,
      conv.step_advanced_at,
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
      aa.response_style_instructions,
      aa.priority_rules,
      aa.objective,
      aa.tone,
      aa.language,
      aa.target_audience,
      aa.escalation_rules,
      aa.escalation_keywords,
      aa.escalation_sentiments,
      aa.conversation_steps,
      aa.knowledge_similarity_threshold,
      aa.max_messages_before_transfer,
      aa.handoff_after_exchanges,
      aa.connection_strategy,
      aa.post_accept_message,
      aa.transfer_triggers
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
      response_style_instructions: row.response_style_instructions,
      priority_rules: row.priority_rules || [],
      objective: row.objective,
      tone: row.tone,
      language: row.language,
      target_audience: row.target_audience,
      escalation_rules: row.escalation_rules,
      escalation_keywords: row.escalation_keywords,
      escalation_sentiments: row.escalation_sentiments,
      conversation_steps: row.conversation_steps,
      knowledge_similarity_threshold: row.knowledge_similarity_threshold,
      max_messages_before_transfer: row.max_messages_before_transfer,
      handoff_after_exchanges: row.handoff_after_exchanges,
      connection_strategy: row.connection_strategy,
      post_accept_message: row.post_accept_message,
      transfer_triggers: row.transfer_triggers || []
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
 * DEPRECATED: Use getConversationContext() instead for better performance
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
 * Get optimized conversation context with progressive summary
 * Uses summary for old messages + recent messages in full
 * @param {string} conversationId
 * @returns {Promise<object>} Context with summary and recent messages
 */
async function getConversationContext(conversationId) {
  try {
    const context = await conversationSummaryService.getContextForAI(conversationId);
    return context;
  } catch (error) {
    console.error('⚠️ Error getting conversation context, falling back to basic history:', error.message);
    // Fallback to old method if summary service fails
    const messages = await getConversationHistory(conversationId, 20);
    return {
      summary: null,
      recentMessages: messages,
      stats: {
        totalMessages: messages.length,
        recentMessagesCount: messages.length,
        summaryTokens: 0,
        recentTokens: 0,
        totalTokens: 0,
        hasSummary: false,
      }
    };
  }
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
  getConversationHistory,
  getConversationContext
};
