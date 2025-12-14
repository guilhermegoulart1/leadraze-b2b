/**
 * Check Bull queue status for google-maps-agents
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Queue = require('bull');

const redisUrl = process.env.REDIS_URL;

const queue = new Queue('google-maps-agents', redisUrl);

async function run() {
  console.log('=== GOOGLE MAPS AGENTS QUEUE STATUS ===\n');

  const waiting = await queue.getWaiting();
  const active = await queue.getActive();
  const delayed = await queue.getDelayed();
  const completed = await queue.getCompleted(0, 10);
  const failed = await queue.getFailed();

  console.log(`Waiting: ${waiting.length}`);
  console.log(`Active: ${active.length}`);
  console.log(`Delayed: ${delayed.length}`);
  console.log(`Completed (last 10): ${completed.length}`);
  console.log(`Failed: ${failed.length}`);

  if (waiting.length > 0) {
    console.log('\n--- WAITING JOBS ---');
    for (const job of waiting) {
      console.log(`  Job ${job.id}: ${job.data?.agentName || 'unknown'}`);
    }
  }

  if (active.length > 0) {
    console.log('\n--- ACTIVE JOBS ---');
    for (const job of active) {
      console.log(`  Job ${job.id}: ${job.data?.agentName || 'unknown'}`);
    }
  }

  if (delayed.length > 0) {
    console.log('\n--- DELAYED JOBS (first 5) ---');
    for (const job of delayed.slice(0, 5)) {
      const delay = new Date(job.opts.delay + job.timestamp);
      console.log(`  Job ${job.id}: scheduled for ${delay.toISOString()}`);
    }
  }

  await queue.close();
  console.log('\n✅ Queue check complete');
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
