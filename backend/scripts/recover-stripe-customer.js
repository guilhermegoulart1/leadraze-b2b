/**
 * Script para recuperar assinatura Stripe perdida
 *
 * Uso: node scripts/recover-stripe-customer.js
 */

require('dotenv').config();
const db = require('../src/config/database');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const subscriptionService = require('../src/services/subscriptionService');
const billingService = require('../src/services/billingService');
const emailService = require('../src/services/emailService');
const { stripe } = require('../src/config/stripe');

// ========================================
// DADOS DO CLIENTE A RECUPERAR
// ========================================
const CUSTOMER_DATA = {
  stripeCustomerId: 'cus_TWdR7yGJWOeZFq',
  stripeSubscriptionId: 'sub_1SZaAnFYqwizUuNOCZKE5uJw',
  email: 'leandro@transgonsalves.com',
  name: 'LEANDRO GONSALVES',
  phone: '+595983406466',
  address: {
    line1: 'Av. Don Carlos Antonio Lopez',
    city: 'Santa Rosa del Monday',
    country: 'PY'
  },
  planType: 'base',
  extraChannels: 1,
  extraUsers: 0
};

async function recoverCustomer() {
  const client = await db.pool.connect();

  try {
    console.log('🔄 Iniciando recuperação do cliente...');
    console.log(`📧 Email: ${CUSTOMER_DATA.email}`);
    console.log(`👤 Nome: ${CUSTOMER_DATA.name}`);

    await client.query('BEGIN');

    // 1. Verificar se já existe conta com esse email
    const existingUser = await client.query(
      'SELECT id, account_id FROM users WHERE email = $1',
      [CUSTOMER_DATA.email.toLowerCase()]
    );

    let accountId;
    let userId;
    let resetToken;
    let isNewAccount = false;

    if (existingUser.rows.length > 0) {
      // Usuário já existe
      accountId = existingUser.rows[0].account_id;
      userId = existingUser.rows[0].id;
      console.log(`✅ Usuário já existe: ${userId}`);
      console.log(`✅ Account já existe: ${accountId}`);

      // Atualizar stripe_customer_id na account
      await client.query(
        'UPDATE accounts SET stripe_customer_id = $1 WHERE id = $2',
        [CUSTOMER_DATA.stripeCustomerId, accountId]
      );

    } else {
      // Criar nova conta
      isNewAccount = true;
      console.log('🆕 Criando nova conta...');

      // Gerar slug único
      const baseSlug = CUSTOMER_DATA.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

      // Criar account
      const accountResult = await client.query(`
        INSERT INTO accounts (name, slug, stripe_customer_id, subscription_status)
        VALUES ($1, $2, $3, 'active')
        RETURNING id
      `, [CUSTOMER_DATA.name, uniqueSlug, CUSTOMER_DATA.stripeCustomerId]);

      accountId = accountResult.rows[0].id;
      console.log(`✅ Account criada: ${accountId}`);

      // Gerar token de reset de senha
      resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      const resetTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

      // Criar senha temporária
      const tempPassword = crypto.randomBytes(16).toString('hex');
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      // Criar usuário admin
      const userResult = await client.query(`
        INSERT INTO users (account_id, email, password_hash, name, phone, billing_address, role, is_active, password_reset_token, password_reset_expires)
        VALUES ($1, $2, $3, $4, $5, $6, 'admin', true, $7, $8)
        RETURNING id
      `, [
        accountId,
        CUSTOMER_DATA.email.toLowerCase(),
        passwordHash,
        CUSTOMER_DATA.name,
        CUSTOMER_DATA.phone,
        JSON.stringify(CUSTOMER_DATA.address),
        resetTokenHash,
        resetTokenExpiry
      ]);

      userId = userResult.rows[0].id;
      console.log(`✅ Usuário criado: ${userId}`);
    }

    // 2. Buscar subscription do Stripe
    console.log('🔍 Buscando subscription no Stripe...');
    const subscription = await stripe.subscriptions.retrieve(CUSTOMER_DATA.stripeSubscriptionId);
    console.log(`✅ Subscription status: ${subscription.status}`);

    // 3. Atualizar metadata da subscription com account_id
    await stripe.subscriptions.update(CUSTOMER_DATA.stripeSubscriptionId, {
      metadata: {
        account_id: accountId,
        extra_channels: CUSTOMER_DATA.extraChannels.toString(),
        extra_users: CUSTOMER_DATA.extraUsers.toString()
      }
    });
    console.log('✅ Metadata da subscription atualizada no Stripe');

    await client.query('COMMIT');

    // 4. Sincronizar subscription para o banco local
    console.log('🔄 Sincronizando subscription...');
    const localSubscription = await subscriptionService.syncFromStripe(subscription, accountId);
    console.log(`✅ Subscription sincronizada: ${localSubscription.id}`);

    // 5. Adicionar créditos mensais
    if (subscription.status === 'active') {
      console.log('💰 Adicionando créditos mensais...');
      await billingService.addMonthlyCredits(accountId, CUSTOMER_DATA.planType);
      console.log('✅ Créditos adicionados');
    }

    // 6. Enviar email de boas vindas (se conta nova)
    if (isNewAccount && resetToken) {
      console.log('📧 Enviando email de boas vindas...');
      const setupUrl = `${process.env.FRONTEND_URL}/set-password?token=${resetToken}`;

      try {
        await emailService.sendWelcomeWithPasswordSetup({
          email: CUSTOMER_DATA.email,
          name: CUSTOMER_DATA.name
        }, setupUrl, accountId);
        console.log('✅ Email de boas vindas enviado');
      } catch (emailError) {
        console.error('⚠️ Erro ao enviar email:', emailError.message);
        console.log(`\n📋 Link para definir senha (passe manualmente para o cliente):`);
        console.log(`   ${setupUrl}\n`);
      }
    }

    // Resumo
    console.log('\n========================================');
    console.log('✅ RECUPERAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('========================================');
    console.log(`Account ID: ${accountId}`);
    console.log(`User ID: ${userId}`);
    console.log(`Email: ${CUSTOMER_DATA.email}`);
    console.log(`Subscription Status: ${subscription.status}`);

    if (isNewAccount && resetToken) {
      console.log(`\n🔗 Link para definir senha:`);
      console.log(`   ${process.env.FRONTEND_URL}/set-password?token=${resetToken}`);
    } else if (!isNewAccount) {
      console.log(`\n⚠️ Conta já existia - usuário pode fazer login normalmente`);
    }

    return { accountId, userId, resetToken };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na recuperação:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Executar
recoverCustomer()
  .then(() => {
    console.log('\n✅ Script finalizado');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Falha no script:', error.message);
    process.exit(1);
  });
