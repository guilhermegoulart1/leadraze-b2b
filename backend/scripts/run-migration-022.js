// Run migration 022 to fix contacts_check constraint
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

delete require.cache[require.resolve('../src/config/database')];
const db = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🚀 Running Migration 022: Fix contacts_check constraint\n');

    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migrations/022_fix_contacts_check_constraint_for_google_maps.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded\n');
    console.log('🔍 Checking current constraint...\n');

    // Check existing constraint
    const existingConstraint = await db.query(`
      SELECT check_clause
      FROM information_schema.check_constraints
      WHERE constraint_name = 'contacts_check'
    `);

    if (existingConstraint.rows.length > 0) {
      console.log('Current constraint:');
      console.log(`  ${existingConstraint.rows[0].check_clause}\n`);
    } else {
      console.log('  No contacts_check constraint found\n');
    }

    console.log('🔧 Applying migration...\n');

    // Run migration
    await db.query(migrationSQL);

    console.log('✅ Migration applied successfully!\n');

    // Verify fix
    console.log('🔍 Verifying fix...\n');

    const newConstraint = await db.query(`
      SELECT check_clause
      FROM information_schema.check_constraints
      WHERE constraint_name = 'contacts_check'
    `);

    if (newConstraint.rows.length > 0) {
      console.log('New constraint:');
      console.log(`  ${newConstraint.rows[0].check_clause}\n`);
    }

    console.log('✅ Done! Google Maps agents can now insert contacts without email/phone.\n');

  } catch (error) {
    console.error('❌ Error running migration:');
    console.error('Message:', error.message);
    console.error('\nDetails:');
    console.error(error);
  } finally {
    process.exit();
  }
}

runMigration();
