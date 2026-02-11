require('dotenv').config();
const { delayedConversationQueue } = require('./src/queues');

(async () => {
  try {
    // Check job counts
    const jobCounts = await delayedConversationQueue.getJobCounts();
    console.log('=== DELAYED CONVERSATION QUEUE STATUS ===');
    console.log(JSON.stringify(jobCounts, null, 2));

    // Check delayed jobs
    const delayed = await delayedConversationQueue.getDelayed();
    console.log('\n=== DELAYED JOBS ===');
    for (const job of delayed) {
      console.log(`  Job ${job.id}: conversationId=${job.data.conversationId}, delay=${job.opts.delay}ms, processedOn=${job.processedOn}, timestamp=${job.timestamp}`);
    }

    // Check waiting jobs
    const waiting = await delayedConversationQueue.getWaiting();
    console.log('\n=== WAITING JOBS ===');
    for (const job of waiting) {
      console.log(`  Job ${job.id}: conversationId=${job.data.conversationId}`);
    }

    // Check failed jobs
    const failed = await delayedConversationQueue.getFailed();
    console.log('\n=== FAILED JOBS ===');
    for (const job of failed) {
      console.log(`  Job ${job.id}: conversationId=${job.data.conversationId}, failedReason=${job.failedReason}`);
    }

    // Check completed jobs (recent)
    const completed = await delayedConversationQueue.getCompleted();
    console.log(`\n=== COMPLETED JOBS (${completed.length}) ===`);
    for (const job of completed.slice(0, 10)) {
      console.log(`  Job ${job.id}: conversationId=${job.data.conversationId}, returnvalue=${JSON.stringify(job.returnvalue)}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
