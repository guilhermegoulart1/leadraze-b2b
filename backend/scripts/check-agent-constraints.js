// Script to check constraints and triggers on google_maps_agents table
const db = require('../src/config/database');

async function checkConstraints() {
  try {
    console.log('🔍 Checking triggers on google_maps_agents...\n');

    // Check triggers
    const triggers = await db.query(`
      SELECT
        tgname AS trigger_name,
        tgrelid::regclass AS table_name,
        pg_get_triggerdef(oid) AS trigger_definition
      FROM pg_trigger
      WHERE tgrelid = 'google_maps_agents'::regclass
        AND tgisinternal = false
    `);

    console.log('Triggers:');
    console.log(JSON.stringify(triggers.rows, null, 2));

    console.log('\n🔍 Checking foreign key constraints...\n');

    // Check foreign key constraints
    const constraints = await db.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.update_rule,
        rc.delete_rule
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
        AND tc.table_name = 'google_maps_agents'
    `);

    console.log('Foreign Key Constraints:');
    console.log(JSON.stringify(constraints.rows, null, 2));

    console.log('\n🔍 Checking related table constraints...\n');

    // Check constraints on related table
    const relatedConstraints = await db.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.update_rule,
        rc.delete_rule
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
        AND ccu.table_name = 'google_maps_agents'
    `);

    console.log('Constraints referencing google_maps_agents:');
    console.log(JSON.stringify(relatedConstraints.rows, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    process.exit();
  }
}

checkConstraints();
