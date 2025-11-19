// backend/scripts/register-webhooks.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');

const dsn = process.env.UNIPILE_DSN;
const unipileToken = process.env.UNIPILE_ACCESS_TOKEN || process.env.UNIPILE_API_KEY;
const webhookUrl = process.env.WEBHOOK_URL || process.env.BASE_URL + '/api/webhooks/unipile' || 'https://your-domain.com/api/webhooks/unipile';

console.log('🔧 Registrando Webhooks no Unipile\n');
console.log('📍 DSN:', dsn);
console.log('🔗 Webhook URL:', webhookUrl);
console.log('');

if (!dsn || !unipileToken) {
  console.error('❌ Erro: UNIPILE_DSN e UNIPILE_ACCESS_TOKEN devem estar configurados no .env');
  console.error('   Adicione no .env:');
  console.error('   UNIPILE_DSN=your-dsn.unipile.com');
  console.error('   UNIPILE_ACCESS_TOKEN=your_token_here');
  process.exit(1);
}

if (webhookUrl.includes('your-domain.com')) {
  console.error('❌ Erro: Configure WEBHOOK_URL no .env com sua URL real');
  console.error('   Para desenvolvimento local, use ngrok: https://ngrok.com');
  console.error('   Exemplo: WEBHOOK_URL=https://abc123.ngrok.io/api/webhooks/unipile');
  process.exit(1);
}

async function registerWebhooks() {
  try {
    const url = `https://${dsn}/api/v1/webhooks`;

    // ✅ SEPARAR EVENTOS POR SOURCE (EXIGÊNCIA DA API UNIPILE)

    // 1️⃣ MESSAGING SOURCE - Eventos de mensagens
    const messagingEvents = [
      'message_received',     // Mensagens recebidas (incluindo mensagens próprias de outros dispositivos)
      'message_reaction',     // Reações a mensagens
      'message_read',         // Mensagens lidas
      'message_edited',       // Mensagens editadas
      'message_deleted',      // Mensagens deletadas
      'message_delivered',    // Mensagens entregues
    ];

    // 2️⃣ USERS SOURCE - Eventos de relacionamentos
    const usersEvents = [
      'new_relation',         // Novos relacionamentos (convites aceitos) - delay de até 8h
    ];

    console.log('📋 Eventos a serem registrados:\n');
    console.log('🔹 Messaging Source:');
    messagingEvents.forEach(event => console.log(`   - ${event}`));
    console.log('\n🔹 Users Source:');
    usersEvents.forEach(event => console.log(`   - ${event}`));
    console.log('');

    // ✅ REGISTRAR WEBHOOK 1: MESSAGING
    console.log('📤 [1/2] Registrando webhook de mensagens (messaging)...\n');

    const messagingPayload = {
      request_url: webhookUrl,
      source: 'messaging',
      events: messagingEvents
    };

    const messagingResponse = await axios.post(url, messagingPayload, {
      headers: {
        'X-API-KEY': unipileToken,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Webhook de mensagens registrado!');
    console.log('📊 ID:', messagingResponse.data.id || messagingResponse.data);
    console.log('');

    // ✅ REGISTRAR WEBHOOK 2: USERS
    console.log('📤 [2/2] Registrando webhook de usuários (users)...\n');

    const usersPayload = {
      request_url: webhookUrl,
      source: 'users',
      events: usersEvents
    };

    const usersResponse = await axios.post(url, usersPayload, {
      headers: {
        'X-API-KEY': unipileToken,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Webhook de usuários registrado!');
    console.log('📊 ID:', usersResponse.data.id || usersResponse.data);
    console.log('');

    // ✅ SUCESSO FINAL
    console.log('🎉 Pronto! Todos os webhooks foram registrados com sucesso!\n');
    console.log('🔗 Webhook URL:', webhookUrl);
    console.log('');
    console.log('📝 Próximos passos:');
    console.log('   1. Teste enviando uma mensagem no LinkedIn');
    console.log('   2. Monitore os logs: GET http://localhost:3001/api/webhooks/logs');
    console.log('   3. Veja estatísticas: GET http://localhost:3001/api/webhooks/stats');
    console.log('');
    console.log('⚠️  IMPORTANTE: Webhooks de new_relation podem demorar até 8 horas (polling do LinkedIn)');

  } catch (error) {
    console.error('❌ Erro ao registrar webhooks:', error.message);

    if (error.response) {
      console.error('\n📋 Detalhes do erro:');
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }

    process.exit(1);
  }
}

registerWebhooks();
