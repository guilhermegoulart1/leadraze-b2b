// backend/scripts/fix-failed-job.js
require('dotenv').config();
const { pool } = require('../src/config/database');

async function fixJob() {
  try {
    await pool.query(`
      UPDATE bulk_collection_jobs
      SET status = 'failed',
          error_message = 'Job criado antes da correção do JSON parse'
      WHERE id = 'c37c781b-ee8c-4eff-a985-0034342d1f65'
    `);

    console.log('✅ Job marcado como failed');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

fixJob();
