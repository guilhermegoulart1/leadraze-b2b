/**
 * Script para provisionar conta do Bruno Febbo
 * Checkout feito via Payment Link (sem metadata is_guest), conta não foi criada
 *
 * Uso: node scripts/provision-bruno-febbo.js
 */

require('dotenv').config();
const db = require('../src/config/database');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const subscriptionService = require('../src/services/subscriptionService');
const billingService = require('../src/services/billingService');
const emailService = require('../src/services/emailService');
const { initializeAccountSector, assignUserToDefaultSector } = require('../src/services/sectorService');
const pipelineService = require('../src/services/pipelineService');
const { stripe } = require('../src/config/stripe');

// ========================================
// DADOS DO CLIENTE
// ========================================
const CUSTOMER_DATA = {
  stripeCustomerId: 'cus_TwtWfeXyNA9TUk',
  stripeSubscriptionId: 'sub_1Syzj1F139XY9QwNlrabBnl3',
  stripeInvoiceId: 'in_1SyziyF139XY9QwNO1dxS83u',
  email: 'bruno.febbo@icloud.com',
  name: 'Bruno Febbo',
  phone: '11960356090',
  address: {
    city: 'Osasco',
    country: 'BR',
    line1: 'Av pres Joao Goulart, 6',
    line2: '21 Sauipe',
    postal_code: '06036048',
    state: 'Sao Paulo'
  },
  planType: 'base',
  extraChannels: 0,
  extraUsers: 0
};

// Invoice data from Stripe
const INVOICE_DATA = {
  id: 'in_1SyziyF139XY9QwNO1dxS83u',
  subscription: 'sub_1Syzj1F139XY9QwNlrabBnl3',
  customer: 'cus_TwtWfeXyNA9TUk',
  number: '9TOVX21W-0001',
  status: 'paid',
  amount_due: 33000,
  amount_paid: 33000,
  subtotal: 33000,
  tax: 0,
  total: 33000,
  currency: 'BRL',
  hosted_invoice_url: 'https://invoice.stripe.com/i/acct_1SdYi0F139XY9QwN/live_YWNjdF8xU2RZaTBGMTM5WFk5UXdOLF9Ud3RXV2hvUGIzV2NtZ05yVUFyem5PVlhKYklrVkd1LDE2MTIwNDU0NA0200rR4BIGeP?s=ap',
  invoice_pdf: 'https://pay.stripe.com/invoice/acct_1SdYi0F139XY9QwN/live_YWNjdF8xU2RZaTBGMTM5WFk5UXdOLF9Ud3RXV2hvUGIzV2NtZ05yVUFyem5PVlhKYklrVkd1LDE2MTIwNDU0NA0200rR4BIGeP/pdf?s=ap',
  period_start: new Date(1770663740 * 1000),
  period_end: new Date(1770663740 * 1000),
  paid_at: new Date(1770663741 * 1000),
  lines: [
    {
      description: '1 × GetRaze - Monthly Plan (a R$ 330.00 / month)',
      amount: 33000,
      currency: 'brl',
      period: { start: 1770663740, end: 1773082940 }
    }
  ]
};

async function provisionCustomer() {
  const client = await db.pool.connect();

  try {
    console.log('🔄 Iniciando provisionamento do cliente...');
    console.log(`📧 Email: ${CUSTOMER_DATA.email}`);
    console.log(`👤 Nome: ${CUSTOMER_DATA.name}`);

    // 0. Verificar se já existe conta com esse email
    const existingUser = await client.query(
      'SELECT id, account_id FROM users WHERE email = $1',
      [CUSTOMER_DATA.email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      console.log(`⚠️ Usuário já existe com account_id: ${existingUser.rows[0].account_id}`);
      console.log('Abortando para evitar duplicação.');
      return;
    }

    // Verificar se já existe conta com esse stripe_customer_id
    const existingAccount = await client.query(
      'SELECT id FROM accounts WHERE stripe_customer_id = $1',
      [CUSTOMER_DATA.stripeCustomerId]
    );

    if (existingAccount.rows.length > 0) {
      console.log(`⚠️ Account já existe com stripe_customer_id: ${existingAccount.rows[0].id}`);
      console.log('Abortando para evitar duplicação.');
      return;
    }

    await client.query('BEGIN');

    // 1. Criar account
    const baseSlug = CUSTOMER_DATA.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

    const accountResult = await client.query(`
      INSERT INTO accounts (name, slug, stripe_customer_id, subscription_status)
      VALUES ($1, $2, $3, 'active')
      RETURNING id
    `, [CUSTOMER_DATA.name, uniqueSlug, CUSTOMER_DATA.stripeCustomerId]);

    const accountId = accountResult.rows[0].id;
    console.log(`✅ Account criada: ${accountId}`);

    // 2. Criar usuário admin com token de reset de senha (7 dias)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const tempPassword = crypto.randomBytes(16).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

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

    const userId = userResult.rows[0].id;
    console.log(`✅ Usuário admin criado: ${userId}`);

    await client.query('COMMIT');

    // 3. Inicializar setor padrão e pipeline
    try {
      await initializeAccountSector(accountId, 'pt');
      await assignUserToDefaultSector(userId, accountId, 'pt');
      console.log('✅ Setor padrão criado e usuário atribuído');
    } catch (sectorError) {
      console.error('⚠️ Erro ao criar setor padrão:', sectorError.message);
    }

    try {
      await pipelineService.createDefaultPipeline(accountId, userId);
      console.log('✅ Pipeline padrão criado');
    } catch (pipelineError) {
      console.error('⚠️ Erro ao criar pipeline padrão:', pipelineError.message);
    }

    // 4. Buscar e sincronizar subscription do Stripe
    console.log('🔍 Buscando subscription no Stripe...');
    const subscription = await stripe.subscriptions.retrieve(CUSTOMER_DATA.stripeSubscriptionId);
    console.log(`✅ Subscription status: ${subscription.status}`);

    // Atualizar metadata da subscription com account_id
    await stripe.subscriptions.update(CUSTOMER_DATA.stripeSubscriptionId, {
      metadata: {
        account_id: accountId,
        extra_channels: CUSTOMER_DATA.extraChannels.toString(),
        extra_users: CUSTOMER_DATA.extraUsers.toString()
      }
    });
    console.log('✅ Metadata da subscription atualizada no Stripe');

    // Sincronizar para o banco local
    const localSubscription = await subscriptionService.syncFromStripe(subscription, accountId);
    console.log(`✅ Subscription sincronizada: ${localSubscription.id}`);

    // 5. Adicionar créditos mensais
    if (subscription.status === 'active') {
      console.log('💰 Adicionando créditos mensais...');
      await billingService.addMonthlyCredits(accountId, CUSTOMER_DATA.planType);
      console.log('✅ Créditos mensais adicionados');
    }

    // 6. Cachear invoice
    console.log('📄 Cacheando invoice...');
    await db.query(
      `INSERT INTO invoices (
        account_id, stripe_invoice_id, stripe_subscription_id, stripe_customer_id,
        number, status, amount_due_cents, amount_paid_cents, subtotal_cents,
        tax_cents, total_cents, currency, hosted_invoice_url, invoice_pdf_url,
        period_start, period_end, paid_at, line_items
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (stripe_invoice_id) DO NOTHING`,
      [
        accountId,
        INVOICE_DATA.id,
        INVOICE_DATA.subscription,
        INVOICE_DATA.customer,
        INVOICE_DATA.number,
        INVOICE_DATA.status,
        INVOICE_DATA.amount_due,
        INVOICE_DATA.amount_paid,
        INVOICE_DATA.subtotal,
        INVOICE_DATA.tax,
        INVOICE_DATA.total,
        INVOICE_DATA.currency,
        INVOICE_DATA.hosted_invoice_url,
        INVOICE_DATA.invoice_pdf,
        INVOICE_DATA.period_start,
        INVOICE_DATA.period_end,
        INVOICE_DATA.paid_at,
        JSON.stringify(INVOICE_DATA.lines)
      ]
    );
    console.log('✅ Invoice cacheada');

    // 7. Enviar email de boas vindas
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
      console.log(`\n📋 Link para definir senha (passe manualmente):`);
      console.log(`   ${setupUrl}\n`);
    }

    // Resumo
    console.log('\n========================================');
    console.log('✅ PROVISIONAMENTO CONCLUÍDO!');
    console.log('========================================');
    console.log(`Account ID: ${accountId}`);
    console.log(`User ID: ${userId}`);
    console.log(`Email: ${CUSTOMER_DATA.email}`);
    console.log(`Subscription Status: ${subscription.status}`);
    console.log(`Plan: ${CUSTOMER_DATA.planType}`);
    console.log(`\n🔗 Link para definir senha:`);
    console.log(`   ${setupUrl}`);

    return { accountId, userId, resetToken };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro no provisionamento:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Executar
provisionCustomer()
  .then(() => {
    console.log('\n✅ Script finalizado');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Falha no script:', error.message);
    process.exit(1);
  });
