require('dotenv').config({ path: __dirname + '/.env' });
const db = require('./src/config/database');
const { v4: uuidv4 } = require('uuid');

async function fix() {
  try {
    // Find the canceled test user
    const userResult = await db.query(`
      SELECT u.id, u.email, u.account_id
      FROM users u
      WHERE u.email = 'canceled@test.com'
    `);

    if (userResult.rows.length === 0) {
      console.log('User not found');
      process.exit(1);
    }

    const user = userResult.rows[0];
    console.log('User:', user.email, '- Account:', user.account_id);

    // Check if subscription exists
    const subResult = await db.query(`
      SELECT id FROM subscriptions WHERE account_id = $1
    `, [user.account_id]);

    if (subResult.rows.length > 0) {
      // Update existing subscription
      await db.query(`
        UPDATE subscriptions
        SET
          status = 'canceled',
          canceled_at = NOW(),
          cancel_at_period_end = false,
          current_period_end = NOW() - INTERVAL '1 day',
          ended_at = NOW() - INTERVAL '1 day',
          updated_at = NOW()
        WHERE account_id = $1
      `, [user.account_id]);
      console.log('Subscription updated to canceled');
    } else {
      // Create new canceled subscription
      const subscriptionId = uuidv4();
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() - 1); // Ended yesterday

      // Use fake Stripe IDs for test user
      const fakeStripeCustomerId = 'cus_test_canceled_' + Date.now();
      const fakeStripeSubscriptionId = 'sub_test_canceled_' + Date.now();

      await db.query(`
        INSERT INTO subscriptions (
          id, account_id, stripe_customer_id, stripe_subscription_id,
          status, plan_type,
          current_period_start, current_period_end,
          canceled_at, cancel_at_period_end, ended_at,
          max_channels, max_users, monthly_gmaps_credits, monthly_ai_credits,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, 'canceled', 'base', $5, $5, NOW(), false, $5, 1, 2, 200, 5000, NOW(), NOW())
      `, [subscriptionId, user.account_id, fakeStripeCustomerId, fakeStripeSubscriptionId, periodEnd]);
      console.log('Subscription created with canceled status');
    }

    // Verify
    const verifyResult = await db.query(`
      SELECT status, current_period_end, ended_at FROM subscriptions WHERE account_id = $1
    `, [user.account_id]);

    console.log('\nSubscription now:', verifyResult.rows[0]);
    console.log('\n✅ Done! Login with canceled@test.com / test123');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

fix();
