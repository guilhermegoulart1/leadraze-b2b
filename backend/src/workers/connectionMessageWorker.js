// backend/src/workers/connectionMessageWorker.js

const { connectionMessageQueue } = require('../queues');
const db = require('../config/database');
const unipileClient = require('../config/unipile');
const TemplateProcessor = require('../utils/templateProcessor');
const { extractFirstName } = require('../controllers/connectionController');

/**
 * Connection Message Worker
 *
 * Processa envio de mensagens diretas para conexões de 1º grau
 * ao longo do dia com tempo randomizado para evitar bloqueios
 */

/**
 * Calcular delay randomizado para próxima mensagem
 * Distribui mensagens ao longo do dia de forma natural
 * @param {number} remainingMessages - Mensagens restantes no dia
 * @param {number} hoursRemaining - Horas restantes no dia (8h úteis)
 * @returns {number} Delay em milissegundos
 */
function calculateRandomDelay(remainingMessages, hoursRemaining = 8) {
  // Tempo médio entre mensagens (em ms)
  const averageInterval = (hoursRemaining * 60 * 60 * 1000) / remainingMessages;

  // Adicionar variação de ±50% para parecer mais humano
  const minDelay = averageInterval * 0.5;
  const maxDelay = averageInterval * 1.5;

  // Random entre min e max
  const delay = minDelay + Math.random() * (maxDelay - minDelay);

  // Mínimo de 1 minuto, máximo de 1 hora
  // Conexões podem ter intervalo menor que convites
  const MIN_DELAY = 1 * 60 * 1000; // 1 minuto
  const MAX_DELAY = 1 * 60 * 60 * 1000; // 1 hora

  return Math.max(MIN_DELAY, Math.min(MAX_DELAY, delay));
}

/**
 * Processar envio de mensagem para uma conexão
 * @param {Object} job - Job da fila Bull
 */
async function processConnectionMessage(job) {
  const {
    campaignId,
    campaignContactId,
    linkedinAccountId,
    unipileAccountId,
    providerId,
    contactName,
    contactCompany,
    contactTitle
  } = job.data;

  console.log(`\n💬 Processando mensagem - Campaign: ${campaignId}, Contact: ${contactName}`);

  try {
    // Buscar dados da campanha e agente
    const campaignResult = await db.query(
      `SELECT
        ac.id,
        ac.name,
        ac.user_id,
        ac.linkedin_account_id,
        ac.linkedin_agent_id,
        ac.daily_limit,
        ac.status,
        aa.initial_message,
        aa.personality,
        aa.tone,
        aa.custom_instructions,
        aa.name as agent_name
      FROM activation_campaigns ac
      LEFT JOIN activation_agents aa ON ac.linkedin_agent_id = aa.id
      WHERE ac.id = $1`,
      [campaignId]
    );

    if (!campaignResult.rows || campaignResult.rows.length === 0) {
      throw new Error('Campaign not found');
    }

    const campaign = campaignResult.rows[0];

    // Verificar se campanha ainda está ativa
    if (campaign.status !== 'active') {
      console.log(`⚠️ Campanha não está mais ativa (status: ${campaign.status}), ignorando`);
      return { skipped: true, reason: 'campaign_not_active' };
    }

    // Verificar se contato já foi processado
    const contactCheck = await db.query(
      `SELECT status FROM activation_campaign_contacts WHERE id = $1`,
      [campaignContactId]
    );

    if (!contactCheck.rows[0] || contactCheck.rows[0].status !== 'pending') {
      console.log(`⚠️ Contato já processado (status: ${contactCheck.rows[0]?.status}), ignorando`);
      return { skipped: true, reason: 'already_processed' };
    }

    // Processar template da mensagem
    let messageText = campaign.initial_message || 'Olá {{primeiro_nome}}! Tudo bem?';

    // Substituir variáveis
    const firstName = extractFirstName(contactName);
    messageText = messageText
      .replace(/\{\{primeiro_nome\}\}/gi, firstName)
      .replace(/\{\{nome\}\}/gi, contactName || '')
      .replace(/\{\{empresa\}\}/gi, contactCompany || '')
      .replace(/\{\{cargo\}\}/gi, contactTitle || '')
      .replace(/\{\{first_name\}\}/gi, firstName)
      .replace(/\{\{name\}\}/gi, contactName || '')
      .replace(/\{\{company\}\}/gi, contactCompany || '')
      .replace(/\{\{title\}\}/gi, contactTitle || '');

    console.log(`📤 Enviando mensagem para ${contactName} (${providerId})`);
    console.log(`   Mensagem: ${messageText.substring(0, 100)}...`);

    // Enviar mensagem via Unipile
    const result = await unipileClient.messaging.send({
      account_id: unipileAccountId,
      user_id: providerId,
      text: messageText
    });

    // Atualizar status do contato
    await db.query(
      `UPDATE activation_campaign_contacts
       SET status = 'sent', message_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [campaignContactId]
    );

    // Atualizar contador da campanha
    await db.query(
      `UPDATE activation_campaigns
       SET contacts_activated = contacts_activated + 1,
           last_activation_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [campaignId]
    );

    // Atualizar contador diário do usuário
    const today = new Date().toISOString().split('T')[0];
    await db.query(
      `UPDATE users
       SET today_connection_activations = CASE
         WHEN last_connection_activation_date::date = $2::date
         THEN today_connection_activations + 1
         ELSE 1
       END,
       last_connection_activation_date = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [campaign.user_id, today]
    );

    console.log(`✅ Mensagem enviada com sucesso para ${contactName}`);

    return {
      success: true,
      contactName,
      messageLength: messageText.length,
      chatId: result.chat_id
    };

  } catch (error) {
    console.error(`❌ Erro ao enviar mensagem:`, error.message);

    // Atualizar status como falha
    await db.query(
      `UPDATE activation_campaign_contacts
       SET status = 'failed', error_message = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [campaignContactId, error.message]
    );

    // Atualizar contador de falhas
    await db.query(
      `UPDATE activation_campaigns
       SET contacts_failed = contacts_failed + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [campaignId]
    );

    throw error;
  }
}

/**
 * Iniciar campanha de mensagens para conexões
 * @param {string} campaignId - ID da campanha
 * @param {Object} options - Opções de processamento
 */
async function startConnectionCampaign(campaignId, options = {}) {
  const { dailyLimit = 100 } = options;

  console.log(`\n🚀 Iniciando campanha de conexões ${campaignId}`);

  try {
    // Buscar campanha
    const campaignResult = await db.query(
      `SELECT
        ac.id,
        ac.name,
        ac.user_id,
        ac.linkedin_account_id,
        ac.daily_limit,
        la.unipile_account_id
      FROM activation_campaigns ac
      LEFT JOIN linkedin_accounts la ON ac.linkedin_account_id = la.id
      WHERE ac.id = $1 AND ac.status = 'active'`,
      [campaignId]
    );

    if (!campaignResult.rows || campaignResult.rows.length === 0) {
      throw new Error('Campaign not found or not active');
    }

    const campaign = campaignResult.rows[0];

    // Buscar contatos pendentes
    const pendingContactsResult = await db.query(
      `SELECT
        acc.id as campaign_contact_id,
        cli.linkedin_url as provider_id,
        cli.name,
        cli.company,
        cli.position as title
      FROM activation_campaign_contacts acc
      JOIN contact_list_items cli ON acc.list_item_id = cli.id
      WHERE acc.campaign_id = $1 AND acc.status = 'pending'
      ORDER BY acc.created_at ASC`,
      [campaignId]
    );

    const pendingContacts = pendingContactsResult.rows || [];

    if (pendingContacts.length === 0) {
      console.log('ℹ️ Nenhum contato pendente encontrado');

      // Marcar campanha como completa
      await db.query(
        `UPDATE activation_campaigns SET status = 'completed', end_date = CURRENT_TIMESTAMP WHERE id = $1`,
        [campaignId]
      );

      return { success: true, scheduled: 0, completed: true };
    }

    console.log(`📋 ${pendingContacts.length} contatos pendentes encontrados`);

    // Calcular limite efetivo
    const effectiveLimit = Math.min(pendingContacts.length, campaign.daily_limit || dailyLimit);

    console.log(`📊 Limite efetivo: ${effectiveLimit} mensagens`);

    // Agendar mensagens com delays randomizados
    const hoursRemaining = 8; // 8 horas úteis
    let scheduledCount = 0;

    for (let i = 0; i < effectiveLimit; i++) {
      const contact = pendingContacts[i];
      const remainingMessages = effectiveLimit - i;

      // Calcular delay randomizado
      const delay = calculateRandomDelay(remainingMessages, hoursRemaining);

      // Adicionar job à fila
      await connectionMessageQueue.add(
        {
          campaignId: campaign.id,
          campaignContactId: contact.campaign_contact_id,
          linkedinAccountId: campaign.linkedin_account_id,
          unipileAccountId: campaign.unipile_account_id,
          providerId: contact.provider_id,
          contactName: contact.name,
          contactCompany: contact.company,
          contactTitle: contact.title
        },
        {
          delay: delay * i, // Multiplicar pelo índice para espaçar
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 10000
          }
        }
      );

      // Marcar como agendado
      await db.query(
        `UPDATE activation_campaign_contacts SET status = 'scheduled' WHERE id = $1`,
        [contact.campaign_contact_id]
      );

      scheduledCount++;

      const delayMinutes = Math.round((delay * i) / 60000);
      console.log(`   📅 ${i + 1}/${effectiveLimit}: ${contact.name} - em ${delayMinutes} min`);
    }

    console.log(`✅ ${scheduledCount} mensagens agendadas com sucesso`);

    return {
      success: true,
      scheduled: scheduledCount,
      campaignId: campaign.id,
      campaignName: campaign.name
    };

  } catch (error) {
    console.error('❌ Erro ao iniciar campanha de conexões:', error);
    throw error;
  }
}

/**
 * Cancelar mensagens pendentes de uma campanha
 * @param {string} campaignId - ID da campanha
 */
async function cancelConnectionCampaign(campaignId) {
  console.log(`🛑 Cancelando mensagens pendentes da campanha ${campaignId}`);

  try {
    // Buscar jobs pendentes
    const waitingJobs = await connectionMessageQueue.getWaiting();
    const delayedJobs = await connectionMessageQueue.getDelayed();

    const allPendingJobs = [...waitingJobs, ...delayedJobs];

    let canceledCount = 0;

    for (const job of allPendingJobs) {
      if (job.data.campaignId === campaignId) {
        await job.remove();
        canceledCount++;
      }
    }

    // Reverter status dos contatos agendados para pendente
    await db.query(
      `UPDATE activation_campaign_contacts
       SET status = 'pending'
       WHERE campaign_id = $1 AND status = 'scheduled'`,
      [campaignId]
    );

    console.log(`✅ ${canceledCount} mensagens canceladas`);

    return {
      success: true,
      canceled: canceledCount
    };

  } catch (error) {
    console.error('❌ Erro ao cancelar campanha:', error);
    throw error;
  }
}

// Processar jobs da fila
connectionMessageQueue.process(async (job) => {
  return await processConnectionMessage(job);
});

// Event handlers
connectionMessageQueue.on('completed', (job, result) => {
  if (result.skipped) {
    console.log(`⏭️  Job ${job.id} pulado: ${result.reason}`);
  } else {
    console.log(`✅ Job ${job.id} concluído: ${result.contactName}`);
  }
});

connectionMessageQueue.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} falhou:`, err.message);
});

connectionMessageQueue.on('stalled', (job) => {
  console.warn(`⚠️ Job ${job.id} travou, será reprocessado`);
});

module.exports = {
  startConnectionCampaign,
  cancelConnectionCampaign,
  calculateRandomDelay
};
