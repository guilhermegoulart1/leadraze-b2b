/**
 * Check credits for a user
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'getraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function check() {
  const client = await pool.connect();
  try {
    const userEmail = process.argv[2] || 'teste@getraze.com';

    // Find user
    const userResult = await client.query(
      `SELECT id, email, account_id FROM users WHERE email = $1`,
      [userEmail]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User not found:', userEmail);
      return;
    }

    const user = userResult.rows[0];
    console.log('👤 User:', user.email);
    console.log('🏢 Account ID:', user.account_id);

    // Check all credit packages
    const credits = await client.query(
      `SELECT id, credit_type, initial_credits, remaining_credits, status, expires_at, source, created_at
       FROM credit_packages
       WHERE account_id = $1
       ORDER BY created_at DESC`,
      [user.account_id]
    );

    console.log('\n📦 All credit packages:');
    if (credits.rows.length === 0) {
      console.log('  (nenhum pacote encontrado)');
    } else {
      credits.rows.forEach(c => {
        const expired = new Date(c.expires_at) < new Date() ? '⚠️ EXPIRED' : '✅';
        console.log(`  ${expired} ${c.credit_type}: ${c.remaining_credits}/${c.initial_credits} | status: ${c.status} | expires: ${c.expires_at.toISOString().split('T')[0]} | source: ${c.source}`);
      });
    }

    // Check active GMaps credits (same query the system uses)
    const activeGmaps = await client.query(
      `SELECT COALESCE(SUM(remaining_credits), 0) as total
       FROM credit_packages
       WHERE account_id = $1
         AND credit_type IN ('gmaps', 'gmaps_monthly')
         AND status = 'active'
         AND expires_at > NOW()`,
      [user.account_id]
    );

    console.log('\n📊 Active GMaps credits:', activeGmaps.rows[0].total);

    // Check active AI credits
    const activeAi = await client.query(
      `SELECT COALESCE(SUM(remaining_credits), 0) as total
       FROM credit_packages
       WHERE account_id = $1
         AND credit_type IN ('ai', 'ai_monthly')
         AND status = 'active'
         AND expires_at > NOW()`,
      [user.account_id]
    );

    console.log('📊 Active AI credits:', activeAi.rows[0].total);

  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
