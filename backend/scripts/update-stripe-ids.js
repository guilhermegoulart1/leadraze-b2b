// backend/scripts/update-stripe-ids.js
// Script para atualizar os Stripe Price IDs nas tabelas plans e addons

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'getraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function updateStripeIds() {
  try {
    console.log('\n========================================');
    console.log('Updating Stripe Price IDs');
    console.log('========================================\n');

    // Update Base plan
    if (process.env.STRIPE_PRICE_BASE_MONTHLY) {
      await pool.query(`
        UPDATE plans
        SET stripe_price_id_monthly = $1
        WHERE slug = 'base'
      `, [process.env.STRIPE_PRICE_BASE_MONTHLY]);
      console.log(`✅ Base plan: ${process.env.STRIPE_PRICE_BASE_MONTHLY}`);
    }

    // Update Channel addon
    if (process.env.STRIPE_PRICE_CHANNEL_EXTRA) {
      await pool.query(`
        UPDATE addons
        SET stripe_price_id = $1
        WHERE slug = 'channel-extra'
      `, [process.env.STRIPE_PRICE_CHANNEL_EXTRA]);
      console.log(`✅ Channel Extra: ${process.env.STRIPE_PRICE_CHANNEL_EXTRA}`);
    }

    // Update User addon
    if (process.env.STRIPE_PRICE_USER_EXTRA) {
      await pool.query(`
        UPDATE addons
        SET stripe_price_id = $1
        WHERE slug = 'user-extra'
      `, [process.env.STRIPE_PRICE_USER_EXTRA]);
      console.log(`✅ User Extra: ${process.env.STRIPE_PRICE_USER_EXTRA}`);
    }

    // Update Credit packages
    const creditPackages = [
      { slug: 'credits-500', env: 'STRIPE_PRICE_CREDITS_500' },
      { slug: 'credits-1000', env: 'STRIPE_PRICE_CREDITS_1000' },
      { slug: 'credits-2500', env: 'STRIPE_PRICE_CREDITS_2500' },
      { slug: 'credits-5000', env: 'STRIPE_PRICE_CREDITS_5000' },
    ];

    for (const pkg of creditPackages) {
      if (process.env[pkg.env]) {
        await pool.query(`
          UPDATE addons
          SET stripe_price_id = $1
          WHERE slug = $2
        `, [process.env[pkg.env], pkg.slug]);
        console.log(`✅ ${pkg.slug}: ${process.env[pkg.env]}`);
      }
    }

    console.log('\n========================================');
    console.log('Stripe IDs updated successfully!');
    console.log('========================================\n');

    // Show summary
    console.log('Plans:');
    const plans = await pool.query('SELECT name, slug, stripe_price_id_monthly FROM plans WHERE is_public = true');
    plans.rows.forEach(p => console.log(`  ${p.name}: ${p.stripe_price_id_monthly || 'not set'}`));

    console.log('\nAdd-ons:');
    const addons = await pool.query('SELECT name, slug, stripe_price_id FROM addons ORDER BY display_order');
    addons.rows.forEach(a => console.log(`  ${a.name}: ${a.stripe_price_id || 'not set'}`));

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateStripeIds();
