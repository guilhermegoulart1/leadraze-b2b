// backend/src/workers/delayedConversationWorker.js

const { delayedConversationQueue } = require('../queues');
const db = require('../config/database');
const unipileClient = require('../config/unipile');
const workflowExecutionService = require('../services/workflowExecutionService');

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
      ai.workflow_definition,
      ai.workflow_enabled,
      ai.config as ai_config,
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

    if (!opportunityData.ai_agent_id) {
      throw new Error('AI agent not configured for this campaign');
    }

    // Buscar account_id do usuario
    const userResult = await db.query(
      'SELECT account_id FROM users WHERE id = (SELECT user_id FROM campaigns WHERE id = $1)',
      [opportunityData.campaign_id]
    );
    const accountId = userResult.rows[0]?.account_id;

    // Montar lead data para o workflow
    const leadData = {
      name: opportunityData.contact_name,
      title: opportunityData.title,
      company: opportunityData.company,
      location: opportunityData.location,
      industry: opportunityData.industry,
      headline: opportunityData.headline,
      summary: opportunityData.summary
    };

    // 1. Inicializar workflow com trigger invite_accepted
    console.log(`🔄 Inicializando workflow para agente ${opportunityData.ai_agent_id}...`);
    const initResult = await workflowExecutionService.initializeWorkflow(
      conversationId,
      opportunityData.ai_agent_id,
      'invite_accepted'
    );

    if (!initResult.workflowEnabled) {
      throw new Error('Workflow não está habilitado para este agente');
    }

    console.log(`✅ Workflow inicializado. Trigger node: ${initResult.triggerNode?.id || 'N/A'}`);

    // 2. Processar evento invite_accepted pelo workflow engine
    console.log('🤖 Processando evento invite_accepted pelo Workflow Engine...');
    const workflowResult = await workflowExecutionService.processEvent(
      conversationId,
      'invite_accepted',
      {
        message: null,
        conversationContext: { recentMessages: [], summary: null },
        lead: leadData
      },
      {
        agentId: opportunityData.ai_agent_id,
        accountId
      }
    );

    console.log(`✅ Workflow processado. Nodes executados: ${workflowResult.executedNodes?.length || 0}`);

    // 3. Se workflow gerou response (de conversationStep) que nao foi enviada por action node
    //    Action nodes (send_message, schedule, etc) enviam via sendMessageViaUnipile internamente
    //    ConversationStep nodes geram resposta mas NAO enviam - precisamos enviar aqui
    if (workflowResult.response) {
      const sentByAction = workflowResult.executedNodes?.some(
        n => n.nodeType === 'action' && n.result?.result?.sent === true
      );

      if (!sentByAction) {
        console.log(`📤 Enviando resposta do workflow via Unipile (${workflowResult.response.length} chars)...`);

        await unipileClient.messaging.send({
          account_id: opportunityData.unipile_account_id,
          user_id: conversation.unipile_chat_id,
          text: workflowResult.response
        });

        await db.insert('messages', {
          conversation_id: conversationId,
          sender_type: 'ai',
          content: workflowResult.response,
          message_type: 'text',
          sent_at: new Date(),
          created_at: new Date()
        });

        await db.update('conversations', {
          last_message_at: new Date(),
          last_message_preview: workflowResult.response.substring(0, 100),
          updated_at: new Date()
        }, { id: conversationId });

        console.log('✅ Resposta do workflow enviada e salva');
      } else {
        console.log('✅ Resposta já enviada por action node do workflow');
      }
    } else {
      console.log('ℹ️ Workflow não gerou resposta (pode ser estratégia silenciosa)');
    }

    console.log('✅ Conversa iniciada automaticamente via Workflow Engine');

    return {
      success: true,
      workflow: true,
      opportunityId,
      conversationId,
      executedNodes: workflowResult.executedNodes?.length || 0,
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
