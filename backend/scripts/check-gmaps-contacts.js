// Script para verificar os contatos do Google Maps Agent
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'leadraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function check() {
  try {
    // Primeiro, ver os sources únicos
    const sources = await pool.query(`
      SELECT DISTINCT source, COUNT(*) as count
      FROM contacts
      WHERE place_id IS NOT NULL
      GROUP BY source
    `);
    console.log('=== Sources de contatos com place_id ===');
    sources.rows.forEach(s => console.log(`   ${s.source}: ${s.count}`));

    // Verificar últimos 10 contatos com place_id (vindos do Google Maps)
    const result = await pool.query(`
      SELECT
        id, name, website, email, phone,
        company_description, company_services, pain_points,
        source, place_id
      FROM contacts
      WHERE place_id IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log('=== Últimos 10 contatos do Google Maps Agent ===');
    result.rows.forEach((c, i) => {
      console.log(`\n${i+1}. ${c.name}`);
      console.log(`   Website: ${c.website || 'NULL'}`);
      console.log(`   Email: ${c.email || 'NULL'}`);
      console.log(`   Phone: ${c.phone || 'NULL'}`);
      console.log(`   Company Description: ${c.company_description ? 'SIM (' + c.company_description.length + ' chars)' : 'NULL'}`);
      console.log(`   Company Services: ${c.company_services || 'NULL'}`);
      console.log(`   Pain Points: ${c.pain_points || 'NULL'}`);
    });

    // Estatísticas
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(website) as with_website,
        COUNT(email) as with_email,
        COUNT(company_description) as with_ai_analysis
      FROM contacts
      WHERE place_id IS NOT NULL
    `);

    console.log('\n=== Estatísticas ===');
    console.log(`Total contatos GMaps: ${stats.rows[0].total}`);
    console.log(`Com website: ${stats.rows[0].with_website}`);
    console.log(`Com email: ${stats.rows[0].with_email}`);
    console.log(`Com análise IA: ${stats.rows[0].with_ai_analysis}`);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

check();
