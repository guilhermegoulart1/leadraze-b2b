// backend/scripts/run-migration-031.js
// Script para rodar a migracao 031 (modelo simplificado de planos)

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'leadraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  try {
    console.log('\n========================================');
    console.log('Migration 031: Simplified Plan Model');
    console.log('========================================\n');

    // Read SQL file
    const sqlPath = path.join(__dirname, '../database/migrations/031_update_plans_simple_model.sql');

    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration file not found: ${sqlPath}`);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Running migration...\n');
    await pool.query(sql);

    // Verify plans
    console.log('Plans:');
    console.log('----------------------------------------');
    const plansResult = await pool.query(
      'SELECT name, slug, price_monthly_cents, max_channels, max_users, monthly_gmaps_credits, is_public FROM plans ORDER BY display_order'
    );
    plansResult.rows.forEach(plan => {
      const price = plan.price_monthly_cents > 0 ? `R$ ${(plan.price_monthly_cents / 100).toFixed(2)}/mês` : 'Grátis';
      console.log(`  ${plan.name} (${plan.slug}) - ${price}`);
      console.log(`    Canais: ${plan.max_channels}, Usuários: ${plan.max_users}, Créditos: ${plan.monthly_gmaps_credits}/mês`);
      console.log(`    Público: ${plan.is_public ? 'Sim' : 'Não'}`);
      console.log('');
    });

    // Verify addons
    console.log('Add-ons:');
    console.log('----------------------------------------');
    const addonsResult = await pool.query(
      'SELECT name, slug, addon_type, price_cents, billing_type, credits_amount, credits_expire FROM addons ORDER BY display_order'
    );
    addonsResult.rows.forEach(addon => {
      const price = `R$ ${(addon.price_cents / 100).toFixed(2)}`;
      const billing = addon.billing_type === 'recurring' ? '/mês' : ' (avulso)';
      const expireInfo = addon.addon_type === 'credits' ? (addon.credits_expire ? ' - expira' : ' - não expira') : '';
      console.log(`  ${addon.name}: ${price}${billing}${expireInfo}`);
    });

    console.log('\n========================================');
    console.log('Migration 031 completed successfully!');
    console.log('========================================\n');

  } catch (error) {
    console.error('Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
