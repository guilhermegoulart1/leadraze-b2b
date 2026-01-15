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
    // Buscar jobs pendentes (com account_id e user_id da campanha)
    const result = await db.query(
      `SELECT bcj.*, c.account_id, c.user_id
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
// SALVAR PERFIS COMO CONTACTS + OPPORTUNITIES
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

      // Verificar se já existe opportunity para este perfil na mesma campanha
      const existsOppCheck = await db.query(
        `SELECT o.id, o.campaign_id FROM opportunities o
         WHERE o.account_id = $1
         AND o.linkedin_profile_id = $2
         AND o.campaign_id = $3
         LIMIT 1`,
        [job.account_id, profileId, job.campaign_id]
      );

      if (existsOppCheck.rows.length > 0) {
        console.log(`⏭️ Perfil ${profileId} já existe nesta campanha, pulando`);
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

      const name = profile.name || profile.full_name || 'Sem nome';
      const title = profile.title || profile.headline || null;
      const location = profile.location || profile.geo_location || null;
      const profileUrl = profile.profile_url || profile.url || null;

      // 🔍 LOG DETALHADO - Campos extraídos para este perfil
      console.log(`\n👤 Perfil ${savedCount + 1}:`, {
        id: profileId,
        name: name,
        title: title,
        company: company,
        location: location,
        email: email,
        phone: phone
      });

      // 1. Verificar se contact já existe (por linkedin_profile_id)
      let contactId = null;
      const existingContact = await db.query(
        `SELECT id FROM contacts
         WHERE account_id = $1
         AND linkedin_profile_id = $2
         LIMIT 1`,
        [job.account_id, profileId]
      );

      if (existingContact.rows.length > 0) {
        contactId = existingContact.rows[0].id;
        console.log(`📇 Contact existente encontrado: ${contactId}`);
      } else {
        // 2. Criar contact
        const contactInsert = await db.query(
          `INSERT INTO contacts
           (user_id, account_id, linkedin_profile_id, name, title, company, location,
            profile_url, profile_picture, headline, email, phone,
            connections_count, is_premium, source, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
           RETURNING id`,
          [
            job.user_id,
            job.account_id,
            profileId,
            name,
            title,
            company,
            location,
            profileUrl,
            profilePicture,
            profile.summary || profile.description || null,
            email,
            phone,
            profile.shared_connections_count || 0,
            profile.premium || false,
            'linkedin'
          ]
        );
        contactId = contactInsert.rows[0].id;
        console.log(`📇 Novo contact criado: ${contactId}`);
      }

      // 3. Criar opportunity vinculada ao contact
      await db.query(
        `INSERT INTO opportunities
         (account_id, contact_id, campaign_id, linkedin_profile_id,
          title, score, source, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [
          job.account_id,
          contactId,
          job.campaign_id,
          profileId,
          name,
          calculateProfileScore(profile),
          'linkedin'
        ]
      );

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