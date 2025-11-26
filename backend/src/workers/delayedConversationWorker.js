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
 * @param {Object} leadData - Dados do lead e campanha
 * @returns {Promise<string>} Mensagem gerada
 */
async function generateInitialMessage(leadData) {
  // Se houver mensagem inicial configurada, processar template
  if (leadData.initial_approach) {
    const leadTemplateData = TemplateProcessor.extractLeadData({
      name: leadData.lead_name,
      title: leadData.title,
      company: leadData.company,
      location: leadData.location,
      industry: leadData.industry
    });

    const message = TemplateProcessor.processTemplate(
      leadData.initial_approach,
      leadTemplateData
    );

    return message;
  }

  // Caso contrário, gerar mensagem via IA
  const context = {
    lead: {
      name: leadData.lead_name,
      title: leadData.title,
      company: leadData.company,
      industry: leadData.industry,
      location: leadData.location
    },
    agent: {
      objective: leadData.objective,
      tone: leadData.tone || 'professional',
      language: leadData.language || 'pt-BR'
    }
  };

  const prompt = `Você é um agente de IA iniciando uma conversa no LinkedIn.

Informações do lead:
- Nome: ${context.lead.name}
- Cargo: ${context.lead.title || 'Não informado'}
- Empresa: ${context.lead.company || 'Não informada'}
- Indústria: ${context.lead.industry || 'Não informada'}

Objetivo: ${context.agent.objective}
Tom: ${context.agent.tone}

Escreva uma mensagem de abertura natural e personalizada (máximo 150 palavras):`;

  const response = await aiResponseService.generateResponse({
    messages: [],
    prompt,
    temperature: 0.8,
    maxTokens: 300
  });

  return response;
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
 * Agendar início de conversa com delay de 5 minutos
 * @param {string} leadId - ID do lead
 * @param {string} conversationId - ID da conversa
 * @returns {Promise<Object>} Job agendado
 */
async function scheduleDelayedConversation(leadId, conversationId) {
  const FIVE_MINUTES = 5 * 60 * 1000; // 5 minutos em ms

  console.log(`📅 Agendando início de conversa para daqui 5 minutos - Lead: ${leadId}`);

  const job = await delayedConversationQueue.add(
    {
      leadId,
      conversationId
    },
    {
      delay: FIVE_MINUTES,
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

  console.log(`✅ Job agendado - ID: ${job.id}`);

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
