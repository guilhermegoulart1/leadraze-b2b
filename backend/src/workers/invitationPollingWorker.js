// backend/src/workers/invitationPollingWorker.js

const db = require('../config/database');
const unipileClient = require('../config/unipile');
const notificationService = require('../services/notificationService');

/**
 * Invitation Polling Worker
 *
 * Polls for new received LinkedIn invitations every 4 hours (with random delay).
 * Creates notifications for new invitations detected.
 *
 * Strategy based on Unipile documentation:
 * - Polling is recommended "few times per day" with random delay
 * - This avoids triggering LinkedIn's automation detection
 */

const BASE_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours
const RANDOM_DELAY_MAX = 30 * 60 * 1000; // ±30 minutes
let isProcessing = false;
let nextScheduledRun = null;

// Logging helper
const LOG_PREFIX = '📬 [INVITATION POLLING]';
const log = {
  info: (msg, data) => console.log(`${LOG_PREFIX} ${msg}`, data || ''),
  success: (msg, data) => console.log(`${LOG_PREFIX} ✅ ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`${LOG_PREFIX} ⚠️ ${msg}`, data || ''),
  error: (msg, data) => console.error(`${LOG_PREFIX} ❌ ${msg}`, data || ''),
  divider: () => console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`),
};

/**
 * Get random delay for next poll (+/- 30 minutes)
 */
function getRandomDelay() {
  // Random between -30min and +30min
  return Math.floor(Math.random() * RANDOM_DELAY_MAX * 2) - RANDOM_DELAY_MAX;
}

/**
 * Get all active LinkedIn accounts
 */
async function getActiveLinkedInAccounts() {
  const result = await db.query(`
    SELECT
      la.id,
      la.account_id,
      la.user_id,
      la.unipile_account_id,
      la.profile_name,
      la.linkedin_username,
      la.status
    FROM linkedin_accounts la
    WHERE la.status = 'active'
    AND la.unipile_account_id IS NOT NULL
    AND la.provider_type = 'LINKEDIN'
    ORDER BY la.id
  `);

  return result.rows;
}

/**
 * Fetch received invitations from Unipile API
 */
async function fetchReceivedInvitations(unipileAccountId) {
  try {
    const result = await unipileClient.users.listReceivedInvitations({
      account_id: unipileAccountId,
      limit: 50
    });

    return result?.items || result?.invitations || [];
  } catch (error) {
    log.error(`Error fetching received invitations: ${error.message}`);
    return [];
  }
}

/**
 * Get existing snapshot of received invitations
 */
async function getReceivedInvitationsSnapshot(linkedinAccountId) {
  const result = await db.query(`
    SELECT invitation_id, provider_id, user_name, detected_at
    FROM invitation_snapshots
    WHERE linkedin_account_id = $1
    AND invitation_type = 'received'
  `, [linkedinAccountId]);

  // Return as a Set for O(1) lookup
  return new Set(result.rows.map(r => r.invitation_id));
}

/**
 * Process a single LinkedIn account for new invitations
 */
async function processAccountInvitations(account) {
  const { id: linkedinAccountId, account_id: accountId, user_id: userId, unipile_account_id: unipileAccountId, profile_name } = account;

  log.info(`Processing account: ${profile_name || linkedinAccountId}`);

  // Fetch current invitations from Unipile
  const currentInvitations = await fetchReceivedInvitations(unipileAccountId);

  if (!currentInvitations || currentInvitations.length === 0) {
    log.info(`  No invitations found`);
    return { newInvitations: 0, total: 0 };
  }

  log.info(`  Found ${currentInvitations.length} received invitations`);

  // Get existing snapshot
  const existingIds = await getReceivedInvitationsSnapshot(linkedinAccountId);

  let newCount = 0;

  for (const invitation of currentInvitations) {
    const invitationId = invitation.id || invitation.invitation_id;

    // Skip if already in snapshot
    if (existingIds.has(invitationId)) {
      continue;
    }

    // This is a NEW invitation!
    // Extract from nested inviter object (Unipile API structure)
    const inviter = invitation.inviter || {};

    log.success(`  NEW invitation from: ${inviter.inviter_name || invitation.name || 'Unknown'}`);

    // Extract invitation details matching Unipile's nested structure
    const inviterName = inviter.inviter_name
      || invitation.name
      || invitation.inviter_name
      || invitation.display_name
      || [invitation.first_name, invitation.last_name].filter(Boolean).join(' ')
      || 'Usuario LinkedIn';

    const inviterId = inviter.inviter_id
      || invitation.provider_id
      || invitation.inviter_provider_id
      || invitation.user_provider_id
      || null;

    const headline = inviter.inviter_description
      || invitation.headline
      || invitation.title
      || null;

    const profilePicture = inviter.inviter_profile_picture_url
      || invitation.profile_picture
      || invitation.profile_picture_url
      || invitation.picture_url
      || invitation.inviter_picture
      || null;

    const invitationMessage = invitation.invitation_text
      || invitation.message
      || invitation.invitation_message
      || null;

    const publicIdentifier = inviter.inviter_public_identifier
      || invitation.public_identifier
      || null;

    // 1. Save to snapshot
    try {
      await db.query(`
        INSERT INTO invitation_snapshots
        (account_id, linkedin_account_id, invitation_type, invitation_id, provider_id, public_identifier, user_name, user_headline, user_profile_picture, invitation_message, detected_at)
        VALUES ($1, $2, 'received', $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (linkedin_account_id, invitation_id) DO NOTHING
      `, [
        accountId,
        linkedinAccountId,
        invitationId,
        inviterId,
        publicIdentifier,
        inviterName,
        headline,
        profilePicture,
        invitationMessage
      ]);
    } catch (snapshotError) {
      log.error(`  Error saving snapshot: ${snapshotError.message}`);
    }

    // 2. Create notification
    try {
      await notificationService.notifyInvitationReceived({
        accountId,
        userId,
        inviterName,
        inviterId,
        invitationId,
        headline,
        profilePicture,
        message: invitationMessage,
        linkedinAccountId
      });

      log.success(`  Notification created for: ${inviterName}`);
      newCount++;
    } catch (notifError) {
      log.error(`  Error creating notification: ${notifError.message}`);
    }
  }

  return { newInvitations: newCount, total: currentInvitations.length };
}

/**
 * Clean up old snapshots for invitations no longer pending
 */
async function cleanupOldSnapshots(linkedinAccountId, currentInvitationIds) {
  if (!currentInvitationIds || currentInvitationIds.size === 0) {
    return 0;
  }

  // Delete snapshots that are no longer in the current list
  // (meaning they were accepted, rejected, or withdrawn)
  const result = await db.query(`
    DELETE FROM invitation_snapshots
    WHERE linkedin_account_id = $1
    AND invitation_type = 'received'
    AND invitation_id NOT IN (SELECT unnest($2::text[]))
  `, [linkedinAccountId, Array.from(currentInvitationIds)]);

  return result.rowCount || 0;
}

/**
 * Main polling function
 */
async function pollForInvitations() {
  if (isProcessing) {
    log.warn('Already processing, skipping...');
    return;
  }

  isProcessing = true;

  try {
    console.log('\n');
    log.divider();
    log.info('INVITATION POLLING STARTED');
    log.info(`Timestamp: ${new Date().toISOString()}`);
    log.divider();

    // Get all active LinkedIn accounts
    const accounts = await getActiveLinkedInAccounts();

    if (accounts.length === 0) {
      log.info('No active LinkedIn accounts found');
      log.divider();
      return;
    }

    log.info(`Found ${accounts.length} active LinkedIn accounts`);

    let totalNew = 0;
    let totalProcessed = 0;
    let errors = 0;

    for (const account of accounts) {
      try {
        const result = await processAccountInvitations(account);
        totalNew += result.newInvitations;
        totalProcessed++;

        // Random delay between accounts (1-3 seconds) to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      } catch (error) {
        log.error(`Error processing account ${account.id}: ${error.message}`);
        errors++;
      }
    }

    console.log('\n');
    log.divider();
    log.success('INVITATION POLLING COMPLETED');
    log.info(`  Accounts processed: ${totalProcessed}`);
    log.info(`  New invitations: ${totalNew}`);
    log.info(`  Errors: ${errors}`);
    log.divider();

  } catch (error) {
    log.error(`Polling error: ${error.message}`);
    console.error(error);
  } finally {
    isProcessing = false;
    scheduleNextRun();
  }
}

/**
 * Schedule next polling run with random delay
 */
function scheduleNextRun() {
  const randomDelay = getRandomDelay();
  const nextInterval = BASE_INTERVAL + randomDelay;

  nextScheduledRun = new Date(Date.now() + nextInterval);

  log.info(`Next poll scheduled for: ${nextScheduledRun.toISOString()}`);
  log.info(`  (Base: 4h, Random delay: ${(randomDelay / 1000 / 60).toFixed(1)} minutes)`);

  setTimeout(() => {
    pollForInvitations();
  }, nextInterval);
}

/**
 * Start the polling worker
 */
function startProcessor() {
  log.divider();
  log.info('INVITATION POLLING WORKER STARTED');
  log.info(`Base interval: ${BASE_INTERVAL / 1000 / 60 / 60} hours`);
  log.info(`Random delay: +/- ${RANDOM_DELAY_MAX / 1000 / 60} minutes`);
  log.divider();

  // Run immediately on start (with small delay to not interfere with startup)
  setTimeout(() => {
    pollForInvitations();
  }, 5000);
}

/**
 * Manual trigger for testing
 */
async function runOnce() {
  log.info('Manual poll triggered...');
  await pollForInvitations();
}

/**
 * Get next scheduled run time
 */
function getNextScheduledRun() {
  return nextScheduledRun;
}

module.exports = {
  startProcessor,
  pollForInvitations,
  runOnce,
  getNextScheduledRun,
  processAccountInvitations
};
