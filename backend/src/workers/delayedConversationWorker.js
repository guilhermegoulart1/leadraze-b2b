// backend/src/workers/delayedConversationWorker.js

const { delayedConversationQueue } = require('../queues');
const db = require('../config/database');
const unipileClient = require('../config/unipile');
const aiResponseService = require('../services/aiResponseService');
const TemplateProcessor = require('../utils/templateProcessor');

/**
 * Delayed Conversation Worker
 *
 * Inicia conversas automaticamente após 5 minutos se o lead
 * não enviar mensagem após aceitar o convite
 */

/**
 * Verificar se lead já enviou mensagem
 * @param {string} conversationId - ID da conversa
 * @returns {Promise<boolean>} True se lead já respondeu
 */
async function hasLeadReplied(conversationId) {
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
 * Buscar dados do lead e campanha
 * @param {string} leadId - ID do lead
 * @returns {Promise<Object>} Dados do lead e campanha
 */
async function getLeadAndCampaign(leadId) {
  const result = await db.query(
    `SELECT
      l.id as lead_id,
      l.name as lead_name,
      l.title,
      l.company,
      l.location,
      l.industry,
      l.profile_url,
      l.headline,
      l.summary,
      l.campaign_id,
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
    FROM leads l
    LEFT JOIN campaigns c ON l.campaign_id = c.id
    LEFT JOIN ai_agents ai ON c.ai_agent_id = ai.id
    LEFT JOIN linkedin_accounts la ON c.linkedin_account_id = la.id
    WHERE l.id = $1`,
    [leadId]
  );

  if (!result.rows || result.rows.length === 0) {
    throw new Error('Lead not found');
  }

  return result.rows[0];
}

/**
 * Gerar mensagem inicial da IA
 * Usa aiResponseService.generateInitialMessage() para garantir consistencia
 * com o Test Mode e usar todas as configuracoes do agente (Contratar Vendedor)
 * @param {Object} leadData - Dados do lead e campanha
 * @returns {Promise<string>} Mensagem gerada
 */
async function generateInitialMessage(leadData) {
  // Montar objeto ai_agent com todos os campos necessarios
  const ai_agent = {
    id: leadData.ai_agent_id,
    name: leadData.ai_agent_name,
    initial_approach: leadData.initial_approach,
    objective: leadData.objective,
    behavioral_profile: leadData.behavioral_profile,
    tone: leadData.tone,
    language: leadData.language,
    system_prompt: leadData.system_prompt,
    products_services: leadData.products_services,
    response_style_instructions: leadData.response_style_instructions,
    auto_schedule: leadData.auto_schedule,
    scheduling_link: leadData.scheduling_link,
    intent_detection_enabled: leadData.intent_detection_enabled,
    priority_rules: leadData.priority_rules,
    target_audience: leadData.target_audience,
    escalation_rules: leadData.escalation_rules,
    max_messages_before_transfer: leadData.max_messages_before_transfer,
    agent_type: 'linkedin' // Sempre LinkedIn neste worker
  };

  // Montar objeto lead_data para o aiResponseService
  const lead_data = {
    name: leadData.lead_name,
    title: leadData.title,
    company: leadData.company,
    location: leadData.location,
    industry: leadData.industry,
    headline: leadData.headline,
    summary: leadData.summary,
    profile_url: leadData.profile_url
  };

  // Usar aiResponseService.generateInitialMessage para consistencia com Test Mode
  const message = await aiResponseService.generateInitialMessage({
    ai_agent,
    lead_data,
    campaign: {
      id: leadData.campaign_id,
      name: leadData.campaign_name
    }
  });

  return message;
}

/**
 * Processar início de conversa automático
 * @param {Object} job - Job da fila Bull
 */
async function processDelayedConversation(job) {
  const { leadId, conversationId } = job.data;

  console.log(`\n💬 Processando início de conversa - Lead: ${leadId}, Conversation: ${conversationId}`);

  try {
    // Verificar se conversa ainda existe e está ativa
    const conversationResult = await db.query(
      `SELECT id, status, lead_id, unipile_chat_id
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

    // Verificar se lead já enviou mensagem
    const leadReplied = await hasLeadReplied(conversationId);

    if (leadReplied) {
      console.log('✅ Lead já enviou mensagem, conversa já iniciada');
      return { canceled: true, reason: 'lead_already_replied' };
    }

    // Buscar dados do lead e campanha
    const leadData = await getLeadAndCampaign(leadId);

    if (!leadData.unipile_account_id) {
      throw new Error('LinkedIn account not configured');
    }

    // Gerar mensagem inicial
    console.log('🤖 Gerando mensagem inicial via IA...');
    const message = await generateInitialMessage(leadData);

    console.log(`📤 Mensagem gerada (${message.length} chars):`, message.substring(0, 100) + '...');

    // Enviar mensagem via Unipile
    const unipileResponse = await unipileClient.messages.send({
      account_id: leadData.unipile_account_id,
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
      leadId,
      conversationId,
      messageLength: message.length,
      leadName: leadData.lead_name
    };

  } catch (error) {
    console.error('❌ Erro ao iniciar conversa automática:', error.message);
    throw error;
  }
}

/**
 * Agendar início de conversa com delay configurável
 * @param {string} leadId - ID do lead
 * @param {string} conversationId - ID da conversa
 * @param {number} delayMs - Delay em milissegundos (opcional, padrão: 5 minutos)
 * @returns {Promise<Object>} Job agendado
 */
async function scheduleDelayedConversation(leadId, conversationId, delayMs = null) {
  const DEFAULT_DELAY = 5 * 60 * 1000; // 5 minutos em ms
  const actualDelay = delayMs || DEFAULT_DELAY;
  const delayMinutes = Math.round(actualDelay / 60000);

  console.log(`📅 Agendando início de conversa para daqui ${delayMinutes} minuto(s) - Lead: ${leadId}`);

  const job = await delayedConversationQueue.add(
    {
      leadId,
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
 * (quando lead envia mensagem antes dos 5 minutos)
 * @param {string} leadId - ID do lead
 * @returns {Promise<boolean>} True se cancelou algum job
 */
async function cancelDelayedConversation(leadId) {
  console.log(`🛑 Cancelando início de conversa agendado - Lead: ${leadId}`);

  try {
    // Buscar jobs pendentes
    const waitingJobs = await delayedConversationQueue.getWaiting();
    const delayedJobs = await delayedConversationQueue.getDelayed();

    const allPendingJobs = [...waitingJobs, ...delayedJobs];

    let canceledCount = 0;

    for (const job of allPendingJobs) {
      if (job.data.leadId === leadId) {
        await job.remove();
        canceledCount++;
        console.log(`✅ Job ${job.id} cancelado`);
      }
    }

    if (canceledCount === 0) {
      console.log('ℹ️ Nenhum job pendente encontrado para este lead');
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
    console.log(`✅ Job ${job.id} concluído: conversa iniciada para ${result.leadName}`);
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
