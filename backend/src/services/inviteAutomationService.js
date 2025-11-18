// backend/src/services/inviteAutomationService.js

const db = require('../config/database');
const unipileClient = require('../config/unipile');
const inviteService = require('./inviteService');
const TemplateProcessor = require('../utils/templateProcessor');

/**
 * Processa automação de convites para campanhas ativas
 * Este serviço envia convites automáticos para leads de campanhas
 * com automation_active = true
 */

/**
 * Processar todos os convites pendentes para campanhas ativas
 * @returns {Promise<Object>} Estatísticas do processamento
 */
async function processAutomatedInvites() {
  console.log('\n🤖 === INICIANDO PROCESSAMENTO DE CONVITES AUTOMÁTICOS ===\n');

  try {
    // Buscar campanhas ativas com automação habilitada
    const activeCampaigns = await getActiveCampaigns();

    if (activeCampaigns.length === 0) {
      console.log('ℹ️ Nenhuma campanha ativa com automação encontrada');
      return {
        success: true,
        campaigns_processed: 0,
        invites_sent: 0,
        invites_failed: 0,
        invites_skipped: 0
      };
    }

    console.log(`📋 Encontradas ${activeCampaigns.length} campanhas ativas:\n`);

    let totalSent = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    // Processar cada campanha
    for (const campaign of activeCampaigns) {
      console.log(`\n📊 Processando campanha: ${campaign.name} (ID: ${campaign.id})`);
      console.log(`   LinkedIn Account: ${campaign.linkedin_account_id}`);
      console.log(`   AI Agent: ${campaign.ai_agent_name || 'Nenhum'}`);

      try {
        const result = await processCampaignInvites(campaign);
        totalSent += result.sent;
        totalFailed += result.failed;
        totalSkipped += result.skipped;

        console.log(`   ✅ Resultado: ${result.sent} enviados, ${result.failed} falhas, ${result.skipped} pulados`);
      } catch (error) {
        console.error(`   ❌ Erro ao processar campanha ${campaign.name}:`, error.message);
        totalFailed++;
      }
    }

    console.log('\n✅ === PROCESSAMENTO CONCLUÍDO ===');
    console.log(`📊 Total: ${totalSent} enviados, ${totalFailed} falhas, ${totalSkipped} pulados\n`);

    return {
      success: true,
      campaigns_processed: activeCampaigns.length,
      invites_sent: totalSent,
      invites_failed: totalFailed,
      invites_skipped: totalSkipped
    };

  } catch (error) {
    console.error('❌ Erro no processamento de convites automáticos:', error);
    throw error;
  }
}

/**
 * Buscar campanhas ativas com automação habilitada
 * @returns {Promise<Array>} Lista de campanhas
 */
async function getActiveCampaigns() {
  const result = await db.query(`
    SELECT
      c.id,
      c.name,
      c.user_id,
      c.linkedin_account_id,
      c.ai_agent_id,
      c.status,
      c.automation_active,
      c.target_profiles_count,
      ai.name as ai_agent_name,
      ai.initial_approach,
      ai.behavioral_profile,
      la.unipile_account_id,
      la.profile_name as linkedin_profile_name,
      la.status as linkedin_account_status
    FROM campaigns c
    LEFT JOIN ai_agents ai ON c.ai_agent_id = ai.id
    LEFT JOIN linkedin_accounts la ON c.linkedin_account_id = la.id
    WHERE c.status = 'active'
      AND c.automation_active = true
      AND la.status = 'active'
    ORDER BY c.created_at DESC
  `);

  return result.rows || [];
}

/**
 * Processar convites de uma campanha específica
 * @param {Object} campaign - Dados da campanha
 * @returns {Promise<Object>} Estatísticas do processamento
 */
async function processCampaignInvites(campaign) {
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  try {
    // Verificar limite diário da conta LinkedIn
    const limitCheck = await inviteService.canSendInvite(campaign.linkedin_account_id);

    if (!limitCheck.canSend) {
      console.log(`   ⚠️ Limite diário atingido: ${limitCheck.sent}/${limitCheck.limit}`);
      return { sent, failed, skipped };
    }

    console.log(`   ✅ Limite disponível: ${limitCheck.remaining} de ${limitCheck.limit}`);

    // Buscar leads pendentes (status = 'leads', não convidados ainda)
    const pendingLeads = await getPendingLeads(campaign.id, limitCheck.remaining);

    if (pendingLeads.length === 0) {
      console.log(`   ℹ️ Nenhum lead pendente para enviar convites`);
      return { sent, failed, skipped };
    }

    console.log(`   📋 ${pendingLeads.length} leads pendentes encontrados`);

    // Processar cada lead
    for (const lead of pendingLeads) {
      try {
        // Verificar limite novamente antes de cada envio
        const currentLimit = await inviteService.canSendInvite(campaign.linkedin_account_id);

        if (!currentLimit.canSend) {
          console.log(`   ⚠️ Limite atingido durante processamento. Parando.`);
          skipped += (pendingLeads.length - sent - failed);
          break;
        }

        // Enviar convite
        const inviteResult = await sendAutomatedInvite({
          campaign,
          lead,
          linkedinAccountId: campaign.linkedin_account_id,
          unipileAccountId: campaign.unipile_account_id,
          aiAgent: {
            initial_approach: campaign.initial_approach,
            behavioral_profile: campaign.behavioral_profile
          }
        });

        if (inviteResult.success) {
          sent++;
          console.log(`   ✅ Convite enviado para: ${lead.name}`);
        } else {
          failed++;
          console.log(`   ❌ Falha ao enviar para: ${lead.name} - ${inviteResult.error}`);
        }

        // Aguardar entre 2-5 segundos entre convites (comportamento mais humano)
        const delay = 2000 + Math.random() * 3000;
        await new Promise(resolve => setTimeout(resolve, delay));

      } catch (error) {
        failed++;
        console.error(`   ❌ Erro ao processar lead ${lead.name}:`, error.message);
      }
    }

  } catch (error) {
    console.error(`   ❌ Erro no processamento da campanha:`, error);
    throw error;
  }

  return { sent, failed, skipped };
}

/**
 * Buscar leads pendentes de uma campanha
 * @param {string} campaignId - ID da campanha
 * @param {number} limit - Limite de leads a buscar
 * @returns {Promise<Array>} Lista de leads pendentes
 */
async function getPendingLeads(campaignId, limit = 10) {
  const result = await db.query(
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
    WHERE campaign_id = $1
      AND status = 'leads'
      AND linkedin_profile_id IS NOT NULL
    ORDER BY created_at ASC
    LIMIT $2`,
    [campaignId, limit]
  );

  return result.rows || [];
}

/**
 * Enviar convite automático para um lead
 * @param {Object} params - Parâmetros do convite
 * @returns {Promise<Object>} Resultado do envio
 */
async function sendAutomatedInvite(params) {
  const { campaign, lead, linkedinAccountId, unipileAccountId, aiAgent } = params;

  try {
    // Processar template da mensagem inicial (se houver)
    let inviteMessage = null;

    if (aiAgent?.initial_approach) {
      // Extrair dados do lead para o template
      const leadData = TemplateProcessor.extractLeadData(lead);

      // Processar template com variáveis
      inviteMessage = TemplateProcessor.processTemplate(
        aiAgent.initial_approach,
        leadData
      );

      // LinkedIn limita mensagens de convite a 300 caracteres
      if (inviteMessage && inviteMessage.length > 300) {
        console.log(`   ⚠️ Mensagem muito longa (${inviteMessage.length} chars), truncando para 300`);
        inviteMessage = inviteMessage.substring(0, 297) + '...';
      }
    }

    // Preparar parâmetros para Unipile
    const inviteParams = {
      account_id: unipileAccountId,
      user_id: lead.linkedin_profile_id
    };

    if (inviteMessage) {
      inviteParams.message = inviteMessage;
    }

    console.log(`   📤 Enviando convite via Unipile para ${lead.linkedin_profile_id}`);

    // Enviar convite via Unipile
    const result = await unipileClient.users.sendConnectionRequest(inviteParams);

    // Registrar sucesso no log
    await inviteService.logInviteSent({
      linkedinAccountId: linkedinAccountId,
      campaignId: campaign.id,
      leadId: lead.id,
      status: 'sent'
    });

    // Atualizar status do lead
    await db.update(
      'leads',
      {
        status: 'invite_sent',
        updated_at: new Date()
      },
      { id: lead.id }
    );

    return {
      success: true,
      result,
      message: inviteMessage
    };

  } catch (error) {
    console.error(`   ❌ Erro ao enviar convite:`, error.message);

    // Registrar falha no log
    await inviteService.logInviteSent({
      linkedinAccountId: linkedinAccountId,
      campaignId: campaign.id,
      leadId: lead.id,
      status: 'failed'
    });

    // Atualizar status do lead como falha
    await db.update(
      'leads',
      {
        status: 'invite_failed',
        updated_at: new Date()
      },
      { id: lead.id }
    );

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Processar convites de uma campanha específica (uso manual/API)
 * @param {string} campaignId - ID da campanha
 * @param {Object} options - Opções de processamento
 * @returns {Promise<Object>} Resultado do processamento
 */
async function processCampaignInvitesById(campaignId, options = {}) {
  const { limit = null } = options;

  console.log(`\n🎯 Processando convites da campanha ${campaignId}`);

  // Buscar dados da campanha
  const campaignResult = await db.query(`
    SELECT
      c.id,
      c.name,
      c.user_id,
      c.linkedin_account_id,
      c.ai_agent_id,
      c.status,
      c.automation_active,
      ai.name as ai_agent_name,
      ai.initial_approach,
      ai.behavioral_profile,
      la.unipile_account_id,
      la.profile_name as linkedin_profile_name,
      la.status as linkedin_account_status
    FROM campaigns c
    LEFT JOIN ai_agents ai ON c.ai_agent_id = ai.id
    LEFT JOIN linkedin_accounts la ON c.linkedin_account_id = la.id
    WHERE c.id = $1
  `, [campaignId]);

  if (!campaignResult.rows || campaignResult.rows.length === 0) {
    throw new Error('Campaign not found');
  }

  const campaign = campaignResult.rows[0];

  if (campaign.status !== 'active') {
    throw new Error('Campaign is not active');
  }

  if (campaign.linkedin_account_status !== 'active') {
    throw new Error('LinkedIn account is not active');
  }

  // Processar convites
  const result = await processCampaignInvites(campaign);

  return {
    campaign_id: campaignId,
    campaign_name: campaign.name,
    ...result
  };
}

/**
 * Obter próxima conta disponível para enviar convite (Round-Robin)
 * @param {string} campaignId - ID da campanha
 * @returns {Promise<Object|null>} Conta disponível ou null se nenhuma disponível
 */
async function getNextAvailableAccount(campaignId) {
  try {
    console.log(`🔄 Buscando próxima conta disponível para campanha ${campaignId}...`);

    // Buscar todas as contas vinculadas à campanha
    const result = await db.query(
      `SELECT
        cla.id as relation_id,
        cla.linkedin_account_id,
        cla.last_used_at,
        cla.invites_sent as campaign_invites_sent,
        cla.priority,
        la.profile_name,
        la.daily_limit,
        la.today_sent,
        la.status
       FROM campaign_linkedin_accounts cla
       JOIN linkedin_accounts la ON cla.linkedin_account_id = la.id
       WHERE cla.campaign_id = $1
         AND cla.is_active = true
         AND la.status = 'active'
       ORDER BY cla.last_used_at ASC NULLS FIRST, cla.priority ASC`,
      [campaignId]
    );

    if (result.rows.length === 0) {
      console.log('⚠️ Nenhuma conta ativa encontrada para esta campanha');
      return null;
    }

    console.log(`📊 Encontradas ${result.rows.length} contas ativas`);

    // Verificar limites e selecionar próxima conta disponível (Round-Robin)
    for (const account of result.rows) {
      const remaining = (account.daily_limit || 0) - (account.today_sent || 0);

      console.log(`   🔍 ${account.profile_name}: ${account.today_sent || 0}/${account.daily_limit || 0} (${remaining} restantes)`);

      if (remaining > 0) {
        console.log(`   ✅ Selecionada: ${account.profile_name}`);

        // Atualizar last_used_at para implementar round-robin
        await db.query(
          `UPDATE campaign_linkedin_accounts
           SET last_used_at = NOW()
           WHERE id = $1`,
          [account.relation_id]
        );

        return {
          id: account.linkedin_account_id,
          profile_name: account.profile_name,
          daily_limit: account.daily_limit,
          today_sent: account.today_sent,
          remaining
        };
      }
    }

    console.log('⚠️ Todas as contas atingiram o limite diário');
    return null;

  } catch (error) {
    console.error('❌ Erro ao buscar próxima conta disponível:', error);
    throw error;
  }
}

/**
 * Incrementar contador de convites enviados para uma conta numa campanha
 * @param {string} campaignId - ID da campanha
 * @param {string} linkedinAccountId - ID da conta LinkedIn
 * @returns {Promise<void>}
 */
async function incrementAccountInviteSent(campaignId, linkedinAccountId) {
  try {
    await db.query(
      `UPDATE campaign_linkedin_accounts
       SET invites_sent = invites_sent + 1
       WHERE campaign_id = $1 AND linkedin_account_id = $2`,
      [campaignId, linkedinAccountId]
    );
  } catch (error) {
    console.error('❌ Erro ao incrementar contador de convites:', error);
    throw error;
  }
}

module.exports = {
  processAutomatedInvites,
  processCampaignInvitesById,
  sendAutomatedInvite,
  getPendingLeads,
  getNextAvailableAccount,
  incrementAccountInviteSent
};
