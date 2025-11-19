const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/config/database');
const fs = require('fs');

async function runMigration() {
  try {
    console.log('\n🚀 Executando Migration 008: Add Lead Enrichment Fields\n');

    const sql = fs.readFileSync(
      path.join(__dirname, '../src/migrations/008_add_lead_enrichment_fields.sql'),
      'utf8'
    );

    await db.query(sql);

    console.log('✅ Migration 008 executada com sucesso!');
    console.log('\n📊 Novos campos adicionados à tabela leads:');
    console.log('  - first_name, last_name');
    console.log('  - connections_count, follower_count');
    console.log('  - is_premium, is_creator, is_influencer');
    console.log('  - network_distance, public_identifier, member_urn');
    console.log('  - profile_picture_large, primary_locale');
    console.log('  - websites, experience, education, skills');
    console.log('  - certifications, languages, about');
    console.log('  - full_profile_fetched_at, enrichment_attempts');
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error.message);
    process.exit(1);
  }
}

runMigration();
