/**
 * External Opportunities Controller
 * Handles opportunity operations via API key authentication
 */

const db = require('../../config/database');
const { calculatePagination } = require('../../utils/helpers');
const roundRobinService = require('../../services/roundRobinService');

/**
 * GET /external/v1/opportunities
 * List opportunities with pagination and filters
 */
exports.listOpportunities = async (req, res) => {
  try {
    const accountId = req.apiKey.accountId;
    const {
      search,
      stage_id,
      pipeline_id,
      campaign_id,
      owner_user_id,
      company,
      page = 1,
      limit = 50,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    // Validate sort parameters
    const allowedSortFields = ['created_at', 'updated_at', 'title', 'value'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Build query
    let whereConditions = ['o.account_id = $1'];
    let queryParams = [accountId];
    let paramIndex = 2;

    if (search) {
      whereConditions.push(`(o.title ILIKE $${paramIndex} OR ct.name ILIKE $${paramIndex} OR ct.company ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (stage_id) {
      whereConditions.push(`o.stage_id = $${paramIndex}`);
      queryParams.push(stage_id);
      paramIndex++;
    }

    if (pipeline_id) {
      whereConditions.push(`o.pipeline_id = $${paramIndex}`);
      queryParams.push(pipeline_id);
      paramIndex++;
    }

    if (campaign_id) {
      whereConditions.push(`o.campaign_id = $${paramIndex}`);
      queryParams.push(campaign_id);
      paramIndex++;
    }

    if (owner_user_id) {
      whereConditions.push(`o.owner_user_id = $${paramIndex}`);
      queryParams.push(owner_user_id);
      paramIndex++;
    }

    if (company) {
      whereConditions.push(`ct.company ILIKE $${paramIndex}`);
      queryParams.push(`%${company}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Count total
    const countResult = await db.query(
      `SELECT COUNT(*) as total
       FROM opportunities o
       LEFT JOIN contacts ct ON o.contact_id = ct.id
       WHERE ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Calculate pagination
    const pagination = calculatePagination(page, Math.min(limit, 100), total);

    // Fetch opportunities
    const opportunitiesResult = await db.query(
      `SELECT
        o.id,
        o.title,
        o.value,
        o.currency,
        o.probability,
        o.expected_close_date,
        o.pipeline_id,
        o.stage_id,
        o.campaign_id,
        o.owner_user_id,
        o.source,
        o.notes,
        o.sent_at,
        o.accepted_at,
        o.qualifying_started_at,
        o.qualified_at,
        o.scheduled_at,
        o.won_at,
        o.lost_at,
        o.created_at,
        o.updated_at,
        ct.id as contact_id,
        ct.name as contact_name,
        ct.email as contact_email,
        ct.phone as contact_phone,
        ct.company as contact_company,
        ct.title as contact_title,
        ct.location as contact_location,
        ct.profile_url as contact_profile_url,
        ct.profile_picture as contact_profile_picture,
        c.name as campaign_name,
        u.name as owner_user_name,
        u.email as owner_user_email,
        ps.name as stage_name,
        p.name as pipeline_name
      FROM opportunities o
      LEFT JOIN contacts ct ON o.contact_id = ct.id
      LEFT JOIN campaigns c ON o.campaign_id = c.id
      LEFT JOIN users u ON o.owner_user_id = u.id
      LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
      LEFT JOIN pipelines p ON o.pipeline_id = p.id
      WHERE ${whereClause}
      ORDER BY o.${sortField} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, pagination.perPage, pagination.offset]
    );

    return res.json({
      success: true,
      data: opportunitiesResult.rows,
      pagination: {
        page: pagination.currentPage,
        per_page: pagination.perPage,
        total: pagination.total,
        total_pages: pagination.totalPages,
        has_next: pagination.hasNext,
        has_prev: pagination.hasPrev
      }
    });
  } catch (error) {
    console.error('External API - Error listing opportunities:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching opportunities'
      }
    });
  }
};

/**
 * GET /external/v1/opportunities/:id
 * Get a single opportunity
 */
exports.getOpportunity = async (req, res) => {
  try {
    const accountId = req.apiKey.accountId;
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        o.*,
        ct.name as contact_name,
        ct.email as contact_email,
        ct.phone as contact_phone,
        ct.company as contact_company,
        ct.title as contact_title,
        c.name as campaign_name,
        u.name as owner_user_name,
        u.email as owner_user_email,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', oc.id,
            'content', oc.content,
            'user_name', cu.name,
            'created_at', oc.created_at
          ))
           FROM opportunity_comments oc
           JOIN users cu ON oc.user_id = cu.id
           WHERE oc.opportunity_id = o.id AND oc.deleted_at IS NULL),
          '[]'
        ) as comments
      FROM opportunities o
      LEFT JOIN contacts ct ON o.contact_id = ct.id
      LEFT JOIN campaigns c ON o.campaign_id = c.id
      LEFT JOIN users u ON o.owner_user_id = u.id
      WHERE o.id = $1 AND o.account_id = $2`,
      [id, accountId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Opportunity not found'
        }
      });
    }

    return res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('External API - Error getting opportunity:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching the opportunity'
      }
    });
  }
};

/**
 * POST /external/v1/opportunities
 * Create a new opportunity with contact
 */
exports.createOpportunity = async (req, res) => {
  try {
    const accountId = req.apiKey.accountId;
    const {
      name,
      title,
      company,
      location,
      headline,
      profile_url,
      profile_picture,
      email,
      phone,
      score,
      notes,
      campaign_id,
      owner_user_id,
      sector_id,
      pipeline_id,
      stage_id,
      source // linkedin, google_maps, list, paid_traffic, other
    } = req.body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Name is required'
        }
      });
    }

    // Check if campaign exists and belongs to account
    if (campaign_id) {
      const campaignCheck = await db.query(
        `SELECT id FROM campaigns WHERE id = $1 AND account_id = $2`,
        [campaign_id, accountId]
      );
      if (campaignCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Campaign not found or does not belong to this account'
          }
        });
      }
    }

    // 1. Create or find contact
    let contactId = null;

    // Check if contact exists by email (if provided)
    if (email) {
      const existingContact = await db.query(
        `SELECT id FROM contacts WHERE account_id = $1 AND email = $2 LIMIT 1`,
        [accountId, email]
      );
      if (existingContact.rows.length > 0) {
        contactId = existingContact.rows[0].id;
      }
    }

    // If no contact found, create one
    if (!contactId) {
      const contactResult = await db.query(
        `INSERT INTO contacts
          (account_id, name, title, company, location, headline, profile_url, profile_picture,
           email, phone, source, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        RETURNING id`,
        [accountId, name.trim(), title, company, location, headline, profile_url, profile_picture,
         email, phone, source || 'other']
      );
      contactId = contactResult.rows[0].id;
    }

    // 2. Create opportunity linked to contact
    const oppResult = await db.query(
      `INSERT INTO opportunities
        (account_id, contact_id, title, score, notes, campaign_id, owner_user_id, sector_id,
         pipeline_id, stage_id, source, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *`,
      [accountId, contactId, name.trim(), score || 0, notes, campaign_id, owner_user_id || null,
       sector_id, pipeline_id || null, stage_id || null, source || 'other']
    );

    const opportunity = oppResult.rows[0];

    // If no owner_user_id was explicitly provided, use centralized auto-assignment
    if (!owner_user_id) {
      try {
        const assignment = await roundRobinService.autoAssignOpportunityOnCreation({
          opportunityId: opportunity.id,
          sectorId: sector_id,
          accountId,
          campaignId: campaign_id,
          source: 'external_api'
        });

        if (assignment.assigned) {
          opportunity.owner_user_id = assignment.user.id;
          console.log(`👤 [ExternalAPI] Opportunity ${opportunity.id} auto-atribuída a: ${assignment.user.name} (${assignment.method})`);
        }
      } catch (assignError) {
        // Don't fail creation if auto-assignment fails
        console.log(`⚠️ [ExternalAPI] Auto-assignment falhou: ${assignError.message}`);
      }
    }

    // Fetch complete opportunity with relations
    const fullOpp = await db.query(
      `SELECT o.*,
        ct.name as contact_name,
        ct.email as contact_email,
        ct.phone as contact_phone,
        ct.company as contact_company,
        ct.title as contact_title,
        c.name as campaign_name,
        u.name as owner_user_name,
        u.email as owner_user_email
      FROM opportunities o
      LEFT JOIN contacts ct ON o.contact_id = ct.id
      LEFT JOIN campaigns c ON o.campaign_id = c.id
      LEFT JOIN users u ON o.owner_user_id = u.id
      WHERE o.id = $1`,
      [opportunity.id]
    );

    return res.status(201).json({
      success: true,
      data: fullOpp.rows[0]
    });
  } catch (error) {
    console.error('External API - Error creating opportunity:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while creating the opportunity'
      }
    });
  }
};

/**
 * PUT /external/v1/opportunities/:id
 * Update an opportunity and its contact
 */
exports.updateOpportunity = async (req, res) => {
  try {
    const accountId = req.apiKey.accountId;
    const { id } = req.params;
    const {
      // Contact fields
      name,
      title,
      company,
      location,
      headline,
      profile_url,
      profile_picture,
      email,
      phone,
      // Opportunity fields
      score,
      notes,
      owner_user_id,
      pipeline_id,
      stage_id
    } = req.body;

    // Check if opportunity exists and get contact_id
    const existingOpp = await db.query(
      `SELECT id, contact_id FROM opportunities WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (existingOpp.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Opportunity not found'
        }
      });
    }

    const contactId = existingOpp.rows[0].contact_id;

    // Update contact fields if provided
    const contactUpdates = [];
    const contactValues = [];
    let contactParamIndex = 1;

    if (name !== undefined) {
      contactUpdates.push(`name = $${contactParamIndex++}`);
      contactValues.push(name.trim());
    }
    if (title !== undefined) {
      contactUpdates.push(`title = $${contactParamIndex++}`);
      contactValues.push(title);
    }
    if (company !== undefined) {
      contactUpdates.push(`company = $${contactParamIndex++}`);
      contactValues.push(company);
    }
    if (location !== undefined) {
      contactUpdates.push(`location = $${contactParamIndex++}`);
      contactValues.push(location);
    }
    if (headline !== undefined) {
      contactUpdates.push(`headline = $${contactParamIndex++}`);
      contactValues.push(headline);
    }
    if (profile_url !== undefined) {
      contactUpdates.push(`profile_url = $${contactParamIndex++}`);
      contactValues.push(profile_url);
    }
    if (profile_picture !== undefined) {
      contactUpdates.push(`profile_picture = $${contactParamIndex++}`);
      contactValues.push(profile_picture);
    }
    if (email !== undefined) {
      contactUpdates.push(`email = $${contactParamIndex++}`);
      contactValues.push(email);
    }
    if (phone !== undefined) {
      contactUpdates.push(`phone = $${contactParamIndex++}`);
      contactValues.push(phone);
    }

    if (contactUpdates.length > 0 && contactId) {
      contactUpdates.push(`updated_at = NOW()`);
      contactValues.push(contactId);
      await db.query(
        `UPDATE contacts
         SET ${contactUpdates.join(', ')}
         WHERE id = $${contactParamIndex}`,
        contactValues
      );
    }

    // Update opportunity fields
    const oppUpdates = [];
    const oppValues = [];
    let oppParamIndex = 1;

    if (name !== undefined) {
      oppUpdates.push(`title = $${oppParamIndex++}`);
      oppValues.push(name.trim());
    }
    if (score !== undefined) {
      oppUpdates.push(`score = $${oppParamIndex++}`);
      oppValues.push(score);
    }
    if (notes !== undefined) {
      oppUpdates.push(`notes = $${oppParamIndex++}`);
      oppValues.push(notes);
    }
    if (owner_user_id !== undefined) {
      oppUpdates.push(`owner_user_id = $${oppParamIndex++}`);
      oppValues.push(owner_user_id);
    }
    if (pipeline_id !== undefined) {
      oppUpdates.push(`pipeline_id = $${oppParamIndex++}`);
      oppValues.push(pipeline_id);
    }
    if (stage_id !== undefined) {
      oppUpdates.push(`stage_id = $${oppParamIndex++}`);
      oppValues.push(stage_id);
    }

    if (oppUpdates.length === 0 && contactUpdates.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No fields to update'
        }
      });
    }

    if (oppUpdates.length > 0) {
      oppUpdates.push(`updated_at = NOW()`);
      oppValues.push(id, accountId);

      await db.query(
        `UPDATE opportunities
         SET ${oppUpdates.join(', ')}
         WHERE id = $${oppParamIndex++} AND account_id = $${oppParamIndex}`,
        oppValues
      );
    }

    // Fetch complete opportunity
    const fullOpp = await db.query(
      `SELECT o.*,
        ct.name as contact_name,
        ct.email as contact_email,
        ct.phone as contact_phone,
        ct.company as contact_company,
        ct.title as contact_title,
        c.name as campaign_name,
        u.name as owner_user_name,
        u.email as owner_user_email
      FROM opportunities o
      LEFT JOIN contacts ct ON o.contact_id = ct.id
      LEFT JOIN campaigns c ON o.campaign_id = c.id
      LEFT JOIN users u ON o.owner_user_id = u.id
      WHERE o.id = $1`,
      [id]
    );

    return res.json({
      success: true,
      data: fullOpp.rows[0]
    });
  } catch (error) {
    console.error('External API - Error updating opportunity:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while updating the opportunity'
      }
    });
  }
};

/**
 * PATCH /external/v1/opportunities/:id/stage
 * Update opportunity stage
 */
exports.updateOpportunityStage = async (req, res) => {
  try {
    const accountId = req.apiKey.accountId;
    const { id } = req.params;
    const { stage_id, discard_reason_id } = req.body;

    // Validate stage_id
    if (!stage_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'stage_id is required'
        }
      });
    }

    // Get current opportunity
    const currentOpp = await db.query(
      `SELECT o.*, ps.name as stage_name
       FROM opportunities o
       LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
       WHERE o.id = $1 AND o.account_id = $2`,
      [id, accountId]
    );

    if (currentOpp.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Opportunity not found'
        }
      });
    }

    const opportunity = currentOpp.rows[0];
    const oldStageId = opportunity.stage_id;
    const oldStageName = opportunity.stage_name;

    // Get new stage info
    const newStageResult = await db.query(
      `SELECT name FROM pipeline_stages WHERE id = $1`,
      [stage_id]
    );

    const newStageName = newStageResult.rows[0]?.name;

    // Build update
    const updates = ['stage_id = $1', 'updated_at = NOW()'];
    const values = [stage_id];
    let paramIndex = 2;

    // Set timestamp based on new stage
    const timestampField = getTimestampField(newStageName);
    if (timestampField) {
      updates.push(`${timestampField} = NOW()`);
    }

    // Set discard reason if provided
    if (discard_reason_id) {
      updates.push(`discard_reason_id = $${paramIndex++}`);
      values.push(discard_reason_id);
    }

    values.push(id, accountId);

    await db.query(
      `UPDATE opportunities
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND account_id = $${paramIndex}`,
      values
    );

    // Fetch complete opportunity
    const fullOpp = await db.query(
      `SELECT o.*,
        ct.name as contact_name,
        ct.email as contact_email,
        ct.phone as contact_phone,
        ct.company as contact_company,
        ct.title as contact_title,
        c.name as campaign_name,
        u.name as owner_user_name,
        u.email as owner_user_email,
        ps.name as stage_name
      FROM opportunities o
      LEFT JOIN contacts ct ON o.contact_id = ct.id
      LEFT JOIN campaigns c ON o.campaign_id = c.id
      LEFT JOIN users u ON o.owner_user_id = u.id
      LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
      WHERE o.id = $1`,
      [id]
    );

    return res.json({
      success: true,
      data: fullOpp.rows[0],
      stage_change: {
        from: { id: oldStageId, name: oldStageName },
        to: { id: stage_id, name: newStageName }
      }
    });
  } catch (error) {
    console.error('External API - Error updating opportunity stage:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while updating the opportunity stage'
      }
    });
  }
};

/**
 * DELETE /external/v1/opportunities/:id
 * Delete an opportunity
 */
exports.deleteOpportunity = async (req, res) => {
  try {
    const accountId = req.apiKey.accountId;
    const { id } = req.params;

    // Check if opportunity exists
    const oppResult = await db.query(
      `SELECT id FROM opportunities WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (oppResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Opportunity not found'
        }
      });
    }

    // Delete opportunity (contact remains)
    await db.query(
      `DELETE FROM opportunities WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    return res.json({
      success: true,
      message: 'Opportunity deleted successfully'
    });
  } catch (error) {
    console.error('External API - Error deleting opportunity:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while deleting the opportunity'
      }
    });
  }
};

// Helper: Get campaign counter column for status
function getCounterColumn(status) {
  const mapping = {
    'leads': 'leads_pending',
    'invite_sent': 'leads_sent',
    'accepted': 'leads_accepted',
    'qualifying': 'leads_qualifying',
    'qualified': 'leads_qualified',
    'scheduled': 'leads_scheduled',
    'won': 'leads_won',
    'lost': 'leads_lost',
    'discarded': 'leads_lost'
  };
  return mapping[status];
}

// Helper: Get timestamp field for status
function getTimestampField(status) {
  const mapping = {
    'invite_sent': 'sent_at',
    'accepted': 'accepted_at',
    'qualifying': 'qualifying_started_at',
    'qualified': 'qualified_at',
    'scheduled': 'scheduled_at',
    'won': 'won_at',
    'lost': 'lost_at'
  };
  return mapping[status];
}
