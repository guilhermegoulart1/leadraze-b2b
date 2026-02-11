// backend/src/workers/invitationPollingWorker.js

const db = require('../config/database');
const unipileClient = require('../config/unipile');
const notificationService = require('../services/notificationService');
const { handleNewRelation } = require('../controllers/webhookController');
const { downloadAndStoreProfilePicture, isR2Url } = require('../services/profilePictureService');

/**
 * Invitation Polling Worker
 *
 * Two responsibilities (every ~40 minutes with ±10min random delay):
 * 1. Poll for new RECEIVED LinkedIn invitations → create notifications
 * 2. Check for ACCEPTED sent invitations → trigger handleNewRelation flow
 *    (fallback for Unipile new_relation webhook which can delay up to 8h)
 *
 * Strategy based on Unipile documentation:
 * - Polling is recommended "few times per day" with random delay
 * - This avoids triggering LinkedIn's automation detection
 */

const BASE_INTERVAL = 40 * 60 * 1000; // 40 minutes
const RANDOM_DELAY_MAX = 10 * 60 * 1000; // ±10 minutes
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

    let profilePicture = inviter.inviter_profile_picture_url
      || invitation.profile_picture
      || invitation.profile_picture_url
      || invitation.picture_url
      || invitation.inviter_picture
      || null;

    // Persist profile picture to R2 if available
    if (profilePicture && !isR2Url(profilePicture)) {
      const picId = inviterId || invitationId;
      const r2Url = await downloadAndStoreProfilePicture(profilePicture, accountId, `invitation-${picId}`);
      if (r2Url) {
        profilePicture = r2Url;
        log.info(`  Profile picture stored in R2 for inviter: ${inviterName}`);
      }
    }

    const invitationMessage = invitation.invitation_text
      || invitation.message
      || invitation.invitation_message
      || null;

    const publicIdentifier = inviter.inviter_public_identifier
      || invitation.public_identifier
      || null;

    // Extract shared_secret (required by Unipile API to accept/decline invitations)
    const sharedSecret = invitation.shared_secret
      || invitation.sharedSecret
      || inviter.shared_secret
      || null;

    if (!sharedSecret) {
      log.warn(`  No shared_secret found for invitation from ${inviterName}`);
    }

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

    // 2. Create notification for users with permission on this channel
    try {
      // Get all users with permission on this channel
      const usersWithAccess = await db.query(`
        SELECT DISTINCT user_id
        FROM user_channel_permissions
        WHERE linkedin_account_id = $1
        AND account_id = $2
        AND access_type IN ('all', 'assigned_only')
      `, [linkedinAccountId, accountId]);

      // If no permissions configured, create only for the owner (backward compatibility)
      const targetUserIds = usersWithAccess.rows.length > 0
        ? usersWithAccess.rows.map(r => r.user_id)
        : [userId];

      // Create notification for each user with access
      for (const targetUserId of targetUserIds) {
        await notificationService.notifyInvitationReceived({
          accountId,
          userId: targetUserId,
          inviterName,
          inviterId,
          invitationId,
          headline,
          profilePicture,
          message: invitationMessage,
          linkedinAccountId,
          linkedinProfileName: profile_name,
          sharedSecret
        });
      }

      log.success(`  Notification created for ${targetUserIds.length} user(s): ${inviterName}`);
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

// ====================================
// ACCEPTANCE POLLING (Fallback for webhook delays)
// ====================================

const ACCEPT_LOG_PREFIX = '🔍 [ACCEPTANCE POLLING]';
const acceptLog = {
  info: (msg, data) => console.log(`${ACCEPT_LOG_PREFIX} ${msg}`, data || ''),
  success: (msg, data) => console.log(`${ACCEPT_LOG_PREFIX} ✅ ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`${ACCEPT_LOG_PREFIX} ⚠️ ${msg}`, data || ''),
  error: (msg, data) => console.error(`${ACCEPT_LOG_PREFIX} ❌ ${msg}`, data || ''),
  divider: () => console.log(`${ACCEPT_LOG_PREFIX} ═══════════════════════════════════════════════════════════`),
};

/**
 * Check for accepted sent invitations using Unipile's recommended approach:
 *
 * Strategy (2-phase detection):
 * 1. Get campaign_contacts with status 'invite_sent' from DB
 * 2. Fetch PENDING sent invitations from Unipile API (GET /users/invite/sent)
 * 3. Invites in our DB but NOT in the pending list = resolved (accepted/rejected/expired)
 * 4. For resolved invites, confirm acceptance via relations API (GET /users/relations)
 * 5. Trigger handleNewRelation() for confirmed acceptances
 */
async function checkAcceptedSentInvitations(accounts) {
  acceptLog.divider();
  acceptLog.info('CHECKING ACCEPTED SENT INVITATIONS (2-phase detection)');
  acceptLog.info(`Timestamp: ${new Date().toISOString()}`);
  acceptLog.divider();

  let totalAccepted = 0;
  let totalChecked = 0;
  let errors = 0;

  for (const account of accounts) {
    const { id: linkedinAccountId, unipile_account_id: unipileAccountId, profile_name } = account;

    try {
      // 1. Get pending sent invites from our DB
      //    Use campaign_invite_queue as source of truth for which account sent each invite
      //    Fallback to campaigns.linkedin_account_id for legacy invites without queue entries
      const pendingResult = await db.query(`
        SELECT cc.id as campaign_contact_id, cc.linkedin_profile_id, cc.contact_id,
               ct.name as contact_name, ct.public_identifier
        FROM campaign_contacts cc
        JOIN contacts ct ON ct.id = cc.contact_id
        JOIN campaigns c ON c.id = cc.campaign_id
        LEFT JOIN campaign_invite_queue ciq ON ciq.campaign_contact_id = cc.id AND ciq.status = 'sent'
        WHERE cc.status = 'invite_sent'
        AND (
          ciq.linkedin_account_id = $1
          OR (ciq.id IS NULL AND c.linkedin_account_id = $1)
        )
      `, [linkedinAccountId]);

      if (pendingResult.rows.length === 0) {
        continue; // No pending invites for this account
      }

      acceptLog.info(`${profile_name}: ${pendingResult.rows.length} pending invite(s) in DB`);
      totalChecked += pendingResult.rows.length;

      // 2. PHASE 1: Fetch ALL pending sent invitations from Unipile API (with pagination)
      //    This endpoint returns ONLY invitations that are still pending
      const pendingOnUnipile = new Set();
      let cursor = null;

      try {
        do {
          const params = { account_id: unipileAccountId, limit: 100 };
          if (cursor) params.cursor = cursor;

          const sentData = await unipileClient.users.listSentInvitations(params);
          const items = sentData?.items || [];

          for (const invite of items) {
            // invited_user_id is the provider_id (confirmed in connectionController.js)
            const providerId = invite.invited_user_id || invite.provider_id;
            if (providerId) pendingOnUnipile.add(providerId);
          }

          cursor = sentData?.cursor || null;
        } while (cursor);

        acceptLog.info(`  ${pendingOnUnipile.size} invitation(s) still pending on Unipile`);
      } catch (apiError) {
        acceptLog.error(`  Error fetching sent invitations for ${profile_name}: ${apiError.message}`);
        errors++;
        continue;
      }

      // 3. Find invites that disappeared from the pending list (= resolved)
      const resolvedCandidates = pendingResult.rows.filter(pending => {
        if (!pending.linkedin_profile_id) return false;
        return !pendingOnUnipile.has(pending.linkedin_profile_id);
      });

      if (resolvedCandidates.length === 0) {
        acceptLog.info(`  All invitations still pending, no changes detected`);
        continue;
      }

      acceptLog.info(`  ${resolvedCandidates.length} invitation(s) no longer pending - checking relations...`);

      // 4. PHASE 2: Fetch relations to confirm acceptance (vs rejection/expiry)
      const relationsSet = new Set();
      const relationsMap = new Map(); // provider_id -> relation data
      const candidateIds = new Set(resolvedCandidates.map(c => c.linkedin_profile_id));

      try {
        let relCursor = null;

        do {
          const relParams = { account_id: unipileAccountId, limit: 250 };
          if (relCursor) relParams.cursor = relCursor;

          const relData = await unipileClient.users.getRelations(relParams);
          const relItems = relData?.items || [];

          for (const rel of relItems) {
            const relProviderId = rel.provider_id || rel.id;
            if (relProviderId) {
              relationsSet.add(relProviderId);
              if (candidateIds.has(relProviderId)) {
                relationsMap.set(relProviderId, rel);
              }
            }
          }

          relCursor = relData?.cursor || null;

          // Optimization: stop paginating if all candidates found
          let allFound = true;
          for (const cId of candidateIds) {
            if (!relationsSet.has(cId)) {
              allFound = false;
              break;
            }
          }
          if (allFound) {
            acceptLog.info(`  All candidates found in relations, stopping pagination early`);
            break;
          }
        } while (relCursor);

        acceptLog.info(`  Relations check: ${relationsMap.size} confirmed acceptance(s) out of ${resolvedCandidates.length} resolved`);
      } catch (relError) {
        acceptLog.error(`  Error fetching relations for ${profile_name}: ${relError.message}`);
        errors++;
        continue;
      }

      // 5. Process confirmed acceptances
      for (const candidate of resolvedCandidates) {
        if (!relationsSet.has(candidate.linkedin_profile_id)) {
          // Not in relations = rejected or expired, not accepted
          acceptLog.info(`  ${candidate.contact_name}: not in relations (rejected/expired)`);
          continue;
        }

        acceptLog.success(`  ACEITE DETECTADO: ${candidate.contact_name} (${candidate.linkedin_profile_id})`);

        try {
          const relData = relationsMap.get(candidate.linkedin_profile_id) || {};

          // Construct payload compatible with handleNewRelation()
          const publicId = relData.public_identifier || relData.username || candidate.public_identifier || null;
          const payload = {
            account_id: unipileAccountId,
            user_provider_id: candidate.linkedin_profile_id,
            user_public_identifier: publicId,
            user_profile_url: relData.profile_url
              || (publicId ? `https://www.linkedin.com/in/${publicId}` : null),
            user_full_name: relData.name || relData.full_name || candidate.contact_name,
            user_picture_url: relData.profile_picture || relData.profile_picture_url || relData.picture_url || null
          };

          const result = await handleNewRelation(payload);

          if (result.handled && result.accepted) {
            acceptLog.success(`  Flow iniciado para ${candidate.contact_name} (conversation: ${result.conversation_id})`);
            totalAccepted++;
          } else if (result.handled && result.skipped) {
            acceptLog.warn(`  Skipped ${candidate.contact_name}: ${result.reason}`);
          } else {
            acceptLog.info(`  ${candidate.contact_name}: ${result.reason || 'not processed'}`);
          }
        } catch (handleError) {
          acceptLog.error(`  Error processing acceptance for ${candidate.contact_name}: ${handleError.message}`);
          errors++;
        }
      }

      // Random delay between accounts (1-3 seconds)
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    } catch (error) {
      acceptLog.error(`Error checking account ${profile_name}: ${error.message}`);
      errors++;
    }
  }

  acceptLog.divider();
  acceptLog.success('ACCEPTANCE CHECK COMPLETED');
  acceptLog.info(`  Pending invites checked: ${totalChecked}`);
  acceptLog.info(`  Acceptances detected: ${totalAccepted}`);
  acceptLog.info(`  Errors: ${errors}`);
  acceptLog.divider();

  return { totalAccepted, totalChecked, errors };
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

    // Check for accepted sent invitations (fallback for webhook delays up to 8h)
    try {
      await checkAcceptedSentInvitations(accounts);
    } catch (acceptError) {
      log.error(`Acceptance check error: ${acceptError.message}`);
      console.error(acceptError);
    }

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
  log.info(`  (Base: 40min, Random delay: ${(randomDelay / 1000 / 60).toFixed(1)} minutes)`);

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
  log.info(`Base interval: ${BASE_INTERVAL / 1000 / 60} minutes`);
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
  processAccountInvitations,
  checkAcceptedSentInvitations
};
