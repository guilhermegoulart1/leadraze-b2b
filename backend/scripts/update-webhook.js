// backend/scripts/update-webhook.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');

const dsn = process.env.UNIPILE_DSN;
const unipileToken = process.env.UNIPILE_ACCESS_TOKEN || process.env.UNIPILE_API_KEY;
const webhookId = process.argv[2];
const newUrl = process.argv[3];

console.log('🔄 Atualizando Webhook do Unipile\n');
console.log('📍 DSN:', dsn);
console.log('');

if (!dsn || !unipileToken) {
  console.error('❌ Erro: UNIPILE_DSN e UNIPILE_ACCESS_TOKEN devem estar configurados no .env');
  console.error('   Adicione no .env:');
  console.error('   UNIPILE_DSN=your-dsn.unipile.com');
  console.error('   UNIPILE_ACCESS_TOKEN=your_token_here');
  process.exit(1);
}

if (!webhookId || !newUrl) {
  console.error('❌ Erro: webhook_id e nova_url são obrigatórios\n');
  console.error('Uso:');
  console.error('   node backend/scripts/update-webhook.js {webhook_id} {nova_url}\n');
  console.error('Exemplo:');
  console.error('   node backend/scripts/update-webhook.js Pca406ioQG-O2sKRGzoDEw https://prod.com/api/webhooks/unipile\n');
  console.error('💡 Para ver webhooks disponíveis:');
  console.error('   node backend/scripts/list-webhooks.js');
  process.exit(1);
}

// Validar URL
try {
  new URL(newUrl);
} catch (e) {
  console.error('❌ Erro: URL inválida');
  console.error('   A URL deve começar com http:// ou https://');
  console.error('   Exemplo: https://seu-dominio.com/api/webhooks/unipile');
  process.exit(1);
}

async function updateWebhook() {
  try {
    const url = `https://${dsn}/api/v1/webhooks/${webhookId}`;

    console.log(`🎯 Webhook ID: ${webhookId}`);
    console.log(`🔗 Nova URL: ${newUrl}`);
    console.log('');
    console.log('⚙️  Atualizando webhook...\n');

    const response = await axios.patch(url, {
      request_url: newUrl
    }, {
      headers: {
        'X-API-KEY': unipileToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log('✅ Webhook atualizado com sucesso!\n');

    if (response.data) {
      console.log('📊 Resposta:');
      console.log(JSON.stringify(response.data, null, 2));
      console.log('');
    }

    console.log('💡 Para verificar a atualização:');
    console.log('   node backend/scripts/list-webhooks.js');
    console.log('');
    console.log('🧪 Teste o webhook:');
    console.log('   1. Envie uma mensagem no LinkedIn');
    console.log('   2. Verifique os logs: GET http://localhost:3001/api/webhooks/logs');
    console.log('');

  } catch (error) {
    console.error('❌ Erro ao atualizar webhook:', error.message);

    if (error.response) {
      console.error('\n📋 Detalhes do erro:');
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));

      if (error.response.status === 404) {
        console.error('');
        console.error('⚠️  Webhook não encontrado. Verifique o ID.');
        console.error('💡 Liste os webhooks disponíveis:');
        console.error('   node backend/scripts/list-webhooks.js');
      }
    }

    process.exit(1);
  }
}

updateWebhook();
