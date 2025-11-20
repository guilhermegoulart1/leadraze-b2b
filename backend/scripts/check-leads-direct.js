const { Pool } = require('pg');

const pool = new Pool({
  host: 'db.epikyczksznhjggzjjgg.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'W5o6k6y0@@',
  ssl: { rejectUnauthorized: false }
});

async function checkLeadsCount() {
  try {
    // Total de leads
    const totalResult = await pool.query('SELECT COUNT(*) FROM leads');
    console.log(`\n📊 TOTAL DE LEADS: ${totalResult.rows[0].count}`);

    // Leads por status
    const statusResult = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM leads
      GROUP BY status
      ORDER BY count DESC
    `);
    console.log('\n📋 LEADS POR STATUS:');
    statusResult.rows.forEach(row => {
      console.log(`  ${row.status}: ${row.count}`);
    });

    // Leads por campanha
    const campaignResult = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.status as campaign_status,
        c.user_id,
        COUNT(l.id) as lead_count
      FROM campaigns c
      LEFT JOIN leads l ON l.campaign_id = c.id
      GROUP BY c.id, c.name, c.status, c.user_id
      ORDER BY lead_count DESC
    `);
    console.log('\n📦 LEADS POR CAMPANHA:');
    campaignResult.rows.forEach(row => {
      console.log(`  [ID: ${row.id}] ${row.name} (${row.campaign_status}) - User ${row.user_id}: ${row.lead_count} leads`);
    });

    // Verificar se há leads sem campanha
    const orphanResult = await pool.query(`
      SELECT COUNT(*)
      FROM leads l
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      WHERE c.id IS NULL
    `);
    console.log(`\n⚠️  LEADS SEM CAMPANHA: ${orphanResult.rows[0].count}`);

    // Testar a query que o frontend usa para cada usuário
    const usersResult = await pool.query('SELECT DISTINCT user_id FROM campaigns ORDER BY user_id');

    for (const user of usersResult.rows) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔍 SIMULANDO QUERY DO FRONTEND para user_id=${user.user_id}:`);
      console.log('='.repeat(80));

      const frontendQuery = await pool.query(`
        SELECT
          l.id,
          l.name,
          l.status,
          l.created_at,
          c.name as campaign_name,
          c.status as campaign_status
        FROM leads l
        JOIN campaigns c ON l.campaign_id = c.id
        WHERE c.user_id = $1
        ORDER BY
          CASE l.status
            WHEN 'qualified' THEN 1
            WHEN 'qualifying' THEN 2
            WHEN 'accepted' THEN 3
            WHEN 'invite_sent' THEN 4
            WHEN 'leads' THEN 5
            WHEN 'discarded' THEN 6
          END,
          l.created_at DESC
        LIMIT 50
      `, [user.user_id]);

      console.log(`  📊 Leads retornados (com LIMIT 50): ${frontendQuery.rows.length}`);

      // Contar sem limite
      const totalForUser = await pool.query(`
        SELECT COUNT(*)
        FROM leads l
        JOIN campaigns c ON l.campaign_id = c.id
        WHERE c.user_id = $1
      `, [user.user_id]);

      console.log(`  📊 Total de leads do usuário (SEM limite): ${totalForUser.rows[0].count}`);
      console.log(`  ⚠️  DIFERENÇA: ${parseInt(totalForUser.rows[0].count) - frontendQuery.rows.length} leads NÃO estão sendo mostrados!`);

      // Mostrar distribuição por status
      const statusDistribution = await pool.query(`
        SELECT l.status, COUNT(*) as count
        FROM leads l
        JOIN campaigns c ON l.campaign_id = c.id
        WHERE c.user_id = $1
        GROUP BY l.status
        ORDER BY count DESC
      `, [user.user_id]);

      console.log(`\n  📊 Distribuição por status:`);
      statusDistribution.rows.forEach(row => {
        console.log(`     ${row.status}: ${row.count}`);
      });

      // Mostrar os primeiros 10 leads retornados
      console.log(`\n  📝 Primeiros 10 leads retornados na query com LIMIT 50:`);
      frontendQuery.rows.slice(0, 10).forEach((lead, idx) => {
        console.log(`     ${idx + 1}. [${lead.status}] ${lead.name} - ${lead.campaign_name} (${lead.campaign_status})`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkLeadsCount();
