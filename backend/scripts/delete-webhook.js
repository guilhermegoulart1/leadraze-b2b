// backend/scripts/delete-webhook.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');

const dsn = process.env.UNIPILE_DSN;
const unipileToken = process.env.UNIPILE_ACCESS_TOKEN || process.env.UNIPILE_API_KEY;
const webhookId = process.argv[2];

console.log('🗑️  Deletando Webhook do Unipile\n');
console.log('📍 DSN:', dsn);
console.log('');

if (!dsn || !unipileToken) {
  console.error('❌ Erro: UNIPILE_DSN e UNIPILE_ACCESS_TOKEN devem estar configurados no .env');
  console.error('   Adicione no .env:');
  console.error('   UNIPILE_DSN=your-dsn.unipile.com');
  console.error('   UNIPILE_ACCESS_TOKEN=your_token_here');
  process.exit(1);
}

if (!webhookId) {
  console.error('❌ Erro: webhook_id é obrigatório\n');
  console.error('Uso:');
  console.error('   node backend/scripts/delete-webhook.js {webhook_id}\n');
  console.error('Exemplo:');
  console.error('   node backend/scripts/delete-webhook.js Pca406ioQG-O2sKRGzoDEw\n');
  console.error('💡 Para ver webhooks disponíveis:');
  console.error('   node backend/scripts/list-webhooks.js');
  process.exit(1);
}

async function deleteWebhook() {
  try {
    const url = `https://${dsn}/api/v1/webhooks/${webhookId}`;

    console.log(`🎯 Webhook ID: ${webhookId}`);
    console.log('');
    console.log('⚠️  Deletando webhook...\n');

    const response = await axios.delete(url, {
      headers: {
        'X-API-KEY': unipileToken,
        'Accept': 'application/json'
      }
    });

    console.log('✅ Webhook deletado com sucesso!\n');

    if (response.data) {
      console.log('📊 Resposta:');
      console.log(JSON.stringify(response.data, null, 2));
      console.log('');
    }

    console.log('💡 Para ver webhooks restantes:');
    console.log('   node backend/scripts/list-webhooks.js');
    console.log('');

  } catch (error) {
    console.error('❌ Erro ao deletar webhook:', error.message);

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

deleteWebhook();
