// backend/src/queues/processors/googleMapsAgentProcessor.js
// Bull Queue processor for Google Maps Agent execution

const googleMapsAgentService = require('../../services/googleMapsAgentService');
const { googleMapsAgentQueue } = require('../index');

/**
 * Process a Google Maps Agent job
 *
 * Job data structure:
 * {
 *   agentId: UUID
 * }
 */
async function processGoogleMapsAgent(job) {
  const { agentId } = job.data;

  console.log(`\n🤖 [Job ${job.id}] Processing Google Maps Agent: ${agentId}`);
  console.log(`   Attempt: ${job.attemptsMade + 1}/${job.opts.attempts}`);

  try {
    // Execute the agent (fetch next 20 leads + insert into CRM)
    const result = await googleMapsAgentService.executeAgent(agentId);

    console.log(`✅ [Job ${job.id}] Agent execution completed:`);
    console.log(`   - Leads inserted: ${result.leads_inserted}`);
    console.log(`   - Leads skipped: ${result.leads_skipped}`);
    console.log(`   - Has more results: ${result.has_more_results}`);

    // If agent is completed (no more results), remove repeatable job
    if (!result.has_more_results || result.status === 'completed') {
      console.log(`🏁 [Job ${job.id}] Agent completed - removing repeatable job`);

      // Remove the repeatable job
      const repeatableJobs = await googleMapsAgentQueue.getRepeatableJobs();
      const agentJob = repeatableJobs.find(j => j.key.includes(agentId));

      if (agentJob) {
        await googleMapsAgentQueue.removeRepeatableByKey(agentJob.key);
        console.log(`   Repeatable job removed: ${agentJob.key}`);
      }
    } else {
      console.log(`⏭️  [Job ${job.id}] Agent will continue - next execution in 24h`);
    }

    return {
      success: true,
      agentId,
      ...result
    };

  } catch (error) {
    console.error(`❌ [Job ${job.id}] Error processing agent:`, error.message);

    // Don't retry if agent was deleted or not found
    if (error.message.includes('not found') || error.message.includes('Agent not found')) {
      console.log(`🗑️  [Job ${job.id}] Agent not found - job will be removed`);

      // Remove repeatable job
      const repeatableJobs = await googleMapsAgentQueue.getRepeatableJobs();
      const agentJob = repeatableJobs.find(j => j.key.includes(agentId));

      if (agentJob) {
        await googleMapsAgentQueue.removeRepeatableByKey(agentJob.key);
      }

      return {
        success: false,
        agentId,
        error: 'Agent not found',
        removed: true
      };
    }

    // For other errors, throw to trigger retry
    throw error;
  }
}

/**
 * Register the processor with the queue
 */
function registerGoogleMapsAgentProcessor() {
  console.log('📋 Registering Google Maps Agent processor...');

  googleMapsAgentQueue.process(async (job) => {
    return await processGoogleMapsAgent(job);
  });

  // Event handlers
  googleMapsAgentQueue.on('completed', (job, result) => {
    console.log(`✅ [google-maps-agents] Job ${job.id} completed`);
    if (result.leads_inserted > 0) {
      console.log(`   📊 ${result.leads_inserted} new leads added to CRM`);
    }
  });

  googleMapsAgentQueue.on('failed', (job, err) => {
    console.error(`❌ [google-maps-agents] Job ${job.id} failed:`, err.message);
  });

  googleMapsAgentQueue.on('progress', (job, progress) => {
    console.log(`📈 [google-maps-agents] Job ${job.id} progress: ${progress}%`);
  });

  console.log('✅ Google Maps Agent processor registered');
}

module.exports = {
  processGoogleMapsAgent,
  registerGoogleMapsAgentProcessor
};
