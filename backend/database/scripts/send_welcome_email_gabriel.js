/**
 * Script para enviar email de boas-vindas para gabriel.engel@gmail.com
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const emailService = require('../../src/services/emailService');
const db = require('../../src/config/database');

async function sendWelcomeEmail() {
  try {
    // Buscar dados do usuário
    const result = await db.query(`
      SELECT u.id, u.email, u.name, u.account_id, u.preferred_language
      FROM users u
      WHERE u.email = 'gabriel.engel@gmail.com'
    `);

    if (result.rows.length === 0) {
      throw new Error('Usuário gabriel.engel@gmail.com não encontrado');
    }

    const user = result.rows[0];
    console.log('Usuário encontrado:', user.name, '-', user.email);

    // Verificar se o serviço de email está pronto
    if (!emailService.isReady()) {
      throw new Error('Serviço de email não está configurado');
    }

    // Enviar email de boas-vindas
    const emailResult = await emailService.sendWelcome(user, user.account_id);

    console.log('\n========================================');
    console.log('EMAIL DE BOAS-VINDAS ENVIADO!');
    console.log('========================================');
    console.log('Para:', user.email);
    console.log('Job ID:', emailResult.jobId);
    console.log('Email Log ID:', emailResult.emailLogId);
    console.log('========================================');

    // Aguardar um pouco para o worker processar
    console.log('\nAguardando processamento do email...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verificar status do email
    const logResult = await db.query(`
      SELECT status, sent_at, error_message
      FROM email_logs
      WHERE id = $1
    `, [emailResult.emailLogId]);

    if (logResult.rows.length > 0) {
      const log = logResult.rows[0];
      console.log('Status:', log.status);
      if (log.sent_at) {
        console.log('Enviado em:', log.sent_at);
      }
      if (log.error_message) {
        console.log('Erro:', log.error_message);
      }
    }

  } catch (error) {
    console.error('ERRO:', error.message);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

sendWelcomeEmail();
