/**
 * External Instagram Agents Controller
 * Handles Instagram agent operations via API key authentication
 */

const db = require('../../config/database');

/**
 * GET /external/v1/instagram-agents
 * List Instagram agents for the account
 */
exports.listAgents = async (req, res) => {
  try {
    const accountId = req.apiKey.accountId;
    const { status, page = 1, limit = 50 } = req.query;

    let whereConditions = ['ia.account_id = $1'];
    let queryParams = [accountId];
    let paramIndex = 2;

    if (status) {
      whereConditions.push(`ia.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(parseInt(limit), 100);
    const perPage = Math.min(parseInt(limit) || 50, 100);

    // Count total
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM instagram_agents ia WHERE ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Fetch agents
    const result = await db.query(
      `SELECT
        ia.id,
        ia.name,
        ia.description,
        ia.search_niche,
        ia.search_location,
        ia.status,
        ia.total_profiles_found,
        ia.total_limit,
        ia.created_at,
        ia.updated_at
      FROM instagram_agents ia
      WHERE ${whereClause}
      ORDER BY ia.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, perPage, offset]
    );

    const totalPages = Math.ceil(total / perPage);
    const currentPage = Math.max(1, parseInt(page));

    return res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: currentPage,
        per_page: perPage,
        total,
        total_pages: totalPages,
        has_next: currentPage < totalPages,
        has_prev: currentPage > 1
      }
    });
  } catch (error) {
    console.error('External API - Error listing Instagram agents:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching Instagram agents'
      }
    });
  }
};

/**
 * POST /external/v1/instagram-agents/:id/profiles
 * Add a profile to an Instagram agent
 */
exports.addProfile = async (req, res) => {
  try {
    const accountId = req.apiKey.accountId;
    const { id: agentId } = req.params;
    const { username, display_name, profile_url, bio, followers_count, following_count, posts_count, external_url, extracted_contacts } = req.body;

    // Validate required fields
    if (!username || username.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Username is required'
        }
      });
    }

    // Check agent exists and belongs to account
    const agentResult = await db.query(
      `SELECT id, name, status, found_profiles, total_profiles_found, total_limit
       FROM instagram_agents
       WHERE id = $1 AND account_id = $2`,
      [agentId, accountId]
    );

    if (agentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Instagram agent not found'
        }
      });
    }

    const agent = agentResult.rows[0];
    const existingProfiles = agent.found_profiles || [];

    // Check for duplicate username
    const normalizedUsername = username.trim().toLowerCase().replace(/^@/, '');
    const isDuplicate = existingProfiles.some(
      p => (p.username || '').toLowerCase() === normalizedUsername
    );

    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: 'This profile is already in the agent'
        }
      });
    }

    // Check if total limit would be exceeded
    if (agent.total_limit && agent.total_profiles_found >= agent.total_limit) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'LIMIT_REACHED',
          message: `Agent has reached its profile limit of ${agent.total_limit}`
        }
      });
    }

    // Build new profile entry
    const newProfile = {
      username: normalizedUsername,
      display_name: display_name || normalizedUsername,
      profile_url: profile_url || `https://www.instagram.com/${normalizedUsername}`,
      bio: bio || '',
      followers_count: followers_count != null ? parseInt(followers_count) || null : null,
      following_count: following_count != null ? parseInt(following_count) || null : null,
      posts_count: posts_count != null ? parseInt(posts_count) || null : null,
      external_url: external_url || '',
      extracted_contacts: extracted_contacts || { emails: [], phones: [], websites: [] },
      source: 'chrome_extension',
      added_at: new Date().toISOString()
    };

    // Append to found_profiles and increment count
    await db.query(
      `UPDATE instagram_agents
       SET found_profiles = COALESCE(found_profiles, '[]'::jsonb) || $1::jsonb,
           total_profiles_found = COALESCE(total_profiles_found, 0) + 1,
           updated_at = NOW()
       WHERE id = $2 AND account_id = $3`,
      [JSON.stringify(newProfile), agentId, accountId]
    );

    return res.status(201).json({
      success: true,
      data: {
        profile: newProfile,
        agent: {
          id: agent.id,
          name: agent.name,
          total_profiles_found: (agent.total_profiles_found || 0) + 1
        }
      },
      message: 'Profile added to Instagram agent successfully'
    });
  } catch (error) {
    console.error('External API - Error adding profile to Instagram agent:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while adding the profile'
      }
    });
  }
};
