// backend/scripts/check-campaign-leads.js
require('dotenv').config();
const db = require('../src/config/database');

async function checkCampaignLeads() {
  try {
    const campaignId = '3a82c07f-1e4c-4a2b-9387-e328f98f1c9b';

    console.log('🔍 Verificando leads da campanha...\n');
    console.log(`Campaign ID: ${campaignId}\n`);

    // 1. Verificar se a campanha existe
    const campaign = await db.query(
      'SELECT * FROM campaigns WHERE id = $1',
      [campaignId]
    );

    if (campaign.rows.length === 0) {
      console.log('❌ Campanha não encontrada no banco!');
      process.exit(1);
    }

    console.log('📋 Campanha encontrada:');
    console.log(`   Nome: ${campaign.rows[0].name}`);
    console.log(`   Status: ${campaign.rows[0].status}`);
    console.log(`   Automation: ${campaign.rows[0].automation_active}`);
    console.log('');

    // 2. Contar leads por status
    const leadsCount = await db.query(`
      SELECT status, COUNT(*) as count
      FROM leads
      WHERE campaign_id = $1
      GROUP BY status
    `, [campaignId]);

    console.log('📊 Leads por Status:');
    if (leadsCount.rows.length === 0) {
      console.log('   ❌ NENHUM LEAD ENCONTRADO NO BANCO!');
    } else {
      leadsCount.rows.forEach(row => {
        console.log(`   ${row.status}: ${row.count}`);
      });
    }

    // 3. Total de leads
    const total = await db.query(
      'SELECT COUNT(*) as total FROM leads WHERE campaign_id = $1',
      [campaignId]
    );
    console.log(`\n📈 TOTAL DE LEADS: ${total.rows[0].total}`);

    // 4. Verificar job de coleta
    const job = await db.query(`
      SELECT id, status, total_collected, error_message, created_at, updated_at
      FROM bulk_collection_jobs
      WHERE campaign_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [campaignId]);

    console.log('\n📦 Job de Coleta:');
    if (job.rows.length > 0) {
      const j = job.rows[0];
      console.log(`   ID: ${j.id}`);
      console.log(`   Status: ${j.status}`);
      console.log(`   Total Coletado: ${j.total_collected || 0}`);
      console.log(`   Criado: ${new Date(j.created_at).toLocaleString('pt-BR')}`);
      console.log(`   Atualizado: ${new Date(j.updated_at).toLocaleString('pt-BR')}`);
      if (j.error_message) {
        console.log(`   Erro: ${j.error_message}`);
      }
    } else {
      console.log('   ❌ Nenhum job encontrado');
    }

    // 5. Mostrar alguns leads de exemplo
    const sampleLeads = await db.query(`
      SELECT id, full_name, headline, location, status, created_at
      FROM leads
      WHERE campaign_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [campaignId]);

    if (sampleLeads.rows.length > 0) {
      console.log('\n👥 Exemplos de Leads (5 mais recentes):');
      sampleLeads.rows.forEach((lead, index) => {
        console.log(`\n   ${index + 1}. ${lead.full_name}`);
        console.log(`      Headline: ${lead.headline || 'N/A'}`);
        console.log(`      Location: ${lead.location || 'N/A'}`);
        console.log(`      Status: ${lead.status}`);
        console.log(`      Criado: ${new Date(lead.created_at).toLocaleString('pt-BR')}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkCampaignLeads();
