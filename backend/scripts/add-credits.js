/**
 * Script to manually add credits to an account
 * Usage: node backend/scripts/add-credits.js <email> <credit_type> <amount>
 * Example: node backend/scripts/add-credits.js teste@leadraze.com gmaps 5000
 */

require('dotenv').config();
const db = require('../src/config/database');

async function addCredits(email, creditType, amount) {
  try {
    console.log(`🔍 Looking for user: ${email}`);

    // Get user and account
    const userResult = await db.query(
      'SELECT id, account_id, email FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      throw new Error(`User not found: ${email}`);
    }

    const user = userResult.rows[0];
    console.log(`✅ Found user: ${user.email} (ID: ${user.id}, Account: ${user.account_id})`);

    // Add credit package
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90); // Valid for 90 days

    const result = await db.query(
      `INSERT INTO credit_packages (
        account_id, credit_type, initial_credits, remaining_credits,
        expires_at, source, currency, status
      ) VALUES ($1, $2, $3, $3, $4, 'manual', 'USD', 'active')
      RETURNING *`,
      [user.account_id, creditType, amount, expiresAt]
    );

    console.log(`✅ Successfully added ${amount} ${creditType} credits to account ${user.account_id}`);

    // Check total available credits
    const totalResult = await db.query(
      'SELECT get_available_credits($1, $2) as total',
      [user.account_id, creditType]
    );

    const total = totalResult.rows[0]?.total || 0;
    console.log(`📊 Total ${creditType} credits available: ${total}`);

    await db.end();
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    await db.end();
    process.exit(1);
  }
}

// Parse command line arguments
const email = process.argv[2];
const creditType = process.argv[3] || 'gmaps';
const amount = parseInt(process.argv[4] || '0');

if (!email || !amount) {
  console.error('Usage: node backend/scripts/add-credits.js <email> <credit_type> <amount>');
  console.error('Example: node backend/scripts/add-credits.js teste@leadraze.com gmaps 5000');
  process.exit(1);
}

addCredits(email, creditType, amount);
