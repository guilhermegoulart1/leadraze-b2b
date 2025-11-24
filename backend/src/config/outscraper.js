// backend/src/config/outscraper.js
const axios = require('axios');

// Configuração do Outscraper
const apiKey = (process.env.OUTSCRAPER_API_KEY || '').trim();
const baseURL = 'https://api.app.outscraper.com';

let initError = null;

// Validar configuração
if (!apiKey) {
  initError = 'OUTSCRAPER_API_KEY must be set in environment variables';
  console.error('❌ Outscraper Init Error:', initError);
}

const outscraperClient = {
  // ✅ Verificar se está inicializado
  isInitialized: () => {
    return !initError && !!apiKey;
  },

  getError: () => {
    return initError;
  },

  // ================================
  // 📊 ACCOUNT
  // ================================
  account: {
    /**
     * Busca informações da conta e créditos disponíveis
     */
    getProfile: async () => {
      try {
        const url = `${baseURL}/profile`;

        console.log('🔍 === OUTSCRAPER GET PROFILE ===');
        console.log('📍 URL:', url);

        const response = await axios.get(url, {
          headers: {
            'X-API-KEY': apiKey
          },
          timeout: 15000
        });

        console.log('✅ Profile response:', response.status);
        console.log('💰 Credits:', response.data.credits || 'N/A');

        return response.data;
      } catch (error) {
        console.error('❌ Error getting Outscraper profile:', error.message);
        throw error;
      }
    }
  },

  // ================================
  // 🗺️ GOOGLE MAPS
  // ================================
  maps: {
    /**
     * Busca estabelecimentos no Google Maps
     * @param {Object} params - Parâmetros de busca
     * @param {string|string[]} params.query - Query de busca (ex: "restaurantes em São Paulo")
     * @param {string} params.language - Código do idioma (ex: "pt", "en")
     * @param {string} params.region - Código da região (ex: "br", "us")
     * @param {number} params.limit - Limite de resultados (padrão: 100)
     * @param {boolean} params.extractContacts - Extrair emails e redes sociais (mais lento)
     * @param {number} params.rating - Rating mínimo (1-5)
     * @param {number} params.minReviews - Número mínimo de reviews
     */
    search: async (params) => {
      try {
        const {
          query,
          language = 'pt',
          region = 'br',
          limit = 100,
          extractContacts = false,
          rating,
          minReviews
        } = params;

        if (!query) {
          throw new Error('Query parameter is required for Google Maps search');
        }

        const url = `${baseURL}/maps/search-v3`;

        // Construir parâmetros da requisição
        const requestParams = {
          query: Array.isArray(query) ? query : [query],
          language,
          region,
          limit
        };

        // Adicionar parâmetros opcionais se fornecidos
        if (extractContacts) {
          requestParams.extractContacts = true;
        }

        if (rating !== undefined && rating !== null) {
          requestParams.rating = rating;
        }

        if (minReviews !== undefined && minReviews !== null) {
          requestParams.minReviews = minReviews;
        }

        console.log('🔍 === OUTSCRAPER MAPS SEARCH REQUEST ===');
        console.log('📍 URL:', url);
        console.log('🔐 API Key length:', apiKey.length);
        console.log('📦 Params:', JSON.stringify(requestParams, null, 2));

        const startTime = Date.now();

        const response = await axios.get(url, {
          params: requestParams,
          headers: {
            'X-API-KEY': apiKey
          },
          timeout: 120000 // 2 minutos para queries grandes
        });

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log('✅ === OUTSCRAPER MAPS SEARCH RESPONSE ===');
        console.log('📊 Status:', response.status);
        console.log('⏱️ Duration:', duration, 'seconds');
        console.log('📊 Response type:', typeof response.data);
        console.log('📊 Is array:', Array.isArray(response.data));

        // Verificar se é resposta síncrona (array de resultados) ou assíncrona (task ID)
        if (response.data.id) {
          // Resposta assíncrona - task criado
          console.log('⏳ API returned TASK ID - async mode');
          console.log('📋 Task ID:', response.data.id);
          console.log('📋 Status:', response.data.status);

          return {
            isAsync: true,
            taskId: response.data.id,
            status: response.data.status
          };
        } else if (Array.isArray(response.data)) {
          // Resposta síncrona - resultados diretos
          console.log('✅ API returned RESULTS - sync mode');

          // Outscraper retorna array de arrays (cada query é um array)
          const businesses = response.data[0] || [];
          console.log('📊 Businesses count:', businesses.length);

          return {
            isAsync: false,
            count: businesses.length,
            businesses: businesses
          };
        } else {
          throw new Error('Unexpected response format from Outscraper API');
        }

      } catch (error) {
        console.error('❌ === OUTSCRAPER MAPS SEARCH ERROR ===');
        console.error('❌ Message:', error.message);
        console.error('❌ Status:', error.response?.status);
        console.error('❌ Response data:', JSON.stringify(error.response?.data, null, 2));

        if (error.response?.status === 401) {
          throw new Error('Outscraper authentication failed - check your API key');
        } else if (error.response?.status === 429) {
          throw new Error('Outscraper rate limit exceeded - try again later');
        } else if (error.response?.status === 402) {
          throw new Error('Insufficient Outscraper credits - please top up your account');
        }

        throw error;
      }
    }
  },

  // ================================
  // 📋 TASKS (para API assíncrona)
  // ================================
  tasks: {
    /**
     * Verifica o status de um task
     * @param {string} taskId - ID do task retornado pela API
     */
    getStatus: async (taskId) => {
      try {
        const url = `${baseURL}/requests/${taskId}`;

        console.log('🔍 === OUTSCRAPER GET TASK STATUS ===');
        console.log('📍 URL:', url);
        console.log('📋 Task ID:', taskId);

        const response = await axios.get(url, {
          headers: {
            'X-API-KEY': apiKey
          },
          timeout: 15000
        });

        console.log('✅ Task status response:');
        console.log('📊 Status:', response.data.status);
        console.log('📊 Progress:', response.data.progress || 'N/A');

        return response.data;

      } catch (error) {
        console.error('❌ Error getting task status:', error.message);
        throw error;
      }
    },

    /**
     * Busca os resultados de um task completo
     * @param {string} taskId - ID do task
     */
    getResults: async (taskId) => {
      try {
        // Primeiro verifica o status
        const taskStatus = await outscraperClient.tasks.getStatus(taskId);

        if (taskStatus.status !== 'Success') {
          throw new Error(`Task not completed yet. Status: ${taskStatus.status}`);
        }

        // Se tiver os resultados no próprio objeto de status
        if (taskStatus.data && Array.isArray(taskStatus.data)) {
          const businesses = taskStatus.data[0] || [];

          return {
            count: businesses.length,
            businesses: businesses
          };
        }

        // Caso contrário, buscar na URL de resultados (se disponível)
        if (taskStatus.result_url) {
          console.log('📥 Fetching results from URL:', taskStatus.result_url);

          const response = await axios.get(taskStatus.result_url, {
            timeout: 30000
          });

          const businesses = Array.isArray(response.data) ? response.data[0] || [] : [];

          return {
            count: businesses.length,
            businesses: businesses
          };
        }

        throw new Error('Unable to retrieve task results - no data available');

      } catch (error) {
        console.error('❌ Error getting task results:', error.message);
        throw error;
      }
    },

    /**
     * Poll de um task até completar (com timeout)
     * @param {string} taskId - ID do task
     * @param {number} maxAttempts - Número máximo de tentativas (padrão: 60)
     * @param {number} interval - Intervalo entre tentativas em ms (padrão: 5000)
     */
    pollUntilComplete: async (taskId, maxAttempts = 60, interval = 5000) => {
      console.log(`⏳ Polling task ${taskId} (max ${maxAttempts} attempts, ${interval}ms interval)`);

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const status = await outscraperClient.tasks.getStatus(taskId);

        console.log(`📊 Attempt ${attempt}/${maxAttempts} - Status: ${status.status}`);

        if (status.status === 'Success') {
          console.log('✅ Task completed successfully');
          return await outscraperClient.tasks.getResults(taskId);
        } else if (status.status === 'Failed' || status.status === 'Error') {
          throw new Error(`Task failed with status: ${status.status}`);
        }

        // Aguardar antes da próxima tentativa
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      }

      throw new Error(`Task timeout after ${maxAttempts} attempts`);
    }
  }
};

module.exports = outscraperClient;
