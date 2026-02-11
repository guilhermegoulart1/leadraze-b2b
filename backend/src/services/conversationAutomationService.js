// backend/src/services/conversationAutomationService.js

const db = require('../config/database');
const unipileClient = require('../config/unipile');
const aiResponseService = require('./aiResponseService');
const contactExtractionService = require('./contactExtractionService');
const conversationSummaryService = require('./conversationSummaryService');
const stripeService = require('./stripeService');
const handoffService = require('./handoffService');
const workflowExecutionService = require('./workflowExecutionService');
const workflowStateService = require('./workflowStateService');
const transferRuleService = require('./transferRuleService');
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
        conversation.opportunity_id,
        message_content
      );

      if (extractionResult.extracted) {
        console.log(`📧📞 Contatos capturados da opportunity ${conversation.opportunity_id}:`, extractionResult.contacts);
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

    // ========================================
    // WORKFLOW ENGINE: Process message through workflow
    // ========================================
    const agent = conversation.ai_agent;

    // Agente DEVE ter workflow definido (modelo antigo não é mais suportado)
    if (!agent?.workflow_definition) {
      console.error(`❌ Agente ${agent?.id || 'N/A'} não tem workflow definido`);
      return {
        processed: false,
        reason: 'no_workflow_definition',
        error: 'Este agente não possui um workflow definido. Por favor, configure o workflow no editor visual.'
      };
    }

    console.log(`🔄 Processing message through Workflow Engine for conversation ${conversation_id}`);

    // Cancel any pending follow-up jobs since lead responded
    try {
      const { cancelScheduledJobs } = require('../workers/followUpWorker');
      const cancelled = await cancelScheduledJobs(conversation_id);
      if (cancelled > 0) {
        console.log(`🛑 Cancelled ${cancelled} follow-up job(s) for conversation ${conversation_id} (lead responded)`);
      }
    } catch (cancelErr) {
      console.error(`⚠️ Error cancelling follow-up jobs:`, cancelErr.message);
    }

    // Process through workflow engine
    const workflowResult = await workflowExecutionService.processEvent(
      conversation_id,
      'message_received',
      {
        message: message_content,
        conversationContext,
        lead: conversation.lead_data
      },
      {
        agentId: agent.id,
        accountId
      }
    );

    // Consumir crédito se gerou resposta
    if (accountId && workflowResult.response) {
      const consumed = await stripeService.consumeAiCredits(
        accountId,
        1,
        agent.id,
        conversation_id,
        conversation.user_id,
        `Workflow AI response to ${conversation.lead_name}`
      );

      if (consumed) {
        console.log(`💰 1 crédito de IA consumido para conta ${accountId}`);
      }
    }

    console.log(`✅ Workflow processed message, executed ${workflowResult.executedNodes?.length || 0} nodes`);

    // ========================================
    // ENRIQUECIMENTO: Atualizar contact com dados extraídos pela IA
    // ========================================
    if (workflowResult.enrichedData?.extractedData) {
      try {
        await updateContactWithExtractedData(
          conversation.opportunity_id,
          workflowResult.enrichedData.extractedData
        );
      } catch (error) {
        console.error('⚠️ Erro ao atualizar contact com dados extraídos:', error.message);
      }
    }

    // Atualizar qualificação da conversa se disponível
    if (workflowResult.enrichedData?.qualification) {
      try {
        await updateConversationQualification(
          conversation_id,
          workflowResult.enrichedData.qualification
        );
      } catch (error) {
        console.error('⚠️ Erro ao atualizar qualificação:', error.message);
      }
    }

    // Registrar objeção se detectada
    if (workflowResult.enrichedData?.objection?.detected) {
      try {
        await saveObjectionRecord(
          conversation_id,
          workflowResult.enrichedData.objection
        );
      } catch (error) {
        console.error('Erro ao registrar objeção:', error.message);
      }
    }

    // ========================================
    // GLOBAL TRANSFER RULES: Evaluate after workflow
    // Only if workflow didn't already trigger a transfer (completed = endsBranch from transfer action)
    // ========================================
    let transferRuleMatch = null;
    if (!workflowResult.completed) {
      try {
        // Get exchange count for exchange_limit rules
        const exchResult = await db.query(
          'SELECT exchange_count FROM conversations WHERE id = $1',
          [conversation_id]
        );
        const exchangeCount = exchResult.rows[0]?.exchange_count || 0;

        // Check for AI-signaled transfer rule
        const lastConvNode = [...(workflowResult.executedNodes || [])].reverse()
          .find(n => n.nodeType === 'conversationStep');
        const ruleIdFromAI = lastConvNode?.result?.transferRuleIdFromAI || null;

        transferRuleMatch = await transferRuleService.evaluateTransferRules(
          agent.id,
          message_content,
          {
            exchangeCount,
            aiResponse: workflowResult.response,
            ruleIdFromAI
          }
        );

        if (transferRuleMatch.shouldTransfer) {
          console.log(`[TransferRule] Global rule matched: "${transferRuleMatch.matchedRule.name}" - executing transfer`);
          await transferRuleService.executeTransferFromRule(
            conversation_id,
            transferRuleMatch.matchedRule,
            agent
          );
        }
      } catch (trError) {
        console.error('Erro ao avaliar regras de transferência:', trError.message);
      }
    }

    return {
      processed: workflowResult.processed || true,
      response_sent: workflowResult.response,
      workflow: true,
      executedNodes: workflowResult.executedNodes?.length || 0,
      paused: workflowResult.paused,
      completed: workflowResult.completed,
      actions: workflowResult.executedActions || [],
      enrichedData: workflowResult.enrichedData || null,
      transferRuleMatch: transferRuleMatch?.shouldTransfer ? {
        ruleName: transferRuleMatch.matchedRule.name,
        reason: transferRuleMatch.reasonText
      } : null
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
    opportunity_id,
    campaign_id,
    linkedin_account_id,
    lead_unipile_id
  } = params;

  try {
    console.log(`🎉 Processando convite aceito para opportunity ${opportunity_id}`);

    // Buscar dados da opportunity, contact e campanha
    const opportunityData = await db.findOne('opportunities', { id: opportunity_id });
    const campaign = await db.findOne('campaigns', { id: campaign_id });
    const linkedinAccount = await db.findOne('linkedin_accounts', { id: linkedin_account_id });

    if (!opportunityData || !campaign || !linkedinAccount) {
      throw new Error('Opportunity, campaign or LinkedIn account not found');
    }

    // Buscar contact data para templates (leadData para compatibilidade)
    let leadData = {};
    if (opportunityData.contact_id) {
      const contactData = await db.findOne('contacts', { id: opportunityData.contact_id });
      if (contactData) {
        leadData = {
          id: contactData.id,
          name: contactData.name,
          email: contactData.email,
          phone: contactData.phone,
          company: contactData.company,
          title: contactData.title,
          headline: contactData.headline,
          linkedin_profile_id: contactData.linkedin_profile_id
        };
      }
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
      opportunity_id: opportunity_id,
      campaign_id: campaign_id,
      user_id: campaign.user_id,
      linkedin_account_id: linkedin_account_id,
      ai_agent_id: aiAgent?.id || null,
      status: 'ai_active',
      ai_active: true,
      manual_control_taken: false,
      is_connection: true,
      unread_count: 0,
      created_at: new Date()
    };

    await db.insert('conversations', conversationData);

    console.log(`✅ Conversa criada: ${conversationId}`);

    // Atualizar opportunity (aceite)
    await db.update(
      'opportunities',
      {
        accepted_at: new Date(),
        updated_at: new Date()
      },
      { id: opportunity_id }
    );

    // Atualizar log de convite
    await db.query(
      `UPDATE linkedin_invite_logs
       SET status = 'accepted'
       WHERE opportunity_id = $1
       AND status = 'sent'`,
      [opportunity_id]
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
      o.id as opportunity_id,
      ct.id as contact_id,
      ct.name as contact_name,
      ct.title as contact_title,
      ct.company as contact_company,
      ct.location as contact_location,
      ct.industry as contact_industry,
      ct.linkedin_profile_id as contact_unipile_id,
      ct.profile_picture as contact_picture,
      c.name as campaign_name,
      c.automation_active,
      la.unipile_account_id,
      aa.id as ai_agent_id,
      aa.name as ai_agent_name,
      aa.products_services,
      aa.behavioral_profile,
      aa.initial_approach,
      aa.auto_schedule,
      aa.scheduling_link,
      aa.intent_detection_enabled,
      aa.response_style_instructions,
      aa.priority_rules,
      aa.objective_instructions,
      aa.language,
      aa.target_audience,
      aa.escalation_keywords,
      aa.escalation_sentiments,
      aa.conversation_steps,
      aa.knowledge_similarity_threshold,
      aa.max_messages_before_transfer,
      aa.handoff_after_exchanges,
      aa.connection_strategy,
      aa.post_accept_message,
      aa.transfer_triggers,
      aa.workflow_definition,
      aa.workflow_enabled,
      aa.config
    FROM conversations conv
    LEFT JOIN opportunities o ON conv.opportunity_id = o.id
    LEFT JOIN contacts ct ON o.contact_id = ct.id
    LEFT JOIN campaigns c ON conv.campaign_id = c.id
    LEFT JOIN linkedin_accounts la ON conv.linkedin_account_id = la.id
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
      products_services: row.products_services,
      behavioral_profile: row.behavioral_profile,
      initial_approach: row.initial_approach,
      auto_schedule: row.auto_schedule,
      scheduling_link: row.scheduling_link,
      intent_detection_enabled: row.intent_detection_enabled,
      response_style_instructions: row.response_style_instructions,
      priority_rules: row.priority_rules || [],
      objective_instructions: row.objective_instructions,
      language: row.language,
      target_audience: row.target_audience,
      escalation_keywords: row.escalation_keywords,
      escalation_sentiments: row.escalation_sentiments,
      conversation_steps: row.conversation_steps,
      knowledge_similarity_threshold: row.knowledge_similarity_threshold,
      max_messages_before_transfer: row.max_messages_before_transfer,
      handoff_after_exchanges: row.handoff_after_exchanges,
      connection_strategy: row.connection_strategy,
      post_accept_message: row.post_accept_message,
      transfer_triggers: row.transfer_triggers || [],
      workflow_definition: row.workflow_definition,
      workflow_enabled: row.workflow_enabled,
      config: row.config || {}
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

/**
 * Atualizar contact com dados extraídos pela IA durante a conversa
 * @param {string} opportunityId - ID da opportunity
 * @param {Object} extractedData - Dados extraídos (email, phone, company, etc)
 */
async function updateContactWithExtractedData(opportunityId, extractedData) {
  if (!extractedData || Object.keys(extractedData).length === 0) {
    return;
  }

  // Mapear campos extraídos para campos do banco (contact)
  const fieldMapping = {
    email: 'email',
    phone: 'phone',
    company: 'company',
    role: 'title',  // role mapeia para title no banco
  };

  // Buscar opportunity para pegar o contact_id
  const opportunity = await db.findOne('opportunities', { id: opportunityId });
  if (!opportunity || !opportunity.contact_id) {
    console.log(`⚠️ Opportunity ${opportunityId} ou contact não encontrado para atualização`);
    return;
  }

  // Buscar contact atual para não sobrescrever dados existentes
  const currentContact = await db.findOne('contacts', { id: opportunity.contact_id });
  if (!currentContact) {
    console.log(`⚠️ Contact ${opportunity.contact_id} não encontrado para atualização`);
    return;
  }

  const contactUpdates = {};
  const updatedFields = [];

  for (const [extractedField, dbField] of Object.entries(fieldMapping)) {
    const value = extractedData[extractedField];
    // Só atualizar se o valor foi extraído E o campo atual está vazio
    if (value && !currentContact[dbField]) {
      contactUpdates[dbField] = value;
      updatedFields.push(dbField);
    }
  }

  // Atualizar opportunity com dados de qualificação (company_size, budget, timeline)
  const opportunityUpdates = {};
  if (extractedData.company_size && !opportunity.company_size) {
    opportunityUpdates.company_size = extractedData.company_size;
    updatedFields.push('company_size');
  }
  if (extractedData.budget && !opportunity.budget) {
    opportunityUpdates.budget = extractedData.budget;
    updatedFields.push('budget');
  }
  if (extractedData.timeline && !opportunity.timeline) {
    opportunityUpdates.timeline = extractedData.timeline;
    updatedFields.push('timeline');
  }

  if (Object.keys(contactUpdates).length > 0) {
    contactUpdates.updated_at = new Date();
    await db.update('contacts', contactUpdates, { id: opportunity.contact_id });
    console.log(`📋 Contact ${opportunity.contact_id} atualizado com dados extraídos`);
  }

  if (Object.keys(opportunityUpdates).length > 0) {
    opportunityUpdates.updated_at = new Date();
    await db.update('opportunities', opportunityUpdates, { id: opportunityId });
    console.log(`📋 Opportunity ${opportunityId} atualizada com dados de qualificação`);
  }

  if (updatedFields.length > 0) {
    console.log(`📋 Campos atualizados: ${updatedFields.join(', ')}`);
  }
}

/**
 * Atualizar qualificação da conversa
 * @param {string} conversationId - ID da conversa
 * @param {Object} qualification - Dados de qualificação (score, stage, reasons)
 */
async function updateConversationQualification(conversationId, qualification) {
  if (!qualification || typeof qualification.score !== 'number') {
    return;
  }

  await db.update(
    'conversations',
    {
      qualification_score: qualification.score,
      qualification_stage: qualification.stage || 'cold',
      qualification_reasons: JSON.stringify(qualification.reasons || []),
      updated_at: new Date()
    },
    { id: conversationId }
  );

  console.log(`⭐ Conversa ${conversationId} qualificada: ${qualification.score} (${qualification.stage})`);
}

/**
 * Registrar objeção detectada na conversa
 * @param {string} conversationId - ID da conversa
 * @param {Object} objection - Dados da objeção (type, text, severity)
 */
async function saveObjectionRecord(conversationId, objection) {
  if (!objection || !objection.detected) {
    return;
  }

  // Salvar na tabela de objeções (se existir) ou no JSON da conversa
  try {
    // Tentar inserir na tabela dedicada
    await db.insert('conversation_objections', {
      id: uuidv4(),
      conversation_id: conversationId,
      type: objection.type || 'unknown',
      text: objection.text || null,
      severity: objection.severity || 'medium',
      detected_at: new Date(),
      created_at: new Date()
    });

    console.log(`⚠️ Objeção registrada: ${objection.type} (${objection.severity})`);
  } catch (error) {
    // Se a tabela não existir, salvar no campo JSON da conversa
    if (error.code === '42P01') { // undefined_table
      console.log('ℹ️ Tabela conversation_objections não existe, salvando em conversations.objections_history');

      const conversation = await db.findOne('conversations', { id: conversationId });
      const objectionsHistory = conversation?.objections_history || [];
      objectionsHistory.push({
        type: objection.type,
        text: objection.text,
        severity: objection.severity,
        detected_at: new Date().toISOString()
      });

      await db.update(
        'conversations',
        { objections_history: JSON.stringify(objectionsHistory) },
        { id: conversationId }
      );
    } else {
      throw error;
    }
  }
}

module.exports = {
  processIncomingMessage,
  processInviteAccepted,
  disableAIForConversation,
  enableAIForConversation,
  getConversationDetails,
  getConversationHistory,
  getConversationContext,
  updateContactWithExtractedData,
  updateConversationQualification
};
