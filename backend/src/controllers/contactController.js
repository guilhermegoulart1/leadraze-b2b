/**
 * Contact Controller
 * Handles unified contact management across all channels
 */

const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const { getAccessibleUserIds, getAccessibleSectorIds } = require('../middleware/permissions');
const unipileClient = require('../config/unipile');
const storageService = require('../services/storageService');

// ================================
// HELPER: Build sector filter for contact queries
// ================================
async function buildContactSectorFilter(userId, accountId, paramIndex = 3) {
  const accessibleSectorIds = await getAccessibleSectorIds(userId, accountId);

  if (accessibleSectorIds.length > 0) {
    return {
      filter: `AND (c.sector_id = ANY($${paramIndex}) OR c.sector_id IS NULL)`,
      params: [accessibleSectorIds]
    };
  } else {
    return {
      filter: 'AND c.sector_id IS NULL',
      params: []
    };
  }
}

/**
 * GET /contacts
 * List contacts with filters, search, and pagination
 */
exports.getContacts = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      search,         // Search by name, email, phone, company
      tags,           // Filter by tag IDs (comma-separated)
      channels,       // Filter by channel types (comma-separated)
      company,        // Filter by specific company
      source,         // Filter by source
      page = 1,
      limit = 50,
      sort_by = 'last_interaction',  // name, company, created_at, last_interaction
      sort_order = 'desc'
    } = req.query;

    // Get accessible user IDs based on role (own, team, or all) - scoped to account
    const accessibleUserIds = await getAccessibleUserIds(userId, accountId);

    // Build WHERE conditions - MUST include account_id for data isolation + SECTOR filtering
    let whereConditions = [`c.account_id = $1`, `c.user_id = ANY($2::uuid[])`];
    let queryParams = [accountId, accessibleUserIds];
    let paramIndex = 3;

    // SECTOR FILTER: Add sector filtering
    const { filter: sectorFilter, params: sectorParams } = await buildContactSectorFilter(userId, accountId, paramIndex);
    if (sectorParams.length > 0) {
      whereConditions.push(sectorFilter.replace(/^AND /, ''));
      queryParams.push(...sectorParams);
      paramIndex += sectorParams.length;
    } else if (sectorFilter) {
      whereConditions.push(sectorFilter.replace(/^AND /, ''));
    }

    // Search filter (name, email, phone, company)
    if (search) {
      whereConditions.push(`(
        c.name ILIKE $${paramIndex} OR
        c.email ILIKE $${paramIndex} OR
        c.phone ILIKE $${paramIndex} OR
        c.company ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Company filter
    if (company) {
      whereConditions.push(`c.company ILIKE $${paramIndex}`);
      queryParams.push(`%${company}%`);
      paramIndex++;
    }

    // Source filter
    if (source) {
      whereConditions.push(`c.source = $${paramIndex}`);
      queryParams.push(source);
      paramIndex++;
    }

    // Tags filter
    if (tags) {
      const tagIds = tags.split(',');
      whereConditions.push(`EXISTS (
        SELECT 1 FROM contact_tags ct
        WHERE ct.contact_id = c.id
        AND ct.tag_id = ANY($${paramIndex}::uuid[])
      )`);
      queryParams.push(tagIds);
      paramIndex++;
    }

    // Channels filter
    if (channels) {
      const channelTypes = channels.split(',');
      whereConditions.push(`EXISTS (
        SELECT 1 FROM contact_channels cc
        WHERE cc.contact_id = c.id
        AND cc.channel_type = ANY($${paramIndex}::text[])
        AND cc.is_active = true
      )`);
      queryParams.push(channelTypes);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Sorting
    let orderByClause = 'c.created_at DESC'; // Default
    if (sort_by === 'name') {
      orderByClause = `c.name ${sort_order.toUpperCase()}`;
    } else if (sort_by === 'company') {
      orderByClause = `c.company ${sort_order.toUpperCase()} NULLS LAST`;
    } else if (sort_by === 'last_interaction') {
      orderByClause = `c.last_interaction_at ${sort_order.toUpperCase()} NULLS LAST`;
    } else if (sort_by === 'created_at') {
      orderByClause = `c.created_at ${sort_order.toUpperCase()}`;
    }

    const offset = (page - 1) * limit;

    // Main query
    const query = `
      SELECT
        c.*,

        -- Aggregate tags
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', t.id,
              'name', t.name,
              'color', t.color,
              'category', t.category
            )
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) as tags,

        -- Aggregate channels
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', cc.id,
              'type', cc.channel_type,
              'channelId', cc.channel_id,
              'username', cc.channel_username,
              'isPrimary', cc.is_primary,
              'isActive', cc.is_active,
              'messageCount', cc.message_count,
              'lastInteraction', cc.last_interaction_at
            )
          ) FILTER (WHERE cc.id IS NOT NULL),
          '[]'
        ) as channels,

        -- Total messages across all channels
        (
          SELECT COALESCE(SUM(message_count), 0)
          FROM contact_channels
          WHERE contact_id = c.id
        ) as total_messages,

        -- Count of active opportunities
        (
          SELECT COUNT(*)
          FROM opportunities o
          WHERE o.contact_id = c.id
        ) as opportunities_count

      FROM contacts c
      LEFT JOIN contact_tags ct ON c.id = ct.contact_id
      LEFT JOIN tags t ON ct.tag_id = t.id
      LEFT JOIN contact_channels cc ON c.id = cc.contact_id
      WHERE ${whereClause}
      GROUP BY c.id
      ORDER BY ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const contacts = await db.query(query, queryParams);

    // Count total
    const countQuery = `
      SELECT COUNT(DISTINCT c.id)
      FROM contacts c
      LEFT JOIN contact_tags ct ON c.id = ct.contact_id
      LEFT JOIN contact_channels cc ON c.id = cc.contact_id
      WHERE ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    sendSuccess(res, {
      contacts: contacts.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * GET /contacts/:id
 * Get single contact with full details
 */
exports.getContact = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // Get accessible user IDs (scoped to account)
    const accessibleUserIds = await getAccessibleUserIds(userId, accountId);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildContactSectorFilter(userId, accountId, 4);

    const query = `
      SELECT
        c.*,

        -- Tags
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', t.id,
              'name', t.name,
              'color', t.color,
              'category', t.category
            )
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) as tags,

        -- Channels
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', cc.id,
              'type', cc.channel_type,
              'channelId', cc.channel_id,
              'username', cc.channel_username,
              'isPrimary', cc.is_primary,
              'isActive', cc.is_active,
              'messageCount', cc.message_count,
              'lastInteraction', cc.last_interaction_at,
              'metadata', cc.metadata
            )
          ) FILTER (WHERE cc.id IS NOT NULL),
          '[]'
        ) as channels,

        -- Linked opportunities
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', o.id,
              'title', o.title,
              'stage_id', o.stage_id,
              'pipeline_id', o.pipeline_id,
              'value', o.value,
              'createdAt', o.created_at
            )
          ) FILTER (WHERE o.id IS NOT NULL),
          '[]'
        ) as opportunities

      FROM contacts c
      LEFT JOIN contact_tags ct ON c.id = ct.contact_id
      LEFT JOIN tags t ON ct.tag_id = t.id AND t.account_id = $3
      LEFT JOIN contact_channels cc ON c.id = cc.contact_id
      LEFT JOIN opportunities o ON o.contact_id = c.id
      WHERE c.id = $1 AND c.account_id = $3 AND c.user_id = ANY($2::uuid[]) ${sectorFilter}
      GROUP BY c.id
    `;

    const result = await db.query(query, [id, accessibleUserIds, accountId, ...sectorParams]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Contact not found');
    }

    sendSuccess(res, { contact: result.rows[0] });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * POST /contacts
 * Create new contact
 */
exports.createContact = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      name,
      first_name,
      last_name,
      email,
      phone,
      phone_country_code,   // ISO country code for phone format (e.g., 'BR', 'US')
      emails = [],          // JSONB array: [{ email, type: 'personal'|'commercial'|'support' }]
      phones = [],          // JSONB array: [{ phone, type: 'mobile'|'whatsapp'|'landline' }]
      company,
      title,
      location,
      sector_id,            // Sector assignment
      linkedin_profile_id,
      profile_url,
      profile_picture,
      headline,
      about,
      industry,
      source = 'manual',
      notes,
      tags = [],           // Array of tag IDs
      channels = []        // Array of {type, channelId, username, isPrimary}
    } = req.body;

    // Validation - at least ONE identifier required
    if (!email && !phone && !linkedin_profile_id) {
      throw new BadRequestError('At least one identifier required: email, phone, or linkedin_profile_id');
    }

    if (!name) {
      throw new BadRequestError('Name is required');
    }

    // Check for duplicates within this account
    if (email) {
      const existing = await db.query(
        'SELECT id FROM contacts WHERE account_id = $1 AND email = $2',
        [accountId, email]
      );
      if (existing.rows.length > 0) {
        throw new BadRequestError('Contact with this email already exists in your account');
      }
    }

    // If sector_id provided, verify it belongs to the account
    if (sector_id) {
      const sector = await db.query(
        'SELECT id FROM sectors WHERE id = $1 AND account_id = $2 AND is_active = true',
        [sector_id, accountId]
      );
      if (sector.rows.length === 0) {
        throw new NotFoundError('Sector not found in your account');
      }
    }

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Insert contact with account_id and sector_id
      const contactResult = await client.query(`
        INSERT INTO contacts (
          user_id, account_id, sector_id, name, first_name, last_name, email, phone,
          phone_country_code, emails, phones, company, title, location, linkedin_profile_id,
          profile_url, profile_picture, headline, about, industry,
          source, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        RETURNING *
      `, [
        userId, accountId, sector_id || null, name, first_name, last_name, email, phone,
        phone_country_code || null, JSON.stringify(emails), JSON.stringify(phones),
        company, title, location, linkedin_profile_id,
        profile_url, profile_picture, headline, about, industry,
        source, notes
      ]);

      const contact = contactResult.rows[0];

      // Add tags
      if (tags.length > 0) {
        for (const tagId of tags) {
          await client.query(`
            INSERT INTO contact_tags (contact_id, tag_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [contact.id, tagId]);
        }
      }

      // Add channels
      if (channels.length > 0) {
        for (const channel of channels) {
          await client.query(`
            INSERT INTO contact_channels (
              contact_id, channel_type, channel_id, channel_username, is_primary
            ) VALUES ($1, $2, $3, $4, $5)
          `, [
            contact.id,
            channel.type,
            channel.channelId,
            channel.username || null,
            channel.isPrimary || false
          ]);
        }
      }

      await client.query('COMMIT');

      // Fetch created contact with relations
      const fullContact = await db.query(`
        SELECT c.*,
          COALESCE(json_agg(DISTINCT t.*) FILTER (WHERE t.id IS NOT NULL), '[]') as tags,
          COALESCE(json_agg(DISTINCT cc.*) FILTER (WHERE cc.id IS NOT NULL), '[]') as channels
        FROM contacts c
        LEFT JOIN contact_tags ct ON c.id = ct.contact_id
        LEFT JOIN tags t ON ct.tag_id = t.id
        LEFT JOIN contact_channels cc ON c.id = cc.contact_id
        WHERE c.id = $1
        GROUP BY c.id
      `, [contact.id]);

      sendSuccess(res, {
        message: 'Contact created successfully',
        contact: fullContact.rows[0]
      }, 201);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * PUT /contacts/:id
 * Update contact
 */
exports.updateContact = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // Get accessible user IDs (scoped to account)
    const accessibleUserIds = await getAccessibleUserIds(userId, accountId);

    // Check if contact exists and user has access in this account
    const existing = await db.query(
      'SELECT * FROM contacts WHERE id = $1 AND account_id = $2 AND user_id = ANY($3::uuid[])',
      [id, accountId, accessibleUserIds]
    );

    if (existing.rows.length === 0) {
      throw new NotFoundError('Contact not found');
    }

    const {
      name, first_name, last_name, email, phone, phone_country_code,
      emails, phones, company, title,
      location, profile_url, profile_picture, headline, about,
      industry, notes, website, instagram_url, facebook_url
    } = req.body;

    // Build update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }

    if (first_name !== undefined) {
      updates.push(`first_name = $${paramIndex}`);
      values.push(first_name);
      paramIndex++;
    }

    if (last_name !== undefined) {
      updates.push(`last_name = $${paramIndex}`);
      values.push(last_name);
      paramIndex++;
    }

    if (email !== undefined) {
      updates.push(`email = $${paramIndex}`);
      values.push(email);
      paramIndex++;
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      values.push(phone);
      paramIndex++;
    }

    if (phone_country_code !== undefined) {
      updates.push(`phone_country_code = $${paramIndex}`);
      values.push(phone_country_code);
      paramIndex++;
    }

    if (emails !== undefined) {
      updates.push(`emails = $${paramIndex}::jsonb`);
      values.push(JSON.stringify(emails));
      paramIndex++;
    }

    if (phones !== undefined) {
      updates.push(`phones = $${paramIndex}::jsonb`);
      values.push(JSON.stringify(phones));
      paramIndex++;
    }

    if (company !== undefined) {
      updates.push(`company = $${paramIndex}`);
      values.push(company);
      paramIndex++;
    }

    if (title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      values.push(title);
      paramIndex++;
    }

    if (location !== undefined) {
      updates.push(`location = $${paramIndex}`);
      values.push(location);
      paramIndex++;
    }

    if (profile_url !== undefined) {
      updates.push(`profile_url = $${paramIndex}`);
      values.push(profile_url);
      paramIndex++;
    }

    if (profile_picture !== undefined) {
      updates.push(`profile_picture = $${paramIndex}`);
      values.push(profile_picture);
      paramIndex++;
    }

    if (headline !== undefined) {
      updates.push(`headline = $${paramIndex}`);
      values.push(headline);
      paramIndex++;
    }

    if (about !== undefined) {
      updates.push(`about = $${paramIndex}`);
      values.push(about);
      paramIndex++;
    }

    if (industry !== undefined) {
      updates.push(`industry = $${paramIndex}`);
      values.push(industry);
      paramIndex++;
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex}`);
      values.push(notes);
      paramIndex++;
    }

    if (website !== undefined) {
      updates.push(`website = $${paramIndex}`);
      values.push(website);
      paramIndex++;
    }

    if (instagram_url !== undefined) {
      updates.push(`instagram_url = $${paramIndex}`);
      values.push(instagram_url);
      paramIndex++;
    }

    if (facebook_url !== undefined) {
      updates.push(`facebook_url = $${paramIndex}`);
      values.push(facebook_url);
      paramIndex++;
    }

    if (updates.length === 0) {
      throw new BadRequestError('No fields to update');
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, accountId);

    const query = `
      UPDATE contacts
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND account_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await db.query(query, values);

    sendSuccess(res, {
      message: 'Contact updated successfully',
      contact: result.rows[0]
    });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * DELETE /contacts/:id
 * Delete contact
 */
exports.deleteContact = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // Get accessible user IDs (scoped to account)
    const accessibleUserIds = await getAccessibleUserIds(userId, accountId);

    // Check if contact exists and user has access in this account
    const existing = await db.query(
      'SELECT * FROM contacts WHERE id = $1 AND account_id = $2 AND user_id = ANY($3::uuid[])',
      [id, accountId, accessibleUserIds]
    );

    if (existing.rows.length === 0) {
      throw new NotFoundError('Contact not found');
    }

    // First, find all opportunities associated with this contact
    const associatedOpportunities = await db.query(
      `SELECT DISTINCT o.id
       FROM opportunities o
       WHERE o.contact_id = $1`,
      [id]
    );

    // Delete all associated opportunities
    if (associatedOpportunities.rows.length > 0) {
      const opportunityIds = associatedOpportunities.rows.map(row => row.id);
      console.log(`🗑️  Deleting ${opportunityIds.length} opportunity(s) associated with contact ${id}`);

      await db.query(
        'DELETE FROM opportunities WHERE id = ANY($1::uuid[])',
        [opportunityIds]
      );
    }

    // Delete contact (cascading deletes will handle contact_tags and other related records)
    await db.query('DELETE FROM contacts WHERE id = $1 AND account_id = $2', [id, accountId]);

    sendSuccess(res, {
      message: 'Contact deleted successfully',
      deleted_opportunities: associatedOpportunities.rows.length
    });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * POST /contacts/:id/tags
 * Add tag to contact
 */
exports.addTag = async (req, res) => {
  try {
    const { id } = req.params;
    const { tag_id } = req.body;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // Get accessible user IDs (scoped to account)
    const accessibleUserIds = await getAccessibleUserIds(userId, accountId);

    // Check contact exists in this account
    const contact = await db.query(
      'SELECT * FROM contacts WHERE id = $1 AND account_id = $2 AND user_id = ANY($3::uuid[])',
      [id, accountId, accessibleUserIds]
    );

    if (contact.rows.length === 0) {
      throw new NotFoundError('Contact not found');
    }

    // Check tag exists in this account
    const tag = await db.query(
      'SELECT * FROM tags WHERE id = $1 AND account_id = $2',
      [tag_id, accountId]
    );
    if (tag.rows.length === 0) {
      throw new NotFoundError('Tag not found in your account');
    }

    // Add tag
    await db.query(`
      INSERT INTO contact_tags (contact_id, tag_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [id, tag_id]);

    sendSuccess(res, {
      message: 'Tag added to contact',
      tag: tag.rows[0]
    });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * DELETE /contacts/:id/tags/:tagId
 * Remove tag from contact
 */
exports.removeTag = async (req, res) => {
  try {
    const { id, tagId } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // Get accessible user IDs (scoped to account)
    const accessibleUserIds = await getAccessibleUserIds(userId, accountId);

    // Check contact exists in this account
    const contact = await db.query(
      'SELECT * FROM contacts WHERE id = $1 AND account_id = $2 AND user_id = ANY($3::uuid[])',
      [id, accountId, accessibleUserIds]
    );

    if (contact.rows.length === 0) {
      throw new NotFoundError('Contact not found');
    }

    // Remove tag
    const result = await db.query(`
      DELETE FROM contact_tags
      WHERE contact_id = $1 AND tag_id = $2
      RETURNING *
    `, [id, tagId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Tag not assigned to this contact');
    }

    sendSuccess(res, {
      message: 'Tag removed from contact'
    });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * GET /contacts/tags
 * Get all available tags
 */
exports.getTags = async (req, res) => {
  try {
    const { category } = req.query;
    const accountId = req.user.account_id;

    let query = 'SELECT * FROM tags WHERE account_id = $1';
    let params = [accountId];

    if (category) {
      query += ' AND category = $2';
      params.push(category);
    }

    query += ' ORDER BY name';

    const result = await db.query(query, params);

    // Group by category
    const grouped = {};
    result.rows.forEach(tag => {
      const cat = tag.category || 'uncategorized';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(tag);
    });

    sendSuccess(res, {
      tags: result.rows,
      grouped
    });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * POST /contacts/export
 * Export contacts to CSV
 */
exports.exportContacts = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      search,
      tags,
      channels,
      company,
      source
    } = req.body; // Use filters from request body

    // Get accessible user IDs (scoped to account)
    const accessibleUserIds = await getAccessibleUserIds(userId, accountId);

    // Build WHERE conditions (same as getContacts) - MUST include account_id
    let whereConditions = [`c.account_id = $1`, `c.user_id = ANY($2::uuid[])`];
    let queryParams = [accountId, accessibleUserIds];
    let paramIndex = 3;

    if (search) {
      whereConditions.push(`(
        c.name ILIKE $${paramIndex} OR
        c.email ILIKE $${paramIndex} OR
        c.phone ILIKE $${paramIndex} OR
        c.company ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (company) {
      whereConditions.push(`c.company ILIKE $${paramIndex}`);
      queryParams.push(`%${company}%`);
      paramIndex++;
    }

    if (source) {
      whereConditions.push(`c.source = $${paramIndex}`);
      queryParams.push(source);
      paramIndex++;
    }

    if (tags) {
      const tagIds = tags.split(',');
      whereConditions.push(`EXISTS (
        SELECT 1 FROM contact_tags ct
        WHERE ct.contact_id = c.id
        AND ct.tag_id = ANY($${paramIndex}::uuid[])
      )`);
      queryParams.push(tagIds);
      paramIndex++;
    }

    if (channels) {
      const channelTypes = channels.split(',');
      whereConditions.push(`EXISTS (
        SELECT 1 FROM contact_channels cc
        WHERE cc.contact_id = c.id
        AND cc.channel_type = ANY($${paramIndex}::text[])
        AND cc.is_active = true
      )`);
      queryParams.push(channelTypes);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Query all matching contacts
    const query = `
      SELECT
        c.name, c.first_name, c.last_name, c.email, c.phone,
        c.company, c.title, c.location, c.industry,
        c.linkedin_profile_id, c.profile_url,
        c.headline, c.source, c.created_at
      FROM contacts c
      WHERE ${whereClause}
      ORDER BY c.name
    `;

    const result = await db.query(query, queryParams);

    // Generate CSV
    const csvRows = [];

    // Header
    csvRows.push([
      'Nome',
      'Primeiro Nome',
      'Sobrenome',
      'Email',
      'Telefone',
      'Empresa',
      'Cargo',
      'Localização',
      'Indústria',
      'LinkedIn ID',
      'URL do Perfil',
      'Headline',
      'Origem',
      'Data de Criação'
    ].join(','));

    // Data rows
    result.rows.forEach(contact => {
      csvRows.push([
        escapeCsvField(contact.name || ''),
        escapeCsvField(contact.first_name || ''),
        escapeCsvField(contact.last_name || ''),
        escapeCsvField(contact.email || ''),
        escapeCsvField(contact.phone || ''),
        escapeCsvField(contact.company || ''),
        escapeCsvField(contact.title || ''),
        escapeCsvField(contact.location || ''),
        escapeCsvField(contact.industry || ''),
        escapeCsvField(contact.linkedin_profile_id || ''),
        escapeCsvField(contact.profile_url || ''),
        escapeCsvField(contact.headline || ''),
        escapeCsvField(contact.source || ''),
        contact.created_at ? new Date(contact.created_at).toLocaleDateString('pt-BR') : ''
      ].join(','));
    });

    const csv = csvRows.join('\n');

    // Set response headers
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="contatos_${new Date().toISOString().split('T')[0]}.csv"`);

    res.send('\ufeff' + csv); // Add BOM for Excel compatibility

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * POST /contacts/import
 * Import contacts from CSV
 */
exports.importContacts = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { csv_data } = req.body; // CSV data as string

    if (!csv_data) {
      throw new BadRequestError('CSV data is required');
    }

    // Parse CSV
    const lines = csv_data.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      throw new BadRequestError('CSV must have header and at least one data row');
    }

    // Parse header
    const headers = parseCsvLine(lines[0]);

    // Expected headers (flexible order)
    const headerMap = {};
    headers.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase().trim();
      if (normalizedHeader.includes('nome') && !normalizedHeader.includes('primeiro') && !normalizedHeader.includes('sobrenome')) {
        headerMap.name = index;
      } else if (normalizedHeader.includes('primeiro')) {
        headerMap.first_name = index;
      } else if (normalizedHeader.includes('sobrenome')) {
        headerMap.last_name = index;
      } else if (normalizedHeader.includes('email') || normalizedHeader.includes('e-mail')) {
        headerMap.email = index;
      } else if (normalizedHeader.includes('telefone') || normalizedHeader.includes('phone')) {
        headerMap.phone = index;
      } else if (normalizedHeader.includes('empresa') || normalizedHeader.includes('company')) {
        headerMap.company = index;
      } else if (normalizedHeader.includes('cargo') || normalizedHeader.includes('title')) {
        headerMap.title = index;
      } else if (normalizedHeader.includes('localização') || normalizedHeader.includes('location')) {
        headerMap.location = index;
      } else if (normalizedHeader.includes('indústria') || normalizedHeader.includes('industry')) {
        headerMap.industry = index;
      } else if (normalizedHeader.includes('linkedin')) {
        headerMap.linkedin_profile_id = index;
      } else if (normalizedHeader.includes('url') || normalizedHeader.includes('perfil')) {
        headerMap.profile_url = index;
      } else if (normalizedHeader.includes('headline')) {
        headerMap.headline = index;
      }
    });

    const imported = [];
    const errors = [];

    // Process data rows
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCsvLine(lines[i]);

        const contactData = {
          user_id: userId,
          account_id: accountId,
          name: values[headerMap.name] || '',
          first_name: values[headerMap.first_name] || null,
          last_name: values[headerMap.last_name] || null,
          email: values[headerMap.email] || null,
          phone: values[headerMap.phone] || null,
          company: values[headerMap.company] || null,
          title: values[headerMap.title] || null,
          location: values[headerMap.location] || null,
          industry: values[headerMap.industry] || null,
          linkedin_profile_id: values[headerMap.linkedin_profile_id] || null,
          profile_url: values[headerMap.profile_url] || null,
          headline: values[headerMap.headline] || null,
          source: 'import'
        };

        // Validation
        if (!contactData.name) {
          errors.push({ row: i + 1, error: 'Nome é obrigatório' });
          continue;
        }

        if (!contactData.email && !contactData.phone && !contactData.linkedin_profile_id) {
          errors.push({ row: i + 1, error: 'Email, telefone ou LinkedIn é obrigatório' });
          continue;
        }

        // Check for duplicates by email (within this account)
        if (contactData.email) {
          const existing = await db.query(
            'SELECT id FROM contacts WHERE account_id = $1 AND email = $2',
            [accountId, contactData.email]
          );

          if (existing.rows.length > 0) {
            errors.push({ row: i + 1, error: `Contato já existe: ${contactData.email}` });
            continue;
          }
        }

        // Insert contact
        const result = await db.insert('contacts', contactData);
        imported.push(result);

      } catch (err) {
        errors.push({ row: i + 1, error: err.message });
      }
    }

    sendSuccess(res, {
      message: `Importação concluída. ${imported.length} contatos importados.`,
      imported: imported.length,
      errors: errors.length > 0 ? errors : undefined,
      total_rows: lines.length - 1
    });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * GET /contacts/:id/full
 * Get complete contact data with channels, conversations, and leads
 * For the unified contact modal
 */
exports.getContactFull = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // Get accessible user IDs (scoped to account)
    const accessibleUserIds = await getAccessibleUserIds(userId, accountId);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildContactSectorFilter(userId, accountId, 4);

    // 1. Get contact with channels and tags
    const contactQuery = `
      SELECT
        c.*,

        -- Tags
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', t.id,
              'name', t.name,
              'color', t.color,
              'category', t.category
            )
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) as tags,

        -- Channels
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', cc.id,
              'type', cc.channel_type,
              'channelId', cc.channel_id,
              'username', cc.channel_username,
              'isPrimary', cc.is_primary,
              'isActive', cc.is_active,
              'messageCount', cc.message_count,
              'lastInteraction', cc.last_interaction_at
            )
          ) FILTER (WHERE cc.id IS NOT NULL),
          '[]'
        ) as channels

      FROM contacts c
      LEFT JOIN contact_tags ct ON c.id = ct.contact_id
      LEFT JOIN tags t ON ct.tag_id = t.id AND t.account_id = $3
      LEFT JOIN contact_channels cc ON c.id = cc.contact_id
      WHERE c.id = $1 AND c.account_id = $3 AND c.user_id = ANY($2::uuid[]) ${sectorFilter}
      GROUP BY c.id
    `;

    const contactResult = await db.query(contactQuery, [id, accessibleUserIds, accountId, ...sectorParams]);

    if (contactResult.rows.length === 0) {
      throw new NotFoundError('Contact not found');
    }

    const contact = contactResult.rows[0];

    // 2. Get all conversations for this contact
    // Via opportunity_id in conversations which links to contact
    const conversationsQuery = `
      SELECT DISTINCT ON (conv.id)
        conv.id,
        conv.status,
        conv.last_message_at,
        conv.unread_count,
        conv.contact_id,
        conv.opportunity_id,
        conv.is_group,
        conv.group_name,
        COALESCE(conv.provider_type, 'LINKEDIN') as provider_type,
        LOWER(COALESCE(conv.provider_type, 'LINKEDIN')) as channel,
        conv.last_message_preview,
        ct.name as contact_name
      FROM conversations conv
      LEFT JOIN opportunities o ON o.id = conv.opportunity_id
      LEFT JOIN contacts ct ON ct.id = o.contact_id
      WHERE conv.account_id = $1
        AND (conv.contact_id = $2 OR o.contact_id = $2)
      ORDER BY conv.id, conv.last_message_at DESC NULLS LAST
    `;

    const conversationsResult = await db.query(conversationsQuery, [accountId, id]);

    // 3. Get all opportunities for this contact
    const opportunitiesQuery = `
      SELECT
        o.id,
        o.title,
        ps.name as stage_name,
        o.pipeline_id,
        o.stage_id,
        o.score,
        o.value,
        o.created_at,
        o.updated_at,
        c.name as campaign_name
      FROM opportunities o
      LEFT JOIN pipeline_stages ps ON ps.id = o.stage_id
      LEFT JOIN campaigns c ON c.id = o.campaign_id
      WHERE o.contact_id = $1
        AND o.account_id = $2
      ORDER BY o.updated_at DESC
    `;

    const opportunitiesResult = await db.query(opportunitiesQuery, [id, accountId]);

    // 4. Get notes for this contact
    const notesQuery = `
      SELECT
        cn.id,
        cn.content,
        cn.created_at,
        cn.user_id,
        u.name as user_name
      FROM contact_notes cn
      LEFT JOIN users u ON u.id = cn.user_id
      WHERE cn.contact_id = $1 AND cn.account_id = $2
      ORDER BY cn.created_at DESC
    `;

    let notes = [];
    try {
      const notesResult = await db.query(notesQuery, [id, accountId]);
      notes = notesResult.rows;
    } catch (e) {
      // Table might not exist yet, ignore error
      console.log('Notes table might not exist:', e.message);
    }

    // Return unified data
    sendSuccess(res, {
      contact,
      channels: contact.channels,
      conversations: conversationsResult.rows,
      opportunities: opportunitiesResult.rows,
      notes
    });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * POST /contacts/:id/notes
 * Add a note to a contact
 */
exports.addContactNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    if (!content || !content.trim()) {
      throw new ValidationError('Note content is required');
    }

    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS contact_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const result = await db.query(`
      INSERT INTO contact_notes (contact_id, user_id, account_id, content)
      VALUES ($1, $2, $3, $4)
      RETURNING id, content, created_at, user_id
    `, [id, userId, accountId, content.trim()]);

    const note = result.rows[0];
    note.user_name = req.user.name;

    sendSuccess(res, { note }, 'Note added successfully');

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * DELETE /contacts/:id/notes/:noteId
 * Delete a note from a contact
 */
exports.deleteContactNote = async (req, res) => {
  try {
    const { id, noteId } = req.params;
    const accountId = req.user.account_id;

    const result = await db.query(`
      DELETE FROM contact_notes
      WHERE id = $1 AND contact_id = $2 AND account_id = $3
      RETURNING id
    `, [noteId, id, accountId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Note not found');
    }

    sendSuccess(res, null, 'Note deleted successfully');

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * POST /contacts/:id/refresh-data
 * Refresh/fetch contact data and profile picture from Unipile
 * Body options:
 *   - updateName: boolean (default: true) - Whether to update the contact name
 *   - updatePicture: boolean (default: true) - Whether to fetch and update profile picture
 */
exports.refreshContactData = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { id: contactId } = req.params;
    const { updateName = true, updatePicture = true } = req.body || {};

    // Get contact
    const contactQuery = await db.query(
      `SELECT c.*, cc.channel_id, cc.channel_type
       FROM contacts c
       LEFT JOIN contact_channels cc ON cc.contact_id = c.id
       WHERE c.id = $1 AND c.account_id = $2
       ORDER BY cc.last_interaction_at DESC NULLS LAST
       LIMIT 1`,
      [contactId, accountId]
    );

    if (contactQuery.rows.length === 0) {
      return sendError(res, new NotFoundError('Contato não encontrado'));
    }

    const contact = contactQuery.rows[0];

    // Get attendee_id from contact_channels metadata
    let attendeeId = null;
    const channelQuery = await db.query(
      `SELECT metadata FROM contact_channels
       WHERE contact_id = $1
       AND metadata->>'attendee_id' IS NOT NULL
       ORDER BY last_interaction_at DESC NULLS LAST
       LIMIT 1`,
      [contactId]
    );

    if (channelQuery.rows.length > 0) {
      attendeeId = channelQuery.rows[0].metadata?.attendee_id;
    }

    if (!attendeeId) {
      console.log('⚠️ AttendeeId não encontrado nos canais do contato');
      return sendError(res, new BadRequestError(
        'Não foi possível encontrar o attendee_id para atualizar os dados. ' +
        'Os dados serão buscados automaticamente na próxima mensagem recebida.'
      ));
    }

    console.log(`🔄 Atualizando dados do contato ${contactId}, attendee ${attendeeId}`);

    const result = { updated: false, fields: [], contact: null };

    // 1. Fetch attendee data from Unipile API
    const attendeeData = await unipileClient.messaging.getAttendeeById(attendeeId);

    if (attendeeData) {
      console.log('📋 Dados do attendee recebidos:', JSON.stringify(attendeeData, null, 2));

      const updates = {};

      // Extract name
      const attendeeName = attendeeData.name
        || attendeeData.display_name
        || attendeeData.full_name
        || attendeeData.pushname;

      // Update name if requested and valid (not just a phone number)
      if (updateName && attendeeName && !attendeeName.match(/^\+?\d+$/)) {
        updates.name = attendeeName;
        result.fields.push('name');
      }

      // Extract headline/bio/about
      if (attendeeData.headline || attendeeData.bio || attendeeData.about) {
        updates.headline = attendeeData.headline || attendeeData.bio || attendeeData.about;
        result.fields.push('headline');
      }

      // Apply updates to contact
      if (Object.keys(updates).length > 0) {
        const setClause = Object.keys(updates)
          .map((key, i) => `${key} = $${i + 2}`)
          .join(', ');
        const values = [contactId, ...Object.values(updates)];

        await db.query(
          `UPDATE contacts SET ${setClause}, updated_at = NOW() WHERE id = $1`,
          values
        );
        result.updated = true;
        console.log(`✅ Dados do contato atualizados: ${result.fields.join(', ')}`);
      }
    }

    // 2. Fetch and save profile picture
    if (updatePicture) {
      console.log(`📸 Buscando foto de perfil do attendee: ${attendeeId}`);

      const pictureResult = await unipileClient.messaging.getAttendeePicture(attendeeId);

      if (pictureResult && pictureResult.data) {
        console.log(`✅ Foto encontrada: ${pictureResult.contentType}, ${pictureResult.data.length} bytes`);

        const mimeToExt = {
          'image/jpeg': '.jpg',
          'image/jpg': '.jpg',
          'image/png': '.png',
          'image/gif': '.gif',
          'image/webp': '.webp'
        };
        const ext = mimeToExt[pictureResult.contentType] || '.jpg';

        const uploadResult = await storageService.uploadContactPicture(
          accountId,
          contactId,
          pictureResult.data,
          pictureResult.contentType,
          `profile${ext}`
        );

        console.log(`✅ Foto salva no R2: ${uploadResult.url}`);

        await db.query(
          `UPDATE contacts SET profile_picture = $1, updated_at = NOW() WHERE id = $2`,
          [uploadResult.url, contactId]
        );

        result.updated = true;
        result.fields.push('profile_picture');
        result.pictureUrl = uploadResult.url;
      } else {
        console.log('⚠️ Nenhuma foto de perfil disponível no Unipile');
      }
    }

    // Fetch updated contact data to return
    const updatedContact = await db.query(
      `SELECT id, name, email, phone, company, title, location, headline,
              profile_picture, profile_url, source, notes, updated_at
       FROM contacts WHERE id = $1`,
      [contactId]
    );
    result.contact = updatedContact.rows[0];

    if (result.updated) {
      sendSuccess(res, {
        message: `Dados atualizados com sucesso: ${result.fields.join(', ')}`,
        fields_updated: result.fields,
        contact: result.contact
      });
    } else {
      sendSuccess(res, {
        message: 'Nenhum dado novo encontrado para atualizar',
        fields_updated: [],
        contact: result.contact
      });
    }

  } catch (error) {
    console.error('❌ Erro ao atualizar dados do contato:', error);
    sendError(res, error);
  }
};

// Alias para compatibilidade (mantém endpoint antigo funcionando)
exports.refreshContactPicture = exports.refreshContactData;

/**
 * POST /contacts/:id/enrich
 * Enrich contact with full LinkedIn profile data and company info
 */
exports.enrichContact = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { force = false } = req.body;

    const { enrichContactById } = require('../services/contactEnrichmentService');

    // Verify contact belongs to this account
    const contact = await db.findOne('contacts', { id, account_id: accountId });
    if (!contact) {
      throw new NotFoundError('Contact not found');
    }

    if (!contact.linkedin_profile_id) {
      throw new BadRequestError('Contact does not have a LinkedIn profile ID');
    }

    // Enrich contact (will also enrich company)
    const result = await enrichContactById(id, force);

    if (result.error) {
      throw new BadRequestError(result.error);
    }

    if (result.skipped) {
      return sendSuccess(res, {
        message: result.reason,
        skipped: true
      });
    }

    // Fetch updated contact with company
    const enrichedContact = await db.query(`
      SELECT c.*,
             comp.name as company_name,
             comp.logo_url as company_logo_url,
             comp.industry as company_industry,
             comp.company_size,
             comp.website as company_website,
             comp.description as company_description,
             comp.specialties as company_specialties,
             comp.headquarters as company_headquarters,
             comp.founded as company_founded,
             comp.follower_count as company_follower_count
      FROM contacts c
      LEFT JOIN companies comp ON c.current_company_id = comp.id
      WHERE c.id = $1
    `, [id]);

    sendSuccess(res, {
      message: 'Contact enriched successfully',
      contact: enrichedContact.rows[0],
      fields_updated: result.fields_updated,
      company_enriched: !!result.company_id
    });

  } catch (error) {
    console.error('Error enriching contact:', error);
    sendError(res, error);
  }
};

/**
 * GET /contacts/:id/company
 * Get company data for a contact
 */
exports.getContactCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    // Get contact with company data and experience to find company_id
    const result = await db.query(`
      SELECT
        c.id as contact_id,
        c.company as company_name_text,
        c.experience,
        c.current_company_id,
        comp.id as company_id,
        comp.linkedin_company_id,
        comp.linkedin_url,
        comp.name,
        comp.logo_url,
        comp.website,
        comp.industry,
        comp.company_size,
        comp.employee_count_min,
        comp.employee_count_max,
        comp.headquarters,
        comp.locations,
        comp.description,
        comp.tagline,
        comp.specialties,
        comp.founded,
        comp.company_type,
        comp.follower_count,
        comp.enriched_at
      FROM contacts c
      LEFT JOIN companies comp ON c.current_company_id = comp.id
      WHERE c.id = $1 AND c.account_id = $2
    `, [id, accountId]);

    if (result.rows.length === 0) {
      return sendError(res, new Error('Contact not found'), 404);
    }

    const row = result.rows[0];

    // Check if we have a company_id in experience that we can use to enrich
    let linkedinCompanyId = row.linkedin_company_id;
    let companyNameFromExperience = null;

    if (row.experience) {
      try {
        const exp = typeof row.experience === 'string' ? JSON.parse(row.experience) : row.experience;
        if (Array.isArray(exp) && exp.length > 0) {
          // Find current job (no end date or status = current)
          const currentJob = exp.find(e => !e.end && !e.end_date || e.status === 'current' || e.status === 'CURRENT') || exp[0];

          // Extract company name from experience
          companyNameFromExperience = currentJob?.company || currentJob?.company_name || currentJob?.companyName || currentJob?.organization;

          if (!linkedinCompanyId) {
            // Check all possible field names for company ID
            linkedinCompanyId = currentJob?.company_id || currentJob?.company_linkedin_id || currentJob?.company_urn
              || currentJob?.companyId || currentJob?.companyUrn || currentJob?.company_profile_id;

            // If no company ID, try to extract from company URL
            const companyUrl = currentJob?.company_linkedin_url || currentJob?.company_url || currentJob?.companyUrl || currentJob?.url;
            if (!linkedinCompanyId && companyUrl) {
              const urlMatch = companyUrl.match(/\/company\/([^\/\?]+)/);
              if (urlMatch && urlMatch[1]) {
                linkedinCompanyId = urlMatch[1];
              }
            }
          }

          console.log('[GET_CONTACT_COMPANY] Experience found:', {
            hasExperience: true,
            currentJobKeys: currentJob ? Object.keys(currentJob) : [],
            companyNameFromExperience,
            resolvedId: linkedinCompanyId
          });
        }
      } catch (e) {
        console.error('[GET_CONTACT_COMPANY] Error parsing experience:', e);
      }
    }

    // Use company name from contacts table or from experience data
    const finalCompanyName = row.company_name_text || companyNameFromExperience;

    // Format company data for frontend
    const company = row.company_id ? {
      id: row.company_id,
      linkedin_company_id: row.linkedin_company_id,
      name: row.name,
      logo: row.logo_url,
      logo_url: row.logo_url,
      linkedin_url: row.linkedin_url,
      website: row.website,
      industry: row.industry,
      company_size: row.company_size,
      employee_count: row.employee_count_max || row.employee_count_min,
      location: row.headquarters,
      headquarters: row.headquarters,
      summary: row.description,
      description: row.description,
      tagline: row.tagline,
      specialties: row.specialties ? (typeof row.specialties === 'string' ? JSON.parse(row.specialties) : row.specialties) : null,
      founded_year: row.founded,
      company_type: row.company_type,
      follower_count: row.follower_count,
      enriched_at: row.enriched_at
    } : null;

    console.log('[GET_CONTACT_COMPANY] Returning:', {
      hasCompany: !!company,
      companyDbId: row.company_id,
      currentCompanyIdFromContact: row.current_company_id,
      companyName: company?.name,
      finalCompanyName,
      canEnrich: !!linkedinCompanyId || !!finalCompanyName,
      linkedinCompanyId
    });

    sendSuccess(res, {
      company,
      company_name: finalCompanyName,
      can_enrich: !!linkedinCompanyId || !!finalCompanyName, // Can try to search by name
      linkedin_company_id: linkedinCompanyId
    });

  } catch (error) {
    console.error('Error getting contact company:', error);
    sendError(res, error);
  }
};

/**
 * POST /contacts/:id/enrich-company
 * Enrich company data from LinkedIn for a contact
 */
exports.enrichContactCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { force = false } = req.body;
    const accountId = req.user.account_id;

    // Get contact with experience data
    const contactResult = await db.query(`
      SELECT c.id, c.experience, c.current_company_id, c.company,
             comp.linkedin_company_id, comp.enriched_at
      FROM contacts c
      LEFT JOIN companies comp ON c.current_company_id = comp.id
      WHERE c.id = $1 AND c.account_id = $2
    `, [id, accountId]);

    if (contactResult.rows.length === 0) {
      return sendError(res, new Error('Contact not found'), 404);
    }

    const contact = contactResult.rows[0];

    // Check if recently enriched (within 24 hours) unless forced
    if (!force && contact.enriched_at) {
      const hoursSinceEnrich = (Date.now() - new Date(contact.enriched_at)) / (1000 * 60 * 60);
      if (hoursSinceEnrich < 24) {
        return sendSuccess(res, {
          message: 'Company was recently enriched',
          skipped: true,
          enriched_at: contact.enriched_at
        });
      }
    }

    // Find LinkedIn company ID from experience or existing company
    let linkedinCompanyId = contact.linkedin_company_id;
    let companyName = contact.company;

    // Always try to extract from experience if we're missing either companyId or companyName
    if (contact.experience && (!linkedinCompanyId || !companyName)) {
      try {
        const exp = typeof contact.experience === 'string' ? JSON.parse(contact.experience) : contact.experience;
        if (Array.isArray(exp) && exp.length > 0) {
          // Find current job (no end date or status = current)
          const currentJob = exp.find(e => !e.end && !e.end_date || e.status === 'current' || e.status === 'CURRENT') || exp[0];

          // Extract company name if not set
          if (!companyName) {
            companyName = currentJob?.company || currentJob?.company_name || currentJob?.companyName || currentJob?.organization;
          }

          // Extract company ID if not set
          if (!linkedinCompanyId) {
            // Check all possible field names for company ID
            linkedinCompanyId = currentJob?.company_id || currentJob?.company_linkedin_id || currentJob?.company_urn
              || currentJob?.companyId || currentJob?.companyUrn || currentJob?.company_profile_id;

            // If no company ID, try to extract from company URL
            const companyUrl = currentJob?.company_linkedin_url || currentJob?.company_url || currentJob?.companyUrl || currentJob?.url;
            if (!linkedinCompanyId && companyUrl) {
              const urlMatch = companyUrl.match(/\/company\/([^\/\?]+)/);
              if (urlMatch && urlMatch[1]) {
                linkedinCompanyId = urlMatch[1];
              }
            }

            console.log('[ENRICH_COMPANY] Extracted from experience:', {
              companyName,
              linkedinCompanyId,
              companyUrl,
              currentJobKeys: currentJob ? Object.keys(currentJob) : []
            });
          }
        }
      } catch (e) {
        console.error('Error parsing experience:', e);
      }
    }

    // Get active LinkedIn account
    const linkedinAccount = await db.query(`
      SELECT unipile_account_id
      FROM linkedin_accounts
      WHERE account_id = $1 AND status = 'active'
      LIMIT 1
    `, [accountId]);

    if (linkedinAccount.rows.length === 0) {
      return sendError(res, new Error('No active LinkedIn account connected'), 400);
    }

    const unipileAccountId = linkedinAccount.rows[0].unipile_account_id;
    const unipileClient = require('../config/unipile');

    if (!unipileClient.isInitialized()) {
      return sendError(res, new Error('Unipile client not initialized'), 500);
    }

    // If no company ID but we have a company name, try to search for it
    if (!linkedinCompanyId && companyName) {
      console.log('[COMPANY ENRICHMENT] No company ID, searching by name:', companyName);
      try {
        const searchResult = await unipileClient.company.search({
          account_id: unipileAccountId,
          keywords: companyName,
          limit: 5
        });

        // Find the best match (exact or close match on name)
        if (searchResult?.items?.length > 0) {
          const companyNameLower = companyName.toLowerCase().trim();
          const exactMatch = searchResult.items.find(c =>
            c.name?.toLowerCase().trim() === companyNameLower
          );
          const bestMatch = exactMatch || searchResult.items[0];

          if (bestMatch?.id) {
            linkedinCompanyId = bestMatch.id;
            console.log('[COMPANY ENRICHMENT] Found company by search:', {
              searchName: companyName,
              matchName: bestMatch.name,
              matchId: bestMatch.id,
              isExact: !!exactMatch
            });
          }
        }
      } catch (searchError) {
        console.error('[COMPANY ENRICHMENT] Search failed:', searchError.message);
      }
    }

    if (!linkedinCompanyId) {
      return sendSuccess(res, {
        message: 'Não foi possível encontrar a empresa no LinkedIn. Tente enriquecer o perfil do contato primeiro.',
        skipped: true,
        company_name: companyName
      });
    }

    console.log('[COMPANY ENRICHMENT] Fetching company:', linkedinCompanyId);

    // Fetch company details from Unipile
    let companyData;
    try {
      companyData = await unipileClient.company.getOne({
        account_id: unipileAccountId,
        identifier: linkedinCompanyId
      });
    } catch (error) {
      console.error('[COMPANY ENRICHMENT] Error fetching from Unipile:', error.message);
      return sendError(res, new Error('Failed to fetch company from LinkedIn'), 500);
    }

    if (!companyData || !companyData.name) {
      return sendSuccess(res, {
        message: 'Empresa não encontrada no LinkedIn',
        skipped: true
      });
    }

    console.log('[COMPANY ENRICHMENT] Received company data:', Object.keys(companyData));

    // Parse employee count range
    let employeeCountMin = null;
    let employeeCountMax = null;
    if (companyData.company_size || companyData.employee_count) {
      const sizeStr = companyData.company_size || String(companyData.employee_count);
      const match = sizeStr.match(/(\d+)-(\d+)/);
      if (match) {
        employeeCountMin = parseInt(match[1]);
        employeeCountMax = parseInt(match[2]);
      } else if (sizeStr.includes('+')) {
        employeeCountMin = parseInt(sizeStr.replace(/\D/g, ''));
      } else {
        const count = parseInt(sizeStr.replace(/\D/g, ''));
        if (!isNaN(count)) {
          employeeCountMin = count;
          employeeCountMax = count;
        }
      }
    }

    // Prepare company record
    const companyRecord = {
      account_id: accountId,
      linkedin_company_id: companyData.id || linkedinCompanyId,
      linkedin_url: companyData.linkedin_url || companyData.url || companyData.profile_url,
      name: companyData.name,
      logo_url: companyData.logo || companyData.logo_url || companyData.profile_picture,
      website: companyData.website,
      industry: companyData.industry,
      company_size: companyData.company_size || companyData.staff_count,
      employee_count_min: employeeCountMin,
      employee_count_max: employeeCountMax,
      headquarters: companyData.headquarters || companyData.location,
      locations: companyData.locations ? JSON.stringify(companyData.locations) : null,
      description: companyData.description || companyData.summary || companyData.about,
      tagline: companyData.tagline,
      specialties: companyData.specialties ? JSON.stringify(
        Array.isArray(companyData.specialties) ? companyData.specialties : [companyData.specialties]
      ) : null,
      founded: companyData.founded || companyData.founded_year || companyData.year_founded,
      company_type: companyData.company_type || companyData.type,
      follower_count: companyData.follower_count || companyData.followers,
      enriched_at: new Date(),
      updated_at: new Date()
    };

    // Upsert company
    let companyId;
    const existingCompany = await db.findOne('companies', {
      account_id: accountId,
      linkedin_company_id: companyRecord.linkedin_company_id
    });

    if (existingCompany) {
      await db.update('companies', companyRecord, { id: existingCompany.id });
      companyId = existingCompany.id;
    } else {
      const newCompany = await db.insert('companies', companyRecord);
      companyId = newCompany.id;
    }

    // Update contact's current_company_id if not set
    if (!contact.current_company_id) {
      await db.update('contacts', { current_company_id: companyId }, { id: contact.id });
    }

    // Format response
    const enrichedCompany = {
      id: companyId,
      linkedin_company_id: companyRecord.linkedin_company_id,
      name: companyRecord.name,
      logo: companyRecord.logo_url,
      logo_url: companyRecord.logo_url,
      linkedin_url: companyRecord.linkedin_url,
      website: companyRecord.website,
      industry: companyRecord.industry,
      company_size: companyRecord.company_size,
      employee_count: employeeCountMax || employeeCountMin,
      location: companyRecord.headquarters,
      headquarters: companyRecord.headquarters,
      summary: companyRecord.description,
      description: companyRecord.description,
      tagline: companyRecord.tagline,
      specialties: companyRecord.specialties ? JSON.parse(companyRecord.specialties) : null,
      founded_year: companyRecord.founded,
      company_type: companyRecord.company_type,
      follower_count: companyRecord.follower_count,
      enriched_at: companyRecord.enriched_at
    };

    sendSuccess(res, {
      message: 'Company enriched successfully',
      company: enrichedCompany
    });

  } catch (error) {
    console.error('Error enriching contact company:', error);
    sendError(res, error);
  }
};

// Helper functions for CSV
function escapeCsvField(field) {
  if (field === null || field === undefined) return '';
  const str = String(field);
  // If field contains comma, quotes, or newlines, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quotes
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Push last field
  result.push(current.trim());

  return result;
}
