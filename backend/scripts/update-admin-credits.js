// backend/scripts/update-admin-credits.js
// Script para atualizar os créditos do plano Admin com os novos valores

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

// Novos limites do plano admin
const NEW_LIMITS = {
  maxChannels: 100,
  maxUsers: 100,
  monthlyGmapsCredits: 1000,
  monthlyAiCredits: 10000
};

async function updateAdminCredits() {
  const client = await pool.connect();

  try {
    console.log('\n========================================');
    console.log('Update Admin Credits');
    console.log('========================================\n');
    console.log('New limits:');
    console.log(`  - Channels: ${NEW_LIMITS.maxChannels}`);
    console.log(`  - Users: ${NEW_LIMITS.maxUsers}`);
    console.log(`  - GMaps Credits: ${NEW_LIMITS.monthlyGmapsCredits}`);
    console.log(`  - AI Credits: ${NEW_LIMITS.monthlyAiCredits}`);
    console.log('');

    await client.query('BEGIN');

    // 0. Update credit_type constraint to allow AI types
    console.log('0. Updating credit_type constraint...');
    await client.query(`
      ALTER TABLE credit_packages DROP CONSTRAINT IF EXISTS credit_packages_credit_type_check
    `);
    await client.query(`
      ALTER TABLE credit_packages ADD CONSTRAINT credit_packages_credit_type_check
      CHECK (credit_type IN ('gmaps', 'gmaps_monthly', 'ai', 'ai_monthly'))
    `);
    console.log('   Constraint updated to allow AI types.');

    // 1. Update plans table (note: plans table may not have monthly_ai_credits column)
    console.log('1. Updating plans table...');
    await client.query(`
      UPDATE plans
      SET
        max_channels = $1,
        max_users = $2,
        monthly_gmaps_credits = $3,
        updated_at = NOW()
      WHERE slug = 'admin'
    `, [NEW_LIMITS.maxChannels, NEW_LIMITS.maxUsers, NEW_LIMITS.monthlyGmapsCredits]);
    console.log('   Plans table updated.');

    // 2. Update subscriptions table for admin accounts
    console.log('2. Updating subscriptions table...');
    const subsResult = await client.query(`
      UPDATE subscriptions
      SET
        max_channels = $1,
        max_users = $2,
        monthly_gmaps_credits = $3,
        monthly_ai_credits = $4,
        updated_at = NOW()
      WHERE plan_type = 'admin'
      RETURNING id, account_id
    `, [NEW_LIMITS.maxChannels, NEW_LIMITS.maxUsers, NEW_LIMITS.monthlyGmapsCredits, NEW_LIMITS.monthlyAiCredits]);
    console.log(`   Updated ${subsResult.rowCount} subscription(s).`);

    // 3. Get admin account IDs
    const adminAccounts = subsResult.rows.map(r => r.account_id);

    if (adminAccounts.length === 0) {
      console.log('\n   No admin subscriptions found. Looking for accounts with admin plan...');
      const accountsResult = await client.query(`
        SELECT id FROM accounts WHERE plan = 'admin'
      `);
      adminAccounts.push(...accountsResult.rows.map(r => r.id));
    }

    console.log(`   Found ${adminAccounts.length} admin account(s).`);

    // 4. Update GMaps credit packages
    console.log('3. Updating GMaps credit packages...');
    for (const accountId of adminAccounts) {
      // Desativar pacotes antigos de GMaps
      await client.query(`
        UPDATE credit_packages
        SET status = 'expired'
        WHERE account_id = $1
          AND credit_type IN ('gmaps', 'gmaps_monthly')
          AND status = 'active'
      `, [accountId]);

      // Criar novo pacote de GMaps
      await client.query(`
        INSERT INTO credit_packages (
          account_id,
          credit_type,
          initial_credits,
          remaining_credits,
          expires_at,
          never_expires,
          status,
          source
        ) VALUES (
          $1,
          'gmaps_monthly',
          $2,
          $2,
          NOW() + INTERVAL '30 days',
          false,
          'active',
          'subscription'
        )
      `, [accountId, NEW_LIMITS.monthlyGmapsCredits]);

      console.log(`   Created GMaps credit package for account ${accountId}: ${NEW_LIMITS.monthlyGmapsCredits} credits`);
    }

    // 5. Update/Create AI credit packages
    console.log('4. Updating AI credit packages...');
    for (const accountId of adminAccounts) {
      // Desativar pacotes antigos de AI
      await client.query(`
        UPDATE credit_packages
        SET status = 'expired'
        WHERE account_id = $1
          AND credit_type IN ('ai', 'ai_monthly')
          AND status = 'active'
      `, [accountId]);

      // Criar novo pacote de AI
      await client.query(`
        INSERT INTO credit_packages (
          account_id,
          credit_type,
          initial_credits,
          remaining_credits,
          expires_at,
          never_expires,
          status,
          source
        ) VALUES (
          $1,
          'ai_monthly',
          $2,
          $2,
          NOW() + INTERVAL '30 days',
          false,
          'active',
          'subscription'
        )
      `, [accountId, NEW_LIMITS.monthlyAiCredits]);

      console.log(`   Created AI credit package for account ${accountId}: ${NEW_LIMITS.monthlyAiCredits} credits`);
    }

    // 6. Update accounts table
    console.log('5. Updating accounts table...');
    await client.query(`
      UPDATE accounts
      SET
        max_channels = $1,
        max_users = $2,
        updated_at = NOW()
      WHERE plan = 'admin'
    `, [NEW_LIMITS.maxChannels, NEW_LIMITS.maxUsers]);
    console.log('   Accounts table updated.');

    await client.query('COMMIT');

    console.log('\n========================================');
    console.log('Admin credits updated successfully!');
    console.log('========================================\n');

    // Show summary
    const summaryResult = await client.query(`
      SELECT
        a.name as account_name,
        s.max_channels,
        s.max_users,
        s.monthly_gmaps_credits,
        s.monthly_ai_credits,
        (SELECT SUM(remaining_credits) FROM credit_packages WHERE account_id = a.id AND credit_type LIKE 'gmaps%' AND status = 'active') as gmaps_credits,
        (SELECT SUM(remaining_credits) FROM credit_packages WHERE account_id = a.id AND credit_type LIKE 'ai%' AND status = 'active') as ai_credits
      FROM accounts a
      JOIN subscriptions s ON s.account_id = a.id
      WHERE s.plan_type = 'admin' OR a.plan = 'admin'
    `);

    console.log('Summary:');
    console.log('----------------------------------------');
    summaryResult.rows.forEach(row => {
      console.log(`Account: ${row.account_name}`);
      console.log(`  Subscription Limits:`);
      console.log(`    - Channels: ${row.max_channels}`);
      console.log(`    - Users: ${row.max_users}`);
      console.log(`    - Monthly GMaps: ${row.monthly_gmaps_credits}`);
      console.log(`    - Monthly AI: ${row.monthly_ai_credits}`);
      console.log(`  Current Credits:`);
      console.log(`    - GMaps: ${row.gmaps_credits || 0}`);
      console.log(`    - AI: ${row.ai_credits || 0}`);
      console.log('');
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\nError:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

updateAdminCredits();
