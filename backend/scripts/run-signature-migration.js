/**
 * Run the signature template fields migration
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../src/config/database');

async function runMigration() {
  console.log('Running signature template fields migration...');

  const migration = `
    -- Template identifier
    ALTER TABLE email_signatures
    ADD COLUMN IF NOT EXISTS template_id VARCHAR(50);

    -- Accent color for the signature
    ALTER TABLE email_signatures
    ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) DEFAULT '#ec4899';

    -- Photo URL
    ALTER TABLE email_signatures
    ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500);

    -- Department
    ALTER TABLE email_signatures
    ADD COLUMN IF NOT EXISTS department VARCHAR(255);

    -- Pronouns
    ALTER TABLE email_signatures
    ADD COLUMN IF NOT EXISTS pronouns VARCHAR(50);

    -- Mobile phone
    ALTER TABLE email_signatures
    ADD COLUMN IF NOT EXISTS mobile VARCHAR(50);

    -- Address
    ALTER TABLE email_signatures
    ADD COLUMN IF NOT EXISTS address VARCHAR(500);
  `;

  try {
    await pool.query(migration);
    console.log('✅ Migration completed successfully!');

    // Verify columns exist
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'email_signatures'
      AND column_name IN ('template_id', 'accent_color', 'photo_url', 'department', 'pronouns', 'mobile', 'address')
      ORDER BY column_name
    `);

    console.log('\nNew columns in email_signatures:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();
