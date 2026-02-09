/**
 * Script para enviar email de boas vindas de teste
 * Uso: node scripts/test-welcome-email.js
 */

require('dotenv').config();
const emailService = require('../src/services/emailService');

const TEST_EMAIL = 'guilherme@orbitflow.com.br';
const TEST_NAME = 'Guilherme';
const FAKE_TOKEN = 'test-token-preview-only';

async function sendTestEmail() {
  console.log(`📧 Enviando email de boas vindas para ${TEST_EMAIL}...`);

  const setupUrl = `${process.env.FRONTEND_URL}/set-password?token=${FAKE_TOKEN}`;

  await emailService.sendWelcomeWithPasswordSetup({
    email: TEST_EMAIL,
    name: TEST_NAME
  }, setupUrl, null);

  console.log('✅ Email enfileirado com sucesso!');
  console.log(`   Link no email: ${setupUrl}`);
}

sendTestEmail()
  .then(() => {
    console.log('\n✅ Done');
    setTimeout(() => process.exit(0), 3000); // aguarda fila processar
  })
  .catch(error => {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  });
