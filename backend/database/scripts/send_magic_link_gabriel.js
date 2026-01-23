/**
 * Script para enviar email com magic link para gabriel.engel@gmail.com
 */

const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const emailService = require('../../src/services/emailService');
const db = require('../../src/config/database');

async function sendMagicLinkEmail() {
  try {
    // Buscar dados do usuário
    const result = await db.query(`
      SELECT u.id, u.email, u.name, u.account_id
      FROM users u
      WHERE u.email = 'gabriel.engel@gmail.com'
    `);

    if (result.rows.length === 0) {
      throw new Error('Usuário gabriel.engel@gmail.com não encontrado');
    }

    const user = result.rows[0];
    console.log('Usuário encontrado:', user.name, '-', user.email);

    // Gerar magic link token
    const magicToken = crypto.randomBytes(32).toString('hex');
    const magicTokenHash = crypto.createHash('sha256').update(magicToken).digest('hex');
    const magicTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

    // Atualizar usuário com token
    await db.query(`
      UPDATE users
      SET password_reset_token = $1,
          password_reset_expires = $2,
          must_change_password = true
      WHERE id = $3
    `, [magicTokenHash, magicTokenExpiry, user.id]);

    console.log('✓ Magic token gerado e salvo no banco');

    // Verificar se o serviço de email está pronto
    if (!emailService.isReady()) {
      throw new Error('Serviço de email não está configurado');
    }

    // Enviar email com magic link
    const emailResult = await emailService.sendTeamMemberWelcome({
      email: user.email,
      name: user.name,
      inviterName: 'Equipe GetRaze',
      magicToken: magicToken,
      language: 'pt'
    }, user.account_id);

    const frontendUrl = process.env.FRONTEND_URL || 'https://app.getraze.co';
    const magicLinkUrl = `${frontendUrl}/magic-login?token=${magicToken}`;

    console.log('\n========================================');
    console.log('EMAIL COM MAGIC LINK ENVIADO!');
    console.log('========================================');
    console.log('Para:', user.email);
    console.log('Job ID:', emailResult.jobId);
    console.log('Expira em: 7 dias');
    console.log('');
    console.log('Magic Link (para debug):');
    console.log(magicLinkUrl);
    console.log('========================================');

    // Aguardar processamento
    console.log('\nAguardando processamento do email...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verificar status
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

sendMagicLinkEmail();
