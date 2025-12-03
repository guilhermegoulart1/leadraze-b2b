require('dotenv').config();
const db = require('./src/config/database');

async function checkCredits() {
  const accountId = 'a4b5f4d7-e0ad-46c6-bd9a-aaa7e9bdcc16';

  try {
    // Ver todos os credit_packages
    const result = await db.query(
      'SELECT * FROM credit_packages WHERE account_id = $1 ORDER BY created_at DESC',
      [accountId]
    );

    console.log('Credit packages encontrados:');
    result.rows.forEach(r => {
      console.log(`- Type: ${r.credit_type} | Initial: ${r.initial_credits} | Remaining: ${r.remaining_credits} | Source: ${r.source} | Status: ${r.status}`);
    });

    // Ver subscription
    const sub = await db.query(
      'SELECT status, trial_start, trial_end, monthly_gmaps_credits, monthly_ai_credits FROM subscriptions WHERE account_id = $1',
      [accountId]
    );

    if (sub.rows.length > 0) {
      console.log('\nSubscription:');
      console.log('- Status:', sub.rows[0].status);
      console.log('- Monthly GMaps:', sub.rows[0].monthly_gmaps_credits);
      console.log('- Monthly AI:', sub.rows[0].monthly_ai_credits);
    }

    process.exit(0);
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
}

checkCredits();
