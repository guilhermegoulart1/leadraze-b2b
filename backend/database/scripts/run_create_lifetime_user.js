/**
 * Script para criar usuário com acesso vitalício
 * Email: gabriel.engel@gmail.com
 * Limites: 1 canal, 3 usuários, 1.000 créditos IA, 200 créditos Google Maps
 */

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false
});

async function createLifetimeUser() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar se o usuário já existe
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      ['gabriel.engel@gmail.com']
    );

    if (existingUser.rows.length > 0) {
      throw new Error('Usuário gabriel.engel@gmail.com já existe no sistema');
    }

    // 1. Criar Account
    const accountResult = await client.query(`
      INSERT INTO accounts (
        id, name, slug, company_email, plan,
        max_users, max_channels, is_active, subscription_status,
        created_at, updated_at
      )
      VALUES (
        gen_random_uuid(),
        'Gabriel Engel',
        'gabriel-engel-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
        'gabriel.engel@gmail.com',
        'lifetime',
        3,
        1,
        true,
        'active',
        NOW(),
        NOW()
      )
      RETURNING id
    `);
    const accountId = accountResult.rows[0].id;
    console.log('✓ Account criada:', accountId);

    // 2. Criar User
    const userResult = await client.query(`
      INSERT INTO users (
        id, email, password_hash, name, account_id, role, is_active, subscription_tier,
        created_at, updated_at
      )
      VALUES (
        gen_random_uuid(),
        'gabriel.engel@gmail.com',
        '$2b$10$LIFETIME_USER_NEEDS_PASSWORD_RESET',
        'Gabriel Engel',
        $1,
        'admin',
        true,
        'lifetime',
        NOW(),
        NOW()
      )
      RETURNING id
    `, [accountId]);
    const userId = userResult.rows[0].id;
    console.log('✓ Usuário criado:', userId);

    // 3. Criar Subscription (vitalícia)
    const stripeCustomerId = `manual_lifetime_${accountId}`;
    const subscriptionResult = await client.query(`
      INSERT INTO subscriptions (
        id, account_id, stripe_customer_id, plan_type, status,
        max_channels, max_users, monthly_gmaps_credits, monthly_ai_credits,
        current_period_start, current_period_end,
        created_at, updated_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        'lifetime',
        'active',
        1,
        3,
        0,
        0,
        NOW(),
        '2099-12-31 23:59:59'::TIMESTAMP WITH TIME ZONE,
        NOW(),
        NOW()
      )
      RETURNING id
    `, [accountId, stripeCustomerId]);
    const subscriptionId = subscriptionResult.rows[0].id;
    console.log('✓ Subscription criada:', subscriptionId);

    // 4. Créditos de IA (1.000 vitalícios)
    await client.query(`
      INSERT INTO credit_packages (
        id, account_id, credit_type, initial_credits, remaining_credits,
        expires_at, never_expires, status, source,
        purchased_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        'ai',
        1000,
        1000,
        '2099-12-31 23:59:59'::TIMESTAMP WITH TIME ZONE,
        true,
        'active',
        'bonus',
        NOW()
      )
    `, [accountId]);
    console.log('✓ Créditos de IA adicionados: 1.000');

    // 5. Créditos Google Maps (200 vitalícios)
    await client.query(`
      INSERT INTO credit_packages (
        id, account_id, credit_type, initial_credits, remaining_credits,
        expires_at, never_expires, status, source,
        purchased_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        'gmaps',
        200,
        200,
        '2099-12-31 23:59:59'::TIMESTAMP WITH TIME ZONE,
        true,
        'active',
        'bonus',
        NOW()
      )
    `, [accountId]);
    console.log('✓ Créditos Google Maps adicionados: 200');

    await client.query('COMMIT');

    console.log('\n========================================');
    console.log('USUÁRIO VITALÍCIO CRIADO COM SUCESSO!');
    console.log('========================================');
    console.log('Email: gabriel.engel@gmail.com');
    console.log('Account ID:', accountId);
    console.log('User ID:', userId);
    console.log('Subscription ID:', subscriptionId);
    console.log('Limites: 1 canal, 3 usuários');
    console.log('Créditos: 1.000 IA, 200 Google Maps (vitalícios)');
    console.log('========================================');
    console.log('\nNOTA: O usuário precisará usar "Esqueci minha senha"');
    console.log('para definir uma senha e acessar o sistema.');

    // Verificação final
    const verification = await client.query(`
      SELECT
        a.id as account_id,
        a.name,
        a.company_email,
        a.max_users,
        a.max_channels,
        s.status as subscription_status,
        s.plan_type,
        s.current_period_end,
        (SELECT SUM(remaining_credits) FROM credit_packages WHERE account_id = a.id AND credit_type = 'ai') as ai_credits,
        (SELECT SUM(remaining_credits) FROM credit_packages WHERE account_id = a.id AND credit_type = 'gmaps') as gmaps_credits
      FROM accounts a
      LEFT JOIN subscriptions s ON s.account_id = a.id
      WHERE a.company_email = 'gabriel.engel@gmail.com'
    `);

    console.log('\nVerificação:');
    console.table(verification.rows);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('ERRO:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

createLifetimeUser();
