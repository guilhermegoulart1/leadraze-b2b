// Diagnose campaign delete issue
// Load environment variables first
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Clear cache and reload database module
delete require.cache[require.resolve('../src/config/database')];
const db = require('../src/config/database');

async function diagnoseCampaignDelete() {
  try {
    console.log('🔍 Diagnostic: Campaign Delete Issue\n');
    console.log('=====================================\n');

    // Get a campaign to test
    console.log('1. Finding a campaign...\n');
    const campaignResult = await db.query(`
      SELECT id, name, status, user_id, account_id
      FROM campaigns
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (campaignResult.rows.length === 0) {
      console.log('❌ No campaigns found');
      process.exit(0);
    }

    const campaign = campaignResult.rows[0];
    console.log('Campaign found:');
    console.log(`  ID: ${campaign.id}`);
    console.log(`  Name: ${campaign.name}`);
    console.log(`  Status: ${campaign.status}`);
    console.log(`  Account ID: ${campaign.account_id}`);

    // Check triggers on campaigns table
    console.log('\n2. Checking triggers on campaigns table...\n');
    const triggersResult = await db.query(`
      SELECT
        tgname AS trigger_name,
        tgrelid::regclass AS table_name,
        pg_get_triggerdef(oid) AS trigger_definition
      FROM pg_trigger
      WHERE tgrelid = 'campaigns'::regclass
        AND tgisinternal = false
    `);

    if (triggersResult.rows.length === 0) {
      console.log('  No custom triggers found on campaigns table');
    } else {
      console.log(`  Found ${triggersResult.rows.length} trigger(s):`);
      triggersResult.rows.forEach(row => {
        console.log(`\n  Trigger: ${row.trigger_name}`);
        console.log(`  Definition: ${row.trigger_definition}`);
      });
    }

    // Check foreign key constraints that reference campaigns
    console.log('\n3. Checking foreign keys that reference campaigns...\n');
    const fkResult = await db.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule,
        rc.update_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'campaigns'
      ORDER BY tc.table_name
    `);

    if (fkResult.rows.length === 0) {
      console.log('  No foreign keys reference campaigns');
    } else {
      console.log(`  Found ${fkResult.rows.length} foreign key(s) referencing campaigns:`);
      fkResult.rows.forEach(row => {
        console.log(`\n  Table: ${row.table_name}`);
        console.log(`  Column: ${row.column_name} -> campaigns.${row.foreign_column_name}`);
        console.log(`  DELETE rule: ${row.delete_rule}`);
        console.log(`  UPDATE rule: ${row.update_rule}`);
      });
    }

    // Check triggers on related tables
    console.log('\n4. Checking triggers on related tables (leads, conversations, bulk_collection_jobs)...\n');

    const relatedTables = ['leads', 'conversations', 'bulk_collection_jobs'];

    for (const table of relatedTables) {
      const tableTriggersResult = await db.query(`
        SELECT
          tgname AS trigger_name,
          tgrelid::regclass AS table_name,
          pg_get_triggerdef(oid) AS trigger_definition
        FROM pg_trigger
        WHERE tgrelid = $1::regclass
          AND tgisinternal = false
      `, [table]);

      if (tableTriggersResult.rows.length > 0) {
        console.log(`\n  Triggers on ${table}:`);
        tableTriggersResult.rows.forEach(row => {
          console.log(`    - ${row.trigger_name}`);
          console.log(`      ${row.trigger_definition}`);
        });
      }
    }

    // Try a dry-run delete to see the exact error
    console.log('\n5. Attempting DELETE (will rollback)...\n');

    try {
      await db.query('BEGIN');
      await db.query('DELETE FROM campaigns WHERE id = $1', [campaign.id]);
      await db.query('ROLLBACK');
      console.log('✅ DELETE would succeed (rolled back for safety)');
    } catch (deleteError) {
      await db.query('ROLLBACK');
      console.log('❌ DELETE FAILED!\n');
      console.log('Error message:', deleteError.message);
      console.log('Error code:', deleteError.code);
      console.log('Error detail:', deleteError.detail);
      console.log('Error hint:', deleteError.hint);
      console.log('Error position:', deleteError.position);
      console.log('Error where:', deleteError.where);
      console.log('\nFull error:');
      console.log(JSON.stringify(deleteError, Object.getOwnPropertyNames(deleteError), 2));
    }

    console.log('\n=====================================');
    console.log('✅ Diagnostic complete\n');

  } catch (error) {
    console.error('❌ Unexpected error:');
    console.error(error);
  } finally {
    process.exit();
  }
}

diagnoseCampaignDelete();
