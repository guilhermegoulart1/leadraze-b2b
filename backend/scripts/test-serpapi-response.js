// Test SerpApi response to see what data is being returned
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const serpApiClient = require('../src/config/serpapi');

async function testSerpApi() {
  try {
    console.log('🔍 Testing SerpApi with the same query from the agent...\n');

    const params = {
      query: 'dentist em Sé, Rua Santa Teresa, Glicério, Sé, São Paulo',
      location: '@-23.55065070,-46.63338240,14z',
      start: 0,
      hl: 'pt'
    };

    console.log('Query:', params.query);
    console.log('Location:', params.location);
    console.log('\n⏳ Fetching results from SerpApi...\n');

    const results = await serpApiClient.searchGoogleMaps(params);

    console.log('📊 Results Summary:');
    console.log('  Total results:', results.total_results);
    console.log('  Has next page:', results.pagination.has_next_page);
    console.log('\n📋 Raw places data:\n');

    // Show first 3 places in detail
    results.places.slice(0, 3).forEach((place, index) => {
      console.log(`\n========== PLACE ${index + 1} ==========`);
      console.log('Title:', place.title);
      console.log('Place ID:', place.place_id);
      console.log('Data CID:', place.data_cid);
      console.log('Address:', place.address);
      console.log('Phone:', place.phone);
      console.log('Website:', place.website);
      console.log('Rating:', place.rating);
      console.log('Reviews:', place.reviews);
      console.log('Type:', place.type);
      console.log('GPS:', place.gps_coordinates);
      console.log('Price:', place.price);
      console.log('Service options:', place.service_options);
      console.log('Operating hours:', place.operating_hours);
      console.log('\n🔍 Full object:');
      console.log(JSON.stringify(place, null, 2));
    });

    console.log('\n\n✅ Test complete!');

  } catch (error) {
    console.error('❌ Error testing SerpApi:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

testSerpApi();
