// Run migration 021 to fix the place_id UNIQUE constraint issue
const db = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🚀 Running Migration 021: Fix place_id UNIQUE constraint\n');

    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migrations/021_fix_place_id_unique_constraint.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded\n');
    console.log('🔍 Checking current constraints...\n');

    // Check existing constraints
    const existingConstraints = await db.query(`
      SELECT
        constraint_name,
        constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'contacts'
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%place_id%'
    `);

    console.log('Current UNIQUE constraints on place_id:');
    if (existingConstraints.rows.length === 0) {
      console.log('  (none found)');
    } else {
      existingConstraints.rows.forEach(row => {
        console.log(`  - ${row.constraint_name} (${row.constraint_type})`);
      });
    }

    console.log('\n🔧 Applying migration...\n');

    // Run migration
    await db.query(migrationSQL);

    console.log('✅ Migration applied successfully!\n');

    // Verify fix
    console.log('🔍 Verifying fix...\n');

    const finalConstraints = await db.query(`
      SELECT
        constraint_name,
        constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'contacts'
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%place_id%'
    `);

    console.log('Final UNIQUE constraints on place_id:');
    if (finalConstraints.rows.length === 0) {
      console.log('  (none found - THIS IS A PROBLEM!)');
    } else {
      finalConstraints.rows.forEach(row => {
        console.log(`  - ${row.constraint_name} (${row.constraint_type})`);
      });
    }

    console.log('\n✅ Done! You can now try deleting the agent again.\n');

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
