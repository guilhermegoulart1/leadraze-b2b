// Script para testar diferentes parâmetros da API de mensagens da Unipile
require('dotenv').config();
const axios = require('axios');

const dsn = process.env.UNIPILE_DSN;
const token = process.env.UNIPILE_ACCESS_TOKEN;

const CHAT_ID = 'EOIN7WXhUmmep9hhrxiSiA';
const ACCOUNT_ID = 'rcgKVUpIRcO6-21Rb-xG7Q';
const OWN_NUMBER = '555199970022';

async function testWithParams(params = {}) {
  const queryString = new URLSearchParams({
    account_id: ACCOUNT_ID,
    limit: 50,
    ...params
  }).toString();

  const url = `https://${dsn}/api/v1/chats/${CHAT_ID}/messages?${queryString}`;
  console.log('📡 URL:', url);

  try {
    const response = await axios.get(url, {
      headers: {
        'X-API-KEY': token,
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    const messages = response.data.items || [];
    console.log(`   ✅ ${messages.length} mensagens`);

    // Analisar senders
    const fromOwn = messages.filter(msg => {
      const senderId = msg.sender_id || '';
      const senderClean = senderId.replace(/@s\.whatsapp\.net|@c\.us/gi, '');
      return senderClean === OWN_NUMBER;
    });

    const fromContact = messages.filter(msg => {
      const senderId = msg.sender_id || '';
      const senderClean = senderId.replace(/@s\.whatsapp\.net|@c\.us/gi, '');
      return senderClean !== OWN_NUMBER;
    });

    // Também verificar is_sender
    const isSenderTrue = messages.filter(m => m.is_sender === 1 || m.is_sender === true);
    const isSenderFalse = messages.filter(m => m.is_sender === 0 || m.is_sender === false);

    console.log(`   📊 Do próprio (sender_id=${OWN_NUMBER}): ${fromOwn.length}`);
    console.log(`   📊 Do contato: ${fromContact.length}`);
    console.log(`   📊 is_sender=1: ${isSenderTrue.length}`);
    console.log(`   📊 is_sender=0: ${isSenderFalse.length}`);

    return messages;
  } catch (error) {
    console.error(`   ❌ Erro: ${error.response?.status} - ${error.response?.data?.detail || error.message}`);
    return null;
  }
}

async function main() {
  console.log('🔍 Testando diferentes parâmetros da API Unipile\n');
  console.log('Chat ID:', CHAT_ID);
  console.log('Own Number:', OWN_NUMBER);
  console.log('');

  // Teste 1: Sem parâmetros extras
  console.log('\n=== Teste 1: Padrão ===');
  await testWithParams({});

  // Teste 2: Com folder=inbox
  console.log('\n=== Teste 2: folder=inbox ===');
  await testWithParams({ folder: 'inbox' });

  // Teste 3: Com folder=sent
  console.log('\n=== Teste 3: folder=sent ===');
  await testWithParams({ folder: 'sent' });

  // Teste 4: Com folder=all
  console.log('\n=== Teste 4: folder=all ===');
  await testWithParams({ folder: 'all' });

  // Teste 5: Com sender_type=me
  console.log('\n=== Teste 5: sender_type=me ===');
  await testWithParams({ sender_type: 'me' });

  // Teste 6: Com direction=sent
  console.log('\n=== Teste 6: direction=sent ===');
  await testWithParams({ direction: 'sent' });

  // Teste 7: Com include_sent=true
  console.log('\n=== Teste 7: include_sent=true ===');
  await testWithParams({ include_sent: 'true' });

  // Agora vamos verificar o endpoint /chats para ver a estrutura do chat
  console.log('\n\n=== Verificando estrutura do CHAT ===');
  try {
    const chatUrl = `https://${dsn}/api/v1/chats/${CHAT_ID}?account_id=${ACCOUNT_ID}`;
    console.log('📡 URL:', chatUrl);
    const chatResponse = await axios.get(chatUrl, {
      headers: {
        'X-API-KEY': token,
        'Accept': 'application/json'
      },
      timeout: 30000
    });
    console.log('Chat data:', JSON.stringify(chatResponse.data, null, 2));
  } catch (error) {
    console.error('❌ Erro ao buscar chat:', error.response?.status, error.message);
  }

  // Verificar endpoints de account
  console.log('\n\n=== Verificando dados da conta (account) ===');
  try {
    const accountUrl = `https://${dsn}/api/v1/accounts/${ACCOUNT_ID}`;
    console.log('📡 URL:', accountUrl);
    const accountResponse = await axios.get(accountUrl, {
      headers: {
        'X-API-KEY': token,
        'Accept': 'application/json'
      },
      timeout: 30000
    });
    console.log('Account data:', JSON.stringify(accountResponse.data, null, 2));
  } catch (error) {
    console.error('❌ Erro ao buscar account:', error.response?.status, error.message);
  }
}

main();
