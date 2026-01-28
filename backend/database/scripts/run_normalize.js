/**
 * Script to normalize existing paying users
 * Run with: node backend/database/scripts/run_normalize.js
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

async function run() {
  const client = await pool.connect();

  try {
    // Find accounts for LEANDRO and WILLIAN via user IDs
    console.log('='.repeat(60));
    console.log('BUSCANDO ACCOUNTS DOS USUÁRIOS PAGANTES');
    console.log('='.repeat(60));

    const usersQuery = await client.query(`
      SELECT u.id as user_id, u.email, u.name, u.account_id,
             a.id as account_id, a.name as account_name, a.subscription_status,
             a.stripe_customer_id, a.preferred_currency,
             s.id as subscription_id, s.stripe_subscription_id, s.status as sub_status,
             s.plan_type, s.max_channels, s.max_users
      FROM users u
      LEFT JOIN accounts a ON u.account_id = a.id
      LEFT JOIN subscriptions s ON s.account_id = a.id
      WHERE u.id IN (
        '46f0423c-8654-4bdc-8488-3b292489b56b',
        'd7827615-878c-40c0-8f3e-7bc07cfc1e5e'
      )
    `);
    console.log('\n📋 Dados dos usuários pagantes:');
    console.table(usersQuery.rows);

    if (usersQuery.rows.length === 0) {
      console.log('❌ Usuários não encontrados!');
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('PASSO 1: Verificar estado atual');
    console.log('='.repeat(60));

    // Verificar accounts
    console.log('\n📋 Accounts:');
    const accounts = await client.query(`
      SELECT id, name, stripe_customer_id, subscription_status, preferred_currency
      FROM accounts
      WHERE id IN (
        '46f0423c-8654-4bdc-8488-3b292489b56b',
        'd7827615-878c-40c0-8f3e-7bc07cfc1e5e'
      )
    `);
    console.table(accounts.rows);

    // Verificar subscriptions
    console.log('\n📋 Subscriptions:');
    const subscriptions = await client.query(`
      SELECT s.id as subscription_id, s.account_id, s.stripe_subscription_id,
             s.plan_type, s.status, s.max_channels, s.max_users
      FROM subscriptions s
      WHERE s.account_id IN (
        '46f0423c-8654-4bdc-8488-3b292489b56b',
        'd7827615-878c-40c0-8f3e-7bc07cfc1e5e'
      )
    `);
    console.table(subscriptions.rows);

    // Verificar subscription_items
    console.log('\n📋 Subscription Items (add-ons):');
    const items = await client.query(`
      SELECT si.id, si.subscription_id, s.account_id, si.addon_type, si.quantity,
             si.stripe_price_id, si.is_active
      FROM subscription_items si
      JOIN subscriptions s ON s.id = si.subscription_id
      WHERE s.account_id IN (
        '46f0423c-8654-4bdc-8488-3b292489b56b',
        'd7827615-878c-40c0-8f3e-7bc07cfc1e5e'
      )
    `);
    console.table(items.rows);

    console.log('\n' + '='.repeat(60));
    console.log('PASSO 2: Atualizar preferred_currency para BRL');
    console.log('='.repeat(60));

    const updateCurrency = await client.query(`
      UPDATE accounts
      SET preferred_currency = 'BRL'
      WHERE id IN (
        '46f0423c-8654-4bdc-8488-3b292489b56b',
        'd7827615-878c-40c0-8f3e-7bc07cfc1e5e'
      )
      RETURNING id, name, preferred_currency
    `);
    console.log(`✅ ${updateCurrency.rowCount} accounts atualizadas para BRL`);
    console.table(updateCurrency.rows);

    console.log('\n' + '='.repeat(60));
    console.log('PASSO 3: Atualizar max_channels nas subscriptions');
    console.log('='.repeat(60));

    // Usuário 1: plano base (1 canal) + 1 extra = 2 canais total
    const update1 = await client.query(`
      UPDATE subscriptions
      SET max_channels = 2
      WHERE account_id = '46f0423c-8654-4bdc-8488-3b292489b56b'
      RETURNING account_id, max_channels
    `);
    console.log(`✅ Usuário 1 (46f0423c...): max_channels = 2`);

    // Usuário 2: plano base (1 canal) + 4 extras = 5 canais total
    const update2 = await client.query(`
      UPDATE subscriptions
      SET max_channels = 5
      WHERE account_id = 'd7827615-878c-40c0-8f3e-7bc07cfc1e5e'
      RETURNING account_id, max_channels
    `);
    console.log(`✅ Usuário 2 (d7827615...): max_channels = 5`);

    console.log('\n' + '='.repeat(60));
    console.log('PASSO 4: Verificar resultado final');
    console.log('='.repeat(60));

    const final = await client.query(`
      SELECT
        a.id,
        a.name,
        a.preferred_currency,
        s.plan_type,
        s.status,
        s.max_channels,
        s.max_users,
        (SELECT COUNT(*) FROM subscription_items si WHERE si.subscription_id = s.id AND si.addon_type = 'channel' AND si.is_active) as channel_addons,
        (SELECT COALESCE(SUM(si.quantity), 0) FROM subscription_items si WHERE si.subscription_id = s.id AND si.addon_type = 'channel' AND si.is_active) as total_extra_channels
      FROM accounts a
      LEFT JOIN subscriptions s ON s.account_id = a.id
      WHERE a.id IN (
        '46f0423c-8654-4bdc-8488-3b292489b56b',
        'd7827615-878c-40c0-8f3e-7bc07cfc1e5e'
      )
    `);
    console.table(final.rows);

    console.log('\n✅ Normalização concluída com sucesso!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
