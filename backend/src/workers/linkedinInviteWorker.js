// backend/src/workers/linkedinInviteWorker.js

const { linkedinInviteQueue } = require('../queues');
const db = require('../config/database');
const unipileClient = require('../config/unipile');
const inviteService = require('../services/inviteService');
const TemplateProcessor = require('../utils/templateProcessor');

/**
 * LinkedIn Invite Worker
 *
 * Processa envio de convites do LinkedIn de forma randomizada
 * ao longo do dia para evitar bloqueios
 */

/**
 * Calcular delay randomizado para próximo convite
 * Distribui convites ao longo do dia de forma natural
 * @param {number} remainingInvites - Convites restantes no dia
 * @param {number} hoursRemaining - Horas restantes no dia (8h úteis)
 * @returns {number} Delay em milissegundos
 */
function calculateRandomDelay(remainingInvites, hoursRemaining = 8) {
  // Tempo médio entre convites (em ms)
  const averageInterval = (hoursRemaining * 60 * 60 * 1000) / remainingInvites;

  // Adicionar variação de ±50% para parecer mais humano
  const minDelay = averageInterval * 0.5;
  const maxDelay = averageInterval * 1.5;

  // Random entre min e max
  const delay = minDelay + Math.random() * (maxDelay - minDelay);

  // Mínimo de 2 minutos, máximo de 2 horas
  const MIN_DELAY = 2 * 60 * 1000; // 2 minutos
  const MAX_DELAY = 2 * 60 * 60 * 1000; // 2 horas

  return Math.max(MIN_DELAY, Math.min(MAX_DELAY, delay));
}

/**
 * Processar envio de convite único
 * @param {Object} job - Job da fila Bull
 */
async function processInvite(job) {
  const { campaignId, leadId, linkedinAccountId, unipileAccountId } = job.data;

  console.log(`\n🎯 Processando convite - Campaign: ${campaignId}, Lead: ${leadId}`);

  try {
    // Buscar dados do lead
    const leadResult = await db.query(
      `SELECT
        id,
        campaign_id,
        linkedin_profile_id,
        name,
        title,
        company,
        location,
        industry,
        profile_url,
        profile_picture,
        summary,
        headline,
        connections_count,
        status
      FROM leads
      WHERE id = $1`,
      [leadId]
    );

    if (!leadResult.rows || leadResult.rows.length === 0) {
      throw new Error('Lead not found');
    }

    const lead = leadResult.rows[0];

    // Verificar se lead ainda está pendente
    if (lead.status !== 'lead') {
      console.log(`⚠️ Lead já processado (status: ${lead.status}), ignorando`);
      return { skipped: true, reason: 'already_processed' };
    }

    // Verificar limite diário
    const limitCheck = await inviteService.canSendInvite(linkedinAccountId);

    if (!limitCheck.canSend) {
      console.log(`⚠️ Limite diário atingido: ${limitCheck.sent}/${limitCheck.limit}`);

      // Reagendar para amanhã
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0); // 9h da manhã

      await linkedinInviteQueue.add(job.data, {
        delay: tomorrow.getTime() - Date.now()
      });

      return { skipped: true, reason: 'daily_limit_reached', rescheduled: true };
    }

    // Buscar dados da campanha e agente IA
    const campaignResult = await db.query(
      `SELECT
        c.id,
        c.name,
        c.user_id,
        c.linkedin_account_id,
        c.ai_agent_id,
        ai.initial_approach,
        ai.behavioral_profile,
        ai.name as ai_agent_name
      FROM campaigns c
      LEFT JOIN ai_agents ai ON c.ai_agent_id = ai.id
      WHERE c.id = $1`,
      [campaignId]
    );

    if (!campaignResult.rows || campaignResult.rows.length === 0) {
      throw new Error('Campaign not found');
    }

    const campaign = campaignResult.rows[0];

    // Processar template da mensagem inicial
    let inviteMessage = null;

    if (campaign.initial_approach) {
      const leadData = TemplateProcessor.extractLeadData(lead);
      inviteMessage = TemplateProcessor.processTemplate(
        campaign.initial_approach,
        leadData
      );

      // LinkedIn limita mensagens de convite a 300 caracteres
      if (inviteMessage && inviteMessage.length > 300) {
        console.log(`⚠️ Mensagem truncada: ${inviteMessage.length} -> 300 chars`);
        inviteMessage = inviteMessage.substring(0, 297) + '...';
      }
    }

    // Enviar convite via Unipile
    console.log(`📤 Enviando convite via Unipile para ${lead.linkedin_profile_id}`);

    const inviteParams = {
      account_id: unipileAccountId,
      user_id: lead.linkedin_profile_id
    };

    if (inviteMessage) {
      inviteParams.message = inviteMessage;
    }

    const result = await unipileClient.users.sendConnectionRequest(inviteParams);

    // Atualizar status do lead para 'invite_sent'
    await db.update(
      'leads',
      {
        status: 'invite_sent',
        sent_at: new Date(),
        updated_at: new Date()
      },
      { id: lead.id }
    );

    // Registrar log de convite enviado
    await inviteService.logInviteSent({
      linkedinAccountId: linkedinAccountId,
      campaignId: campaignId,
      leadId: lead.id,
      status: 'sent'
    });

    console.log(`✅ Convite enviado com sucesso para ${lead.name}`);

    return {
      success: true,
      leadId: lead.id,
      leadName: lead.name,
      messageLength: inviteMessage ? inviteMessage.length : 0
    };

  } catch (error) {
    console.error(`❌ Erro ao enviar convite:`, error.message);

    // Atualizar status do lead como falha
    await db.update(
      'leads',
      {
        status: 'invite_failed',
        updated_at: new Date()
      },
      { id: leadId }
    );

    // Registrar falha no log
    await inviteService.logInviteSent({
      linkedinAccountId: linkedinAccountId,
      campaignId: campaignId,
      leadId: leadId,
      status: 'failed'
    });

    throw error;
  }
}

/**
 * Iniciar processamento de convites para uma campanha
 * @param {string} campaignId - ID da campanha
 * @param {Object} options - Opções de processamento
 */
async function startCampaignInvites(campaignId, options = {}) {
  const { dailyLimit = 100 } = options;

  console.log(`\n🚀 Iniciando envio de convites para campanha ${campaignId}`);

  try {
    // Buscar campanha
    const campaignResult = await db.query(
      `SELECT
        c.id,
        c.name,
        c.linkedin_account_id,
        la.unipile_account_id,
        la.daily_limit,
        la.today_sent
      FROM activation_campaigns c
      LEFT JOIN linkedin_accounts la ON c.linkedin_account_id = la.id
      WHERE c.id = $1 AND c.status = 'active'`,
      [campaignId]
    );

    if (!campaignResult.rows || campaignResult.rows.length === 0) {
      throw new Error('Campaign not found or not active');
    }

    const campaign = campaignResult.rows[0];

    // Buscar leads pendentes
    const pendingLeadsResult = await db.query(
      `SELECT id, name
       FROM leads
       WHERE campaign_id = $1
         AND status = 'lead'
         AND linkedin_profile_id IS NOT NULL
       ORDER BY created_at ASC`,
      [campaignId]
    );

    const pendingLeads = pendingLeadsResult.rows || [];

    if (pendingLeads.length === 0) {
      console.log('ℹ️ Nenhum lead pendente encontrado');
      return { success: true, scheduled: 0 };
    }

    console.log(`📋 ${pendingLeads.length} leads pendentes encontrados`);

    // Calcular limite efetivo (menor entre dailyLimit e leads disponíveis)
    const todayRemaining = (campaign.daily_limit || dailyLimit) - (campaign.today_sent || 0);
    const effectiveLimit = Math.min(todayRemaining, pendingLeads.length, dailyLimit);

    console.log(`📊 Limite efetivo: ${effectiveLimit} convites`);
    console.log(`   - Limite diário: ${campaign.daily_limit || dailyLimit}`);
    console.log(`   - Já enviados hoje: ${campaign.today_sent || 0}`);
    console.log(`   - Restantes: ${todayRemaining}`);

    if (effectiveLimit <= 0) {
      console.log('⚠️ Limite diário já atingido, reagendando para amanhã');

      // Reagendar para amanhã às 9h
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);

      return { success: true, scheduled: 0, rescheduled: true };
    }

    // Agendar convites com delays randomizados
    const hoursRemaining = 8; // 8 horas úteis
    let scheduledCount = 0;

    for (let i = 0; i < effectiveLimit; i++) {
      const lead = pendingLeads[i];
      const remainingInvites = effectiveLimit - i;

      // Calcular delay randomizado
      const delay = calculateRandomDelay(remainingInvites, hoursRemaining);

      // Adicionar job à fila
      await linkedinInviteQueue.add(
        {
          campaignId: campaign.id,
          leadId: lead.id,
          linkedinAccountId: campaign.linkedin_account_id,
          unipileAccountId: campaign.unipile_account_id
        },
        {
          delay: delay * i, // Multiplicar pelo índice para espaçar ao longo do dia
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 10000
          }
        }
      );

      scheduledCount++;

      const delayMinutes = Math.round((delay * i) / 60000);
      console.log(`   📅 Lead ${i + 1}/${effectiveLimit}: ${lead.name} - agendado para daqui ${delayMinutes} min`);
    }

    console.log(`✅ ${scheduledCount} convites agendados com sucesso`);

    return {
      success: true,
      scheduled: scheduledCount,
      campaignId: campaign.id,
      campaignName: campaign.name
    };

  } catch (error) {
    console.error('❌ Erro ao iniciar envio de convites:', error);
    throw error;
  }
}

/**
 * Cancelar convites pendentes de uma campanha
 * @param {string} campaignId - ID da campanha
 */
async function cancelCampaignInvites(campaignId) {
  console.log(`🛑 Cancelando convites pendentes da campanha ${campaignId}`);

  try {
    // Buscar jobs pendentes da campanha
    const waitingJobs = await linkedinInviteQueue.getWaiting();
    const delayedJobs = await linkedinInviteQueue.getDelayed();

    const allPendingJobs = [...waitingJobs, ...delayedJobs];

    let canceledCount = 0;

    for (const job of allPendingJobs) {
      if (job.data.campaignId === campaignId) {
        await job.remove();
        canceledCount++;
      }
    }

    console.log(`✅ ${canceledCount} convites cancelados`);

    return {
      success: true,
      canceled: canceledCount
    };

  } catch (error) {
    console.error('❌ Erro ao cancelar convites:', error);
    throw error;
  }
}

// Processar jobs da fila
linkedinInviteQueue.process(async (job) => {
  return await processInvite(job);
});

// Event handlers
linkedinInviteQueue.on('completed', (job, result) => {
  if (result.skipped) {
    console.log(`⏭️  Job ${job.id} pulado: ${result.reason}`);
  } else {
    console.log(`✅ Job ${job.id} concluído: ${result.leadName}`);
  }
});

linkedinInviteQueue.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} falhou:`, err.message);
});

linkedinInviteQueue.on('stalled', (job) => {
  console.warn(`⚠️ Job ${job.id} travou, será reprocessado`);
});

module.exports = {
  startCampaignInvites,
  cancelCampaignInvites,
  calculateRandomDelay
};
