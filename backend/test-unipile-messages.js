// Script para testar a API de mensagens da Unipile
require('dotenv').config();
const axios = require('axios');

const dsn = process.env.UNIPILE_DSN;
const token = process.env.UNIPILE_ACCESS_TOKEN;

// Chat ID do "Pai" (da conversa que estava com problema)
const CHAT_ID = 'EOIN7WXhUmmep9hhrxiSiA';
const ACCOUNT_ID = 'rcgKVUpIRcO6-21Rb-xG7Q';
const OWN_NUMBER = '555199970022';

async function testMessages() {
  console.log('🔍 Testando API de mensagens da Unipile\n');
  console.log('DSN:', dsn);
  console.log('Chat ID:', CHAT_ID);
  console.log('Account ID:', ACCOUNT_ID);
  console.log('Own Number:', OWN_NUMBER);
  console.log('');

  try {
    // Buscar mensagens
    const url = `https://${dsn}/api/v1/chats/${CHAT_ID}/messages?account_id=${ACCOUNT_ID}&limit=100`;
    console.log('📡 URL:', url);
    console.log('');

    const response = await axios.get(url, {
      headers: {
        'X-API-KEY': token,
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    const messages = response.data.items || [];
    console.log(`✅ Total de mensagens retornadas: ${messages.length}`);
    console.log('');

    // Analisar quem são os senders
    const senders = {};
    messages.forEach(msg => {
      const senderId = msg.sender_id || msg.sender?.attendee_provider_id || 'unknown';
      const senderClean = senderId.replace(/@s\.whatsapp\.net|@c\.us/gi, '');
      if (!senders[senderClean]) {
        senders[senderClean] = { count: 0, messages: [] };
      }
      senders[senderClean].count++;
      senders[senderClean].messages.push({
        id: msg.id,
        text: (msg.text || '').substring(0, 50),
        is_sender: msg.is_sender,
        timestamp: msg.timestamp
      });
    });

    console.log('📊 Distribuição por sender:');
    for (const [sender, data] of Object.entries(senders)) {
      const isOwn = sender === OWN_NUMBER;
      console.log(`   ${sender}: ${data.count} mensagens ${isOwn ? '(PRÓPRIO NÚMERO)' : '(CONTATO)'}`);
    }
    console.log('');

    // Mostrar primeiras 10 mensagens
    console.log('📋 Primeiras 10 mensagens:');
    messages.slice(0, 10).forEach((msg, i) => {
      const senderId = msg.sender_id || msg.sender?.attendee_provider_id || '';
      const senderClean = senderId.replace(/@s\.whatsapp\.net|@c\.us/gi, '');
      const isOwn = senderClean === OWN_NUMBER;
      console.log(`   [${i}] ${isOwn ? '→ ENVIADA' : '← RECEBIDA'} | is_sender=${msg.is_sender} | sender=${senderClean}`);
      console.log(`       "${(msg.text || '').substring(0, 60)}"`);
      console.log(`       Campos extras: folder=${msg.folder || 'N/A'}, from_me=${msg.from_me}, outgoing=${msg.outgoing}`);
    });

    // Verificar se existe algum campo que indica mensagem enviada
    console.log('\n🔍 Estrutura completa da primeira mensagem:');
    console.log(JSON.stringify(messages[0], null, 2));

    // Verificar se há mensagens com sender igual ao own_number
    const ownMessages = messages.filter(msg => {
      const senderId = msg.sender_id || msg.sender?.attendee_provider_id || '';
      const senderClean = senderId.replace(/@s\.whatsapp\.net|@c\.us/gi, '');
      return senderClean === OWN_NUMBER;
    });

    console.log(`\n✅ Mensagens do próprio usuário (${OWN_NUMBER}): ${ownMessages.length}`);
    if (ownMessages.length === 0) {
      console.log('❌ PROBLEMA: Nenhuma mensagem enviada pelo usuário foi retornada pela API!');
      console.log('   Isso indica que a Unipile não está retornando as mensagens enviadas.');
    }

  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

testMessages();
