require('dotenv').config({ path: __dirname + '/.env' });
const db = require('./src/config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function createTestCanceledUser() {
  const email = 'canceled@test.com';
  const password = 'test123';
  const name = 'Usuario Cancelado';

  try {
    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      console.log('User already exists, updating subscription to canceled...');

      const user = existingUser.rows[0];
      const accountResult = await db.query(
        'SELECT account_id FROM users WHERE id = $1',
        [user.id]
      );
      const accountId = accountResult.rows[0].account_id;

      // Update subscription to canceled
      await db.query(`
        UPDATE subscriptions
        SET
          status = 'canceled',
          canceled_at = NOW(),
          cancel_at_period_end = false,
          current_period_end = NOW() - INTERVAL '1 day',
          updated_at = NOW()
        WHERE account_id = $1
      `, [accountId]);

      console.log('\n✅ Subscription updated to canceled!');
      console.log('Email:', email);
      console.log('Password:', password);
      process.exit(0);
      return;
    }

    // Create new account
    const accountId = uuidv4();
    const slug = 'test-canceled-' + Date.now();
    await db.query(`
      INSERT INTO accounts (id, name, slug, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
    `, [accountId, name, slug]);

    // Create user
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(`
      INSERT INTO users (id, account_id, email, password_hash, name, role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'admin', NOW(), NOW())
    `, [userId, accountId, email, hashedPassword, name]);

    // Create canceled subscription
    const subscriptionId = uuidv4();
    const canceledAt = new Date();
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() - 1); // Ended yesterday

    await db.query(`
      INSERT INTO subscriptions (
        id, account_id, status, plan_type,
        current_period_start, current_period_end,
        canceled_at, cancel_at_period_end, ended_at,
        max_channels, max_users, monthly_gmaps_credits, monthly_ai_credits,
        created_at, updated_at
      )
      VALUES ($1, $2, 'canceled', 'base', $3, $4, $5, false, $4, 1, 2, 200, 5000, NOW(), NOW())
    `, [subscriptionId, accountId, periodEnd, periodEnd, canceledAt]);

    console.log('\n✅ Test canceled user created!');
    console.log('');
    console.log('Login credentials:');
    console.log('  Email:', email);
    console.log('  Password:', password);
    console.log('');
    console.log('Account ID:', accountId);
    console.log('Subscription Status: canceled');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

createTestCanceledUser();
