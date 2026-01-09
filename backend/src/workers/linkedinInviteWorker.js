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

// Logging helper
const LOG_PREFIX = '📤 [INVITE-SEND]';
const log = {
  info: (msg, data) => console.log(`${LOG_PREFIX} ${msg}`, data || ''),
  success: (msg, data) => console.log(`${LOG_PREFIX} ✅ ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`${LOG_PREFIX} ⚠️ ${msg}`, data || ''),
  error: (msg, data) => console.error(`${LOG_PREFIX} ❌ ${msg}`, data || ''),
  step: (step, msg, data) => console.log(`${LOG_PREFIX} [${step}] ${msg}`, data || ''),
  divider: () => console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`),
};

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
  const { campaignId, opportunityId, linkedinAccountId, unipileAccountId } = job.data;

  log.divider();
  log.info('PROCESSANDO ENVIO DE CONVITE');
  log.info(`   Job ID: ${job.id}`);
  log.info(`   Campaign ID: ${campaignId}`);
  log.info(`   Opportunity ID: ${opportunityId}`);
  log.info(`   LinkedIn Account ID: ${linkedinAccountId}`);
  log.info(`   Unipile Account ID: ${unipileAccountId}`);
  log.info(`   Timestamp: ${new Date().toISOString()}`);

  try {
    // Buscar dados da opportunity com contact
    log.step('1', 'Buscando dados da opportunity no banco...');
    const opportunityResult = await db.query(
      `SELECT
        o.id,
        o.campaign_id,
        o.linkedin_profile_id,
        o.title as opportunity_title,
        o.sent_at,
        ct.id as contact_id,
        ct.name,
        ct.title,
        ct.company,
        ct.location,
        ct.industry,
        ct.profile_url,
        ct.profile_picture,
        ct.about as summary,
        ct.headline,
        ct.connections_count
      FROM opportunities o
      LEFT JOIN contacts ct ON o.contact_id = ct.id
      WHERE o.id = $1`,
      [opportunityId]
    );

    if (!opportunityResult.rows || opportunityResult.rows.length === 0) {
      log.error('Opportunity não encontrada no banco!');
      throw new Error('Opportunity not found');
    }

    const opportunity = opportunityResult.rows[0];
    log.success(`Opportunity encontrada: ${opportunity.name}`);
    log.info(`   LinkedIn Profile ID: ${opportunity.linkedin_profile_id}`);
    log.info(`   Empresa: ${opportunity.company || 'N/A'}`);
    log.info(`   Cargo: ${opportunity.title || 'N/A'}`);

    // Verificar se opportunity ainda está pendente (não enviada)
    log.step('2', 'Verificando se opportunity ainda está pendente...');
    if (opportunity.sent_at) {
      log.warn(`Convite já enviado em ${opportunity.sent_at}, ignorando`);
      return { skipped: true, reason: 'already_processed' };
    }
    log.success('Opportunity está pendente, pode enviar convite');

    // Verificar limite diário
    log.step('3', 'Verificando limite diário de convites...');
    const limitCheck = await inviteService.canSendInvite(linkedinAccountId);
    log.info(`   Enviados hoje: ${limitCheck.sent}/${limitCheck.limit}`);

    if (!limitCheck.canSend) {
      log.warn(`Limite diário atingido: ${limitCheck.sent}/${limitCheck.limit}`);

      // Reagendar para amanhã
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0); // 9h da manhã

      log.info(`   Reagendando para amanhã: ${tomorrow.toISOString()}`);
      await linkedinInviteQueue.add(job.data, {
        delay: tomorrow.getTime() - Date.now()
      });

      return { skipped: true, reason: 'daily_limit_reached', rescheduled: true };
    }
    log.success('Dentro do limite diário, pode enviar');

    // Buscar dados da campanha e agente IA
    log.step('4', 'Buscando dados da campanha...');
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
      log.error('Campanha não encontrada!');
      throw new Error('Campaign not found');
    }

    const campaign = campaignResult.rows[0];
    log.success(`Campanha encontrada: ${campaign.name}`);
    log.info(`   AI Agent: ${campaign.ai_agent_name || 'N/A'}`);

    // Processar template da mensagem inicial
    log.step('5', 'Processando template da mensagem de convite...');
    let inviteMessage = null;

    if (campaign.initial_approach) {
      const contactData = TemplateProcessor.extractLeadData(opportunity);
      inviteMessage = TemplateProcessor.processTemplate(
        campaign.initial_approach,
        contactData
      );

      // LinkedIn limita mensagens de convite a 300 caracteres
      if (inviteMessage && inviteMessage.length > 300) {
        log.warn(`Mensagem truncada: ${inviteMessage.length} -> 300 chars`);
        inviteMessage = inviteMessage.substring(0, 297) + '...';
      }

      log.success(`Mensagem processada (${inviteMessage?.length || 0} chars)`);
      log.info(`   Preview: "${inviteMessage?.substring(0, 50)}..."`);
    } else {
      log.info('   Sem mensagem de convite (convite sem nota)');
    }

    // Enviar convite via Unipile
    log.step('6', 'Enviando convite via Unipile API...');
    log.info(`   Profile ID: ${opportunity.linkedin_profile_id}`);
    log.info(`   Account ID: ${unipileAccountId}`);

    const inviteParams = {
      account_id: unipileAccountId,
      user_id: opportunity.linkedin_profile_id
    };

    if (inviteMessage) {
      inviteParams.message = inviteMessage;
    }

    const result = await unipileClient.users.sendConnectionRequest(inviteParams);
    log.success('Convite enviado via API Unipile!');

    // Atualizar opportunity com sent_at
    log.step('7', 'Atualizando opportunity...');
    await db.update(
      'opportunities',
      {
        sent_at: new Date(),
        updated_at: new Date()
      },
      { id: opportunity.id }
    );
    log.success('Opportunity atualizada com sent_at');

    // Registrar log de convite enviado
    log.step('8', 'Registrando log de convite...');
    await inviteService.logInviteSent({
      linkedinAccountId: linkedinAccountId,
      campaignId: campaignId,
      opportunityId: opportunity.id,
      status: 'sent'
    });
    log.success('Log de convite registrado');

    log.divider();
    log.success(`CONVITE ENVIADO COM SUCESSO!`);
    log.info(`   Contato: ${opportunity.name}`);
    log.info(`   Empresa: ${opportunity.company || 'N/A'}`);
    log.info(`   Cargo: ${opportunity.title || 'N/A'}`);
    log.info(`   Mensagem: ${inviteMessage ? inviteMessage.length + ' chars' : 'Sem nota'}`);
    log.divider();

    return {
      success: true,
      opportunityId: opportunity.id,
      contactName: opportunity.name,
      messageLength: inviteMessage ? inviteMessage.length : 0
    };

  } catch (error) {
    log.error(`Erro ao enviar convite: ${error.message}`);

    // Registrar falha no log
    log.info('   Registrando falha no log');
    await inviteService.logInviteSent({
      linkedinAccountId: linkedinAccountId,
      campaignId: campaignId,
      opportunityId: opportunityId,
      status: 'failed'
    });

    log.divider();
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

  log.divider();
  log.info('INICIANDO ENVIO DE CONVITES PARA CAMPANHA');
  log.info(`   Campaign ID: ${campaignId}`);
  log.info(`   Daily Limit: ${dailyLimit}`);
  log.info(`   Timestamp: ${new Date().toISOString()}`);
  log.divider();

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
      log.error('Campanha não encontrada ou não está ativa');
      throw new Error('Campaign not found or not active');
    }

    const campaign = campaignResult.rows[0];
    log.success(`Campanha encontrada: ${campaign.name}`);

    // Buscar opportunities pendentes (sem sent_at)
    log.step('2', 'Buscando opportunities pendentes...');
    const pendingOpportunitiesResult = await db.query(
      `SELECT o.id, ct.name
       FROM opportunities o
       LEFT JOIN contacts ct ON o.contact_id = ct.id
       WHERE o.campaign_id = $1
         AND o.sent_at IS NULL
         AND o.linkedin_profile_id IS NOT NULL
       ORDER BY o.created_at ASC`,
      [campaignId]
    );

    const pendingOpportunities = pendingOpportunitiesResult.rows || [];

    if (pendingOpportunities.length === 0) {
      log.info('Nenhuma opportunity pendente encontrada');
      return { success: true, scheduled: 0 };
    }

    log.success(`${pendingOpportunities.length} opportunities pendentes encontradas`);
    pendingOpportunities.slice(0, 5).forEach((o, i) => {
      log.info(`   ${i + 1}. ${o.name}`);
    });
    if (pendingOpportunities.length > 5) {
      log.info(`   ... e mais ${pendingOpportunities.length - 5} opportunities`);
    }

    // Calcular limite efetivo (menor entre dailyLimit e opportunities disponíveis)
    log.step('3', 'Calculando limite efetivo...');
    const todayRemaining = (campaign.daily_limit || dailyLimit) - (campaign.today_sent || 0);
    const effectiveLimit = Math.min(todayRemaining, pendingOpportunities.length, dailyLimit);

    log.info(`   Limite diário: ${campaign.daily_limit || dailyLimit}`);
    log.info(`   Já enviados hoje: ${campaign.today_sent || 0}`);
    log.info(`   Restantes: ${todayRemaining}`);
    log.info(`   Opportunities pendentes: ${pendingOpportunities.length}`);
    log.success(`Limite efetivo: ${effectiveLimit} convites`);

    if (effectiveLimit <= 0) {
      log.warn('Limite diário já atingido, reagendando para amanhã');

      // Reagendar para amanhã às 9h
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);

      return { success: true, scheduled: 0, rescheduled: true };
    }

    // Agendar convites com delays randomizados
    log.step('4', 'Agendando convites com delays randomizados...');
    const hoursRemaining = 8; // 8 horas úteis
    let scheduledCount = 0;

    for (let i = 0; i < effectiveLimit; i++) {
      const opportunity = pendingOpportunities[i];
      const remainingInvites = effectiveLimit - i;

      // Calcular delay randomizado
      const delay = calculateRandomDelay(remainingInvites, hoursRemaining);

      // Adicionar job à fila
      await linkedinInviteQueue.add(
        {
          campaignId: campaign.id,
          opportunityId: opportunity.id,
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
      log.info(`   📅 ${i + 1}/${effectiveLimit}: ${opportunity.name} → daqui ${delayMinutes} min`);
    }

    log.divider();
    log.success(`CONVITES AGENDADOS COM SUCESSO!`);
    log.info(`   Campanha: ${campaign.name}`);
    log.info(`   Total agendados: ${scheduledCount}`);
    log.info(`   Distribuídos ao longo de: ~${hoursRemaining} horas`);
    log.divider();

    return {
      success: true,
      scheduled: scheduledCount,
      campaignId: campaign.id,
      campaignName: campaign.name
    };

  } catch (error) {
    log.error(`Erro ao iniciar envio de convites: ${error.message}`);
    log.divider();
    throw error;
  }
}

/**
 * Cancelar convites pendentes de uma campanha
 * @param {string} campaignId - ID da campanha
 */
async function cancelCampaignInvites(campaignId) {
  log.divider();
  log.info(`CANCELANDO CONVITES PENDENTES`);
  log.info(`   Campaign ID: ${campaignId}`);

  try {
    // Buscar jobs pendentes da campanha
    log.step('1', 'Buscando jobs pendentes na fila...');
    const waitingJobs = await linkedinInviteQueue.getWaiting();
    const delayedJobs = await linkedinInviteQueue.getDelayed();

    const allPendingJobs = [...waitingJobs, ...delayedJobs];
    log.info(`   Jobs na fila: ${allPendingJobs.length} (waiting: ${waitingJobs.length}, delayed: ${delayedJobs.length})`);

    log.step('2', 'Removendo jobs da campanha...');
    let canceledCount = 0;

    for (const job of allPendingJobs) {
      if (job.data.campaignId === campaignId) {
        await job.remove();
        canceledCount++;
      }
    }

    log.divider();
    log.success(`CONVITES CANCELADOS!`);
    log.info(`   Total cancelados: ${canceledCount}`);
    log.divider();

    return {
      success: true,
      canceled: canceledCount
    };

  } catch (error) {
    log.error(`Erro ao cancelar convites: ${error.message}`);
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
    log.warn(`Job ${job.id} pulado: ${result.reason}`);
  } else {
    log.success(`Job ${job.id} concluído: ${result.leadName}`);
  }
});

linkedinInviteQueue.on('failed', (job, err) => {
  log.error(`Job ${job.id} falhou: ${err.message}`);
});

linkedinInviteQueue.on('stalled', (job) => {
  log.warn(`Job ${job.id} travou, será reprocessado`);
});

module.exports = {
  startCampaignInvites,
  cancelCampaignInvites,
  calculateRandomDelay
};
