require('dotenv').config();
const { followUpQueue } = require('./src/queues');

(async () => {
  try {
    const jobCounts = await followUpQueue.getJobCounts();
    console.log('=== FOLLOW-UP QUEUE STATUS ===');
    console.log(JSON.stringify(jobCounts, null, 2));

    const delayed = await followUpQueue.getDelayed();
    console.log(`\n=== DELAYED JOBS (${delayed.length}) ===`);
    for (const job of delayed) {
      console.log(`  Job ${job.id}: type=${job.data.type}, conversationId=${job.data.conversationId}, scheduledFor=${job.data.scheduledFor}`);
    }

    const waiting = await followUpQueue.getWaiting();
    console.log(`\n=== WAITING JOBS (${waiting.length}) ===`);
    for (const job of waiting) {
      console.log(`  Job ${job.id}: type=${job.data.type}, conversationId=${job.data.conversationId}`);
    }

    const failed = await followUpQueue.getFailed();
    console.log(`\n=== FAILED JOBS (${failed.length}) ===`);
    for (const job of failed) {
      console.log(`  Job ${job.id}: type=${job.data.type}, conversationId=${job.data.conversationId}, reason=${job.failedReason}`);
    }

    const active = await followUpQueue.getActive();
    console.log(`\n=== ACTIVE JOBS (${active.length}) ===`);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
