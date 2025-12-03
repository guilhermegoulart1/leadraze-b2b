require('dotenv').config({ path: __dirname + '/.env' });
const db = require('./src/config/database');

async function check() {
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
    console.log('User:', user);

    // Get subscription
    const subResult = await db.query(`
      SELECT * FROM subscriptions WHERE account_id = $1
    `, [user.account_id]);

    console.log('\nSubscription:', JSON.stringify(subResult.rows[0], null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

check();
