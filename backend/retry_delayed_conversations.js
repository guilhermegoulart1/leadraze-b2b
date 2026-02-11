/**
 * Retry failed delayed conversation jobs
 * Run after deploying the tone column fix
 */
require('dotenv').config();
const { delayedConversationQueue } = require('./src/queues');

(async () => {
  try {
    // Get failed jobs
    const failed = await delayedConversationQueue.getFailed();
    console.log(`Found ${failed.length} failed jobs`);

    for (const job of failed) {
      console.log(`Retrying job ${job.id}: conversationId=${job.data.conversationId}`);
      await job.retry();
    }

    console.log(`\nRetried ${failed.length} jobs. They should process immediately.`);

    // Wait a bit then check status
    await new Promise(resolve => setTimeout(resolve, 3000));

    const counts = await delayedConversationQueue.getJobCounts();
    console.log('\nQueue status after retry:', JSON.stringify(counts, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
