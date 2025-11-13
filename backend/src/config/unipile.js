// backend/src/config/unipile.js
const axios = require('axios');

// Configuração do Unipile
const dsn = process.env.UNIPILE_DSN;
const unipileToken = (process.env.UNIPILE_API_KEY || process.env.UNIPILE_ACCESS_TOKEN || '').trim();

let initError = null;

// Validar configuração
if (!dsn || !unipileToken) {
  initError = 'UNIPILE_DSN and UNIPILE_ACCESS_TOKEN must be set in environment variables';
  console.error('❌ Unipile Init Error:', initError);
}

const unipileClient = {
  // ✅ Verificar se está inicializado
  isInitialized: () => {
    return !initError && !!dsn && !!unipileToken;
  },

  getError: () => {
    return initError;
  },

  // ================================
  // 🔗 ACCOUNT
  // ================================
  account: {
    connectLinkedin: async (credentials) => {
      const url = `https://${dsn}/api/v1/accounts`;
      
      const response = await axios.post(url, {
        provider: 'LINKEDIN',
        type: 'LINKEDIN',
        credentials: credentials
      }, {
        headers: {
          'X-API-KEY': unipileToken,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      return response.data;
    }
  },

  // ================================
  // 👤 USERS
  // ================================
  users: {
    getOwnProfile: async (accountId) => {
      const url = `https://${dsn}/api/v1/users/me?account_id=${accountId}`;
      
      const response = await axios.get(url, {
        headers: {
          'X-API-KEY': unipileToken,
          'Accept': 'application/json'
        },
        timeout: 15000
      });

      return response.data;
    },

    getOne: async (accountId, userId) => {
      const url = `https://${dsn}/api/v1/users/${userId}?account_id=${accountId}`;
      
      const response = await axios.get(url, {
        headers: {
          'X-API-KEY': unipileToken,
          'Accept': 'application/json'
        },
        timeout: 15000
      });

      return response.data;
    },

    search: async (params) => {
      const { account_id, ...bodyParams } = params;
      const url = `https://${dsn}/api/v1/users/search?account_id=${account_id}`;
      
      const response = await axios.post(url, bodyParams, {
        headers: {
          'X-API-KEY': unipileToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      return response.data;
    },

    sendConnectionRequest: async (params) => {
      const { account_id, user_id, message } = params;
      const url = `https://${dsn}/api/v1/users/${user_id}/connection?account_id=${account_id}`;
      
      const body = message ? { message } : {};
      
      const response = await axios.post(url, body, {
        headers: {
          'X-API-KEY': unipileToken,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      return response.data;
    }
  },

  // ================================
  // 🔍 LINKEDIN
  // ================================
  linkedin: {
    search: async (params) => {
      try {
        // ✅ EXTRAIR account_id do params e colocar na URL
        const { account_id, ...bodyParams } = params;

        if (!account_id) {
          throw new Error('account_id is required for LinkedIn search');
        }

        // ✅ URL com account_id como query parameter
        const url = `https://${dsn}/api/v1/linkedin/search?account_id=${account_id}`;

        console.log('🔍 === UNIPILE SEARCH REQUEST ===');
        console.log('📍 URL:', url);
        console.log('🔐 Token length:', unipileToken.length);
        console.log('📦 Body params:', JSON.stringify(bodyParams, null, 2));

        // ✅ LIMPAR PARÂMETROS VAZIOS DO BODY
        const cleanBody = {};
        Object.entries(bodyParams).forEach(([key, value]) => {
          if (value !== '' && value !== undefined && value !== null) {
            // ✅ TRATAMENTO ESPECIAL PARA ARRAYS
            if (Array.isArray(value) && value.length > 0) {
              cleanBody[key] = value;
            } else if (!Array.isArray(value)) {
              cleanBody[key] = value;
            }
          }
        });

        console.log('🧹 Clean body (after filtering):', JSON.stringify(cleanBody, null, 2));

        const response = await axios.post(url, cleanBody, {
          headers: {
            'X-API-KEY': unipileToken,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          timeout: 30000 // ✅ TIMEOUT de 30 segundos
        });
        
        if (!response || !response.data) {
          throw new Error('Unipile search failed: no response data');
        }

        console.log('✅ === UNIPILE SEARCH RESPONSE ===');
        console.log('📊 Status:', response.status);
        console.log('📊 Items count:', response.data.items?.length || 0);
        console.log('🔗 Has cursor:', !!response.data.cursor);
        console.log('📄 Paging info:', JSON.stringify(response.data.paging, null, 2));

        return response.data;
        
      } catch (error) {
        console.error('❌ === UNIPILE SEARCH ERROR ===');
        console.error('❌ Message:', error.message);
        console.error('❌ Status:', error.response?.status);
        console.error('❌ Error type:', error.response?.data?.type);
        console.error('❌ Error detail:', error.response?.data?.detail);
        console.error('❌ Response data:', JSON.stringify(error.response?.data, null, 2));
        
        throw error;
      }
    }
  }
};

module.exports = unipileClient;