// Script to run migration 011: Add Google OAuth fields
const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');

async function runMigration() {
  try {
    console.log('🚀 Running Migration 011: Add Google OAuth fields...\n');

    // Read migration SQL file
    const migrationPath = path.join(__dirname, '../database/migrations/011_add_google_oauth_fields.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    await db.query(sql);

    console.log('✅ Migration 011 executed successfully!\n');
    console.log('📊 Added fields to users table:');
    console.log('   - google_id (VARCHAR(255) UNIQUE)');
    console.log('   - avatar_url (TEXT)');
    console.log('   - is_active (BOOLEAN DEFAULT true)');
    console.log('   - role (VARCHAR(50) DEFAULT \'user\')');
    console.log('   - subscription_tier (VARCHAR(50) DEFAULT \'free\')');
    console.log('\n🔍 Created indexes:');
    console.log('   - idx_users_google_id');
    console.log('   - idx_users_is_active');
    console.log('\n✨ password_hash is now optional (for Google OAuth users)\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
