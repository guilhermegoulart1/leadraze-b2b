/**
 * External Opportunities (Leads) Controller
 * Handles lead/opportunity operations via API key authentication
 */

const db = require('../../config/database');
const { calculatePagination, LEAD_STATUS } = require('../../utils/helpers');
const roundRobinService = require('../../services/roundRobinService');

// Valid pipeline stages
const VALID_STAGES = Object.values(LEAD_STATUS);

/**
 * GET /external/v1/opportunities
 * List opportunities (leads) with pagination and filters
 */
exports.listOpportunities = async (req, res) => {
  try {
    const accountId = req.apiKey.accountId;
    const {
      search,
      status,
      campaign_id,
      responsible_user_id,
      company,
      page = 1,
      limit = 50,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    // Validate sort parameters
    const allowedSortFields = ['created_at', 'updated_at', 'name', 'company', 'status', 'score'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Build query
    let whereConditions = ['l.account_id = $1'];
    let queryParams = [accountId];
    let paramIndex = 2;

    if (search) {
      whereConditions.push(`(l.name ILIKE $${paramIndex} OR l.company ILIKE $${paramIndex} OR l.title ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      const statuses = status.split(',');
      whereConditions.push(`l.status = ANY($${paramIndex}::text[])`);
      queryParams.push(statuses);
      paramIndex++;
    }

    if (campaign_id) {
      whereConditions.push(`l.campaign_id = $${paramIndex}`);
      queryParams.push(campaign_id);
      paramIndex++;
    }

    if (responsible_user_id) {
      whereConditions.push(`l.responsible_user_id = $${paramIndex}`);
      queryParams.push(responsible_user_id);
      paramIndex++;
    }

    if (company) {
      whereConditions.push(`l.company ILIKE $${paramIndex}`);
      queryParams.push(`%${company}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Count total
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM leads l WHERE ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Calculate pagination
    const pagination = calculatePagination(page, Math.min(limit, 100), total);

    // Fetch leads
    const leadsResult = await db.query(
      `SELECT
        l.id,
        l.name,
        l.title,
        l.company,
        l.location,
        l.headline,
        l.profile_url,
        l.profile_picture,
        l.email,
        l.phone,
        l.status,
        l.score,
        l.notes,
        l.discard_reason,
        l.campaign_id,
        l.responsible_user_id,
        l.sent_at,
        l.accepted_at,
        l.qualifying_started_at,
        l.qualified_at,
        l.scheduled_at,
        l.won_at,
        l.lost_at,
        l.created_at,
        l.updated_at,
        c.name as campaign_name,
        u.name as responsible_user_name,
        u.email as responsible_user_email
      FROM leads l
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      LEFT JOIN users u ON l.responsible_user_id = u.id
      WHERE ${whereClause}
      ORDER BY l.${sortField} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, pagination.perPage, pagination.offset]
    );

    return res.json({
      success: true,
      data: leadsResult.rows,
      pagination: {
        page: pagination.currentPage,
        per_page: pagination.perPage,
        total: pagination.total,
        total_pages: pagination.totalPages,
        has_next: pagination.hasNext,
        has_prev: pagination.hasPrev
      },
      available_stages: VALID_STAGES
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
 * Get a single opportunity (lead)
 */
exports.getOpportunity = async (req, res) => {
  try {
    const accountId = req.apiKey.accountId;
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        l.*,
        c.name as campaign_name,
        u.name as responsible_user_name,
        u.email as responsible_user_email,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', lc.id,
            'comment', lc.comment,
            'user_name', cu.name,
            'created_at', lc.created_at
          ))
           FROM lead_comments lc
           JOIN users cu ON lc.user_id = cu.id
           WHERE lc.lead_id = l.id AND lc.is_deleted = false),
          '[]'
        ) as comments
      FROM leads l
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      LEFT JOIN users u ON l.responsible_user_id = u.id
      WHERE l.id = $1 AND l.account_id = $2`,
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
 * Create a new opportunity (lead)
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
      status = 'leads',
      score,
      notes,
      campaign_id,
      responsible_user_id,
      sector_id
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

    // Validate status if provided
    if (status && !VALID_STAGES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid status. Must be one of: ${VALID_STAGES.join(', ')}`
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

    // Create lead first (without responsible_user_id if not explicitly provided)
    const result = await db.query(
      `INSERT INTO leads
        (account_id, name, title, company, location, headline, profile_url, profile_picture,
         email, phone, status, score, notes, campaign_id, responsible_user_id, sector_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [accountId, name.trim(), title, company, location, headline, profile_url, profile_picture,
       email, phone, status, score || 0, notes, campaign_id, responsible_user_id || null, sector_id]
    );

    const lead = result.rows[0];

    // If no responsible_user_id was explicitly provided, use centralized auto-assignment
    if (!responsible_user_id) {
      try {
        const assignment = await roundRobinService.autoAssignLeadOnCreation({
          leadId: lead.id,
          sectorId: sector_id,
          accountId,
          campaignId: campaign_id,
          source: 'external_api'
        });

        if (assignment.assigned) {
          lead.responsible_user_id = assignment.user.id;
          console.log(`👤 [ExternalAPI] Lead ${lead.id} auto-atribuído a: ${assignment.user.name} (${assignment.method})`);
        }
      } catch (assignError) {
        // Don't fail lead creation if auto-assignment fails
        console.log(`⚠️ [ExternalAPI] Auto-assignment falhou: ${assignError.message}`);
      }
    }

    // Update campaign counters if campaign_id provided
    if (campaign_id) {
      const counterColumn = getCounterColumn(status);
      if (counterColumn) {
        await db.query(
          `UPDATE campaigns SET ${counterColumn} = ${counterColumn} + 1, total_leads = total_leads + 1 WHERE id = $1`,
          [campaign_id]
        );
      }
    }

    // Fetch complete lead with relations
    const fullLead = await db.query(
      `SELECT l.*,
        c.name as campaign_name,
        u.name as responsible_user_name,
        u.email as responsible_user_email
      FROM leads l
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      LEFT JOIN users u ON l.responsible_user_id = u.id
      WHERE l.id = $1`,
      [lead.id]
    );

    return res.status(201).json({
      success: true,
      data: fullLead.rows[0]
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
 * Update an opportunity (lead)
 */
exports.updateOpportunity = async (req, res) => {
  try {
    const accountId = req.apiKey.accountId;
    const { id } = req.params;
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
      responsible_user_id
    } = req.body;

    // Check if lead exists
    const existingLead = await db.query(
      `SELECT id FROM leads WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (existingLead.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Opportunity not found'
        }
      });
    }

    // Build update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (company !== undefined) {
      updates.push(`company = $${paramIndex++}`);
      values.push(company);
    }
    if (location !== undefined) {
      updates.push(`location = $${paramIndex++}`);
      values.push(location);
    }
    if (headline !== undefined) {
      updates.push(`headline = $${paramIndex++}`);
      values.push(headline);
    }
    if (profile_url !== undefined) {
      updates.push(`profile_url = $${paramIndex++}`);
      values.push(profile_url);
    }
    if (profile_picture !== undefined) {
      updates.push(`profile_picture = $${paramIndex++}`);
      values.push(profile_picture);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }
    if (score !== undefined) {
      updates.push(`score = $${paramIndex++}`);
      values.push(score);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }
    if (responsible_user_id !== undefined) {
      updates.push(`responsible_user_id = $${paramIndex++}`);
      values.push(responsible_user_id);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No fields to update'
        }
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id, accountId);

    const result = await db.query(
      `UPDATE leads
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND account_id = $${paramIndex}
       RETURNING *`,
      values
    );

    // Fetch complete lead
    const fullLead = await db.query(
      `SELECT l.*,
        c.name as campaign_name,
        u.name as responsible_user_name,
        u.email as responsible_user_email
      FROM leads l
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      LEFT JOIN users u ON l.responsible_user_id = u.id
      WHERE l.id = $1`,
      [id]
    );

    return res.json({
      success: true,
      data: fullLead.rows[0]
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
 * Update opportunity stage/status
 */
exports.updateOpportunityStage = async (req, res) => {
  try {
    const accountId = req.apiKey.accountId;
    const { id } = req.params;
    const { status, discard_reason } = req.body;

    // Validate status
    if (!status || !VALID_STAGES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid status. Must be one of: ${VALID_STAGES.join(', ')}`
        }
      });
    }

    // Get current lead
    const currentLead = await db.query(
      `SELECT * FROM leads WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (currentLead.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Opportunity not found'
        }
      });
    }

    const lead = currentLead.rows[0];
    const oldStatus = lead.status;

    // Build update
    const updates = ['status = $1', 'updated_at = NOW()'];
    const values = [status];
    let paramIndex = 2;

    // Set timestamp based on new status
    const timestampField = getTimestampField(status);
    if (timestampField) {
      updates.push(`${timestampField} = NOW()`);
    }

    // Set discard reason if moving to discarded/lost
    if ((status === 'discarded' || status === 'lost') && discard_reason) {
      updates.push(`discard_reason = $${paramIndex++}`);
      values.push(discard_reason);
    }

    values.push(id, accountId);

    const result = await db.query(
      `UPDATE leads
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND account_id = $${paramIndex}
       RETURNING *`,
      values
    );

    // Update campaign counters
    if (lead.campaign_id) {
      const oldCounter = getCounterColumn(oldStatus);
      const newCounter = getCounterColumn(status);

      if (oldCounter) {
        await db.query(
          `UPDATE campaigns SET ${oldCounter} = GREATEST(0, ${oldCounter} - 1) WHERE id = $1`,
          [lead.campaign_id]
        );
      }
      if (newCounter) {
        await db.query(
          `UPDATE campaigns SET ${newCounter} = ${newCounter} + 1 WHERE id = $1`,
          [lead.campaign_id]
        );
      }
    }

    // Fetch complete lead
    const fullLead = await db.query(
      `SELECT l.*,
        c.name as campaign_name,
        u.name as responsible_user_name,
        u.email as responsible_user_email
      FROM leads l
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      LEFT JOIN users u ON l.responsible_user_id = u.id
      WHERE l.id = $1`,
      [id]
    );

    return res.json({
      success: true,
      data: fullLead.rows[0],
      stage_change: {
        from: oldStatus,
        to: status
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
 * Delete an opportunity (lead)
 */
exports.deleteOpportunity = async (req, res) => {
  try {
    const accountId = req.apiKey.accountId;
    const { id } = req.params;

    // Get lead before deleting for counter update
    const leadResult = await db.query(
      `SELECT campaign_id, status FROM leads WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (leadResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Opportunity not found'
        }
      });
    }

    const lead = leadResult.rows[0];

    // Delete lead
    await db.query(
      `DELETE FROM leads WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    // Update campaign counters
    if (lead.campaign_id) {
      const counterColumn = getCounterColumn(lead.status);
      if (counterColumn) {
        await db.query(
          `UPDATE campaigns SET ${counterColumn} = GREATEST(0, ${counterColumn} - 1), total_leads = GREATEST(0, total_leads - 1) WHERE id = $1`,
          [lead.campaign_id]
        );
      }
    }

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
