/**
 * Contact Controller
 * Handles unified contact management across all channels
 */

const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const { getAccessibleUserIds, getAccessibleSectorIds } = require('../middleware/permissions');

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

        -- Count of active opportunities (leads)
        (
          SELECT COUNT(*)
          FROM contact_leads cl
          JOIN leads l ON l.id = cl.lead_id
          WHERE cl.contact_id = c.id
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
              'id', l.id,
              'name', l.name,
              'status', l.status,
              'role', cl.role,
              'createdAt', cl.created_at
            )
          ) FILTER (WHERE l.id IS NOT NULL),
          '[]'
        ) as opportunities

      FROM contacts c
      LEFT JOIN contact_tags ct ON c.id = ct.contact_id
      LEFT JOIN tags t ON ct.tag_id = t.id AND t.account_id = $3
      LEFT JOIN contact_channels cc ON c.id = cc.contact_id
      LEFT JOIN contact_leads cl ON c.id = cl.contact_id
      LEFT JOIN leads l ON cl.lead_id = l.id
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
          company, title, location, linkedin_profile_id,
          profile_url, profile_picture, headline, about, industry,
          source, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `, [
        userId, accountId, sector_id || null, name, first_name, last_name, email, phone,
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
      name, first_name, last_name, email, phone, company, title,
      location, profile_url, profile_picture, headline, about,
      industry, notes
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

    // First, find all leads associated with this contact
    const associatedLeads = await db.query(
      `SELECT DISTINCT l.id
       FROM leads l
       INNER JOIN contact_leads cl ON cl.lead_id = l.id
       WHERE cl.contact_id = $1`,
      [id]
    );

    // Delete all associated leads
    if (associatedLeads.rows.length > 0) {
      const leadIds = associatedLeads.rows.map(row => row.id);
      console.log(`🗑️  Deleting ${leadIds.length} lead(s) associated with contact ${id}`);

      await db.query(
        'DELETE FROM leads WHERE id = ANY($1::uuid[])',
        [leadIds]
      );
    }

    // Delete contact (cascading deletes will handle contact_leads and other related records)
    await db.query('DELETE FROM contacts WHERE id = $1 AND account_id = $2', [id, accountId]);

    sendSuccess(res, {
      message: 'Contact deleted successfully',
      deleted_leads: associatedLeads.rows.length
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
