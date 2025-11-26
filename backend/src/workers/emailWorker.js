/**
 * Email Worker
 *
 * Processes email jobs from the queue
 */

const { emailQueue } = require('../queues');
const emailService = require('../services/emailService');

// Process up to 10 emails concurrently
emailQueue.process(10, async (job) => {
  const { emailLogId, template, to } = job.data;

  console.log(`[emailWorker] Processing job ${job.id} - Template: ${template}`);
  console.log(`[emailWorker] Sending to: ${to.email}`);

  const startTime = Date.now();

  try {
    const result = await emailService.sendEmail(job.data);

    const duration = Date.now() - startTime;
    console.log(`[emailWorker] Job ${job.id} completed in ${duration}ms`);

    return {
      success: true,
      messageId: result.messageId,
      duration
    };
  } catch (error) {
    console.error(`[emailWorker] Job ${job.id} failed:`, error.message);
    throw error;
  }
});

// Event handlers
emailQueue.on('completed', (job, result) => {
  console.log(`[emailWorker] Completed: ${job.data.template} to ${job.data.to.email}`);
});

emailQueue.on('failed', (job, error) => {
  console.error(`[emailWorker] Failed: ${job.data.template} - ${error.message}`);
  console.error(`[emailWorker] Attempt ${job.attemptsMade}/${job.opts.attempts}`);
});

emailQueue.on('stalled', (job) => {
  console.warn(`[emailWorker] Stalled: ${job.id}`);
});

console.log('Email worker started');
console.log('  Processing templates: welcome, password-reset, invoice, etc.');
console.log('  Max concurrent jobs: 10');

module.exports = emailQueue;
