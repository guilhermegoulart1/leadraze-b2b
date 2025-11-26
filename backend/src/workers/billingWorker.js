/**
 * Billing Worker
 *
 * Processes billing-related background jobs
 * - Credit expiration
 * - Usage limit notifications
 * - Trial ending reminders
 */

const { billingQueue } = require('../queues');
const billingService = require('../services/billingService');
const subscriptionService = require('../services/subscriptionService');
const emailService = require('../services/emailService');
const db = require('../config/database');

// Process billing jobs
billingQueue.process(5, async (job) => {
  const { type, data } = job.data;

  console.log(`[billingWorker] Processing job ${job.id} - Type: ${type}`);

  switch (type) {
    case 'expire_credits':
      return await expireCredits();

    case 'check_trial_ending':
      return await checkTrialEnding();

    case 'check_usage_limits':
      return await checkUsageLimits(data.accountId);

    default:
      console.warn(`[billingWorker] Unknown job type: ${type}`);
      return { skipped: true };
  }
});

/**
 * Expire old credits
 */
async function expireCredits() {
  const expiredCount = await billingService.expireOldCredits();
  console.log(`[billingWorker] Expired ${expiredCount} credit packages`);
  return { expiredCount };
}

/**
 * Check for trials ending soon and send reminders
 */
async function checkTrialEnding() {
  // Find accounts with trials ending in 3 days
  const result = await db.query(`
    SELECT s.account_id, s.trial_end, u.id as user_id, u.email, u.name, u.preferred_language
    FROM subscriptions s
    JOIN users u ON u.account_id = s.account_id AND u.role = 'admin'
    WHERE s.status = 'trialing'
      AND s.trial_end BETWEEN NOW() AND NOW() + INTERVAL '3 days'
      AND NOT EXISTS (
        SELECT 1 FROM email_logs el
        WHERE el.account_id = s.account_id
          AND el.template_name = 'trial-ending'
          AND el.created_at > NOW() - INTERVAL '24 hours'
      )
  `);

  let sentCount = 0;
  for (const row of result.rows) {
    const daysRemaining = Math.ceil((new Date(row.trial_end) - new Date()) / (1000 * 60 * 60 * 24));

    await emailService.sendTrialEnding(
      { id: row.user_id, email: row.email, name: row.name, preferred_language: row.preferred_language },
      daysRemaining,
      row.account_id
    );

    sentCount++;
  }

  console.log(`[billingWorker] Sent ${sentCount} trial ending reminders`);
  return { sentCount };
}

/**
 * Check usage limits for an account
 */
async function checkUsageLimits(accountId) {
  const summary = await billingService.getBillingSummary(accountId);
  if (!summary) return { skipped: true };

  const maxUsers = summary.max_users + summary.extra_users;
  const maxChannels = summary.max_channels + summary.extra_channels;

  const warnings = [];

  // Check if approaching limits (80%+)
  if (summary.current_users >= maxUsers * 0.8) {
    warnings.push(`Users at ${Math.round((summary.current_users / maxUsers) * 100)}% capacity`);
  }

  if (summary.current_channels >= maxChannels * 0.8) {
    warnings.push(`Channels at ${Math.round((summary.current_channels / maxChannels) * 100)}% capacity`);
  }

  if (summary.available_gmaps_credits < 100) {
    warnings.push(`Low Google Maps credits: ${summary.available_gmaps_credits} remaining`);
  }

  if (warnings.length > 0) {
    console.log(`[billingWorker] Account ${accountId} warnings:`, warnings);
  }

  return { accountId, warnings };
}

// Event handlers
billingQueue.on('completed', (job, result) => {
  console.log(`[billingWorker] Completed: ${job.data.type}`);
});

billingQueue.on('failed', (job, error) => {
  console.error(`[billingWorker] Failed: ${job.data.type} - ${error.message}`);
});

/**
 * Schedule recurring jobs
 */
async function scheduleRecurringJobs() {
  // Expire credits - run daily at 1 AM
  await billingQueue.add(
    { type: 'expire_credits' },
    {
      repeat: {
        cron: '0 1 * * *' // 1:00 AM daily
      },
      jobId: 'expire-credits-daily'
    }
  );

  // Check trial ending - run daily at 9 AM
  await billingQueue.add(
    { type: 'check_trial_ending' },
    {
      repeat: {
        cron: '0 9 * * *' // 9:00 AM daily
      },
      jobId: 'check-trial-ending-daily'
    }
  );

  console.log('[billingWorker] Scheduled recurring jobs');
}

// Initialize recurring jobs
scheduleRecurringJobs().catch(console.error);

console.log('Billing worker started');
console.log('  Processing: credit expiration, trial reminders, usage checks');

module.exports = billingQueue;
