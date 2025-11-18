// Check which campaigns the leads belong to
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
    console.log('\n🔍 Verificando campanhas dos leads...\n');

    // Count leads by campaign_id
    const result = await pool.query(`
      SELECT
        l.campaign_id,
        c.name as campaign_name,
        c.status as campaign_status,
        COUNT(l.id) as lead_count
      FROM leads l
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      GROUP BY l.campaign_id, c.name, c.status
      ORDER BY lead_count DESC
    `);

    console.log('📊 Leads por campanha:\n');
    result.rows.forEach(row => {
      console.log(`Campaign: ${row.campaign_name || 'DESCONHECIDA'}`);
      console.log(`  ID: ${row.campaign_id}`);
      console.log(`  Status: ${row.campaign_status || 'N/A'}`);
      console.log(`  Leads: ${row.lead_count}`);
      console.log('');
    });

    // Also check the specific campaign from the screenshot
    const campaignId = '3a82c07f-1e4c-4a2b-9387-e328f98f1c9b';
    const specificCheck = await pool.query(
      'SELECT COUNT(*) as count FROM leads WHERE campaign_id = $1',
      [campaignId]
    );

    console.log(`\n🎯 Leads na campanha específica (${campaignId}):`);
    console.log(`   ${specificCheck.rows[0].count} leads\n`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    await pool.end();
    process.exit(1);
  }
}

check();
