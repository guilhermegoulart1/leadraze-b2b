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
// ENRIQUECER OPPORTUNITY/CONTACT COM PERFIL COMPLETO
// ================================
async function enrichLead(opportunityId) {
  try {
    console.log(`\n🚀 === ENRIQUECENDO OPPORTUNITY ${opportunityId} ===\n`);

    // 1. Buscar dados da opportunity e contact associado
    const oppQuery = await db.query(
      `SELECT o.id as opportunity_id, o.linkedin_profile_id, o.campaign_id,
              ct.id as contact_id, ct.name, ct.connections_count, ct.follower_count,
              ct.full_profile_fetched_at,
              la.unipile_account_id
       FROM opportunities o
       LEFT JOIN contacts ct ON o.contact_id = ct.id
       LEFT JOIN campaigns c ON o.campaign_id = c.id
       LEFT JOIN linkedin_accounts la ON c.linkedin_account_id = la.id
       WHERE o.id = $1`,
      [opportunityId]
    );

    if (oppQuery.rows.length === 0) {
      throw new Error(`Opportunity ${opportunityId} não encontrada`);
    }

    const opp = oppQuery.rows[0];

    // 2. Validações
    if (!opp.linkedin_profile_id) {
      throw new Error('Opportunity não possui linkedin_profile_id');
    }

    if (!opp.unipile_account_id) {
      throw new Error('Opportunity não possui unipile_account_id associado');
    }

    if (!opp.contact_id) {
      throw new Error('Opportunity não possui contact_id associado');
    }

    // 3. Verificar se já foi enriquecido recentemente (últimas 24h)
    if (opp.full_profile_fetched_at) {
      const hoursSinceEnrich = (Date.now() - new Date(opp.full_profile_fetched_at)) / (1000 * 60 * 60);
      if (hoursSinceEnrich < 24) {
        const hoursRounded = Math.round(hoursSinceEnrich * 10) / 10;
        console.log(`⏭️ Contact já enriquecido há ${hoursRounded}h, pulando`);
        return opp;
      }
    }

    // 4. Buscar perfil completo via Unipile
    const profile = await fetchFullProfile(opp.linkedin_profile_id, opp.unipile_account_id);

    console.log('📊 Perfil recebido:', {
      provider_id: profile.provider_id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      headline: profile.headline,
      connections: profile.connections_count,
      followers: profile.follower_count,
      is_premium: profile.is_premium
    });

    // 5. Atualizar contacts com dados enriquecidos
    const updateQuery = `
      UPDATE contacts SET
        connections_count = $1,
        follower_count = $2,
        is_premium = $3,
        is_creator = $4,
        is_influencer = $5,
        profile_picture = COALESCE($6, profile_picture),
        full_profile_fetched_at = NOW(),
        updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `;

    const updateValues = [
      profile.connections_count || 0,
      profile.follower_count || 0,
      profile.is_premium || false,
      profile.is_creator || false,
      profile.is_influencer || false,
      profile.profile_picture_url_large || profile.profile_picture_url || null,
      opp.contact_id
    ];

    const result = await db.query(updateQuery, updateValues);
    const enrichedContact = result.rows[0];

    console.log('✅ Contact enriquecido com sucesso!');
    console.log(`📊 Dados atualizados:`);
    console.log(`  - Nome: ${enrichedContact.name}`);
    console.log(`  - Conexões: ${enrichedContact.connections_count}`);
    console.log(`  - Seguidores: ${enrichedContact.follower_count}`);
    console.log(`  - Premium: ${enrichedContact.is_premium ? 'Sim' : 'Não'}`);
    console.log(`  - Creator: ${enrichedContact.is_creator ? 'Sim' : 'Não'}`);
    console.log(`  - Influencer: ${enrichedContact.is_influencer ? 'Sim' : 'Não'}\n`);

    return enrichedContact;

  } catch (error) {
    console.error(`❌ Erro ao enriquecer opportunity ${opportunityId}:`, error.message);
    throw error;
  }
}

// ================================
// ENRIQUECER MÚLTIPLAS OPPORTUNITIES EM LOTE
// ================================
async function enrichLeadsBatch(opportunityIds) {
  console.log(`\n🚀 === ENRIQUECENDO ${opportunityIds.length} OPPORTUNITIES EM LOTE ===\n`);

  const results = {
    success: [],
    failed: []
  };

  for (const opportunityId of opportunityIds) {
    try {
      const enrichedContact = await enrichLead(opportunityId);
      results.success.push(enrichedContact);

      // Delay entre requests (evitar rate limiting)
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      results.failed.push({
        opportunityId,
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
// ENRIQUECER OPPORTUNITIES DE UMA CAMPANHA
// ================================
async function enrichCampaignLeads(campaignId, limit = 100) {
  try {
    console.log(`\n🚀 === ENRIQUECENDO OPPORTUNITIES DA CAMPANHA ${campaignId} ===\n`);

    // Buscar opportunities cujos contacts ainda não foram enriquecidos
    const oppsQuery = await db.query(
      `SELECT o.id
       FROM opportunities o
       LEFT JOIN contacts ct ON o.contact_id = ct.id
       WHERE o.campaign_id = $1
         AND ct.full_profile_fetched_at IS NULL
       ORDER BY o.created_at DESC
       LIMIT $2`,
      [campaignId, limit]
    );

    const opportunityIds = oppsQuery.rows.map(row => row.id);

    if (opportunityIds.length === 0) {
      console.log('✅ Todos os contacts já foram enriquecidos!');
      return { success: [], failed: [] };
    }

    console.log(`📋 Encontradas ${opportunityIds.length} opportunities para enriquecer\n`);

    return await enrichLeadsBatch(opportunityIds);

  } catch (error) {
    console.error('❌ Erro ao enriquecer opportunities da campanha:', error.message);
    throw error;
  }
}

module.exports = {
  enrichLead,
  enrichLeadsBatch,
  enrichCampaignLeads,
  fetchFullProfile
};
