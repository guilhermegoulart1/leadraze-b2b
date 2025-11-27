/**
 * Script para deletar usuário de teste
 * Usage: node scripts/delete-test-user.js <email>
 */

require('dotenv').config();
const db = require('../src/config/database');

async function deleteTestUser(email) {
  if (!email) {
    console.error('Usage: node scripts/delete-test-user.js <email>');
    process.exit(1);
  }

  console.log(`Deleting user: ${email}`);

  try {
    // Get user info first
    const userResult = await db.query('SELECT id, account_id FROM users WHERE email = $1', [email]);

    if (userResult.rows.length === 0) {
      console.log('User not found');
      process.exit(0);
    }

    const user = userResult.rows[0];
    console.log(`Found user ID: ${user.id}, Account ID: ${user.account_id}`);

    // Delete in correct order (respecting foreign keys)
    console.log('Deleting subscription items...');
    await db.query(`
      DELETE FROM subscription_items WHERE subscription_id IN (
        SELECT id FROM subscriptions WHERE account_id = $1
      )
    `, [user.account_id]);

    console.log('Deleting subscriptions...');
    await db.query('DELETE FROM subscriptions WHERE account_id = $1', [user.account_id]);

    console.log('Deleting email logs...');
    await db.query('DELETE FROM email_logs WHERE user_id = $1', [user.id]);

    console.log('Deleting user...');
    await db.query('DELETE FROM users WHERE id = $1', [user.id]);

    console.log('Deleting account...');
    await db.query('DELETE FROM accounts WHERE id = $1', [user.account_id]);

    console.log('User and related data deleted successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error deleting user:', error.message);
    process.exit(1);
  }
}

const email = process.argv[2] || 'guissgoulart@gmail.com';
deleteTestUser(email);
