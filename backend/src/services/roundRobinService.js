// backend/src/services/roundRobinService.js
const db = require('../config/database');

/**
 * Get the next user for round-robin assignment in a sector
 * @param {string} sectorId - The sector ID
 * @param {string} accountId - The account ID for multi-tenancy
 * @returns {object|null} The next user to assign, or null if no users available
 */
const getNextUser = async (sectorId, accountId) => {
  // Get sector configuration
  const sectorResult = await db.query(
    `SELECT id, enable_round_robin, last_assigned_user_id
     FROM sectors
     WHERE id = $1 AND account_id = $2`,
    [sectorId, accountId]
  );

  if (sectorResult.rows.length === 0) {
    return null;
  }

  const sector = sectorResult.rows[0];

  if (!sector.enable_round_robin) {
    return null;
  }

  // Get active users in this sector, ordered by id for consistent rotation
  const usersResult = await db.query(
    `SELECT su.user_id, u.name, u.email, u.avatar_url
     FROM sector_users su
     JOIN users u ON u.id = su.user_id
     WHERE su.sector_id = $1
       AND su.is_active = true
       AND u.is_active = true
     ORDER BY su.created_at ASC, su.user_id ASC`,
    [sectorId]
  );

  if (usersResult.rows.length === 0) {
    return null;
  }

  const users = usersResult.rows;

  // Find the next user after the last assigned
  let nextUser;
  if (!sector.last_assigned_user_id) {
    // First assignment - use first user
    nextUser = users[0];
  } else {
    // Find the index of the last assigned user
    const lastIndex = users.findIndex(u => u.user_id === sector.last_assigned_user_id);

    if (lastIndex === -1) {
      // Last assigned user not found (maybe removed), start from first
      nextUser = users[0];
    } else {
      // Get next user in rotation (wrap around to first if at end)
      const nextIndex = (lastIndex + 1) % users.length;
      nextUser = users[nextIndex];
    }
  }

  return nextUser;
};

/**
 * Assign an opportunity to a user and update round-robin tracking
 * @param {string} opportunityId - The opportunity ID
 * @param {string} userId - The user ID to assign
 * @param {string} sectorId - The sector ID (for updating last_assigned)
 * @param {string} accountId - The account ID
 */
const assignOpportunityToUser = async (opportunityId, userId, sectorId, accountId) => {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // Update the opportunity with the owner user
    await client.query(
      `UPDATE opportunities
       SET owner_user_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND account_id = $3`,
      [userId, opportunityId, accountId]
    );

    // Update the sector's last assigned user (for round-robin tracking)
    if (sectorId) {
      await client.query(
        `UPDATE sectors
         SET last_assigned_user_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND account_id = $3`,
        [userId, sectorId, accountId]
      );
    }

    await client.query('COMMIT');

    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Auto-assign an opportunity using round-robin if the sector has it enabled
 * @param {string} opportunityId - The opportunity ID
 * @param {string} sectorId - The sector ID
 * @param {string} accountId - The account ID
 * @returns {object|null} The assigned user, or null if not auto-assigned
 */
const autoAssignOpportunity = async (opportunityId, sectorId, accountId) => {
  const nextUser = await getNextUser(sectorId, accountId);

  if (!nextUser) {
    return null;
  }

  await assignOpportunityToUser(opportunityId, nextUser.user_id, sectorId, accountId);

  return nextUser;
};

/**
 * Get users assigned to a sector
 * @param {string} sectorId - The sector ID
 */
const getSectorUsers = async (sectorId) => {
  const result = await db.query(
    `SELECT u.id, u.name, u.email, u.avatar_url
     FROM sector_users su
     JOIN users u ON u.id = su.user_id
     WHERE su.sector_id = $1 AND su.is_active = true
     ORDER BY su.created_at ASC`,
    [sectorId]
  );

  return result.rows;
};

/**
 * Add a user to a sector
 * @param {string} sectorId - The sector ID
 * @param {string} userId - The user ID
 */
const addUserToSector = async (sectorId, userId) => {
  const result = await db.query(
    `INSERT INTO sector_users (sector_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (sector_id, user_id)
     DO UPDATE SET is_active = true
     RETURNING *`,
    [sectorId, userId]
  );

  return result.rows[0];
};

/**
 * Remove a user from a sector
 * @param {string} sectorId - The sector ID
 * @param {string} userId - The user ID
 */
const removeUserFromSector = async (sectorId, userId) => {
  await db.query(
    `UPDATE sector_users
     SET is_active = false
     WHERE sector_id = $1 AND user_id = $2`,
    [sectorId, userId]
  );
};

/**
 * Toggle round-robin for a sector
 * @param {string} sectorId - The sector ID
 * @param {string} accountId - The account ID
 * @param {boolean} enabled - Enable or disable
 */
const toggleRoundRobin = async (sectorId, accountId, enabled) => {
  const result = await db.query(
    `UPDATE sectors
     SET enable_round_robin = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND account_id = $3
     RETURNING *`,
    [enabled, sectorId, accountId]
  );

  return result.rows[0];
};

/**
 * CENTRALIZED: Auto-assign an opportunity on creation based on sector/campaign settings
 * This is the main entry point for all opportunity assignment across the system.
 *
 * Priority:
 * 1. If sector has round-robin enabled AND has users -> use round-robin
 * 2. If campaign has default_responsible_user_id -> use that
 * 3. Otherwise -> leave unassigned
 *
 * @param {object} params - Assignment parameters
 * @param {string} params.opportunityId - The opportunity ID to assign
 * @param {string} params.sectorId - The sector ID (from opportunity or campaign)
 * @param {string} params.accountId - The account ID
 * @param {string} [params.campaignId] - Optional campaign ID to check default responsible
 * @param {string} [params.source] - Source of the opportunity (for logging): 'google_maps', 'linkedin', 'api', 'manual'
 * @returns {object} Result with assigned user info or null
 */
const autoAssignOpportunityOnCreation = async ({ opportunityId, sectorId, accountId, campaignId = null, source = 'unknown' }) => {
  console.log(`🔄 [RoundRobin] Auto-assigning opportunity ${opportunityId} from source: ${source}`);

  // If no sector, can't auto-assign via round-robin
  if (!sectorId) {
    console.log(`⚠️ [RoundRobin] No sector_id provided, checking campaign default...`);

    // Try to get default from campaign
    if (campaignId) {
      const campaignResult = await db.query(
        `SELECT c.default_responsible_user_id, c.sector_id, u.id, u.name, u.email, u.avatar_url
         FROM campaigns c
         LEFT JOIN users u ON u.id = c.default_responsible_user_id
         WHERE c.id = $1 AND c.account_id = $2`,
        [campaignId, accountId]
      );

      if (campaignResult.rows.length > 0) {
        const campaign = campaignResult.rows[0];

        // If campaign has sector_id, use it
        if (campaign.sector_id) {
          sectorId = campaign.sector_id;
        } else if (campaign.default_responsible_user_id) {
          // Use campaign's default responsible
          await db.query(
            `UPDATE opportunities SET owner_user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [campaign.default_responsible_user_id, opportunityId]
          );
          console.log(`✅ [RoundRobin] Assigned to campaign default: ${campaign.name}`);
          return {
            assigned: true,
            method: 'campaign_default',
            user: {
              id: campaign.id,
              name: campaign.name,
              email: campaign.email,
              avatar_url: campaign.avatar_url
            }
          };
        }
      }
    }

    if (!sectorId) {
      console.log(`⚠️ [RoundRobin] No sector available, opportunity remains unassigned`);
      return { assigned: false, method: 'none', reason: 'no_sector' };
    }
  }

  // Check if sector has round-robin enabled
  const sectorResult = await db.query(
    `SELECT id, name, enable_round_robin, last_assigned_user_id
     FROM sectors
     WHERE id = $1 AND account_id = $2`,
    [sectorId, accountId]
  );

  if (sectorResult.rows.length === 0) {
    console.log(`⚠️ [RoundRobin] Sector ${sectorId} not found`);
    return { assigned: false, method: 'none', reason: 'sector_not_found' };
  }

  const sector = sectorResult.rows[0];

  // If round-robin is enabled, try to assign
  if (sector.enable_round_robin) {
    const nextUser = await getNextUser(sectorId, accountId);

    if (nextUser) {
      await assignOpportunityToUser(opportunityId, nextUser.user_id, sectorId, accountId);
      console.log(`✅ [RoundRobin] Assigned via round-robin to: ${nextUser.name}`);
      return {
        assigned: true,
        method: 'round_robin',
        sector: { id: sector.id, name: sector.name },
        user: {
          id: nextUser.user_id,
          name: nextUser.name,
          email: nextUser.email,
          avatar_url: nextUser.avatar_url
        }
      };
    } else {
      console.log(`⚠️ [RoundRobin] Round-robin enabled but no users in rotation`);
    }
  }

  // Round-robin disabled or no users - check campaign default
  if (campaignId) {
    const campaignResult = await db.query(
      `SELECT c.default_responsible_user_id, u.id, u.name, u.email, u.avatar_url
       FROM campaigns c
       LEFT JOIN users u ON u.id = c.default_responsible_user_id
       WHERE c.id = $1 AND c.account_id = $2 AND c.default_responsible_user_id IS NOT NULL`,
      [campaignId, accountId]
    );

    if (campaignResult.rows.length > 0 && campaignResult.rows[0].default_responsible_user_id) {
      const campaign = campaignResult.rows[0];
      await db.query(
        `UPDATE opportunities SET owner_user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [campaign.default_responsible_user_id, opportunityId]
      );
      console.log(`✅ [RoundRobin] Assigned to campaign default: ${campaign.name}`);
      return {
        assigned: true,
        method: 'campaign_default',
        user: {
          id: campaign.id,
          name: campaign.name,
          email: campaign.email,
          avatar_url: campaign.avatar_url
        }
      };
    }
  }

  console.log(`⚠️ [RoundRobin] No assignment method available, opportunity remains unassigned`);
  return { assigned: false, method: 'none', reason: 'no_assignment_method' };
};

/**
 * Get opportunity assignment statistics for a sector
 * @param {string} sectorId - The sector ID
 * @param {string} accountId - The account ID
 */
const getSectorAssignmentStats = async (sectorId, accountId) => {
  const result = await db.query(
    `SELECT
       u.id as user_id,
       u.name,
       u.avatar_url,
       COUNT(o.id) as total_opportunities,
       COUNT(CASE WHEN o.won_at IS NOT NULL THEN 1 END) as won_opportunities,
       COUNT(CASE WHEN o.lost_at IS NOT NULL THEN 1 END) as lost_opportunities,
       COUNT(CASE WHEN o.won_at IS NULL AND o.lost_at IS NULL THEN 1 END) as active_opportunities
     FROM sector_users su
     JOIN users u ON u.id = su.user_id
     LEFT JOIN opportunities o ON o.owner_user_id = u.id
     WHERE su.sector_id = $1 AND su.is_active = true
     GROUP BY u.id, u.name, u.avatar_url
     ORDER BY u.name`,
    [sectorId]
  );

  return result.rows;
};

module.exports = {
  getNextUser,
  assignOpportunityToUser,
  autoAssignOpportunity,
  autoAssignOpportunityOnCreation, // Centralized entry point for all opportunity sources
  getSectorUsers,
  addUserToSector,
  removeUserFromSector,
  toggleRoundRobin,
  getSectorAssignmentStats
};
