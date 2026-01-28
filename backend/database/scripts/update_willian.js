/**
 * Script to update WILLIAN MILANE with new Stripe IDs
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

// WILLIAN MILANE data
const ACCOUNT_ID = 'd63470e4-6a47-4c78-84bf-e1a229ff5f4f';
const NEW_CUSTOMER_ID = 'cus_TpNckrUnKARPDi';
const NEW_SUBSCRIPTION_ID = 'sub_1SrirWF139XY9QwNZn4Jhude';
const MAX_CHANNELS = 5; // base (1) + 4 extras
const EXTRA_CHANNELS = 4;

// BRL Price IDs from new Stripe account
const CHANNEL_PRICE_ID = 'price_1SrP9LF139XY9QwNljbRKdyT';

async function run() {
  const client = await pool.connect();

  try {
    console.log('='.repeat(60));
    console.log('ATUALIZANDO WILLIAN MILANE');
    console.log('='.repeat(60));

    // Start transaction
    await client.query('BEGIN');

    // 1. Update account with new Stripe Customer ID
    console.log('\n1. Atualizando account...');
    const accountUpdate = await client.query(`
      UPDATE accounts
      SET
        stripe_customer_id = $1,
        subscription_status = 'active',
        preferred_currency = 'BRL'
      WHERE id = $2
      RETURNING id, name, stripe_customer_id, subscription_status, preferred_currency
    `, [NEW_CUSTOMER_ID, ACCOUNT_ID]);

    if (accountUpdate.rowCount === 0) {
      throw new Error('Account not found!');
    }
    console.log('✅ Account atualizada:');
    console.table(accountUpdate.rows);

    // 2. Update subscription with new Stripe Subscription ID
    console.log('\n2. Atualizando subscription...');
    const subUpdate = await client.query(`
      UPDATE subscriptions
      SET
        stripe_subscription_id = $1,
        status = 'active',
        max_channels = $2,
        current_period_start = NOW(),
        current_period_end = NOW() + INTERVAL '1 month'
      WHERE account_id = $3
      RETURNING id, account_id, stripe_subscription_id, status, max_channels, max_users
    `, [NEW_SUBSCRIPTION_ID, MAX_CHANNELS, ACCOUNT_ID]);

    if (subUpdate.rowCount === 0) {
      throw new Error('Subscription not found!');
    }
    console.log('✅ Subscription atualizada:');
    console.table(subUpdate.rows);

    const subscriptionId = subUpdate.rows[0].id;

    // 3. Check if subscription_items exist for channels
    console.log('\n3. Verificando subscription_items...');
    const existingItems = await client.query(`
      SELECT * FROM subscription_items
      WHERE subscription_id = $1 AND addon_type = 'channel'
    `, [subscriptionId]);

    if (existingItems.rowCount > 0) {
      // Update existing
      console.log('   Atualizando subscription_item existente...');
      await client.query(`
        UPDATE subscription_items
        SET
          quantity = $1,
          stripe_price_id = $2,
          is_active = true
        WHERE subscription_id = $3 AND addon_type = 'channel'
      `, [EXTRA_CHANNELS, CHANNEL_PRICE_ID, subscriptionId]);
    } else {
      // Create new
      console.log('   Criando novo subscription_item...');
      await client.query(`
        INSERT INTO subscription_items (subscription_id, addon_type, quantity, stripe_price_id, is_active)
        VALUES ($1, 'channel', $2, $3, true)
      `, [subscriptionId, EXTRA_CHANNELS, CHANNEL_PRICE_ID]);
    }
    console.log(`✅ Subscription item para ${EXTRA_CHANNELS} canais extras configurado`);

    // Commit transaction
    await client.query('COMMIT');

    // 4. Verify final state
    console.log('\n' + '='.repeat(60));
    console.log('VERIFICAÇÃO FINAL');
    console.log('='.repeat(60));

    const finalCheck = await client.query(`
      SELECT
        a.id as account_id,
        a.name,
        a.stripe_customer_id,
        a.subscription_status,
        a.preferred_currency,
        s.stripe_subscription_id,
        s.status as sub_status,
        s.max_channels,
        s.max_users,
        (SELECT COALESCE(SUM(si.quantity), 0) FROM subscription_items si
         WHERE si.subscription_id = s.id AND si.addon_type = 'channel' AND si.is_active) as extra_channels
      FROM accounts a
      LEFT JOIN subscriptions s ON s.account_id = a.id
      WHERE a.id = $1
    `, [ACCOUNT_ID]);

    console.log('\n📋 Estado final de WILLIAN MILANE:');
    console.table(finalCheck.rows);

    console.log('\n✅ WILLIAN MILANE atualizado com sucesso!');
    console.log(`   Customer ID: ${NEW_CUSTOMER_ID}`);
    console.log(`   Subscription ID: ${NEW_SUBSCRIPTION_ID}`);
    console.log(`   Max Channels: ${MAX_CHANNELS} (1 base + ${EXTRA_CHANNELS} extras)`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
