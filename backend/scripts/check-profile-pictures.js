// Check if profile pictures are being saved
const { Pool } = require('pg');

const pool = new Pool({
  host: 'db.epikyczksznhjggzjjgg.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'W5o6k6y0@@',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    console.log('\n🔍 Verificando fotos de perfil...\n');

    // Count leads with and without photos
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE profile_picture IS NOT NULL AND profile_picture != '') as with_photo,
        COUNT(*) FILTER (WHERE profile_picture IS NULL OR profile_picture = '') as without_photo,
        COUNT(*) as total
      FROM leads
    `);

    console.log('📊 Estatísticas de fotos:');
    console.log(`   Com foto: ${result.rows[0].with_photo}`);
    console.log(`   Sem foto: ${result.rows[0].without_photo}`);
    console.log(`   Total: ${result.rows[0].total}\n`);

    // Show some sample profile pictures
    const samples = await pool.query(`
      SELECT id, name, profile_picture, profile_url
      FROM leads
      WHERE profile_picture IS NOT NULL AND profile_picture != ''
      LIMIT 5
    `);

    if (samples.rows.length > 0) {
      console.log('📸 Amostra de leads com foto:\n');
      samples.rows.forEach(lead => {
        console.log(`  ${lead.name}`);
        console.log(`    Foto: ${lead.profile_picture?.substring(0, 80)}...`);
        console.log(`    URL: ${lead.profile_url}\n`);
      });
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    await pool.end();
    process.exit(1);
  }
}

check();
