/**
 * External Campaigns Controller
 * Handles campaign operations via API key authentication
 */

const db = require('../../config/database');

/**
 * GET /external/v1/campaigns
 * List LinkedIn campaigns for the account
 */
exports.listCampaigns = async (req, res) => {
  try {
    const accountId = req.apiKey.accountId;
    const { status, page = 1, limit = 50 } = req.query;

    let whereConditions = ['c.account_id = $1'];
    let queryParams = [accountId];
    let paramIndex = 2;

    if (status) {
      whereConditions.push(`c.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(parseInt(limit), 100);
    const perPage = Math.min(parseInt(limit) || 50, 100);

    // Count total
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM campaigns c WHERE ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Fetch campaigns with contact count
    const result = await db.query(
      `SELECT
        c.id,
        c.name,
        c.status,
        c.automation_active,
        c.created_at,
        c.updated_at,
        COALESCE(
          (SELECT COUNT(*) FROM campaign_contacts cc WHERE cc.campaign_id = c.id),
          0
        )::INTEGER as contact_count
      FROM campaigns c
      WHERE ${whereClause}
      ORDER BY c.created_at DESC
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
    console.error('External API - Error listing campaigns:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching campaigns'
      }
    });
  }
};

/**
 * POST /external/v1/campaigns/:id/contacts
 * Add a contact to a campaign (creates contact if not exists)
 */
exports.addContactToCampaign = async (req, res) => {
  try {
    const accountId = req.apiKey.accountId;
    const { id: campaignId } = req.params;
    const {
      name,
      linkedin_profile_url,
      title,
      company,
      location,
      email,
      phone,
      about,
      extracted_contacts
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

    if (!linkedin_profile_url || linkedin_profile_url.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'LinkedIn profile URL is required'
        }
      });
    }

    // Check campaign exists and belongs to account
    const campaignResult = await db.query(
      `SELECT id, name, status FROM campaigns WHERE id = $1 AND account_id = $2`,
      [campaignId, accountId]
    );

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Campaign not found'
        }
      });
    }

    // Get first user of the account
    const userResult = await db.query(
      `SELECT id FROM users WHERE account_id = $1 LIMIT 1`,
      [accountId]
    );

    if (userResult.rows.length === 0) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'No user found for this account'
        }
      });
    }

    const userId = userResult.rows[0].id;

    // Normalize LinkedIn URL (remove query params and trailing slash)
    const normalizedUrl = linkedin_profile_url.split('?')[0].replace(/\/+$/, '');

    // Extract linkedin_profile_id from URL (e.g. "https://www.linkedin.com/in/john-doe" -> "john-doe")
    const profileIdMatch = normalizedUrl.match(/\/in\/([^/]+)$/);
    const linkedinProfileId = profileIdMatch ? profileIdMatch[1] : null;

    // Find or create contact by LinkedIn URL (stored in profile_url column)
    let contact;
    const existingContact = await db.query(
      `SELECT id, name, profile_url FROM contacts
       WHERE account_id = $1 AND profile_url = $2`,
      [accountId, normalizedUrl]
    );

    if (existingContact.rows.length > 0) {
      contact = existingContact.rows[0];
    } else {
      // Use extracted contacts as fallback for email/phone
      const contactEmail = email || (extracted_contacts?.emails?.[0]) || null;
      const contactPhone = phone || (extracted_contacts?.phones?.[0]) || null;

      const newContact = await db.query(
        `INSERT INTO contacts
          (account_id, user_id, name, profile_url, linkedin_profile_id, title, company, location, email, phone, about, extracted_contacts, source)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'chrome_extension')
        RETURNING id, name, profile_url`,
        [accountId, userId, name.trim(), normalizedUrl, linkedinProfileId, title, company, location, contactEmail, contactPhone, about || null, extracted_contacts ? JSON.stringify(extracted_contacts) : null]
      );
      contact = newContact.rows[0];
    }

    // Check if contact is already in this campaign
    const existingCampaignContact = await db.query(
      `SELECT id, status FROM campaign_contacts
       WHERE campaign_id = $1 AND contact_id = $2`,
      [campaignId, contact.id]
    );

    if (existingCampaignContact.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: 'This contact is already in the campaign',
          existing_status: existingCampaignContact.rows[0].status
        }
      });
    }

    // Add contact to campaign with status 'approved'
    const campaignContact = await db.query(
      `INSERT INTO campaign_contacts
        (campaign_id, contact_id, account_id, status)
      VALUES ($1, $2, $3, 'approved')
      RETURNING id, campaign_id, contact_id, status, created_at`,
      [campaignId, contact.id, accountId]
    );

    return res.status(201).json({
      success: true,
      data: {
        campaign_contact: campaignContact.rows[0],
        contact: {
          id: contact.id,
          name: contact.name,
          profile_url: contact.profile_url
        },
        campaign: {
          id: campaignResult.rows[0].id,
          name: campaignResult.rows[0].name
        }
      },
      message: 'Contact added to campaign successfully'
    });
  } catch (error) {
    console.error('External API - Error adding contact to campaign:', error);
    console.error('Error detail:', error.message);
    console.error('Error code:', error.code);
    if (error.detail) console.error('PG detail:', error.detail);
    if (error.column) console.error('PG column:', error.column);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while adding the contact to the campaign',
        debug: {
          pg_message: error.message,
          pg_code: error.code,
          pg_detail: error.detail || null,
          pg_column: error.column || null
        }
      }
    });
  }
};
