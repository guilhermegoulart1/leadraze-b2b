/**
 * Check database columns and data for contacts/leads
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'getraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking database columns and data...\n');

    // Check contacts table columns
    console.log('=== CONTACTS TABLE COLUMNS ===');
    const contactsCols = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'contacts'
      ORDER BY ordinal_position
    `);

    const expectedContactsCols = [
      'emails', 'phones', 'social_links', 'team_members', // Multiple contacts
      'city', 'state', 'country', 'street_address', 'postal_code', // Address fields
      'company_description', 'services', 'pain_points', 'sales_opportunities', // AI analysis
      'cnpj', 'cnpj_data' // CNPJ
    ];

    const existingCols = contactsCols.rows.map(r => r.column_name);

    console.log('\nExpected columns check:');
    for (const col of expectedContactsCols) {
      const exists = existingCols.includes(col);
      console.log(`  ${exists ? '✅' : '❌'} ${col}`);
    }

    // Check sample data from recent contacts
    console.log('\n=== SAMPLE CONTACTS DATA (5 most recent) ===');

    // Build dynamic query based on existing columns
    const selectCols = ['id', 'name', 'company', 'website', 'location', 'latitude', 'longitude', 'created_at'];
    for (const col of expectedContactsCols) {
      if (existingCols.includes(col)) {
        selectCols.push(col);
      }
    }

    const sampleContacts = await client.query(`
      SELECT ${selectCols.join(', ')}
      FROM contacts
      ORDER BY created_at DESC
      LIMIT 5
    `);

    for (const contact of sampleContacts.rows) {
      console.log(`\n📧 ${contact.name || 'NO NAME'} (${contact.company || 'NO COMPANY'})`);
      console.log(`   Website: ${contact.website || 'NULL'}`);
      console.log(`   Location: ${contact.location || 'NULL'}`);
      if (existingCols.includes('city')) {
        console.log(`   City/State/Country: ${contact.city || 'NULL'} / ${contact.state || 'NULL'} / ${contact.country || 'NULL'}`);
      }
      console.log(`   Lat/Long: ${contact.latitude || 'NULL'} / ${contact.longitude || 'NULL'}`);
      if (existingCols.includes('emails')) {
        console.log(`   Emails (JSONB): ${contact.emails ? JSON.stringify(contact.emails).substring(0, 100) : 'NULL'}`);
      }
      if (existingCols.includes('phones')) {
        console.log(`   Phones (JSONB): ${contact.phones ? JSON.stringify(contact.phones).substring(0, 100) : 'NULL'}`);
      }
      if (existingCols.includes('social_links')) {
        console.log(`   Social Links: ${contact.social_links ? JSON.stringify(contact.social_links).substring(0, 100) : 'NULL'}`);
      }
      if (existingCols.includes('team_members')) {
        console.log(`   Team Members: ${contact.team_members ? JSON.stringify(contact.team_members).substring(0, 100) : 'NULL'}`);
      }
      if (existingCols.includes('company_description')) {
        console.log(`   Company Desc: ${contact.company_description ? contact.company_description.substring(0, 80) + '...' : 'NULL'}`);
      }
      if (existingCols.includes('services')) {
        console.log(`   Services: ${contact.services ? JSON.stringify(contact.services).substring(0, 80) : 'NULL'}`);
      }
      if (existingCols.includes('pain_points')) {
        console.log(`   Pain Points: ${contact.pain_points ? JSON.stringify(contact.pain_points).substring(0, 80) : 'NULL'}`);
      }
      console.log(`   Created: ${contact.created_at}`);
    }

    // Check google_maps_agents columns
    console.log('\n\n=== GOOGLE_MAPS_AGENTS TABLE COLUMNS ===');
    const agentsCols = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'google_maps_agents'
      ORDER BY ordinal_position
    `);

    console.log('Columns with VARCHAR limit:');
    for (const col of agentsCols.rows) {
      if (col.data_type === 'character varying') {
        console.log(`  ${col.column_name}: VARCHAR(${col.character_maximum_length || 'unlimited'})`);
      } else if (col.data_type === 'text') {
        console.log(`  ${col.column_name}: TEXT`);
      }
    }

    // Check leads table columns
    console.log('\n\n=== LEADS TABLE COLUMNS ===');
    const leadsCols = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'leads'
      AND column_name IN ('name', 'company', 'location', 'title', 'industry', 'city', 'state', 'country')
      ORDER BY ordinal_position
    `);

    console.log('Key columns:');
    for (const col of leadsCols.rows) {
      const type = col.data_type === 'character varying'
        ? `VARCHAR(${col.character_maximum_length || 'unlimited'})`
        : col.data_type.toUpperCase();
      console.log(`  ${col.column_name}: ${type}`);
    }

    // Count contacts with data
    console.log('\n\n=== DATA STATISTICS ===');

    // Build stats query dynamically
    let statsQuery = `SELECT COUNT(*) as total, COUNT(website) as with_website`;
    if (existingCols.includes('company_description')) {
      statsQuery += `, COUNT(company_description) as with_description`;
    }
    if (existingCols.includes('emails')) {
      statsQuery += `, COUNT(CASE WHEN emails IS NOT NULL AND emails::text != '[]' AND emails::text != 'null' THEN 1 END) as with_emails`;
    }
    if (existingCols.includes('phones')) {
      statsQuery += `, COUNT(CASE WHEN phones IS NOT NULL AND phones::text != '[]' AND phones::text != 'null' THEN 1 END) as with_phones`;
    }
    if (existingCols.includes('city')) {
      statsQuery += `, COUNT(city) as with_city`;
    }
    statsQuery += `, COUNT(latitude) as with_coordinates FROM contacts`;

    const stats = await client.query(statsQuery);
    const s = stats.rows[0];
    console.log(`Total contacts: ${s.total}`);
    console.log(`With website: ${s.with_website}`);
    if (s.with_description !== undefined) console.log(`With company_description: ${s.with_description}`);
    if (s.with_emails !== undefined) console.log(`With emails array: ${s.with_emails}`);
    if (s.with_phones !== undefined) console.log(`With phones array: ${s.with_phones}`);
    if (s.with_city !== undefined) console.log(`With city: ${s.with_city}`);
    console.log(`With coordinates: ${s.with_coordinates}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
