// backend/scripts/test-outscraper.js
// Script para testar a API Outscraper e entender seu comportamento

require('dotenv').config({ path: '../.env' });
const axios = require('axios');

// ===================================
// CONFIGURAÇÃO
// ===================================
const OUTSCRAPER_API_KEY = process.env.OUTSCRAPER_API_KEY || '';

if (!OUTSCRAPER_API_KEY) {
  console.error('❌ ERROR: OUTSCRAPER_API_KEY not found in .env file');
  console.log('\n📝 Please add to backend/.env:');
  console.log('OUTSCRAPER_API_KEY=your_api_key_here\n');
  process.exit(1);
}

console.log('✅ Outscraper API Key found');
console.log('🔑 Key length:', OUTSCRAPER_API_KEY.length);

// ===================================
// TESTE 1: Busca Simples no Google Maps
// ===================================
async function testGoogleMapsSearch() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 1: Google Maps Search - Restaurantes em São Paulo');
  console.log('='.repeat(60));

  try {
    const url = 'https://api.app.outscraper.com/maps/search-v3';

    const params = {
      query: ['restaurantes italianos em São Paulo, SP, Brasil'],
      language: 'pt',
      region: 'br',
      limit: 10  // Limitar a 10 resultados para teste
    };

    console.log('\n📤 Request:');
    console.log('URL:', url);
    console.log('Params:', JSON.stringify(params, null, 2));

    const startTime = Date.now();

    const response = await axios.get(url, {
      params: params,
      headers: {
        'X-API-KEY': OUTSCRAPER_API_KEY
      },
      timeout: 120000  // 2 minutos de timeout
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n✅ Response received in', duration, 'seconds');
    console.log('📊 Status:', response.status);
    console.log('📊 Response type:', typeof response.data);
    console.log('📊 Is array?', Array.isArray(response.data));

    if (Array.isArray(response.data) && response.data.length > 0) {
      console.log('📊 Results count:', response.data[0].length || 0);

      // Mostrar primeiro resultado completo
      if (response.data[0] && response.data[0][0]) {
        console.log('\n📍 First result (full data):');
        console.log(JSON.stringify(response.data[0][0], null, 2));

        // Resumo dos campos disponíveis
        console.log('\n📋 Available fields in results:');
        console.log(Object.keys(response.data[0][0]));
      }
    } else if (response.data.id) {
      // API assíncrona - retornou task ID
      console.log('\n⏳ API is ASYNCHRONOUS - Task created');
      console.log('📋 Task ID:', response.data.id);
      console.log('📋 Status:', response.data.status);
      console.log('\n🔄 Will need to poll for results...');

      return {
        isAsync: true,
        taskId: response.data.id
      };
    }

    return {
      isAsync: false,
      data: response.data
    };

  } catch (error) {
    console.error('\n❌ ERROR in Google Maps search:');
    console.error('Message:', error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));

      if (error.response.status === 401) {
        console.error('\n🔐 Authentication failed - check your API key');
      } else if (error.response.status === 429) {
        console.error('\n⚠️  Rate limit exceeded');
      }
    }

    throw error;
  }
}

// ===================================
// TESTE 2: Verificar Status do Task (se API for assíncrona)
// ===================================
async function checkTaskStatus(taskId) {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 2: Checking Task Status');
  console.log('='.repeat(60));

  try {
    const url = `https://api.app.outscraper.com/requests/${taskId}`;

    console.log('\n📤 Request:');
    console.log('URL:', url);
    console.log('Task ID:', taskId);

    const response = await axios.get(url, {
      headers: {
        'X-API-KEY': OUTSCRAPER_API_KEY
      }
    });

    console.log('\n✅ Task status response:');
    console.log('Status:', response.data.status);
    console.log('Progress:', response.data.progress || 'N/A');
    console.log('Full response:', JSON.stringify(response.data, null, 2));

    return response.data;

  } catch (error) {
    console.error('\n❌ ERROR checking task status:');
    console.error('Message:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

// ===================================
// TESTE 3: Verificar créditos da conta
// ===================================
async function checkAccountCredits() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 3: Checking Account Credits');
  console.log('='.repeat(60));

  try {
    const url = 'https://api.app.outscraper.com/profile';

    const response = await axios.get(url, {
      headers: {
        'X-API-KEY': OUTSCRAPER_API_KEY
      }
    });

    console.log('\n✅ Account info:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.credits !== undefined) {
      console.log('\n💰 Remaining credits:', response.data.credits);
    }

    return response.data;

  } catch (error) {
    console.error('\n❌ ERROR checking credits:');
    console.error('Message:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    // Não falhar o teste todo se não conseguir checar créditos
  }
}

// ===================================
// EXECUTAR TODOS OS TESTES
// ===================================
async function runAllTests() {
  console.log('\n🚀 Starting Outscraper API Tests...\n');

  try {
    // Teste 1: Verificar créditos
    await checkAccountCredits();

    // Teste 2: Busca no Google Maps
    const searchResult = await testGoogleMapsSearch();

    // Teste 3: Se for assíncrona, verificar status do task
    if (searchResult.isAsync && searchResult.taskId) {
      console.log('\n⏳ Waiting 5 seconds before checking task status...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      await checkTaskStatus(searchResult.taskId);

      console.log('\n📝 NOTE: You may need to poll this endpoint until status = "Success"');
      console.log('📝 Then fetch results from the task endpoint');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS COMPLETED');
    console.log('='.repeat(60));

    console.log('\n📊 SUMMARY:');
    console.log('- API Type:', searchResult.isAsync ? 'ASYNCHRONOUS (task-based)' : 'SYNCHRONOUS (immediate response)');
    console.log('- Response time:', searchResult.isAsync ? 'Instant (returns task ID)' : 'Depends on query size');

    if (!searchResult.isAsync && searchResult.data) {
      console.log('- Results format: Array of arrays');
      console.log('- First query results in: response.data[0]');
    }

  } catch (error) {
    console.error('\n❌ Tests failed:', error.message);
    process.exit(1);
  }
}

// Executar
runAllTests();
