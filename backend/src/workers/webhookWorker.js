/**
 * Webhook Worker
 *
 * Processes webhook jobs from the queue in background
 */

const { webhookQueue } = require('../queues');
const db = require('../config/database');

// Import webhook handlers from controller
// We'll access the processing functions directly
const webhookController = require('../controllers/webhookController');

/**
 * Process webhook jobs
 *
 * Each job contains:
 * - eventType: The webhook event type (message_received, new_relation, etc.)
 * - payload: The webhook payload from Unipile
 * - webhookLogId: ID from webhook_logs table
 * - receivedAt: Timestamp when webhook was received
 *
 * IMPORTANT: We use a generic processor (no job name) to handle all webhook types.
 * The eventType is passed in job.data, not as job.name.
 */
webhookQueue.process(10, async (job) => {  // Process up to 10 jobs concurrently
  // Extract eventType from job.data (not job.name) since we're using a generic processor
  const { eventType, payload, webhookLogId, receivedAt } = job.data;

  // Ignore test jobs silently
  if (eventType === 'test') {
    return {
      success: true,
      eventType: 'test',
      skipped: true,
      message: 'Test job ignored'
    };
  }

  console.log(`[webhookWorker] Processing job ${job.id} - Event: ${eventType}`);
  console.log(`[webhookWorker] Webhook log ID: ${webhookLogId}`);

  const startTime = Date.now();

  try {
    let result;

    // Route to appropriate handler based on event type
    switch (eventType) {
      case 'message_received':
        result = await webhookController.handleMessageReceived(payload);
        break;

      case 'new_relation':
        console.log('[webhookWorker] 🔔 NEW_RELATION event - Processing invite accepted webhook');
        console.log('[webhookWorker] 🔔 Payload user_full_name:', payload?.user_full_name);
        console.log('[webhookWorker] 🔔 Payload user_provider_id:', payload?.user_provider_id);
        result = await webhookController.handleNewRelation(payload);
        break;

      case 'message_reaction':
        result = await webhookController.handleMessageReaction(payload);
        break;

      case 'message_read':
        result = await webhookController.handleMessageRead(payload);
        break;

      case 'message_edited':
        result = await webhookController.handleMessageEdited(payload);
        break;

      case 'message_deleted':
        result = await webhookController.handleMessageDeleted(payload);
        break;

      case 'message_delivered':
        result = await webhookController.handleMessageDelivered(payload);
        break;

      // ✅ Handler para mensagem enviada (usa mesmo handler de received)
      case 'message_sent':
        console.log('[webhookWorker] Processing message_sent as message_received');
        result = await webhookController.handleMessageReceived(payload);
        break;

      // ✅ MULTI-CHANNEL: Handler para nova conta conectada
      case 'account_connected':
      case 'account.created':
      case 'account_created':
        result = await webhookController.handleAccountConnected(payload);
        break;

      // Handler para conta desconectada
      case 'account_disconnected':
      case 'account.deleted':
      case 'account_deleted':
        result = await webhookController.handleAccountDisconnected(payload);
        break;

      // Handler para status de conta (Account webhook da Unipile)
      case 'account_status':
        result = await webhookController.handleAccountStatus(payload);
        break;

      default:
        console.log(`[webhookWorker] Unhandled event type: ${eventType}`);
        result = { handled: false, reason: 'Event type not handled' };
    }

    // Mark webhook as processed in database
    await db.query(
      `UPDATE webhook_logs
       SET processed = true
       WHERE id = $1`,
      [webhookLogId]
    );

    const duration = Date.now() - startTime;
    console.log(`[webhookWorker] ✅ Job ${job.id} completed in ${duration}ms`);
    console.log(`[webhookWorker] Result:`, result);

    return {
      success: true,
      eventType,
      result,
      duration,
      processedAt: new Date().toISOString()
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[webhookWorker] ❌ Job ${job.id} failed after ${duration}ms:`, error.message);
    console.error(`[webhookWorker] Stack:`, error.stack);

    // Save error to webhook log
    try {
      await db.query(
        `UPDATE webhook_logs
         SET error = $1
         WHERE id = $2`,
        [error.message, webhookLogId]
      );
    } catch (logError) {
      console.error(`[webhookWorker] Failed to save error to webhook log:`, logError.message);
    }

    // Rethrow to let Bull handle retry
    throw error;
  }
});


/**
 * Event Handlers
 */

// Job completed successfully
webhookQueue.on('completed', (job, result) => {
  console.log(`[webhookWorker] ✅ Completed: ${job.name} (Job ${job.id})`);
  console.log(`[webhookWorker] Duration: ${result.duration}ms`);
});

// Job failed
webhookQueue.on('failed', (job, error) => {
  console.error(`[webhookWorker] ❌ Failed: ${job.name} (Job ${job.id})`);
  console.error(`[webhookWorker] Attempt ${job.attemptsMade}/${job.opts.attempts}`);
  console.error(`[webhookWorker] Error: ${error.message}`);

  // If this was the final attempt, log it
  if (job.attemptsMade >= job.opts.attempts) {
    console.error(`[webhookWorker] 🚨 Job ${job.id} failed permanently after ${job.attemptsMade} attempts`);
    // Could send alert here
  }
});

// Job stalled (worker crashed while processing)
webhookQueue.on('stalled', (job) => {
  console.warn(`[webhookWorker] ⚠️ Stalled: ${job.name} (Job ${job.id})`);
  console.warn(`[webhookWorker] Job will be retried automatically`);
});

// Worker error
webhookQueue.on('error', (error) => {
  console.error(`[webhookWorker] 🚨 Queue error:`, error.message);
});

console.log('✅ Webhook worker started');
console.log(`   Processing events: message_received, new_relation, message_read, etc.`);
console.log(`   Max concurrent jobs: 10`);
console.log(`   Retry attempts: 3`);

module.exports = webhookQueue;
