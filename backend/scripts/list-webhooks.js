// backend/scripts/list-webhooks.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');

const dsn = process.env.UNIPILE_DSN;
const unipileToken = process.env.UNIPILE_ACCESS_TOKEN || process.env.UNIPILE_API_KEY;

console.log('📋 Listando Webhooks do Unipile\n');
console.log('📍 DSN:', dsn);
console.log('');

if (!dsn || !unipileToken) {
  console.error('❌ Erro: UNIPILE_DSN e UNIPILE_ACCESS_TOKEN devem estar configurados no .env');
  console.error('   Adicione no .env:');
  console.error('   UNIPILE_DSN=your-dsn.unipile.com');
  console.error('   UNIPILE_ACCESS_TOKEN=your_token_here');
  process.exit(1);
}

async function listWebhooks() {
  try {
    const url = `https://${dsn}/api/v1/webhooks`;

    console.log('🔍 Buscando webhooks registrados...\n');

    const response = await axios.get(url, {
      headers: {
        'X-API-KEY': unipileToken,
        'Accept': 'application/json'
      }
    });

    const webhooks = response.data.items || response.data || [];

    if (webhooks.length === 0) {
      console.log('⚠️  Nenhum webhook registrado');
      console.log('');
      console.log('💡 Para registrar webhooks:');
      console.log('   node backend/scripts/register-webhooks.js');
      return;
    }

    console.log(`✅ ${webhooks.length} webhook(s) encontrado(s):\n`);
    console.log('─'.repeat(80));

    webhooks.forEach((webhook, index) => {
      console.log(`\n📌 Webhook #${index + 1}`);
      console.log(`   ID: ${webhook.id || webhook.webhook_id || 'N/A'}`);
      console.log(`   URL: ${webhook.request_url || webhook.url || 'N/A'}`);
      console.log(`   Source: ${webhook.source || 'N/A'}`);
      console.log(`   Events: ${(webhook.events || []).join(', ') || 'N/A'}`);
      if (webhook.created_at) {
        console.log(`   Criado em: ${webhook.created_at}`);
      }
      console.log('');
    });

    console.log('─'.repeat(80));
    console.log('');
    console.log('🛠️  Comandos úteis:');
    console.log('   Deletar: node backend/scripts/delete-webhook.js {webhook_id}');
    console.log('   Atualizar: node backend/scripts/update-webhook.js {webhook_id} {nova_url}');
    console.log('');

  } catch (error) {
    console.error('❌ Erro ao listar webhooks:', error.message);

    if (error.response) {
      console.error('\n📋 Detalhes do erro:');
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }

    process.exit(1);
  }
}

listWebhooks();
