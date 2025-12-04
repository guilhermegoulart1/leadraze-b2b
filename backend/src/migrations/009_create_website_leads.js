// backend/src/migrations/009_create_website_leads.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'leadraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function up() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('📦 Creating website_leads table...');

    // Create website_leads table
    await client.query(`
      CREATE TABLE IF NOT EXISTS website_leads (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

        -- Lead info
        email VARCHAR(255) NOT NULL,
        source VARCHAR(50) DEFAULT 'hero', -- hero, pricing, footer, etc.
        locale VARCHAR(10) DEFAULT 'en',

        -- UTM tracking
        utm_source VARCHAR(255),
        utm_medium VARCHAR(255),
        utm_campaign VARCHAR(255),
        utm_content VARCHAR(255),
        utm_term VARCHAR(255),
        referrer TEXT,

        -- Visitor info
        ip_address VARCHAR(45),
        user_agent TEXT,
        country VARCHAR(100),
        city VARCHAR(100),

        -- Conversion tracking
        status VARCHAR(50) DEFAULT 'captured', -- captured, trial_started, subscribed, churned
        stripe_customer_id VARCHAR(255),
        stripe_session_id VARCHAR(255),
        trial_started_at TIMESTAMP,
        subscribed_at TIMESTAMP,

        -- Plan info (when they subscribe)
        plan_channels INTEGER,
        plan_users INTEGER,
        plan_amount INTEGER, -- in cents

        -- Metadata
        affiliate_code VARCHAR(50),
        extra_data JSONB DEFAULT '{}',

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        -- Unique constraint on email
        UNIQUE(email)
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_website_leads_email
        ON website_leads(email);

      CREATE INDEX IF NOT EXISTS idx_website_leads_status
        ON website_leads(status);

      CREATE INDEX IF NOT EXISTS idx_website_leads_created_at
        ON website_leads(created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_website_leads_source
        ON website_leads(source);

      CREATE INDEX IF NOT EXISTS idx_website_leads_stripe_customer
        ON website_leads(stripe_customer_id);
    `);

    console.log('✅ website_leads table created!');

    await client.query('COMMIT');
    console.log('🎉 Migration 009 completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🔄 Reverting migration 009...');

    await client.query(`
      DROP TABLE IF EXISTS website_leads CASCADE;
    `);

    console.log('✅ Migration 009 reverted!');

    await client.query('COMMIT');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error reverting migration:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Execute if called directly
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'up') {
    up()
      .then(() => {
        console.log('✅ Migration applied successfully!');
        process.exit(0);
      })
      .catch(err => {
        console.error('❌ Error:', err);
        process.exit(1);
      });
  } else if (command === 'down') {
    down()
      .then(() => {
        console.log('✅ Migration reverted successfully!');
        process.exit(0);
      })
      .catch(err => {
        console.error('❌ Error:', err);
        process.exit(1);
      });
  } else {
    console.log('Usage: node 009_create_website_leads.js [up|down]');
    process.exit(1);
  }
}

module.exports = { up, down };
