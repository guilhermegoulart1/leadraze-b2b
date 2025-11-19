// backend/src/services/leadEnrichmentService.js
const db = require('../config/database');
const axios = require('axios');

// ================================
// BUSCAR PERFIL COMPLETO VIA UNIPILE API
// ================================
async function fetchFullProfile(providerId, unipileAccountId) {
  try {
    const dsn = process.env.UNIPILE_DSN;
    const token = process.env.UNIPILE_ACCESS_TOKEN;

    console.log(`🔍 Buscando perfil completo: ${providerId}`);

    const response = await axios.get(
      `https://${dsn}/api/v1/users/${providerId}`,
      {
        headers: {
          'X-API-KEY': token,
          'Accept': 'application/json'
        },
        params: {
          account_id: unipileAccountId
        },
        timeout: 15000
      }
    );

    return response.data;
  } catch (error) {
    console.error(`❌ Erro ao buscar perfil ${providerId}:`, error.message);
    throw error;
  }
}

// ================================
// ENRIQUECER LEAD COM PERFIL COMPLETO
// ================================
async function enrichLead(leadId) {
  try {
    console.log(`\n🚀 === ENRIQUECENDO LEAD ${leadId} ===\n`);

    // 1. Buscar dados do lead
    const leadQuery = await db.query(
      `SELECT l.*, la.unipile_account_id
       FROM leads l
       LEFT JOIN campaigns c ON l.campaign_id = c.id
       LEFT JOIN linkedin_accounts la ON c.linkedin_account_id = la.id
       WHERE l.id = $1`,
      [leadId]
    );

    if (leadQuery.rows.length === 0) {
      throw new Error(`Lead ${leadId} não encontrado`);
    }

    const lead = leadQuery.rows[0];

    // 2. Validações
    if (!lead.provider_id) {
      throw new Error('Lead não possui provider_id');
    }

    if (!lead.unipile_account_id) {
      throw new Error('Lead não possui unipile_account_id associado');
    }

    // 3. Verificar se já foi enriquecido recentemente (últimas 24h)
    if (lead.full_profile_fetched_at) {
      const hoursSinceEnrich = (Date.now() - new Date(lead.full_profile_fetched_at)) / (1000 * 60 * 60);
      if (hoursSinceEnrich < 24) {
        const hoursRounded = Math.round(hoursSinceEnrich * 10) / 10;
        console.log(`⏭️ Lead já enriquecido há ${hoursRounded}h, pulando`);
        return lead;
      }
    }

    // 4. Buscar perfil completo
    const profile = await fetchFullProfile(lead.provider_id, lead.unipile_account_id);

    console.log('📊 Perfil recebido:', {
      provider_id: profile.provider_id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      headline: profile.headline,
      connections: profile.connections_count,
      followers: profile.follower_count,
      is_premium: profile.is_premium
    });

    // 5. Atualizar lead com dados enriquecidos
    const updateQuery = `
      UPDATE leads SET
        first_name = $1,
        last_name = $2,
        connections_count = $3,
        follower_count = $4,
        is_premium = $5,
        is_creator = $6,
        is_influencer = $7,
        network_distance = $8,
        public_identifier = $9,
        member_urn = $10,
        profile_picture_large = $11,
        primary_locale = $12,
        websites = $13,
        full_profile_fetched_at = NOW(),
        enrichment_attempts = COALESCE(enrichment_attempts, 0) + 1,
        last_enrichment_error = NULL,
        updated_at = NOW()
      WHERE id = $14
      RETURNING *
    `;

    const updateValues = [
      profile.first_name || null,
      profile.last_name || null,
      profile.connections_count || 0,
      profile.follower_count || 0,
      profile.is_premium || false,
      profile.is_creator || false,
      profile.is_influencer || false,
      profile.network_distance || null,
      profile.public_identifier || null,
      profile.member_urn || null,
      profile.profile_picture_url_large || profile.profile_picture_url || null,
      profile.primary_locale ? JSON.stringify(profile.primary_locale) : null,
      profile.websites && profile.websites.length > 0 ? JSON.stringify(profile.websites) : null,
      leadId
    ];

    const result = await db.query(updateQuery, updateValues);
    const enrichedLead = result.rows[0];

    console.log('✅ Lead enriquecido com sucesso!');
    console.log(`📊 Dados atualizados:`);
    console.log(`  - Nome completo: ${enrichedLead.first_name} ${enrichedLead.last_name}`);
    console.log(`  - Conexões: ${enrichedLead.connections_count}`);
    console.log(`  - Seguidores: ${enrichedLead.follower_count}`);
    console.log(`  - Premium: ${enrichedLead.is_premium ? 'Sim' : 'Não'}`);
    console.log(`  - Creator: ${enrichedLead.is_creator ? 'Sim' : 'Não'}`);
    console.log(`  - Influencer: ${enrichedLead.is_influencer ? 'Sim' : 'Não'}\n`);

    return enrichedLead;

  } catch (error) {
    console.error(`❌ Erro ao enriquecer lead ${leadId}:`, error.message);

    // Registrar erro
    await db.query(
      `UPDATE leads
       SET enrichment_attempts = COALESCE(enrichment_attempts, 0) + 1,
           last_enrichment_error = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [error.message, leadId]
    );

    throw error;
  }
}

// ================================
// ENRIQUECER MÚLTIPLOS LEADS EM LOTE
// ================================
async function enrichLeadsBatch(leadIds) {
  console.log(`\n🚀 === ENRIQUECENDO ${leadIds.length} LEADS EM LOTE ===\n`);

  const results = {
    success: [],
    failed: []
  };

  for (const leadId of leadIds) {
    try {
      const enrichedLead = await enrichLead(leadId);
      results.success.push(enrichedLead);

      // Delay entre requests (evitar rate limiting)
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      results.failed.push({
        leadId,
        error: error.message
      });
    }
  }

  console.log(`\n📊 === RESULTADOS DO ENRIQUECIMENTO EM LOTE ===`);
  console.log(`✅ Sucesso: ${results.success.length}`);
  console.log(`❌ Falhas: ${results.failed.length}\n`);

  return results;
}

// ================================
// ENRIQUECER LEADS DE UMA CAMPANHA
// ================================
async function enrichCampaignLeads(campaignId, limit = 100) {
  try {
    console.log(`\n🚀 === ENRIQUECENDO LEADS DA CAMPANHA ${campaignId} ===\n`);

    // Buscar leads que ainda não foram enriquecidos
    const leadsQuery = await db.query(
      `SELECT id
       FROM leads
       WHERE campaign_id = $1
         AND full_profile_fetched_at IS NULL
       ORDER BY created_at DESC
       LIMIT $2`,
      [campaignId, limit]
    );

    const leadIds = leadsQuery.rows.map(row => row.id);

    if (leadIds.length === 0) {
      console.log('✅ Todos os leads já foram enriquecidos!');
      return { success: [], failed: [] };
    }

    console.log(`📋 Encontrados ${leadIds.length} leads para enriquecer\n`);

    return await enrichLeadsBatch(leadIds);

  } catch (error) {
    console.error('❌ Erro ao enriquecer leads da campanha:', error.message);
    throw error;
  }
}

module.exports = {
  enrichLead,
  enrichLeadsBatch,
  enrichCampaignLeads,
  fetchFullProfile
};
