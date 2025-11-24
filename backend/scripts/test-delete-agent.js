// Test script to reproduce the delete error
const db = require('../src/config/database');

async function testDelete() {
  try {
    // Get the first agent to test delete
    const agentResult = await db.query(`
      SELECT id, name, account_id
      FROM google_maps_agents
      LIMIT 1
    `);

    if (agentResult.rows.length === 0) {
      console.log('❌ No agents found in database');
      process.exit(0);
    }

    const agent = agentResult.rows[0];
    console.log(`🧪 Testing delete for agent: ${agent.name} (${agent.id})`);
    console.log(`   Account ID: ${agent.account_id}`);

    // Try to delete
    console.log('\n🗑️  Attempting to delete...\n');

    await db.query(
      'DELETE FROM google_maps_agents WHERE id = $1 AND account_id = $2',
      [agent.id, agent.account_id]
    );

    console.log('✅ Delete successful!');

  } catch (error) {
    console.error('❌ Error during delete:');
    console.error('Message:', error.message);
    console.error('Detail:', error.detail);
    console.error('Hint:', error.hint);
    console.error('Position:', error.position);
    console.error('Code:', error.code);
    console.error('\nFull error:');
    console.error(error);
  } finally {
    process.exit();
  }
}

testDelete();
