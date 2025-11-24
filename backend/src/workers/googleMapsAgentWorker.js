// backend/src/workers/googleMapsAgentWorker.js
// Daily worker to execute Google Maps agents automatically

const googleMapsAgentService = require('../services/googleMapsAgentService');

/**
 * Execute all Google Maps agents that are due
 *
 * This worker should be called:
 * - By a cron job (e.g., every hour to check for agents to execute)
 * - Or manually via admin endpoint
 */
async function executeScheduledAgents() {
  console.log('🤖 Starting Google Maps Agent Worker...');
  console.log(`⏰ Current time: ${new Date().toISOString()}`);

  try {
    // Get all agents that need to be executed
    const agentsToExecute = await googleMapsAgentService.getAgentsToExecute();

    if (agentsToExecute.length === 0) {
      console.log('✅ No agents scheduled for execution at this time');
      return {
        success: true,
        executed: 0,
        failed: 0,
        skipped: 0
      };
    }

    console.log(`📋 Found ${agentsToExecute.length} agent(s) to execute`);

    let executed = 0;
    let failed = 0;
    let skipped = 0;

    // Execute each agent
    for (const agent of agentsToExecute) {
      try {
        console.log(`\n🔹 Executing agent: ${agent.name} (${agent.id})`);
        console.log(`   Status: ${agent.status}`);
        console.log(`   Current page: ${agent.current_page || 0}`);
        console.log(`   Last execution: ${agent.last_execution_at || 'Never'}`);

        // Execute the agent
        const result = await googleMapsAgentService.executeAgent(agent.id);

        if (result.success) {
          console.log(`✅ Agent executed successfully:`);
          console.log(`   - Leads inserted: ${result.leads_inserted}`);
          console.log(`   - Leads skipped: ${result.leads_skipped}`);
          console.log(`   - Current page: ${result.current_page}`);
          console.log(`   - Has more results: ${result.has_more_results}`);

          executed++;
        } else {
          console.log(`⚠️  Agent execution completed with warnings`);
          skipped++;
        }

      } catch (error) {
        console.error(`❌ Error executing agent ${agent.name}:`, error.message);
        failed++;

        // Mark agent as failed
        try {
          await googleMapsAgentService._updateAgentStatus(agent.id, 'failed');
        } catch (updateError) {
          console.error('❌ Error updating agent status:', updateError.message);
        }
      }

      // Small delay between agents to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n✅ Google Maps Agent Worker completed');
    console.log(`   Executed: ${executed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Skipped: ${skipped}`);

    return {
      success: true,
      executed,
      failed,
      skipped,
      total: agentsToExecute.length
    };

  } catch (error) {
    console.error('❌ Fatal error in Google Maps Agent Worker:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Execute a specific agent by ID (for testing/manual triggers)
 */
async function executeAgentById(agentId) {
  console.log(`🤖 Manually executing agent: ${agentId}`);

  try {
    const result = await googleMapsAgentService.executeAgent(agentId);

    console.log('✅ Agent executed successfully');
    return result;

  } catch (error) {
    console.error('❌ Error executing agent:', error);
    throw error;
  }
}

// If running directly (not imported as module)
if (require.main === module) {
  console.log('🚀 Running Google Maps Agent Worker directly...');

  executeScheduledAgents()
    .then(result => {
      console.log('\n📊 Final result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('\n💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  executeScheduledAgents,
  executeAgentById
};
