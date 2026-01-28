/**
 * Script para enviar email de boas-vindas com link de senha para WILLIAN MILANE
 */

const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const emailService = require('../../src/services/emailService');
const db = require('../../src/config/database');

const WILLIAN_EMAIL = 'willian.milane@squadcontabil.com.br';

async function sendWelcomeWithPasswordSetup() {
  try {
    // Buscar dados do usuário
    const result = await db.query(`
      SELECT u.id, u.email, u.name, u.account_id, u.preferred_language
      FROM users u
      WHERE u.email = $1
    `, [WILLIAN_EMAIL]);

    if (result.rows.length === 0) {
      throw new Error(`Usuário ${WILLIAN_EMAIL} não encontrado`);
    }

    const user = result.rows[0];
    console.log('Usuário encontrado:', user.name, '-', user.email);
    console.log('Account ID:', user.account_id);

    // Gerar password reset token (igual ao createAccountFromStripe)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Atualizar usuário com token
    await db.query(`
      UPDATE users
      SET password_reset_token = $1,
          password_reset_expires = $2,
          must_change_password = true
      WHERE id = $3
    `, [resetTokenHash, resetTokenExpiry, user.id]);

    console.log('✓ Password reset token gerado e salvo no banco');

    // Verificar se o serviço de email está pronto
    if (!emailService.isReady()) {
      throw new Error('Serviço de email não está configurado');
    }

    // Construir URL de setup de senha
    const frontendUrl = process.env.FRONTEND_URL || 'https://app.getraze.co';
    const setupUrl = `${frontendUrl}/set-password?token=${resetToken}`;

    // Enviar email de boas-vindas com setup de senha
    const emailResult = await emailService.sendWelcomeWithPasswordSetup({
      email: user.email,
      name: user.name
    }, setupUrl, user.account_id);

    console.log('\n' + '='.repeat(60));
    console.log('EMAIL DE BOAS-VINDAS ENVIADO!');
    console.log('='.repeat(60));
    console.log('Para:', user.email);
    console.log('Nome:', user.name);
    console.log('Job ID:', emailResult.jobId);
    console.log('Email Log ID:', emailResult.emailLogId);
    console.log('Token expira em: 24 horas');
    console.log('');
    console.log('Link para criar senha (para debug):');
    console.log(setupUrl);
    console.log('='.repeat(60));

    // Aguardar processamento do email
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

    console.log('\n✅ Processo concluído!');

  } catch (error) {
    console.error('❌ ERRO:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

sendWelcomeWithPasswordSetup();
