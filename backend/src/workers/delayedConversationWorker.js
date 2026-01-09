// backend/src/workers/delayedConversationWorker.js

const { delayedConversationQueue } = require('../queues');
const db = require('../config/database');
const unipileClient = require('../config/unipile');
const aiResponseService = require('../services/aiResponseService');
const TemplateProcessor = require('../utils/templateProcessor');

/**
 * Delayed Conversation Worker
 *
 * Inicia conversas automaticamente após 5 minutos se o contato
 * não enviar mensagem após aceitar o convite
 */

/**
 * Verificar se contato já enviou mensagem
 * @param {string} conversationId - ID da conversa
 * @returns {Promise<boolean>} True se contato já respondeu
 */
async function hasContactReplied(conversationId) {
  const result = await db.query(
    `SELECT COUNT(*) as count
     FROM messages
     WHERE conversation_id = $1
       AND sender_type = 'lead'
     LIMIT 1`,
    [conversationId]
  );

  return result.rows[0].count > 0;
}

/**
 * Buscar dados da opportunity e campanha
 * @param {string} opportunityId - ID da opportunity
 * @returns {Promise<Object>} Dados da opportunity, contato e campanha
 */
async function getOpportunityAndCampaign(opportunityId) {
  const result = await db.query(
    `SELECT
      o.id as opportunity_id,
      o.title as opportunity_title,
      o.campaign_id,
      ct.id as contact_id,
      ct.name as contact_name,
      ct.title,
      ct.company,
      ct.city as location,
      ct.industry,
      ct.profile_url,
      ct.headline,
      ct.about as summary,
      c.name as campaign_name,
      c.ai_agent_id,
      c.linkedin_account_id,
      ai.name as ai_agent_name,
      ai.initial_approach,
      ai.objective,
      ai.behavioral_profile,
      ai.tone,
      ai.language,
      ai.system_prompt,
      ai.products_services,
      ai.response_style_instructions,
      ai.auto_schedule,
      ai.scheduling_link,
      ai.intent_detection_enabled,
      ai.priority_rules,
      ai.target_audience,
      ai.escalation_rules,
      ai.max_messages_before_transfer,
      la.unipile_account_id
    FROM opportunities o
    LEFT JOIN contacts ct ON o.contact_id = ct.id
    LEFT JOIN campaigns c ON o.campaign_id = c.id
    LEFT JOIN ai_agents ai ON c.ai_agent_id = ai.id
    LEFT JOIN linkedin_accounts la ON c.linkedin_account_id = la.id
    WHERE o.id = $1`,
    [opportunityId]
  );

  if (!result.rows || result.rows.length === 0) {
    throw new Error('Opportunity not found');
  }

  return result.rows[0];
}

/**
 * Gerar mensagem inicial da IA
 * Usa aiResponseService.generateInitialMessage() para garantir consistencia
 * com o Test Mode e usar todas as configuracoes do agente (Contratar Vendedor)
 * @param {Object} opportunityData - Dados da opportunity, contato e campanha
 * @returns {Promise<string>} Mensagem gerada
 */
async function generateInitialMessage(opportunityData) {
  // Montar objeto ai_agent com todos os campos necessarios
  const ai_agent = {
    id: opportunityData.ai_agent_id,
    name: opportunityData.ai_agent_name,
    initial_approach: opportunityData.initial_approach,
    objective: opportunityData.objective,
    behavioral_profile: opportunityData.behavioral_profile,
    tone: opportunityData.tone,
    language: opportunityData.language,
    system_prompt: opportunityData.system_prompt,
    products_services: opportunityData.products_services,
    response_style_instructions: opportunityData.response_style_instructions,
    auto_schedule: opportunityData.auto_schedule,
    scheduling_link: opportunityData.scheduling_link,
    intent_detection_enabled: opportunityData.intent_detection_enabled,
    priority_rules: opportunityData.priority_rules,
    target_audience: opportunityData.target_audience,
    escalation_rules: opportunityData.escalation_rules,
    max_messages_before_transfer: opportunityData.max_messages_before_transfer,
    agent_type: 'linkedin' // Sempre LinkedIn neste worker
  };

  // Montar objeto lead_data para o aiResponseService (mantendo nome lead_data por compatibilidade com aiResponseService)
  const lead_data = {
    name: opportunityData.contact_name,
    title: opportunityData.title,
    company: opportunityData.company,
    location: opportunityData.location,
    industry: opportunityData.industry,
    headline: opportunityData.headline,
    summary: opportunityData.summary,
    profile_url: opportunityData.profile_url
  };

  // Usar aiResponseService.generateInitialMessage para consistencia com Test Mode
  const message = await aiResponseService.generateInitialMessage({
    ai_agent,
    lead_data,
    campaign: {
      id: opportunityData.campaign_id,
      name: opportunityData.campaign_name
    }
  });

  return message;
}

/**
 * Processar início de conversa automático
 * @param {Object} job - Job da fila Bull
 */
async function processDelayedConversation(job) {
  const { opportunityId, conversationId } = job.data;

  console.log(`\n💬 Processando início de conversa - Opportunity: ${opportunityId}, Conversation: ${conversationId}`);

  try {
    // Verificar se conversa ainda existe e está ativa
    const conversationResult = await db.query(
      `SELECT id, status, opportunity_id, unipile_chat_id
       FROM conversations
       WHERE id = $1`,
      [conversationId]
    );

    if (!conversationResult.rows || conversationResult.rows.length === 0) {
      console.log('⚠️ Conversa não encontrada, cancelando');
      return { canceled: true, reason: 'conversation_not_found' };
    }

    const conversation = conversationResult.rows[0];

    // Verificar se IA ainda está ativa
    if (conversation.status !== 'ai_active') {
      console.log(`⚠️ IA não está ativa (status: ${conversation.status}), cancelando`);
      return { canceled: true, reason: 'ai_not_active' };
    }

    // Verificar se contato já enviou mensagem
    const contactReplied = await hasContactReplied(conversationId);

    if (contactReplied) {
      console.log('✅ Contato já enviou mensagem, conversa já iniciada');
      return { canceled: true, reason: 'contact_already_replied' };
    }

    // Buscar dados da opportunity e campanha
    const opportunityData = await getOpportunityAndCampaign(opportunityId);

    if (!opportunityData.unipile_account_id) {
      throw new Error('LinkedIn account not configured');
    }

    // Gerar mensagem inicial
    console.log('🤖 Gerando mensagem inicial via IA...');
    const message = await generateInitialMessage(opportunityData);

    console.log(`📤 Mensagem gerada (${message.length} chars):`, message.substring(0, 100) + '...');

    // Enviar mensagem via Unipile
    const unipileResponse = await unipileClient.messages.send({
      account_id: opportunityData.unipile_account_id,
      attendee_id: conversation.unipile_chat_id,
      text: message,
      type: 'TEXT'
    });

    console.log('✅ Mensagem enviada via Unipile');

    // Salvar mensagem no banco de dados
    await db.insert('messages', {
      conversation_id: conversationId,
      sender_type: 'ai',
      content: message,
      unipile_message_id: unipileResponse.object?.id || null,
      created_at: new Date()
    });

    // Atualizar last_message_at da conversa
    await db.update(
      'conversations',
      {
        last_message_at: new Date(),
        updated_at: new Date()
      },
      { id: conversationId }
    );

    console.log('✅ Conversa iniciada automaticamente com sucesso');

    return {
      success: true,
      opportunityId,
      conversationId,
      messageLength: message.length,
      contactName: opportunityData.contact_name
    };

  } catch (error) {
    console.error('❌ Erro ao iniciar conversa automática:', error.message);
    throw error;
  }
}

/**
 * Agendar início de conversa com delay configurável
 * @param {string} opportunityId - ID da opportunity
 * @param {string} conversationId - ID da conversa
 * @param {number} delayMs - Delay em milissegundos (opcional, padrão: 5 minutos)
 * @returns {Promise<Object>} Job agendado
 */
async function scheduleDelayedConversation(opportunityId, conversationId, delayMs = null) {
  const DEFAULT_DELAY = 5 * 60 * 1000; // 5 minutos em ms
  const actualDelay = delayMs || DEFAULT_DELAY;
  const delayMinutes = Math.round(actualDelay / 60000);

  console.log(`📅 Agendando início de conversa para daqui ${delayMinutes} minuto(s) - Opportunity: ${opportunityId}`);

  const job = await delayedConversationQueue.add(
    {
      opportunityId,
      conversationId
    },
    {
      delay: actualDelay,
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: true,
      removeOnFail: {
        age: 24 * 3600 // 24 horas
      }
    }
  );

  console.log(`✅ Job agendado - ID: ${job.id} (delay: ${delayMinutes} min)`);

  return job;
}

/**
 * Cancelar início de conversa agendado
 * (quando contato envia mensagem antes dos 5 minutos)
 * @param {string} opportunityId - ID da opportunity
 * @returns {Promise<boolean>} True se cancelou algum job
 */
async function cancelDelayedConversation(opportunityId) {
  console.log(`🛑 Cancelando início de conversa agendado - Opportunity: ${opportunityId}`);

  try {
    // Buscar jobs pendentes
    const waitingJobs = await delayedConversationQueue.getWaiting();
    const delayedJobs = await delayedConversationQueue.getDelayed();

    const allPendingJobs = [...waitingJobs, ...delayedJobs];

    let canceledCount = 0;

    for (const job of allPendingJobs) {
      if (job.data.opportunityId === opportunityId) {
        await job.remove();
        canceledCount++;
        console.log(`✅ Job ${job.id} cancelado`);
      }
    }

    if (canceledCount === 0) {
      console.log('ℹ️ Nenhum job pendente encontrado para esta opportunity');
    }

    return canceledCount > 0;

  } catch (error) {
    console.error('❌ Erro ao cancelar início de conversa:', error);
    return false;
  }
}

// Processar jobs da fila
delayedConversationQueue.process(async (job) => {
  return await processDelayedConversation(job);
});

// Event handlers
delayedConversationQueue.on('completed', (job, result) => {
  if (result.canceled) {
    console.log(`⏭️  Job ${job.id} cancelado: ${result.reason}`);
  } else {
    console.log(`✅ Job ${job.id} concluído: conversa iniciada para ${result.contactName}`);
  }
});

delayedConversationQueue.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} falhou:`, err.message);
});

delayedConversationQueue.on('stalled', (job) => {
  console.warn(`⚠️ Job ${job.id} travou, será reprocessado`);
});

module.exports = {
  scheduleDelayedConversation,
  cancelDelayedConversation,
  processDelayedConversation
};
