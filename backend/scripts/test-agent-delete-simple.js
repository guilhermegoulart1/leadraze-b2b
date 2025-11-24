// Simple test to identify the exact SQL causing the error
const db = require('../src/config/database');

async function testDelete() {
  try {
    console.log('🔍 Finding google_maps_agent to delete...\n');

    // Get one agent
    const agentResult = await db.query(`
      SELECT id, name, account_id, status
      FROM google_maps_agents
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (agentResult.rows.length === 0) {
      console.log('No agents found');
      process.exit(0);
    }

    const agent = agentResult.rows[0];
    console.log(`Agent found:`);
    console.log(`  ID: ${agent.id}`);
    console.log(`  Name: ${agent.name}`);
    console.log(`  Account ID: ${agent.account_id}`);
    console.log(`  Status: ${agent.status}`);

    console.log('\n🔍 Checking related data...\n');

    // Check google_maps_agent_contacts
    const contactsResult = await db.query(`
      SELECT COUNT(*) as count
      FROM google_maps_agent_contacts
      WHERE agent_id = $1
    `, [agent.id]);
    console.log(`  Related contacts: ${contactsResult.rows[0].count}`);

    console.log('\n🗑️  Attempting DELETE...\n');

    // Try to delete with verbose error handling
    try {
      await db.query('DELETE FROM google_maps_agents WHERE id = $1 AND account_id = $2', [agent.id, agent.account_id]);
      console.log('✅ DELETE SUCCESSFUL!');
    } catch (deleteError) {
      console.error('❌ DELETE FAILED!\n');
      console.error('Error message:', deleteError.message);
      console.error('\nError details:');
      console.error('  Code:', deleteError.code);
      console.error('  Detail:', deleteError.detail);
      console.error('  Hint:', deleteError.hint);
      console.error('  Position:', deleteError.position);
      console.error('  Query:', deleteError.query);
      console.error('  Schema:', deleteError.schema);
      console.error('  Table:', deleteError.table);
      console.error('  Column:', deleteError.column);
      console.error('  Constraint:', deleteError.constraint);
      console.error('\nFull error object:');
      console.error(JSON.stringify(deleteError, null, 2));
    }

  } catch (error) {
    console.error('❌ Unexpected error:');
    console.error(error);
  } finally {
    process.exit();
  }
}

testDelete();
