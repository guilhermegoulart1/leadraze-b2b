// backend/src/services/bulkCollectionProcessor.js
const db = require('../config/database');
const unipileClient = require('../config/unipile');

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
    // Buscar jobs pendentes
    const result = await db.query(
      `SELECT * FROM bulk_collection_jobs 
       WHERE status = 'pending' 
       ORDER BY created_at ASC 
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

    const searchFilters = JSON.parse(job.search_filters || '{}');
    let currentCursor = job.current_cursor;
    let totalCollected = job.collected_count;
    let searchCount = 0;

    console.log('🔍 Filtros de busca:', searchFilters);

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
        // Nova busca - adicionar filtros
        if (searchFilters.keywords) {
          searchParams.keywords = searchFilters.keywords;
        }
        if (searchFilters.location && Array.isArray(searchFilters.location)) {
          searchParams.location = searchFilters.location;
        }
        if (searchFilters.industries && Array.isArray(searchFilters.industries)) {
          searchParams.industries = searchFilters.industries;
        }
        if (searchFilters.job_titles && Array.isArray(searchFilters.job_titles)) {
          searchParams.job_titles = searchFilters.job_titles;
        }
        if (searchFilters.companies && Array.isArray(searchFilters.companies)) {
          searchParams.companies = searchFilters.companies;
        }
      }

      console.log('📤 Buscando no Unipile...');

      // Buscar via Unipile
      const unipileResponse = await unipileClient.linkedin.search(searchParams);
      const profiles = unipileResponse.items || [];

      console.log(`📥 Recebidos: ${profiles.length} perfis`);

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

      // Delay entre requests
      await new Promise(resolve => setTimeout(resolve, 2000));
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

      // Inserir lead
      await db.query(
        `INSERT INTO leads 
         (campaign_id, linkedin_profile_id, provider_id, name, title, company, 
          location, profile_url, profile_picture, headline, status, score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          job.campaign_id,
          profileId,
          profile.provider_id || profile.id,
          profile.name || profile.full_name || 'Sem nome',
          profile.title || profile.headline || null,
          profile.company || profile.current_company || null,
          profile.location || profile.geo_location || null,
          profile.profile_url || profile.url || null,
          profile.profile_picture || profile.picture || null,
          profile.summary || profile.description || null,
          'leads',
          calculateProfileScore(profile)
        ]
      );

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
  if (profile.company || profile.current_company) score += 15;
  if (profile.location) score += 10;
  if (profile.profile_picture || profile.picture) score += 10;
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