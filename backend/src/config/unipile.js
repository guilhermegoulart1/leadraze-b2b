// backend/src/config/unipile.js
const axios = require('axios');

// Configuração do Unipile
const dsn = process.env.UNIPILE_DSN;
const unipileToken = (process.env.UNIPILE_ACCESS_TOKEN || process.env.UNIPILE_API_KEY || '').trim();

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
    // Gerar link de autenticação hospedada (Hosted Auth Link)
    getHostedAuthLink: async (options = {}) => {
      const url = `https://${dsn}/api/v1/hosted/accounts/link`;

      // expiresOn deve ser ISO 8601: YYYY-MM-DDTHH:MM:SS.sssZ
      const expiresDate = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos
      const expiresOnISO = expiresDate.toISOString(); // Formato: 2025-11-29T02:53:03.000Z

      const body = {
        type: 'create',
        api_url: `https://${dsn}`,
        expiresOn: expiresOnISO,
        // Todos os providers disponíveis: Messaging + Email
        providers: options.providers || ['LINKEDIN', 'WHATSAPP', 'INSTAGRAM', 'MESSENGER', 'TELEGRAM', 'TWITTER', 'GOOGLE', 'OUTLOOK', 'MAIL'],
        success_redirect_url: options.successRedirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/channels?connected=true`,
        failure_redirect_url: options.failureRedirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/channels?error=true`
      };

      // Adicionar name se fornecido (útil para identificar no notify_url)
      if (options.name) {
        body.name = options.name;
      }

      // Adicionar notify_url se fornecido
      if (options.notifyUrl) {
        body.notify_url = options.notifyUrl;
      }

      console.log('🔗 Gerando hosted auth link:', JSON.stringify(body, null, 2));

      try {
        const response = await axios.post(url, body, {
          headers: {
            'X-API-KEY': unipileToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 15000
        });

        console.log('✅ Hosted auth link gerado:', response.data);
        return response.data;
      } catch (error) {
        console.error('❌ Erro Unipile Hosted Auth:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: JSON.stringify(error.response?.data, null, 2),
          message: error.message
        });
        throw error;
      }
    },

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
    },

    // Buscar dados atualizados da conta
    getAccountById: async (accountId) => {
      const url = `https://${dsn}/api/v1/accounts/${accountId}`;

      const response = await axios.get(url, {
        headers: {
          'X-API-KEY': unipileToken,
          'Accept': 'application/json'
        },
        timeout: 15000
      });

      return response.data;
    },

    // Desconectar conta do Unipile
    disconnectAccount: async (accountId) => {
      const url = `https://${dsn}/api/v1/accounts/${accountId}`;

      const response = await axios.delete(url, {
        headers: {
          'X-API-KEY': unipileToken,
          'Accept': 'application/json'
        },
        timeout: 15000
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
    },

    // Buscar perfil completo de um usuário (com todas as seções do LinkedIn)
    getFullProfile: async (accountId, userId) => {
      const url = `https://${dsn}/api/v1/users/${userId}?account_id=${accountId}&linkedin_sections=*`;

      const response = await axios.get(url, {
        headers: {
          'X-API-KEY': unipileToken,
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      return response.data;
    }
  },

  // ================================
  // 🔗 CONNECTIONS (1º GRAU)
  // ================================
  connections: {
    // Buscar conexões de 1º grau usando search com filtro network_distance
    search: async (params) => {
      const { account_id, limit = 100, cursor, keywords, job_title, industry, location } = params;

      if (!account_id) {
        throw new Error('account_id is required for connections search');
      }

      const url = `https://${dsn}/api/v1/linkedin/search?account_id=${account_id}`;

      // Body com filtro de 1º grau (conexões existentes)
      const body = {
        api: 'classic', // OBRIGATÓRIO pela API Unipile
        category: 'people',
        network_distance: [1], // Apenas 1º grau (já conectados!)
        limit: limit
      };

      // Adicionar filtros opcionais
      if (keywords) body.keywords = keywords;
      if (job_title) body.job_title = Array.isArray(job_title) ? job_title : [job_title];
      if (industry) body.industry = Array.isArray(industry) ? industry : [industry];
      if (location) body.location = location;
      if (cursor) body.cursor = cursor;

      console.log('🔍 === UNIPILE CONNECTIONS SEARCH ===');
      console.log('📍 URL:', url);
      console.log('📦 Body:', JSON.stringify(body, null, 2));

      const response = await axios.post(url, body, {
        headers: {
          'X-API-KEY': unipileToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 60000 // Timeout maior para busca de conexões
      });

      console.log('✅ Conexões encontradas:', response.data.items?.length || 0);

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
  },

  // ================================
  // 💬 MESSAGING
  // ================================
  messaging: {
    send: async (params) => {
      const { account_id, user_id, text } = params;

      if (!account_id || !user_id || !text) {
        throw new Error('account_id, user_id, and text are required');
      }

      const url = `https://${dsn}/api/v1/messaging/send?account_id=${account_id}`;

      const response = await axios.post(url, {
        attendees_ids: [user_id],
        text: text
      }, {
        headers: {
          'X-API-KEY': unipileToken,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      return response.data;
    },

    // Get messages from a chat
    getMessages: async (params) => {
      const { account_id, chat_id, limit = 50, before_id } = params;

      if (!account_id || !chat_id) {
        throw new Error('account_id and chat_id are required');
      }

      let url = `https://${dsn}/api/v1/chats/${chat_id}/messages?account_id=${account_id}&limit=${limit}`;

      if (before_id) {
        url += `&before_id=${before_id}`;
      }

      const response = await axios.get(url, {
        headers: {
          'X-API-KEY': unipileToken,
          'Accept': 'application/json'
        },
        timeout: 15000
      });

      return response.data;
    },

    // Send message to existing chat
    sendMessage: async (params) => {
      const { account_id, chat_id, text } = params;

      if (!account_id || !chat_id || !text) {
        throw new Error('account_id, chat_id, and text are required');
      }

      const url = `https://${dsn}/api/v1/chats/${chat_id}/messages?account_id=${account_id}`;

      const response = await axios.post(url, {
        text: text
      }, {
        headers: {
          'X-API-KEY': unipileToken,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      return response.data;
    },

    // Send message with attachments to existing chat
    sendMessageWithAttachment: async (params) => {
      const { account_id, chat_id, text, attachments } = params;

      if (!account_id || !chat_id) {
        throw new Error('account_id and chat_id are required');
      }

      if (!attachments || attachments.length === 0) {
        throw new Error('At least one attachment is required');
      }

      const url = `https://${dsn}/api/v1/chats/${chat_id}/messages?account_id=${account_id}`;

      // Create FormData for multipart request
      const FormData = require('form-data');
      const formData = new FormData();

      // Add text if provided
      if (text && text.trim()) {
        formData.append('text', text.trim());
      }

      // Add attachments - each attachment is { filename, buffer, mimetype }
      for (const attachment of attachments) {
        formData.append('attachments', attachment.buffer, {
          filename: attachment.filename,
          contentType: attachment.mimetype
        });
      }

      const response = await axios.post(url, formData, {
        headers: {
          'X-API-KEY': unipileToken,
          ...formData.getHeaders()
        },
        timeout: 60000, // Longer timeout for file uploads
        maxContentLength: 20 * 1024 * 1024, // 20MB max
        maxBodyLength: 20 * 1024 * 1024
      });

      return response.data;
    },

    // Get attachment from a message
    getAttachment: async (params) => {
      const { account_id, message_id, attachment_id } = params;

      if (!account_id || !message_id || !attachment_id) {
        throw new Error('account_id, message_id, and attachment_id are required');
      }

      const url = `https://${dsn}/api/v1/messages/${message_id}/attachments/${attachment_id}?account_id=${account_id}`;

      const response = await axios.get(url, {
        headers: {
          'X-API-KEY': unipileToken,
          'Accept': '*/*'
        },
        responseType: 'arraybuffer',
        timeout: 30000
      });

      return {
        data: response.data,
        contentType: response.headers['content-type'],
        contentDisposition: response.headers['content-disposition']
      };
    },

    // Get all chats
    getChats: async (params) => {
      const { account_id, limit = 50, cursor } = params;

      if (!account_id) {
        throw new Error('account_id is required');
      }

      let url = `https://${dsn}/api/v1/chats?account_id=${account_id}&limit=${limit}`;

      if (cursor) {
        url += `&cursor=${cursor}`;
      }

      const response = await axios.get(url, {
        headers: {
          'X-API-KEY': unipileToken,
          'Accept': 'application/json'
        },
        timeout: 15000
      });

      return response.data;
    },

    // Get single chat details
    getChat: async (params) => {
      const { account_id, chat_id } = params;

      if (!account_id || !chat_id) {
        throw new Error('account_id and chat_id are required');
      }

      const url = `https://${dsn}/api/v1/chats/${chat_id}?account_id=${account_id}`;

      const response = await axios.get(url, {
        headers: {
          'X-API-KEY': unipileToken,
          'Accept': 'application/json'
        },
        timeout: 15000
      });

      return response.data;
    },

    // Get attendee full data (name, phone, profile picture URL, etc.)
    // https://developer.unipile.com/reference/chatattendeescontroller_getattendeebyid
    getAttendeeById: async (attendeeId) => {
      if (!attendeeId) {
        throw new Error('attendeeId is required');
      }

      const url = `https://${dsn}/api/v1/chat_attendees/${attendeeId}`;

      try {
        const response = await axios.get(url, {
          headers: {
            'X-API-KEY': unipileToken,
            'Accept': 'application/json'
          },
          timeout: 15000
        });

        return response.data;
      } catch (error) {
        if (error.response?.status === 404) {
          console.warn(`⚠️ Attendee ${attendeeId} não encontrado`);
          return null;
        }
        throw error;
      }
    },

    // Get attendee profile picture
    // https://developer.unipile.com/reference/chatattendeescontroller_getattendeeprofilepicture
    getAttendeePicture: async (attendeeId) => {
      if (!attendeeId) {
        throw new Error('attendeeId is required');
      }

      const url = `https://${dsn}/api/v1/chat_attendees/${attendeeId}/picture`;

      const response = await axios.get(url, {
        headers: {
          'X-API-KEY': unipileToken,
          'Accept': '*/*'
        },
        responseType: 'arraybuffer',
        timeout: 15000,
        // Don't throw on 404 - attendee might not have a profile picture
        validateStatus: (status) => status < 500
      });

      if (response.status === 404 || response.status === 204) {
        return null; // No profile picture available
      }

      if (response.status !== 200) {
        console.warn(`⚠️ Unipile attendee picture returned status ${response.status}`);
        return null;
      }

      return {
        data: Buffer.from(response.data),
        contentType: response.headers['content-type'] || 'image/jpeg',
        contentLength: response.headers['content-length']
      };
    },

    // Extract own profile from chats (for WhatsApp, Instagram, etc.)
    // The Unipile API doesn't have a direct /users/me for non-LinkedIn accounts
    // So we need to get the "own attendee" from chat data
    getOwnProfileFromChats: async (accountId) => {
      console.log(`🔍 Buscando perfil próprio via chats para account ${accountId}`);

      // First, get the account info to find the phone number/identifier
      const accountUrl = `https://${dsn}/api/v1/accounts/${accountId}`;
      const accountResponse = await axios.get(accountUrl, {
        headers: {
          'X-API-KEY': unipileToken,
          'Accept': 'application/json'
        },
        timeout: 15000
      });

      const accountData = accountResponse.data;
      const connectionParams = accountData?.connection_params?.im || {};
      const ownPhoneNumber = connectionParams.phone_number || connectionParams.phone || accountData.name;

      console.log(`📱 Número próprio identificado: ${ownPhoneNumber}`);

      // Get chats to find own attendee
      const chatsUrl = `https://${dsn}/api/v1/chats?account_id=${accountId}&limit=10`;
      const chatsResponse = await axios.get(chatsUrl, {
        headers: {
          'X-API-KEY': unipileToken,
          'Accept': 'application/json'
        },
        timeout: 15000
      });

      const chats = chatsResponse.data.items || chatsResponse.data || [];
      console.log(`💬 Encontrados ${chats.length} chats`);

      if (chats.length === 0) {
        console.log('⚠️ Nenhum chat encontrado - não é possível extrair perfil');
        return null;
      }

      // Look for own attendee in chats
      let ownProfile = null;

      for (const chat of chats) {
        const attendees = chat.attendees || [];
        console.log(`   Chat ${chat.id}: ${attendees.length} attendees`);

        for (const attendee of attendees) {
          // Check if this attendee is "self" or matches our phone number
          const attendeeId = attendee.id || attendee.identifier || '';
          const attendeeName = attendee.name || attendee.display_name || '';
          const attendeePhone = attendee.phone_number || attendee.identifier || '';

          console.log(`     Attendee: ${attendeeName} (${attendeeId})`);

          // The own attendee usually has is_self=true or matches the account's phone
          if (attendee.is_self === true ||
              attendeeId.includes(ownPhoneNumber) ||
              attendeePhone.includes(ownPhoneNumber) ||
              (ownPhoneNumber && attendeeName === ownPhoneNumber)) {

            console.log(`   ✅ Encontrado perfil próprio!`);
            console.log(`   📊 Dados do attendee:`, JSON.stringify(attendee, null, 2));

            ownProfile = {
              name: attendee.name || attendee.display_name || attendee.pushname,
              profile_picture: attendee.profile_picture || attendee.profile_picture_url || attendee.picture_url,
              phone_number: attendee.phone_number || attendee.identifier || ownPhoneNumber,
              id: attendee.id,
              is_self: true
            };
            break;
          }
        }

        if (ownProfile) break;
      }

      return ownProfile;
    }
  }
};

module.exports = unipileClient;