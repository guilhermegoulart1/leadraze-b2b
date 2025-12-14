/**
 * Add GMaps credits to test user
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'leadraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function run() {
  const client = await pool.connect();
  try {
    const userEmail = process.argv[2] || 'teste@leadraze.com';
    const credits = parseInt(process.argv[3]) || 100;

    console.log(`🔍 Finding user: ${userEmail}`);

    // Find user and account
    const userResult = await client.query(
      `SELECT u.id as user_id, u.name, u.email, u.account_id, a.name as account_name
       FROM users u
       JOIN accounts a ON a.id = u.account_id
       WHERE u.email = $1`,
      [userEmail]
    );

    if (userResult.rows.length === 0) {
      console.error(`❌ User not found: ${userEmail}`);
      return;
    }

    const user = userResult.rows[0];
    console.log(`✅ Found user: ${user.name} (${user.email})`);
    console.log(`   Account: ${user.account_name} (${user.account_id})`);

    // Add GMaps credits
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 365); // 1 year validity

    const insertResult = await client.query(
      `INSERT INTO credit_packages (
        account_id, credit_type, initial_credits, remaining_credits,
        expires_at, source, currency
      ) VALUES ($1, $2, $3, $3, $4, $5, $6)
      RETURNING *`,
      [user.account_id, 'gmaps', credits, expiresAt, 'bonus', 'USD']
    );

    console.log(`\n✅ Added ${credits} GMaps credits!`);
    console.log(`   Package ID: ${insertResult.rows[0].id}`);
    console.log(`   Expires: ${expiresAt.toISOString()}`);

    // Also add AI credits
    const aiResult = await client.query(
      `INSERT INTO credit_packages (
        account_id, credit_type, initial_credits, remaining_credits,
        expires_at, source, currency
      ) VALUES ($1, $2, $3, $3, $4, $5, $6)
      RETURNING *`,
      [user.account_id, 'ai', credits * 5, expiresAt, 'bonus', 'USD']
    );

    console.log(`\n✅ Added ${credits * 5} AI credits!`);
    console.log(`   Package ID: ${aiResult.rows[0].id}`);

    // Show total available credits
    const creditsResult = await client.query(
      `SELECT
        COALESCE(SUM(remaining_credits) FILTER (WHERE credit_type IN ('gmaps', 'gmaps_monthly') AND status = 'active' AND expires_at > NOW()), 0) as gmaps,
        COALESCE(SUM(remaining_credits) FILTER (WHERE credit_type IN ('ai', 'ai_monthly') AND status = 'active' AND expires_at > NOW()), 0) as ai
       FROM credit_packages
       WHERE account_id = $1`,
      [user.account_id]
    );

    console.log(`\n📊 Total available credits:`);
    console.log(`   GMaps: ${creditsResult.rows[0].gmaps}`);
    console.log(`   AI: ${creditsResult.rows[0].ai}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
