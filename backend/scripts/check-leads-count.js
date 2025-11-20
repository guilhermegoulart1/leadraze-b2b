require('dotenv').config({ path: '../.env' });
const db = require('../src/config/database');

async function checkLeadsCount() {
  try {
    // Total de leads
    const totalResult = await db.query('SELECT COUNT(*) FROM leads');
    console.log(`\n📊 TOTAL DE LEADS: ${totalResult.rows[0].count}`);

    // Leads por status
    const statusResult = await db.query(`
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
    const campaignResult = await db.query(`
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
      console.log(`  ${row.name} (${row.campaign_status}) - User ${row.user_id}: ${row.lead_count} leads`);
    });

    // Verificar se há leads sem campanha
    const orphanResult = await db.query(`
      SELECT COUNT(*)
      FROM leads l
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      WHERE c.id IS NULL
    `);
    console.log(`\n⚠️  LEADS SEM CAMPANHA: ${orphanResult.rows[0].count}`);

    // Testar a query que o frontend usa para cada usuário
    const usersResult = await db.query('SELECT DISTINCT user_id FROM campaigns');

    for (const user of usersResult.rows) {
      console.log(`\n🔍 SIMULANDO QUERY DO FRONTEND para user_id=${user.user_id}:`);

      const frontendQuery = await db.query(`
        SELECT
          l.*,
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

      console.log(`  Leads retornados (com LIMIT 50): ${frontendQuery.rows.length}`);

      // Contar sem limite
      const totalForUser = await db.query(`
        SELECT COUNT(*)
        FROM leads l
        JOIN campaigns c ON l.campaign_id = c.id
        WHERE c.user_id = $1
      `, [user.user_id]);

      console.log(`  Total de leads do usuário: ${totalForUser.rows[0].count}`);

      // Mostrar distribuição por status
      const statusDistribution = await db.query(`
        SELECT l.status, COUNT(*) as count
        FROM leads l
        JOIN campaigns c ON l.campaign_id = c.id
        WHERE c.user_id = $1
        GROUP BY l.status
        ORDER BY count DESC
      `, [user.user_id]);

      console.log(`  Distribuição por status:`);
      statusDistribution.rows.forEach(row => {
        console.log(`    ${row.status}: ${row.count}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await db.pool.end();
    process.exit(0);
  }
}

checkLeadsCount();
