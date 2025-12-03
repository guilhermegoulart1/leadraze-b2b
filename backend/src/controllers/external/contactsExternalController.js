/**
 * External Contacts Controller
 * Handles contact operations via API key authentication
 */

const db = require('../../config/database');
const { calculatePagination } = require('../../utils/helpers');

/**
 * GET /external/v1/contacts
 * List contacts with pagination and filters
 */
exports.listContacts = async (req, res) => {
  try {
    const accountId = req.apiKey.accountId;
    const {
      search,
      company,
      email,
      phone,
      source,
      tags,
      page = 1,
      limit = 50,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    // Validate sort parameters
    const allowedSortFields = ['created_at', 'updated_at', 'name', 'company', 'last_interaction'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Build query
    let whereConditions = ['c.account_id = $1'];
    let queryParams = [accountId];
    let paramIndex = 2;

    if (search) {
      whereConditions.push(`(c.name ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex} OR c.company ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (company) {
      whereConditions.push(`c.company ILIKE $${paramIndex}`);
      queryParams.push(`%${company}%`);
      paramIndex++;
    }

    if (email) {
      whereConditions.push(`c.email ILIKE $${paramIndex}`);
      queryParams.push(`%${email}%`);
      paramIndex++;
    }

    if (phone) {
      whereConditions.push(`c.phone ILIKE $${paramIndex}`);
      queryParams.push(`%${phone}%`);
      paramIndex++;
    }

    if (source) {
      whereConditions.push(`c.source = $${paramIndex}`);
      queryParams.push(source);
      paramIndex++;
    }

    if (tags) {
      const tagList = tags.split(',');
      whereConditions.push(`EXISTS (
        SELECT 1 FROM contact_tags ct
        WHERE ct.contact_id = c.id
        AND ct.tag_id = ANY($${paramIndex}::uuid[])
      )`);
      queryParams.push(tagList);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Count total
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM contacts c WHERE ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Calculate pagination
    const pagination = calculatePagination(page, Math.min(limit, 100), total);

    // Fetch contacts
    const contactsResult = await db.query(
      `SELECT
        c.id,
        c.name,
        c.email,
        c.phone,
        c.company,
        c.title,
        c.location,
        c.linkedin_profile_url,
        c.source,
        c.custom_fields,
        c.last_interaction,
        c.created_at,
        c.updated_at,
        COALESCE(
          (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
           FROM contact_tags ct
           JOIN tags t ON ct.tag_id = t.id
           WHERE ct.contact_id = c.id),
          '[]'
        ) as tags
      FROM contacts c
      WHERE ${whereClause}
      ORDER BY c.${sortField} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, pagination.perPage, pagination.offset]
    );

    return res.json({
      success: true,
      data: contactsResult.rows,
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
    console.error('External API - Error listing contacts:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching contacts'
      }
    });
  }
};

/**
 * GET /external/v1/contacts/:id
 * Get a single contact
 */
exports.getContact = async (req, res) => {
  try {
    const accountId = req.apiKey.accountId;
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        c.id,
        c.name,
        c.email,
        c.phone,
        c.company,
        c.title,
        c.location,
        c.linkedin_profile_url,
        c.source,
        c.custom_fields,
        c.last_interaction,
        c.created_at,
        c.updated_at,
        COALESCE(
          (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
           FROM contact_tags ct
           JOIN tags t ON ct.tag_id = t.id
           WHERE ct.contact_id = c.id),
          '[]'
        ) as tags,
        COALESCE(
          (SELECT json_agg(json_build_object('id', cn.id, 'note', cn.note, 'created_at', cn.created_at))
           FROM contact_notes cn
           WHERE cn.contact_id = c.id),
          '[]'
        ) as notes
      FROM contacts c
      WHERE c.id = $1 AND c.account_id = $2`,
      [id, accountId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Contact not found'
        }
      });
    }

    return res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('External API - Error getting contact:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching the contact'
      }
    });
  }
};

/**
 * POST /external/v1/contacts
 * Create a new contact
 */
exports.createContact = async (req, res) => {
  try {
    const accountId = req.apiKey.accountId;
    const {
      name,
      email,
      phone,
      company,
      title,
      location,
      linkedin_profile_url,
      source = 'api',
      custom_fields,
      tags
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

    // Get first user of the account to assign as owner
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

    // Create contact
    const result = await db.query(
      `INSERT INTO contacts
        (account_id, user_id, name, email, phone, company, title, location, linkedin_profile_url, source, custom_fields)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [accountId, userId, name.trim(), email, phone, company, title, location, linkedin_profile_url, source, custom_fields ? JSON.stringify(custom_fields) : null]
    );

    const contact = result.rows[0];

    // Add tags if provided
    if (tags && Array.isArray(tags) && tags.length > 0) {
      for (const tagId of tags) {
        await db.query(
          `INSERT INTO contact_tags (contact_id, tag_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [contact.id, tagId]
        );
      }
    }

    // Fetch complete contact with tags
    const fullContact = await db.query(
      `SELECT
        c.*,
        COALESCE(
          (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
           FROM contact_tags ct
           JOIN tags t ON ct.tag_id = t.id
           WHERE ct.contact_id = c.id),
          '[]'
        ) as tags
      FROM contacts c
      WHERE c.id = $1`,
      [contact.id]
    );

    return res.status(201).json({
      success: true,
      data: fullContact.rows[0]
    });
  } catch (error) {
    console.error('External API - Error creating contact:', error);

    // Check for unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: 'A contact with this email already exists'
        }
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while creating the contact'
      }
    });
  }
};

/**
 * PUT /external/v1/contacts/:id
 * Update a contact
 */
exports.updateContact = async (req, res) => {
  try {
    const accountId = req.apiKey.accountId;
    const { id } = req.params;
    const {
      name,
      email,
      phone,
      company,
      title,
      location,
      linkedin_profile_url,
      custom_fields,
      tags
    } = req.body;

    // Check if contact exists
    const existingContact = await db.query(
      `SELECT id FROM contacts WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (existingContact.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Contact not found'
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
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }
    if (company !== undefined) {
      updates.push(`company = $${paramIndex++}`);
      values.push(company);
    }
    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (location !== undefined) {
      updates.push(`location = $${paramIndex++}`);
      values.push(location);
    }
    if (linkedin_profile_url !== undefined) {
      updates.push(`linkedin_profile_url = $${paramIndex++}`);
      values.push(linkedin_profile_url);
    }
    if (custom_fields !== undefined) {
      updates.push(`custom_fields = $${paramIndex++}`);
      values.push(JSON.stringify(custom_fields));
    }

    updates.push(`updated_at = NOW()`);
    values.push(id, accountId);

    const result = await db.query(
      `UPDATE contacts
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND account_id = $${paramIndex}
       RETURNING *`,
      values
    );

    // Update tags if provided
    if (tags !== undefined && Array.isArray(tags)) {
      // Remove existing tags
      await db.query(`DELETE FROM contact_tags WHERE contact_id = $1`, [id]);

      // Add new tags
      for (const tagId of tags) {
        await db.query(
          `INSERT INTO contact_tags (contact_id, tag_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [id, tagId]
        );
      }
    }

    // Fetch complete contact
    const fullContact = await db.query(
      `SELECT
        c.*,
        COALESCE(
          (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
           FROM contact_tags ct
           JOIN tags t ON ct.tag_id = t.id
           WHERE ct.contact_id = c.id),
          '[]'
        ) as tags
      FROM contacts c
      WHERE c.id = $1`,
      [id]
    );

    return res.json({
      success: true,
      data: fullContact.rows[0]
    });
  } catch (error) {
    console.error('External API - Error updating contact:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while updating the contact'
      }
    });
  }
};

/**
 * DELETE /external/v1/contacts/:id
 * Delete a contact
 */
exports.deleteContact = async (req, res) => {
  try {
    const accountId = req.apiKey.accountId;
    const { id } = req.params;

    const result = await db.query(
      `DELETE FROM contacts WHERE id = $1 AND account_id = $2 RETURNING id`,
      [id, accountId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Contact not found'
        }
      });
    }

    return res.json({
      success: true,
      message: 'Contact deleted successfully'
    });
  } catch (error) {
    console.error('External API - Error deleting contact:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while deleting the contact'
      }
    });
  }
};
