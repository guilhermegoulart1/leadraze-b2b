// backend/src/services/campaignCollectionService.js
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const unipileClient = require('../config/unipile');

// ================================
// MAPEAMENTO DE LOCALIZAÇÕES PARA UNIPILE LOCATION IDs
// ================================
// Referência: https://unipile.com/docs/api/linkedin-search#location
const LOCATION_MAPPING = {
  // Brasil - Principais cidades
  'São Paulo, SP': '90009725',          // São Paulo Area
  'Rio de Janeiro, RJ': '90009731',     // Rio de Janeiro Area
  'Belo Horizonte, MG': '90009713',     // Belo Horizonte Area
  'Brasília, DF': '90009714',           // Brasilia Area
  'Curitiba, PR': '90009718',           // Curitiba Area
  'Porto Alegre, RS': '90009730',       // Porto Alegre Area
  'Salvador, BA': '90009734',           // Salvador Area
  'Fortaleza, CE': '90009719',          // Fortaleza Area
  'Recife, PE': '90009732',             // Recife Area
  'Manaus, AM': '90009724',             // Manaus Area
  'Florianópolis, SC': '90009720',      // Florianopolis Area
  'Campinas, SP': '90009715',           // Campinas Area
  'Goiânia, GO': '90009721',            // Goiania Area
  'Vitória, ES': '90009739',            // Vitoria Area
  'João Pessoa, PB': '90009722',        // Joao Pessoa Area
  'Natal, RN': '90009727',              // Natal Area
  'São Luís, MA': '90009735',           // Sao Luis Area
  'Maceió, AL': '90009723',             // Maceio Area
  'Teresina, PI': '90009738',           // Teresina Area
  'Belém, PA': '90009711',              // Belem Area

  // Estados completos (fallback)
  'São Paulo': '90009725',
  'Rio de Janeiro': '90009731',
  'Minas Gerais': '90009713',
  'Paraná': '90009718',
  'Rio Grande do Sul': '90009730',
  'Bahia': '90009734',
  'Brasil': '90000056'                   // Brazil (country-wide)
};

// ================================
// RESOLVER LOCALIZAÇÃO VIA UNIPILE API
// ================================
async function resolveLocationId(locationName, unipileAccountId) {
  if (!locationName) return null;

  // ✅ PRIORIZAR MAPEAMENTO ESTÁTICO para cidades conhecidas
  // (O mapeamento estático tem IDs corretos para as principais cidades do Brasil)
  if (LOCATION_MAPPING[locationName]) {
    console.log(`✅ Usando mapeamento estático: "${locationName}" → ${LOCATION_MAPPING[locationName]}`);
    return LOCATION_MAPPING[locationName];
  }

  // ✅ Para localizações desconhecidas, usar API Unipile
  try {
    const dsn = process.env.UNIPILE_DSN;
    const token = process.env.UNIPILE_API_KEY || process.env.UNIPILE_ACCESS_TOKEN;

    const axios = require('axios');
    const url = `https://${dsn}/api/v1/linkedin/search/parameters`;

    console.log(`🔍 Resolvendo location via API: "${locationName}"`);

    const response = await axios.get(url, {
      headers: {
        'X-API-KEY': token,
        'Accept': 'application/json'
      },
      params: {
        account_id: unipileAccountId,
        type: 'LOCATION',
        keywords: locationName,
        limit: 1
      },
      timeout: 10000
    });

    const locations = response.data?.items || response.data?.data || [];

    if (locations.length > 0) {
      const location = locations[0];
      const locationId = location.id || location.value || location.urn_id;
      const locationLabel = location.name || location.title || location.label;

      console.log(`✅ Location resolvida via API: "${locationName}" → ${locationId} (${locationLabel})`);
      return locationId;
    }

    console.warn(`⚠️ Localização "${locationName}" não encontrada na Unipile`);
    return null;

  } catch (error) {
    console.error(`❌ Erro ao resolver location "${locationName}":`, error.message);
    return null;
  }
}

// ================================
// CRIAR JOB DE COLETA PARA UMA CAMPANHA
// ================================
async function createCollectionJob(campaignId, userId) {
  try {
    console.log(`\n🚀 === CRIANDO JOB DE COLETA ===`);
    console.log(`📊 Campaign ID: ${campaignId}`);

    // 1. Buscar dados da campanha com conta LinkedIn
    // Prioridade: 1) campaigns.linkedin_account_id, 2) primeira conta ativa em campaign_linkedin_accounts
    const campaignQuery = await db.query(
      `SELECT c.*,
              COALESCE(la.id, cla_la.id) as resolved_linkedin_account_id,
              COALESCE(la.unipile_account_id, cla_la.unipile_account_id) as unipile_account_id,
              COALESCE(la.linkedin_username, cla_la.linkedin_username) as linkedin_username
       FROM campaigns c
       LEFT JOIN linkedin_accounts la ON c.linkedin_account_id = la.id
       LEFT JOIN campaign_linkedin_accounts cla ON cla.campaign_id = c.id AND cla.is_active = true
       LEFT JOIN linkedin_accounts cla_la ON cla.linkedin_account_id = cla_la.id
       WHERE c.id = $1 AND c.user_id = $2
       ORDER BY cla.priority ASC
       LIMIT 1`,
      [campaignId, userId]
    );

    if (campaignQuery.rows.length === 0) {
      throw new Error('Campanha não encontrada');
    }

    const campaign = campaignQuery.rows[0];

    // Usar a conta resolvida (do campo principal ou da tabela de associação)
    const linkedinAccountId = campaign.linkedin_account_id || campaign.resolved_linkedin_account_id;

    // 2. Validações
    if (!linkedinAccountId) {
      throw new Error('Campanha não possui conta do LinkedIn associada. Por favor, selecione uma conta LinkedIn nas configurações da campanha.');
    }

    if (!campaign.unipile_account_id) {
      throw new Error('Conta do LinkedIn não está conectada ao Unipile');
    }

    // Atualizar o campo linkedin_account_id da campanha se estava vazio
    if (!campaign.linkedin_account_id && linkedinAccountId) {
      console.log(`📝 Atualizando linkedin_account_id da campanha para: ${linkedinAccountId}`);
      await db.query(
        'UPDATE campaigns SET linkedin_account_id = $1 WHERE id = $2',
        [linkedinAccountId, campaignId]
      );
      campaign.linkedin_account_id = linkedinAccountId;
    }

    if (!campaign.search_filters) {
      throw new Error('Campanha não possui filtros de busca');
    }

    // 3. Verificar se já existe um job pendente ou em processamento
    const existingJobQuery = await db.query(
      `SELECT id, status FROM bulk_collection_jobs
       WHERE campaign_id = $1 AND status IN ('pending', 'processing')
       LIMIT 1`,
      [campaignId]
    );

    if (existingJobQuery.rows.length > 0) {
      const existingJob = existingJobQuery.rows[0];
      console.log(`⚠️ Já existe um job ${existingJob.status} para esta campanha`);
      return existingJob;
    }

    // 4. Processar filtros de busca
    const searchFilters = typeof campaign.search_filters === 'string'
      ? JSON.parse(campaign.search_filters)
      : campaign.search_filters;

    console.log('🔍 Filtros originais:', searchFilters);

    // 5. Processar localizações
    // A partir de agora, as locations já vêm como IDs do frontend (selecionadas via autocomplete)
    // Não precisamos mais resolver, apenas validar se existem
    const mappedFilters = { ...searchFilters };

    if (!searchFilters.location || !Array.isArray(searchFilters.location) || searchFilters.location.length === 0) {
      throw new Error('Nenhuma localização foi selecionada. Por favor, selecione pelo menos uma localização.');
    }

    console.log('📍 Localizações (já como IDs):', mappedFilters.location);

    // 6. Criar job de coleta
    const targetCount = campaign.target_profiles_count || 100;
    const jobId = uuidv4();

    await db.query(
      `INSERT INTO bulk_collection_jobs
       (id, user_id, linkedin_account_id, campaign_id, unipile_account_id,
        target_count, collected_count, api_type, status, search_filters)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        jobId,
        userId,
        campaign.linkedin_account_id,
        campaignId,
        campaign.unipile_account_id,
        targetCount,
        0, // collected_count
        'classic', // api_type (classic = free LinkedIn, sales_navigator = premium)
        'pending',
        JSON.stringify(mappedFilters)
      ]
    );

    // 7. Manter campanha como 'draft' para revisão após coleta
    // (a campanha só será ativada quando o usuário revisar e aprovar os leads)
    await db.query(
      `UPDATE campaigns
       SET current_step = 2
       WHERE id = $1`,
      [campaignId]
    );

    console.log(`✅ Job de coleta criado: ${jobId}`);
    console.log(`📊 Target: ${targetCount} perfis`);
    console.log(`🔍 Filtros processados:`, mappedFilters);

    return {
      id: jobId,
      campaign_id: campaignId,
      target_count: targetCount,
      status: 'pending',
      search_filters: mappedFilters
    };

  } catch (error) {
    console.error('❌ Erro ao criar job de coleta:', error);
    throw error;
  }
}

// ================================
// OBTER STATUS DE COLETA DE UMA CAMPANHA
// ================================
async function getCollectionStatus(campaignId, userId) {
  try {
    const result = await db.query(
      `SELECT bcj.*, c.name as campaign_name, c.target_profiles_count
       FROM bulk_collection_jobs bcj
       LEFT JOIN campaigns c ON bcj.campaign_id = c.id
       WHERE bcj.campaign_id = $1 AND bcj.user_id = $2
       ORDER BY bcj.created_at DESC
       LIMIT 1`,
      [campaignId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const job = result.rows[0];

    // Calcular progresso
    const progress = job.target_count > 0
      ? Math.round((job.collected_count / job.target_count) * 100)
      : 0;

    return {
      id: job.id,
      status: job.status,
      collected_count: job.collected_count,
      target_count: job.target_count,
      progress,
      error_message: job.error_message,
      started_at: job.started_at,
      last_processed_at: job.last_processed_at,
      completed_at: job.completed_at
    };

  } catch (error) {
    console.error('❌ Erro ao obter status de coleta:', error);
    throw error;
  }
}

module.exports = {
  createCollectionJob,
  getCollectionStatus,
  resolveLocationId,
  LOCATION_MAPPING
};
