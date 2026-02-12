const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false
});

async function run() {
  // Find user
  const userRes = await pool.query("SELECT id, account_id, name, role FROM users WHERE email = 'teste@leadraze.com'");
  const user = userRes.rows[0];
  console.log('User:', JSON.stringify(user, null, 2));

  if (user) {
    // Find onboarding for this account
    const obRes = await pool.query('SELECT id, status, completed_at FROM onboarding_responses WHERE account_id = $1 ORDER BY created_at DESC LIMIT 1', [user.account_id]);
    const onboarding = obRes.rows[0];
    console.log('Onboarding:', JSON.stringify(onboarding || 'NONE', null, 2));

    if (onboarding) {
      const compRes = await pool.query('SELECT COUNT(*) FROM onboarding_task_completions WHERE onboarding_id = $1', [onboarding.id]);
      console.log('Existing completions:', compRes.rows[0].count);
    }
  }

  pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
