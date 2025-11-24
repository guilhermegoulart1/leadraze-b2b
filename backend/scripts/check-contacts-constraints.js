// Check contacts table constraints
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

delete require.cache[require.resolve('../src/config/database')];
const db = require('../src/config/database');

async function checkConstraints() {
  try {
    console.log('🔍 Checking contacts table constraints...\n');

    // Get CHECK constraints
    const checkConstraints = await db.query(`
      SELECT
        tc.constraint_name,
        cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_name = 'contacts'
        AND tc.constraint_type = 'CHECK'
    `);

    console.log('CHECK Constraints on contacts table:');
    if (checkConstraints.rows.length === 0) {
      console.log('  (none found)');
    } else {
      checkConstraints.rows.forEach(row => {
        console.log(`\n  Constraint: ${row.constraint_name}`);
        console.log(`  Check clause: ${row.check_clause}`);
      });
    }

    console.log('\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit();
  }
}

checkConstraints();
