/**
 * Migration Script: Persist existing profile pictures to R2
 *
 * Contacts and invitation snapshots may have temporary Unipile URLs
 * that expire. This script downloads and re-uploads them to R2 storage.
 *
 * Usage:
 *   node src/scripts/migrateProfilePicturesToR2.js [--dry-run] [--limit=100] [--account-id=UUID]
 */

require('dotenv').config();

const db = require('../config/database');
const { downloadAndStoreProfilePicture, isR2Url } = require('../services/profilePictureService');

const LOG_PREFIX = '[PIC-MIGRATION]';
const BATCH_SIZE = 50;
const DELAY_BETWEEN_ITEMS_MS = 500;
const DELAY_BETWEEN_BATCHES_MS = 5000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function migrateContactPictures(options = {}) {
  const { dryRun = false, limit = null, accountId = null } = options;

  console.log(`${LOG_PREFIX} Starting contacts migration (dryRun=${dryRun}, limit=${limit || 'all'}, accountId=${accountId || 'all'})`);

  const r2PublicUrl = process.env.R2_PUBLIC_URL;
  if (!r2PublicUrl) {
    console.error(`${LOG_PREFIX} R2_PUBLIC_URL not set, cannot detect R2 URLs`);
    return { totalProcessed: 0, totalMigrated: 0, totalFailed: 0 };
  }

  let totalProcessed = 0;
  let totalMigrated = 0;
  let totalFailed = 0;
  let offset = 0;

  while (true) {
    const params = [`${r2PublicUrl}%`];
    let query = `
      SELECT id, account_id, name, profile_picture
      FROM contacts
      WHERE profile_picture IS NOT NULL
        AND profile_picture != ''
        AND profile_picture NOT LIKE $1
      ORDER BY updated_at DESC
    `;

    if (accountId) {
      query += ` AND account_id = $${params.length + 1}`;
      params.push(accountId);
    }

    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(BATCH_SIZE, offset);

    const result = await db.query(query, params);

    if (result.rows.length === 0) break;

    console.log(`${LOG_PREFIX} Batch: ${result.rows.length} contacts (offset: ${offset})`);

    for (const contact of result.rows) {
      totalProcessed++;

      if (dryRun) {
        console.log(`${LOG_PREFIX} [DRY RUN] Would migrate: ${contact.name} (${contact.id})`);
        totalMigrated++;
        continue;
      }

      try {
        const r2Url = await downloadAndStoreProfilePicture(
          contact.profile_picture,
          contact.account_id,
          contact.id
        );

        if (r2Url) {
          await db.query(
            `UPDATE contacts SET profile_picture = $1, updated_at = NOW() WHERE id = $2`,
            [r2Url, contact.id]
          );
          totalMigrated++;
          console.log(`${LOG_PREFIX} Migrated: ${contact.name} (${contact.id})`);
        } else {
          totalFailed++;
          console.log(`${LOG_PREFIX} Failed (expired/unavailable): ${contact.name} (${contact.id})`);
        }
      } catch (error) {
        totalFailed++;
        console.error(`${LOG_PREFIX} Error: ${contact.id} - ${error.message}`);
      }

      await sleep(DELAY_BETWEEN_ITEMS_MS);

      if (limit && totalProcessed >= limit) break;
    }

    if (limit && totalProcessed >= limit) break;

    offset += BATCH_SIZE;
    await sleep(DELAY_BETWEEN_BATCHES_MS);
  }

  const summary = { totalProcessed, totalMigrated, totalFailed };
  console.log(`${LOG_PREFIX} Contacts migration complete:`, summary);
  return summary;
}

async function migrateSnapshotPictures(options = {}) {
  const { dryRun = false, limit = null } = options;

  console.log(`${LOG_PREFIX} Starting invitation snapshots migration`);

  const r2PublicUrl = process.env.R2_PUBLIC_URL;
  if (!r2PublicUrl) {
    console.error(`${LOG_PREFIX} R2_PUBLIC_URL not set`);
    return { totalProcessed: 0, totalMigrated: 0, totalFailed: 0 };
  }

  let totalProcessed = 0;
  let totalMigrated = 0;
  let totalFailed = 0;

  const params = [`${r2PublicUrl}%`];
  let query = `
    SELECT id, account_id, user_name, user_profile_picture, provider_id, invitation_id
    FROM invitation_snapshots
    WHERE user_profile_picture IS NOT NULL
      AND user_profile_picture != ''
      AND user_profile_picture NOT LIKE $1
    ORDER BY detected_at DESC
  `;
  if (limit) {
    query += ` LIMIT $${params.length + 1}`;
    params.push(limit);
  }

  const result = await db.query(query, params);
  console.log(`${LOG_PREFIX} Found ${result.rows.length} snapshots to migrate`);

  for (const snapshot of result.rows) {
    totalProcessed++;
    const picId = snapshot.provider_id || snapshot.invitation_id;

    if (dryRun) {
      console.log(`${LOG_PREFIX} [DRY RUN] Would migrate snapshot: ${snapshot.user_name} (${snapshot.id})`);
      totalMigrated++;
      continue;
    }

    try {
      const r2Url = await downloadAndStoreProfilePicture(
        snapshot.user_profile_picture,
        snapshot.account_id,
        `invitation-${picId}`
      );

      if (r2Url) {
        await db.query(
          `UPDATE invitation_snapshots SET user_profile_picture = $1 WHERE id = $2`,
          [r2Url, snapshot.id]
        );
        totalMigrated++;
      } else {
        totalFailed++;
      }
    } catch (error) {
      totalFailed++;
      console.error(`${LOG_PREFIX} Error snapshot ${snapshot.id}: ${error.message}`);
    }

    await sleep(DELAY_BETWEEN_ITEMS_MS);
  }

  const summary = { totalProcessed, totalMigrated, totalFailed };
  console.log(`${LOG_PREFIX} Snapshots migration complete:`, summary);
  return summary;
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
  const accountArg = args.find(a => a.startsWith('--account-id='));
  const accountId = accountArg ? accountArg.split('=')[1] : null;

  (async () => {
    try {
      await migrateContactPictures({ dryRun, limit, accountId });
      await migrateSnapshotPictures({ dryRun, limit });
      console.log(`${LOG_PREFIX} All migrations complete`);
      process.exit(0);
    } catch (err) {
      console.error(`${LOG_PREFIX} Migration failed:`, err);
      process.exit(1);
    }
  })();
}

module.exports = { migrateContactPictures, migrateSnapshotPictures };
