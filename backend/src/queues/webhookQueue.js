const { webhookQueue } = require('./index');

/**
 * Webhook Queue Helper Functions
 *
 * Functions to add webhook jobs to the queue
 */

/**
 * Add a webhook job to the queue
 *
 * @param {string} eventType - Webhook event type (message_received, message_read, etc.)
 * @param {object} payload - Webhook payload from Unipile
 * @param {number} webhookLogId - ID from webhook_logs table
 * @returns {Promise<Job>} - Bull job object
 */
async function addWebhookJob(eventType, payload, webhookLogId) {
  // Create unique job ID to prevent duplicates
  const jobId = generateJobId(eventType, payload);

  // IMPORTANT: Don't pass eventType as job name (first parameter)
  // Instead, pass it in the data object so the generic processor can handle it
  const job = await webhookQueue.add(
    {
      eventType,  // ← Pass eventType in data, not as job name
      payload,
      webhookLogId,
      receivedAt: new Date().toISOString()
    },
    {
      jobId, // Prevent duplicate jobs
      priority: getPriority(eventType), // Prioritize important events
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    }
  );

  console.log(`[webhookQueue] Added job ${job.id} for event: ${eventType}`);
  return job;
}

/**
 * Generate unique job ID based on event and payload
 * Prevents duplicate processing of same webhook
 */
function generateJobId(eventType, payload) {
  const identifier =
    payload.message_id ||
    payload.chat_id ||
    payload.relation_id ||
    payload.object?.id ||
    `${Date.now()}`;

  return `webhook-${eventType}-${identifier}`;
}

/**
 * Get job priority based on event type
 * Lower number = higher priority
 */
function getPriority(eventType) {
  const priorities = {
    // High priority - require immediate AI response
    'message_received': 1,

    // Medium priority
    'new_relation': 3,
    'message_updated': 5,

    // Low priority - just updates
    'message_read': 7,
    'message_deleted': 8,
    'typing': 10
  };

  return priorities[eventType] || 5; // Default medium priority
}

/**
 * Get webhook queue statistics
 */
async function getWebhookQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    webhookQueue.getWaitingCount(),
    webhookQueue.getActiveCount(),
    webhookQueue.getCompletedCount(),
    webhookQueue.getFailedCount(),
    webhookQueue.getDelayedCount()
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed
  };
}

/**
 * Check if webhook was already processed
 * @param {string} eventType - Event type
 * @param {object} payload - Webhook payload
 * @returns {Promise<boolean>} - True if already processed
 */
async function isWebhookProcessed(eventType, payload) {
  const jobId = generateJobId(eventType, payload);
  const job = await webhookQueue.getJob(jobId);

  if (!job) return false;

  const state = await job.getState();
  return state === 'completed';
}

/**
 * Retry a failed webhook job
 * @param {string} jobId - Job ID
 */
async function retryWebhookJob(jobId) {
  const job = await webhookQueue.getJob(jobId);

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  await job.retry();
  console.log(`[webhookQueue] Retrying job ${jobId}`);
  return job;
}

/**
 * Get failed webhook jobs for manual review
 */
async function getFailedWebhookJobs(limit = 50) {
  const failed = await webhookQueue.getFailed(0, limit - 1);

  return failed.map(job => ({
    id: job.id,
    eventType: job.name,
    payload: job.data.payload,
    webhookLogId: job.data.webhookLogId,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn
  }));
}

module.exports = {
  addWebhookJob,
  getWebhookQueueStats,
  isWebhookProcessed,
  retryWebhookJob,
  getFailedWebhookJobs,
  generateJobId,
  getPriority
};
