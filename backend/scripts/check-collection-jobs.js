// Script to check collection jobs
const db = require('../src/config/database');

async function checkJobs() {
  try {
    const result = await db.query(`
      SELECT id, campaign_id, status, target_count, collected_count,
             created_at, started_at, completed_at, error_message
      FROM bulk_collection_jobs
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('\n📊 === COLLECTION JOBS ===\n');
    if (result.rows.length === 0) {
      console.log('Nenhum job de coleta encontrado.');
    } else {
      result.rows.forEach((job, index) => {
        console.log(`\n${index + 1}. Job ID: ${job.id}`);
        console.log(`   Campaign ID: ${job.campaign_id}`);
        console.log(`   Status: ${job.status}`);
        console.log(`   Progress: ${job.collected_count}/${job.target_count}`);
        console.log(`   Created: ${job.created_at}`);
        if (job.error_message) {
          console.log(`   Error: ${job.error_message}`);
        }
      });
    }
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('Erro ao buscar jobs:', error);
    process.exit(1);
  }
}

checkJobs();
