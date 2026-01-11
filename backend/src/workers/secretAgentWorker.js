/**
 * Secret Agent Worker
 *
 * Processes investigation jobs from the Bull queue
 * Coordinates with the orchestrator service to execute investigations
 */

const { secretAgentQueue } = require('../queues');
const { orchestratorService } = require('../services/secretAgent/orchestratorService');
const { Pool } = require('pg');
const { publishInvestigationQueued } = require('../services/ablyService');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'getraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

/**
 * Process investigation jobs
 */
secretAgentQueue.process(async (job) => {
  const { investigationId, sessionId, accountId } = job.data;

  console.log(`[SecretAgentWorker] Processing job ${job.id}`);
  console.log(`  Investigation: ${investigationId}`);
  console.log(`  Session: ${sessionId}`);

  try {
    // Get investigation and session from database
    const [investigationResult, sessionResult] = await Promise.all([
      pool.query('SELECT * FROM secret_agent_investigations WHERE id = $1', [investigationId]),
      pool.query('SELECT * FROM secret_agent_sessions WHERE id = $1', [sessionId])
    ]);

    if (investigationResult.rows.length === 0) {
      throw new Error(`Investigation ${investigationId} not found`);
    }

    if (sessionResult.rows.length === 0) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const investigation = investigationResult.rows[0];
    const session = sessionResult.rows[0];

    // Update investigation status to running
    await pool.query(
      `UPDATE secret_agent_investigations
       SET status = 'running', progress = 5
       WHERE id = $1`,
      [investigationId]
    );

    // Execute the investigation
    const result = await orchestratorService.executeInvestigation(investigation, session);

    console.log(`[SecretAgentWorker] Investigation ${investigation.case_number} completed`);
    console.log(`  Briefing ID: ${result.id}`);
    console.log(`  Total findings: ${result.totalFindings}`);

    return result;

  } catch (error) {
    console.error(`[SecretAgentWorker] Job ${job.id} failed:`, error);

    // Update investigation status to failed
    await pool.query(
      `UPDATE secret_agent_investigations
       SET status = 'failed', completed_at = NOW()
       WHERE id = $1`,
      [investigationId]
    );

    throw error;
  }
});

/**
 * Job event handlers
 */
secretAgentQueue.on('waiting', (jobId) => {
  console.log(`[SecretAgentWorker] Job ${jobId} waiting`);
});

secretAgentQueue.on('active', (job) => {
  console.log(`[SecretAgentWorker] Job ${job.id} started`);
});

secretAgentQueue.on('completed', (job, result) => {
  console.log(`[SecretAgentWorker] Job ${job.id} completed`);
});

secretAgentQueue.on('failed', (job, error) => {
  console.error(`[SecretAgentWorker] Job ${job.id} failed:`, error.message);
});

secretAgentQueue.on('stalled', (job) => {
  console.warn(`[SecretAgentWorker] Job ${job.id} stalled`);
});

/**
 * Add investigation to queue
 *
 * @param {string} investigationId - Investigation UUID
 * @param {string} sessionId - Session UUID
 * @param {string} accountId - Account UUID
 * @param {Object} options - Job options
 */
async function queueInvestigation(investigationId, sessionId, accountId, options = {}) {
  const {
    priority = 0, // Higher = more important
    delay = 0 // Delay in ms before processing
  } = options;

  // Get current queue position
  const waitingCount = await secretAgentQueue.getWaitingCount();
  const estimatedMinutes = Math.ceil((waitingCount + 1) * 5); // ~5 min per investigation

  // Get investigation details for notification
  const result = await pool.query(
    `SELECT i.case_number, s.target_name, s.objective
     FROM secret_agent_investigations i
     JOIN secret_agent_sessions s ON s.id = i.session_id
     WHERE i.id = $1`,
    [investigationId]
  );

  if (result.rows.length > 0) {
    const { case_number, target_name, objective } = result.rows[0];

    // Notify user that investigation is queued (via Ably)
    publishInvestigationQueued({
      accountId,
      investigationId,
      caseNumber: case_number,
      target: target_name,
      objective,
      queuePosition: waitingCount + 1,
      estimatedMinutes
    });
  }

  // Add job to queue
  const job = await secretAgentQueue.add(
    {
      investigationId,
      sessionId,
      accountId
    },
    {
      priority,
      delay,
      jobId: investigationId, // Use investigation ID as job ID for deduplication
      removeOnComplete: false, // Keep for debugging
      removeOnFail: false
    }
  );

  console.log(`[SecretAgentWorker] Queued investigation ${investigationId} as job ${job.id}`);
  console.log(`  Queue position: ${waitingCount + 1}`);
  console.log(`  Estimated wait: ${estimatedMinutes} minutes`);

  return {
    jobId: job.id,
    queuePosition: waitingCount + 1,
    estimatedMinutes
  };
}

/**
 * Get queue status
 */
async function getQueueStatus() {
  const [waiting, active, completed, failed] = await Promise.all([
    secretAgentQueue.getWaitingCount(),
    secretAgentQueue.getActiveCount(),
    secretAgentQueue.getCompletedCount(),
    secretAgentQueue.getFailedCount()
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    total: waiting + active
  };
}

/**
 * Cancel a queued investigation
 */
async function cancelInvestigation(investigationId) {
  const job = await secretAgentQueue.getJob(investigationId);

  if (job) {
    const state = await job.getState();

    if (state === 'waiting' || state === 'delayed') {
      await job.remove();

      // Update investigation status
      await pool.query(
        `UPDATE secret_agent_investigations
         SET status = 'cancelled', completed_at = NOW()
         WHERE id = $1`,
        [investigationId]
      );

      return { cancelled: true, state };
    }

    return { cancelled: false, reason: `Job is ${state}` };
  }

  return { cancelled: false, reason: 'Job not found' };
}

module.exports = {
  queueInvestigation,
  getQueueStatus,
  cancelInvestigation
};
