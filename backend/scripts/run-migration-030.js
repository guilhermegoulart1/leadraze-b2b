// backend/scripts/run-migration-030.js
// Script para rodar a migracao 030 (tabela de plans)

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'getraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  try {
    console.log('\n========================================');
    console.log('Migration 030: Create Plans Table');
    console.log('========================================\n');

    // Read SQL file
    const sqlPath = path.join(__dirname, '../database/migrations/030_create_plans_table.sql');

    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration file not found: ${sqlPath}`);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Running migration...\n');
    await pool.query(sql);

    // Verify plans were created
    const plansResult = await pool.query('SELECT name, slug, max_channels, max_users, monthly_gmaps_credits, is_public FROM plans ORDER BY display_order');

    console.log('\nPlans created:');
    console.log('----------------------------------------');
    plansResult.rows.forEach(plan => {
      const visibility = plan.is_public ? 'Public' : 'Internal';
      console.log(`  ${plan.name} (${plan.slug})`);
      console.log(`    - Channels: ${plan.max_channels}`);
      console.log(`    - Users: ${plan.max_users}`);
      console.log(`    - GMaps Credits: ${plan.monthly_gmaps_credits}`);
      console.log(`    - Visibility: ${visibility}`);
      console.log('');
    });

    console.log('Migration 030 completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
