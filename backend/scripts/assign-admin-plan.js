// backend/scripts/assign-admin-plan.js
// Script para associar o plano Admin ao usuario/account existente

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

async function assignAdminPlan() {
  const client = await pool.connect();

  try {
    console.log('\n========================================');
    console.log('Assign Admin Plan to Existing Users');
    console.log('========================================\n');

    await client.query('BEGIN');

    // Get Admin plan
    const planResult = await client.query(
      "SELECT id, name, max_channels, max_users, monthly_gmaps_credits FROM plans WHERE slug = 'admin'"
    );

    if (planResult.rows.length === 0) {
      throw new Error('Admin plan not found. Run migration 030 first.');
    }

    const adminPlan = planResult.rows[0];
    console.log(`Admin plan found: ${adminPlan.name} (${adminPlan.id})`);

    // Get all accounts that don't have a subscription yet
    const accountsResult = await client.query(`
      SELECT a.id, a.name, a.slug
      FROM accounts a
      LEFT JOIN subscriptions s ON s.account_id = a.id
      WHERE s.id IS NULL
    `);

    if (accountsResult.rows.length === 0) {
      console.log('\nNo accounts without subscription found.');

      // Check if there are any accounts at all
      const allAccounts = await client.query('SELECT id, name, slug FROM accounts');
      if (allAccounts.rows.length === 0) {
        console.log('No accounts exist yet. Create a user first.');
      } else {
        console.log('\nExisting accounts already have subscriptions:');
        const existingSubscriptions = await client.query(`
          SELECT a.name, a.slug, s.plan_type, s.status, p.name as plan_name
          FROM accounts a
          JOIN subscriptions s ON s.account_id = a.id
          LEFT JOIN plans p ON p.id = s.plan_id
        `);
        existingSubscriptions.rows.forEach(sub => {
          console.log(`  - ${sub.name} (${sub.slug}): ${sub.plan_name || sub.plan_type} [${sub.status}]`);
        });
      }

      await client.query('ROLLBACK');
      return;
    }

    console.log(`\nFound ${accountsResult.rows.length} account(s) without subscription:`);
    accountsResult.rows.forEach(acc => {
      console.log(`  - ${acc.name} (${acc.slug})`);
    });

    // Create subscriptions for each account
    for (const account of accountsResult.rows) {
      console.log(`\nCreating Admin subscription for: ${account.name}`);

      // Create subscription
      const subscriptionResult = await client.query(`
        INSERT INTO subscriptions (
          account_id,
          stripe_customer_id,
          plan_type,
          plan_id,
          status,
          max_channels,
          max_users,
          monthly_gmaps_credits,
          current_period_start,
          current_period_end,
          metadata
        ) VALUES (
          $1,
          'admin_internal',
          'admin',
          $2,
          'active',
          $3,
          $4,
          $5,
          NOW(),
          NOW() + INTERVAL '100 years',
          '{"assigned_by": "system", "reason": "initial_admin"}'::jsonb
        )
        RETURNING id
      `, [
        account.id,
        adminPlan.id,
        adminPlan.max_channels,
        adminPlan.max_users,
        adminPlan.monthly_gmaps_credits
      ]);

      console.log(`  Subscription created: ${subscriptionResult.rows[0].id}`);

      // Update account subscription_status
      await client.query(`
        UPDATE accounts
        SET subscription_status = 'active',
            plan = 'admin',
            max_channels = $2,
            max_users = $3
        WHERE id = $1
      `, [account.id, adminPlan.max_channels, adminPlan.max_users]);

      console.log(`  Account updated with Admin plan`);

      // Create initial credit package (unlimited)
      await client.query(`
        INSERT INTO credit_packages (
          account_id,
          credit_type,
          initial_credits,
          remaining_credits,
          expires_at,
          status,
          source
        ) VALUES (
          $1,
          'gmaps_monthly',
          $2,
          $2,
          NOW() + INTERVAL '100 years',
          'active',
          'subscription'
        )
      `, [account.id, adminPlan.monthly_gmaps_credits]);

      console.log(`  Credit package created: ${adminPlan.monthly_gmaps_credits} credits`);
    }

    await client.query('COMMIT');

    console.log('\n========================================');
    console.log('Admin plan assigned successfully!');
    console.log('========================================\n');

    // Show summary
    const summaryResult = await client.query(`
      SELECT
        a.name as account_name,
        a.slug as account_slug,
        u.email as user_email,
        s.status as subscription_status,
        p.name as plan_name,
        s.max_channels,
        s.max_users,
        s.monthly_gmaps_credits
      FROM accounts a
      JOIN users u ON u.account_id = a.id
      JOIN subscriptions s ON s.account_id = a.id
      LEFT JOIN plans p ON p.id = s.plan_id
    `);

    console.log('Summary:');
    console.log('----------------------------------------');
    summaryResult.rows.forEach(row => {
      console.log(`Account: ${row.account_name}`);
      console.log(`  User: ${row.user_email}`);
      console.log(`  Plan: ${row.plan_name}`);
      console.log(`  Status: ${row.subscription_status}`);
      console.log(`  Limits:`);
      console.log(`    - Channels: ${row.max_channels}`);
      console.log(`    - Users: ${row.max_users}`);
      console.log(`    - GMaps Credits: ${row.monthly_gmaps_credits}`);
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

assignAdminPlan();
