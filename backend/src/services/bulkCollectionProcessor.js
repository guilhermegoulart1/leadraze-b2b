// backend/src/services/bulkCollectionProcessor.js
const db = require('../config/database');
const unipileClient = require('../config/unipile');
const { getCountryFromLocationId, translateSearchTerms } = require('./locationLanguageService');

const BATCH_SIZE = 25; // Perfis por busca
const MAX_SEARCHES = 50; // Máximo de buscas por job
const PROCESSOR_INTERVAL = 10000; // 10 segundos

let isProcessing = false;

// ================================
// PROCESSAR JOBS PENDENTES
// ================================
async function processJobs() {
  if (isProcessing) {
    console.log('⏭️ Já está processando jobs, pulando...');
    return;
  }

  isProcessing = true;

  try {
    // Buscar jobs pendentes (com account_id da campanha)
    const result = await db.query(
      `SELECT bcj.*, c.account_id
       FROM bulk_collection_jobs bcj
       JOIN campaigns c ON bcj.campaign_id = c.id
       WHERE bcj.status = 'pending'
       ORDER BY bcj.created_at ASC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return;
    }

    const job = result.rows[0];
    console.log(`\n🚀 === PROCESSANDO JOB ${job.id} ===`);
    console.log(`📊 Target: ${job.target_count} | Coletado: ${job.collected_count}`);

    await processJob(job);

  } catch (error) {
    console.error('❌ Erro no processador de jobs:', error);
  } finally {
    isProcessing = false;
  }
}

// ================================
// PROCESSAR UM JOB ESPECÍFICO
// ================================
async function processJob(job) {
  try {
    // Marcar como processing
    await db.query(
      `UPDATE bulk_collection_jobs 
       SET status = 'processing', started_at = NOW()
       WHERE id = $1`,
      [job.id]
    );

    // PostgreSQL retorna JSONB como objeto, não como string
    const searchFilters = typeof job.search_filters === 'string'
      ? JSON.parse(job.search_filters)
      : (job.search_filters || {});
    let currentCursor = job.current_cursor;
    let totalCollected = job.collected_count;
    let searchCount = 0;

    console.log('🔍 Filtros de busca:', searchFilters);

    // ===== TRADUÇÃO AUTOMÁTICA BASEADA NO PAÍS =====
    let translatedFilters = searchFilters;

    // Detectar país - primeiro verifica se já veio do frontend
    let detectedCountry = null;
    let locationName = null;

    if (searchFilters.location_data && searchFilters.location_data.country) {
      // País já veio do frontend - usar diretamente
      detectedCountry = searchFilters.location_data.country;
      locationName = searchFilters.location_data.label;
      console.log(`\n🌍 === PAÍS DO FRONTEND ===`);
      console.log(`📍 País: ${detectedCountry}`);
      console.log(`📌 Localização: ${locationName}`);
    } else if (searchFilters.location && Array.isArray(searchFilters.location) && searchFilters.location.length > 0) {
      // Fallback: detectar país a partir do location ID
      const firstLocationId = searchFilters.location[0];

      console.log(`\n🌍 === DETECTANDO PAÍS VIA API ===`);
      const locationInfo = await getCountryFromLocationId(firstLocationId, job.unipile_account_id);

      if (locationInfo && locationInfo.country) {
        detectedCountry = locationInfo.country;
        locationName = locationInfo.locationName;
        console.log(`📍 País detectado: ${detectedCountry}`);
        console.log(`📌 Localização completa: ${locationName}`);
      }
    }

    if (detectedCountry) {
      // Traduzir termos para a língua do país
      translatedFilters = await translateSearchTerms(searchFilters, detectedCountry);

      console.log(`\n✅ Filtros traduzidos para ${detectedCountry}:`);
      console.log('  Keywords:', translatedFilters.keywords);
      console.log('  Industries:', translatedFilters.industries);
      console.log('  Job Titles:', translatedFilters.job_titles?.slice(0, 5), '...');
    } else {
      console.log('⚠️ Não foi possível detectar o país, usando filtros originais');
    }

    // Loop de coleta
    while (totalCollected < job.target_count && searchCount < MAX_SEARCHES) {
      searchCount++;
      console.log(`\n📄 Busca ${searchCount}/${MAX_SEARCHES}`);
      console.log(`📊 Coletado: ${totalCollected}/${job.target_count}`);

      // Preparar parâmetros
      const searchParams = {
        account_id: job.unipile_account_id,
        api: job.api_type,
        category: 'people',
        limit: BATCH_SIZE
      };

      if (currentCursor) {
        searchParams.cursor = currentCursor;
      } else {
        // Nova busca - adicionar filtros TRADUZIDOS
        if (translatedFilters.keywords) {
          searchParams.keywords = translatedFilters.keywords;
        }
        if (translatedFilters.location && Array.isArray(translatedFilters.location)) {
          searchParams.location = translatedFilters.location;
        }
        if (translatedFilters.industries && Array.isArray(translatedFilters.industries)) {
          searchParams.industries = translatedFilters.industries;
        }
        if (translatedFilters.job_titles && Array.isArray(translatedFilters.job_titles)) {
          searchParams.job_titles = translatedFilters.job_titles;
        }
        if (translatedFilters.companies && Array.isArray(translatedFilters.companies)) {
          searchParams.companies = translatedFilters.companies;
        }
      }

      console.log('📤 Buscando no Unipile...');

      // Buscar via Unipile
      const unipileResponse = await unipileClient.linkedin.search(searchParams);
      const profiles = unipileResponse.items || [];

      console.log(`📥 Recebidos: ${profiles.length} perfis`);

      // 🔍 LOG DETALHADO - Mostrar estrutura do primeiro perfil
      if (profiles.length > 0) {
        console.log('\n📊 === EXEMPLO DE PERFIL DA API UNIPILE ===');
        console.log('Campos disponíveis:', Object.keys(profiles[0]));
        console.log('\n📋 Dados completos do primeiro perfil:');
        console.log(JSON.stringify(profiles[0], null, 2));
        console.log('===========================================\n');
      }

      if (profiles.length === 0) {
        console.log('🏁 Sem mais perfis');
        break;
      }

      // Salvar perfis
      const savedCount = await saveProfiles(profiles, job);
      totalCollected += savedCount;

      console.log(`✅ Salvos: ${savedCount} perfis`);

      // Atualizar job
      currentCursor = unipileResponse.cursor;
      await db.query(
        `UPDATE bulk_collection_jobs 
         SET collected_count = $1, current_cursor = $2, last_processed_at = NOW()
         WHERE id = $3`,
        [totalCollected, currentCursor, job.id]
      );

      // Verificar se atingiu target
      if (totalCollected >= job.target_count) {
        console.log('🎯 Target atingido!');
        break;
      }

      // Verificar se acabaram os resultados
      if (!currentCursor) {
        console.log('🏁 Sem mais resultados da Unipile');
        break;
      }

      // Delay entre requests (900ms = 1000 requests a cada 15 minutos)
      await new Promise(resolve => setTimeout(resolve, 900));
    }

    // Marcar como concluído
    await db.query(
      `UPDATE bulk_collection_jobs 
       SET status = 'completed', completed_at = NOW()
       WHERE id = $1`,
      [job.id]
    );

    console.log(`✅ === JOB CONCLUÍDO ===`);
    console.log(`📊 Total coletado: ${totalCollected}/${job.target_count}`);

  } catch (error) {
    console.error(`❌ Erro ao processar job ${job.id}:`, error);

    // Atualizar erro
    const errorCount = (job.error_count || 0) + 1;
    const status = errorCount >= 3 ? 'failed' : 'pending';

    await db.query(
      `UPDATE bulk_collection_jobs 
       SET status = $1, error_message = $2, error_count = $3
       WHERE id = $4`,
      [status, error.message, errorCount, job.id]
    );
  }
}

// ================================
// SALVAR PERFIS COMO LEADS
// ================================
async function saveProfiles(profiles, job) {
  let savedCount = 0;

  for (const profile of profiles) {
    try {
      const profileId = profile.id || profile.provider_id || profile.urn_id;
      
      if (!profileId) {
        console.warn('⚠️ Perfil sem ID, pulando');
        continue;
      }

      // Verificar se já existe
      const existsCheck = await db.query(
        `SELECT id FROM leads 
         WHERE linkedin_profile_id = $1 AND campaign_id = $2`,
        [profileId, job.campaign_id]
      );

      if (existsCheck.rows.length > 0) {
        console.log(`⏭️ Perfil ${profileId} já existe, pulando`);
        continue;
      }

      // ✅ Buscar foto em múltiplos campos possíveis da API Unipile
      const profilePicture = profile.profile_picture ||
                            profile.profile_picture_url ||
                            profile.profile_picture_url_large ||
                            profile.picture ||
                            profile.photo ||
                            profile.image ||
                            profile.avatar ||
                            profile.photoUrl ||
                            null;

      // 🏢 Extrair empresa (MÚLTIPLOS CAMPOS POSSÍVEIS)
      const company = profile.company ||
                     profile.current_company ||
                     profile.organization ||
                     profile.company_name ||
                     (profile.experience && profile.experience[0] && profile.experience[0].company_name) ||
                     (profile.positions && profile.positions[0] && profile.positions[0].company_name) ||
                     null;

      // 📧📞 Extrair email e telefone do perfil (se disponível)
      const email = profile.email ||
                    profile.email_address ||
                    profile.contact_email ||
                    (profile.contact_info && profile.contact_info.email) ||
                    null;

      const phone = profile.phone ||
                    profile.phone_number ||
                    profile.contact_phone ||
                    (profile.contact_info && profile.contact_info.phone) ||
                    null;

      // 🔍 LOG DETALHADO - Campos extraídos para este perfil
      console.log(`\n👤 Perfil ${savedCount + 1}:`, {
        id: profileId,
        name: profile.name || profile.full_name,
        title: profile.title || profile.headline,
        company: company,
        location: profile.location || profile.geo_location,
        email: email,
        phone: phone,
        raw_company_fields: {
          company: profile.company,
          current_company: profile.current_company,
          organization: profile.organization,
          company_name: profile.company_name,
          experience_first: profile.experience && profile.experience[0],
          positions_first: profile.positions && profile.positions[0]
        }
      });

      // Inserir lead com campos expandidos (inclui account_id para multi-tenancy)
      const insertQuery = `INSERT INTO leads
         (account_id, campaign_id, linkedin_profile_id, provider_id, name, title, company,
          location, profile_url, profile_picture, headline, status, score,
          email, phone, email_captured_at, phone_captured_at, email_source, phone_source,
          public_identifier, network_distance, profile_picture_large,
          connections_count, follower_count, is_premium, member_urn)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
                 $20, $21, $22, $23, $24, $25, $26)`;

      const insertValues = [
        job.account_id, // account_id para multi-tenancy
        job.campaign_id,
        profileId,
        profile.provider_id || profile.id,
        profile.name || profile.full_name || 'Sem nome',
        profile.title || profile.headline || null,
        company, // ✅ Usando a variável extraída com múltiplas tentativas
        profile.location || profile.geo_location || null,
        profile.profile_url || profile.url || null,
        profilePicture,
        profile.summary || profile.description || null,
        'leads', // Status correto (plural) conforme LEAD_STATUS.LEADS
        calculateProfileScore(profile),
        email,
        phone,
        email ? new Date() : null, // email_captured_at
        phone ? new Date() : null, // phone_captured_at
        email ? 'profile' : null,  // email_source
        phone ? 'profile' : null,   // phone_source
        // Novos campos da busca básica
        profile.public_identifier || null,
        profile.network_distance || null,
        profile.profile_picture_url_large || null,
        profile.shared_connections_count || 0,
        0, // follower_count (não vem na busca básica)
        profile.premium || false, // is_premium
        profile.member_urn || null
      ];

      await db.query(insertQuery, insertValues);

      // Log de contatos capturados
      if (email || phone) {
        console.log(`📧📞 Contatos capturados do perfil ${profileId}:`, { email, phone });
      }

      savedCount++;

    } catch (error) {
      console.error(`❌ Erro ao salvar perfil:`, error.message);
    }
  }

  return savedCount;
}

// Helper - Calcular score
function calculateProfileScore(profile) {
  let score = 0;
  if (profile.name || profile.full_name) score += 20;
  if (profile.title || profile.headline) score += 15;

  // ✅ Verificar empresa em múltiplos campos
  const hasCompany = profile.company ||
                     profile.current_company ||
                     profile.organization ||
                     profile.company_name ||
                     (profile.experience && profile.experience[0] && profile.experience[0].company_name) ||
                     (profile.positions && profile.positions[0] && profile.positions[0].company_name);
  if (hasCompany) score += 15;

  if (profile.location) score += 10;
  // Check all possible photo fields
  if (profile.profile_picture || profile.profile_picture_url || profile.profile_picture_url_large ||
      profile.picture || profile.photo || profile.image || profile.avatar || profile.photoUrl) score += 10;
  if (profile.profile_url || profile.url) score += 5;
  if (profile.summary || profile.description) score += 10;
  if (profile.connections && profile.connections > 0) score += 10;
  if (profile.industry) score += 5;
  return Math.min(score, 100);
}

// ================================
// INICIAR PROCESSADOR
// ================================
function startProcessor() {
  console.log('🚀 Iniciando processador de coleta em lote...');
  
  // Processar imediatamente
  processJobs();
  
  // Processar a cada intervalo
  setInterval(() => {
    processJobs();
  }, PROCESSOR_INTERVAL);
}

module.exports = {
  startProcessor,
  processJobs
};