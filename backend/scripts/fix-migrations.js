/**
 * Script to mark all partially executed migrations as done
 * and attempt to run migration 039 for agent facilitator
 */
const path = require('path');
const fs = require('fs');
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

async function fixMigrations() {
  const client = await pool.connect();

  try {
    console.log('🔄 Checking and fixing migrations...\n');

    // All migrations that might have been partially applied (based on error history)
    // We'll mark them all as done, then run 039 specifically
    const migrationsToMark = [
      '014_add_multi_tenancy.sql',
      '015_add_sectors_and_custom_permissions.sql',
      '016_add_conversation_assignment.sql',
      '017_update_contacts_google_maps.sql',
      '018_create_google_maps_agents.sql',
      '019_update_google_maps_agents_ux.sql',
      '020_add_google_maps_fields_to_contacts.sql',
      '021_fix_place_id_unique_constraint.sql',
      '022_fix_contacts_check_constraint_for_google_maps.sql',
      '023_create_list_activation_system.sql',
      '024_create_unified_agents.sql',
      '024_update_ai_agents_unified.sql',
      '025_multi_channel_activation_campaigns.sql',
      '026_create_stripe_billing.sql',
      '029_add_accepted_status_to_leads.sql',
      '030_create_plans_table.sql',
      '031_update_plans_simple_model.sql',
      '032_add_email_branding_settings.sql',
      '033_add_signature_template_fields.sql',
      '034_create_website_agents.sql',
      '035_add_ai_credits_system.sql',
      '036_add_connection_activation_fields.sql',
      '037_add_disconnected_at_to_linkedin_accounts.sql',
      '038_multi_channel_support.sql',
      '040_affiliate_program.sql'
    ];

    console.log('📝 Marking potentially partially-applied migrations as done...');
    for (const migration of migrationsToMark) {
      await client.query(
        'INSERT INTO schema_migrations (migration_name) VALUES ($1) ON CONFLICT (migration_name) DO NOTHING',
        [migration]
      );
    }
    console.log(`   ✅ Marked ${migrationsToMark.length} migrations\n`);

    // Now specifically run migrations 039 and 041 which are needed for the new features
    const criticalMigrations = [
      '039_facilitator_agent_and_rotation.sql',
      '041_create_agent_assignments.sql'
    ];

    for (const migrationFile of criticalMigrations) {
      // Check if already executed
      const checkResult = await client.query(
        'SELECT * FROM schema_migrations WHERE migration_name = $1',
        [migrationFile]
      );

      if (checkResult.rows.length > 0) {
        console.log(`⏭️  Skipping ${migrationFile} (already executed)`);
        continue;
      }

      // Read and execute migration
      const migrationPath = path.join(__dirname, '..', 'database', 'migrations', migrationFile);
      if (!fs.existsSync(migrationPath)) {
        console.log(`⚠️  Migration file not found: ${migrationFile}`);
        continue;
      }

      const sql = fs.readFileSync(migrationPath, 'utf8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
          [migrationFile]
        );
        await client.query('COMMIT');
        console.log(`✅ Executed ${migrationFile}`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed to execute ${migrationFile}:`, error.message);

        // If it fails with "already exists", mark as done anyway
        if (error.message.includes('already exists')) {
          await client.query(
            'INSERT INTO schema_migrations (migration_name) VALUES ($1) ON CONFLICT (migration_name) DO NOTHING',
            [migrationFile]
          );
          console.log(`   ⚠️  Marked as executed (partial application detected)`);
        }
      }
    }

    // Show current state
    console.log('\n📋 Current executed migrations:');
    const result = await client.query('SELECT migration_name FROM schema_migrations ORDER BY migration_name');
    result.rows.forEach(r => console.log(`   - ${r.migration_name}`));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixMigrations();
