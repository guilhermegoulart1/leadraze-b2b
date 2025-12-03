require('dotenv').config({ path: __dirname + '/.env' });
const db = require('./src/config/database');

async function fixTrialDate() {
  const accountId = 'a4b5f4d7-e0ad-46c6-bd9a-aaa7e9bdcc16';

  try {
    // Calculate correct trial end date (7 days from now)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    // Update subscription with correct trial end date
    const result = await db.query(`
      UPDATE subscriptions
      SET
        trial_end = $1,
        current_period_end = $1,
        updated_at = NOW()
      WHERE account_id = $2
      RETURNING id, status, trial_end, current_period_end
    `, [trialEndDate, accountId]);

    if (result.rows.length === 0) {
      console.log('No subscription found for account');
      process.exit(1);
    }

    const sub = result.rows[0];
    console.log('Subscription updated:');
    console.log('- Status:', sub.status);
    console.log('- Trial End:', new Date(sub.trial_end).toLocaleDateString('pt-BR'));
    console.log('- Current Period End:', new Date(sub.current_period_end).toLocaleDateString('pt-BR'));

    console.log('\n✅ Trial date fixed!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

fixTrialDate();
