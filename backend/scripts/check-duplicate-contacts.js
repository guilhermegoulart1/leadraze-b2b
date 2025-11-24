// Check for duplicate contacts from Google Maps
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

delete require.cache[require.resolve('../src/config/database')];
const db = require('../src/config/database');

async function checkDuplicates() {
  try {
    console.log('🔍 Verificando contacts duplicados...\n');

    const placeIds = ['ChIJiUYAW6pZzpQR2YtcUuwgxzc', 'ChIJ7xxOZ6pZzpQRK0-Gu_zWrQA'];

    const result = await db.query(`
      SELECT
        id, name, place_id,
        rating, phone, address,
        created_at
      FROM contacts
      WHERE place_id IN ($1, $2)
      ORDER BY created_at DESC
    `, placeIds);

    console.log(`📋 Contacts encontrados: ${result.rows.length}\n`);

    if (result.rows.length === 0) {
      console.log('  Nenhum contact encontrado com esses place_ids');
      console.log('  Isso significa que o erro não era de duplicados!\n');
    } else {
      result.rows.forEach(c => {
        console.log(`  ID: ${c.id}`);
        console.log(`  Nome: ${c.name}`);
        console.log(`  Place ID: ${c.place_id}`);
        console.log(`  Rating: ${c.rating || 'N/A'}`);
        console.log(`  Telefone: ${c.phone || 'N/A'}`);
        console.log(`  Endereço: ${c.address || 'N/A'}`);
        console.log(`  Criado em: ${c.created_at}`);
        console.log('');
      });
    }

    // Check if there are leads for these contacts
    const leadsResult = await db.query(`
      SELECT l.id, l.name, l.status, l.contact_id, c.place_id
      FROM leads l
      JOIN contacts c ON l.contact_id = c.id
      WHERE c.place_id IN ($1, $2)
    `, placeIds);

    console.log(`📊 Leads criados para esses contacts: ${leadsResult.rows.length}\n`);

    if (leadsResult.rows.length === 0) {
      console.log('  Nenhum lead criado para esses contacts!');
      console.log('  Os contacts foram inseridos mas os leads falharam.\n');
    } else {
      leadsResult.rows.forEach(l => {
        console.log(`  - Lead ${l.id}: ${l.name}`);
        console.log(`    Status: ${l.status}`);
        console.log(`    Contact ID: ${l.contact_id}`);
        console.log(`    Place ID: ${l.place_id}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

checkDuplicates();
