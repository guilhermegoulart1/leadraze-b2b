// List all Google Maps contacts
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

delete require.cache[require.resolve('../src/config/database')];
const db = require('../src/config/database');

async function listContacts() {
  try {
    const contacts = await db.query(`
      SELECT
        id, name, company, phone, email, place_id,
        rating, business_category, created_at
      FROM contacts
      WHERE source = 'google_maps'
      ORDER BY created_at DESC
    `);

    console.log('📋 Total contacts do Google Maps:', contacts.rows.length);
    console.log('\n');

    contacts.rows.forEach((c, index) => {
      console.log(`${index + 1}. ${c.name}`);
      console.log(`   Business: ${c.business_category || 'N/A'}`);
      console.log(`   Phone: ${c.phone || 'N/A'}`);
      console.log(`   Email: ${c.email || 'N/A'}`);
      console.log(`   Rating: ${c.rating || 'N/A'}`);
      console.log(`   Created: ${c.created_at}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

listContacts();
