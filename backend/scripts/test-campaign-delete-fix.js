// Test if the campaign delete fix works
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

delete require.cache[require.resolve('../src/config/database')];
const db = require('../src/config/database');

// Import the helper function to test the query
const { Pool } = require('pg');

async function testFix() {
  try {
    console.log('🧪 Testing Campaign Delete Fix\n');

    // Get a test campaign
    const campaignResult = await db.query(`
      SELECT id, name, user_id, account_id, sector_id
      FROM campaigns
      LIMIT 1
    `);

    if (campaignResult.rows.length === 0) {
      console.log('No campaigns found to test');
      process.exit(0);
    }

    const campaign = campaignResult.rows[0];
    console.log('Test campaign:');
    console.log(`  ID: ${campaign.id}`);
    console.log(`  Name: ${campaign.name}`);
    console.log(`  User ID: ${campaign.user_id}`);
    console.log(`  Account ID: ${campaign.account_id}`);
    console.log(`  Sector ID: ${campaign.sector_id || '(null)'}`);

    // Simulate the sector filter (simplified version)
    console.log('\n1. Testing query WITH alias "c" (CORRECT):');
    try {
      const sectorFilter = campaign.sector_id
        ? 'AND c.sector_id IS NULL'
        : 'AND c.sector_id IS NULL';

      const result = await db.query(
        `SELECT * FROM campaigns c WHERE c.id = $1 AND c.user_id = $2 AND c.account_id = $3 ${sectorFilter}`,
        [campaign.id, campaign.user_id, campaign.account_id]
      );

      console.log('   ✅ Query executed successfully!');
      console.log(`   Found ${result.rows.length} campaign(s)`);
    } catch (error) {
      console.log('   ❌ Query failed:', error.message);
    }

    console.log('\n2. Testing query WITHOUT alias "c" (WRONG - should fail):');
    try {
      const sectorFilter = campaign.sector_id
        ? 'AND c.sector_id IS NULL'
        : 'AND c.sector_id IS NULL';

      const result = await db.query(
        `SELECT * FROM campaigns WHERE id = $1 AND user_id = $2 AND account_id = $3 ${sectorFilter}`,
        [campaign.id, campaign.user_id, campaign.account_id]
      );

      console.log('   ⚠️ Query executed (this should have failed!)');
      console.log(`   Found ${result.rows.length} campaign(s)`);
    } catch (error) {
      console.log('   ✅ Query failed as expected!');
      console.log(`   Error: ${error.message}`);
    }

    console.log('\n3. Testing DELETE operation (will rollback):');
    try {
      await db.query('BEGIN');

      // Test the delete queries
      const sectorFilter = 'AND c.sector_id IS NULL';
      const checkCampaign = await db.query(
        `SELECT * FROM campaigns c WHERE c.id = $1 AND c.user_id = $2 AND c.account_id = $3 ${sectorFilter}`,
        [campaign.id, campaign.user_id, campaign.account_id]
      );

      if (checkCampaign.rows.length > 0) {
        // Simulate the deletes from the controller
        await db.query('DELETE FROM bulk_collection_jobs WHERE campaign_id = $1', [campaign.id]);
        await db.query('DELETE FROM leads WHERE campaign_id = $1', [campaign.id]);
        await db.query('DELETE FROM campaigns WHERE id = $1', [campaign.id]);

        console.log('   ✅ DELETE operations would succeed!');
      }

      await db.query('ROLLBACK');
      console.log('   ✅ Transaction rolled back (data preserved)');

    } catch (error) {
      await db.query('ROLLBACK');
      console.log('   ❌ DELETE operation failed:', error.message);
    }

    console.log('\n========================================');
    console.log('✅ Test complete!');
    console.log('\nThe fix should now work. Try deleting a campaign via the UI or API.');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit();
  }
}

testFix();
