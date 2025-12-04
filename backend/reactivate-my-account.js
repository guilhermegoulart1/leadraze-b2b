require('dotenv').config({ path: __dirname + '/.env' });
const db = require('./src/config/database');

async function reactivate() {
  try {
    // Find the main admin user (not the test canceled user)
    const userResult = await db.query(`
      SELECT u.id, u.email, u.account_id, u.name
      FROM users u
      WHERE u.email != 'canceled@test.com'
      ORDER BY u.created_at ASC
      LIMIT 1
    `);

    if (userResult.rows.length === 0) {
      console.log('No user found');
      process.exit(1);
    }

    const user = userResult.rows[0];
    console.log('User:', user.email, '- Account:', user.account_id);

    // Set subscription to active with far future end date (10 years)
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 10);

    // Check if subscription exists
    const subResult = await db.query(`
      SELECT id FROM subscriptions WHERE account_id = $1
    `, [user.account_id]);

    if (subResult.rows.length > 0) {
      // Update existing subscription to active
      await db.query(`
        UPDATE subscriptions
        SET
          status = 'active',
          canceled_at = NULL,
          cancel_at_period_end = false,
          ended_at = NULL,
          current_period_start = NOW(),
          current_period_end = $2,
          trial_end = NULL,
          updated_at = NOW()
        WHERE account_id = $1
      `, [user.account_id, futureDate]);
      console.log('Subscription updated to ACTIVE');
    } else {
      console.log('No subscription found for this account');
      process.exit(1);
    }

    // Verify
    const verifyResult = await db.query(`
      SELECT status, current_period_end FROM subscriptions WHERE account_id = $1
    `, [user.account_id]);

    console.log('\nSubscription now:', verifyResult.rows[0]);
    console.log('\n✅ Done! Your account is now active until', futureDate.toLocaleDateString());

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

reactivate();
