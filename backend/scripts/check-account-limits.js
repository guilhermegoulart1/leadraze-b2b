// Check LinkedIn account limits
const db = require('../src/config/database');

async function checkAccountLimits() {
  try {
    const result = await db.query(`
      SELECT
        id,
        linkedin_username,
        profile_name,
        account_type,
        daily_invite_limit
      FROM linkedin_accounts
    `);

    console.log('\n=== LinkedIn Accounts ===');
    console.table(result.rows);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAccountLimits();
