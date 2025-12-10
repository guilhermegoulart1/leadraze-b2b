// Script to check invite queue status
require('dotenv').config();
const db = require('../src/config/database');

async function check() {
  try {
    // Check queue status by status
    const queueResult = await db.query(`
      SELECT
        ciq.status,
        COUNT(*) as count,
        MIN(scheduled_for) as earliest_scheduled,
        MAX(scheduled_for) as latest_scheduled
      FROM campaign_invite_queue ciq
      GROUP BY ciq.status
      ORDER BY ciq.status
    `);

    console.log('\n📊 STATUS DA FILA DE CONVITES:');
    console.log('================================');
    queueResult.rows.forEach(row => {
      console.log(`  ${row.status}: ${row.count}`);
      if (row.earliest_scheduled) {
        console.log(`    Primeiro agendado: ${row.earliest_scheduled}`);
        console.log(`    Último agendado: ${row.latest_scheduled}`);
      }
    });

    // Check campaign status
    const campaignResult = await db.query(`
      SELECT c.id, c.name, c.status, c.automation_active,
             (SELECT COUNT(*) FROM campaign_invite_queue WHERE campaign_id = c.id AND status = 'scheduled') as scheduled_count
      FROM campaigns c
      WHERE c.id IN (SELECT DISTINCT campaign_id FROM campaign_invite_queue WHERE status = 'scheduled')
    `);

    console.log('\n🎯 CAMPANHAS COM CONVITES AGENDADOS:');
    console.log('=====================================');
    campaignResult.rows.forEach(row => {
      console.log(`  ${row.name}:`);
      console.log(`    ID: ${row.id}`);
      console.log(`    Status: ${row.status}`);
      console.log(`    Automation Active: ${row.automation_active}`);
      console.log(`    Convites scheduled: ${row.scheduled_count}`);
    });

    // Check if any are ready to send (scheduled_for <= NOW)
    const readyResult = await db.query(`
      SELECT COUNT(*) as count
      FROM campaign_invite_queue ciq
      JOIN campaigns c ON c.id = ciq.campaign_id
      WHERE ciq.status = 'scheduled'
        AND ciq.scheduled_for <= NOW()
        AND c.status = 'active'
        AND c.automation_active = true
    `);

    console.log('\n⏰ PRONTOS PARA ENVIAR AGORA (scheduled_for <= NOW):');
    console.log('=====================================================');
    console.log(`  Convites prontos: ${readyResult.rows[0].count}`);

    // Check ALL scheduled regardless of automation_active
    const allScheduledResult = await db.query(`
      SELECT COUNT(*) as count, c.automation_active
      FROM campaign_invite_queue ciq
      JOIN campaigns c ON c.id = ciq.campaign_id
      WHERE ciq.status = 'scheduled'
        AND ciq.scheduled_for <= NOW()
        AND c.status = 'active'
      GROUP BY c.automation_active
    `);

    console.log('\n🔍 DETALHAMENTO POR automation_active:');
    console.log('========================================');
    allScheduledResult.rows.forEach(row => {
      console.log(`  automation_active=${row.automation_active}: ${row.count} convites`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Erro:', error.message);
    process.exit(1);
  }
}

check();
