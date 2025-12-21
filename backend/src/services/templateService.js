// backend/src/services/templateService.js
// Service for managing AI Employee templates

const db = require('../config/database');

/**
 * Get all templates (official + account's own + approved public)
 * @param {Object} options - Query options
 * @returns {Promise<Array>} List of templates
 */
async function getTemplates(options = {}) {
  const {
    accountId = null,
    agentType = null,
    niche = null,
    language = 'pt-BR',
    includePublic = true,
    onlyOfficial = false,
    limit = 50,
    offset = 0
  } = options;

  let query = `
    SELECT
      t.*,
      CASE WHEN t.rating_count > 0 THEN ROUND(t.rating_sum::numeric / t.rating_count, 1) ELSE 0 END as rating_average,
      u.name as created_by_name
    FROM agent_templates t
    LEFT JOIN users u ON t.created_by = u.id
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  // Filter by visibility
  if (onlyOfficial) {
    query += ` AND t.is_official = true`;
  } else {
    // Official templates OR account's own OR approved public
    query += ` AND (
      t.is_official = true
      ${accountId ? ` OR t.account_id = $${paramIndex++}` : ''}
      ${includePublic ? ` OR (t.is_public = true AND t.is_approved = true)` : ''}
    )`;
    if (accountId) params.push(accountId);
  }

  // Filter by agent type
  if (agentType) {
    query += ` AND t.agent_type = $${paramIndex++}`;
    params.push(agentType);
  }

  // Filter by niche
  if (niche) {
    query += ` AND t.niche = $${paramIndex++}`;
    params.push(niche);
  }

  // Filter by language
  if (language) {
    query += ` AND t.language = $${paramIndex++}`;
    params.push(language);
  }

  // Order by: official first, then by rating, then by usage
  query += ` ORDER BY t.is_official DESC, rating_average DESC, t.usage_count DESC`;

  // Pagination
  query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params.push(limit, offset);

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Get a single template by ID
 * @param {string} templateId - Template UUID
 * @param {string} accountId - Account ID for permission check
 * @returns {Promise<Object|null>} Template or null
 */
async function getTemplateById(templateId, accountId = null) {
  const query = `
    SELECT
      t.*,
      CASE WHEN t.rating_count > 0 THEN ROUND(t.rating_sum::numeric / t.rating_count, 1) ELSE 0 END as rating_average,
      u.name as created_by_name
    FROM agent_templates t
    LEFT JOIN users u ON t.created_by = u.id
    WHERE t.id = $1
      AND (
        t.is_official = true
        OR t.account_id = $2
        OR (t.is_public = true AND t.is_approved = true)
      )
  `;

  const result = await db.query(query, [templateId, accountId]);
  return result.rows[0] || null;
}

/**
 * Create a new template
 * @param {Object} data - Template data
 * @returns {Promise<Object>} Created template
 */
async function createTemplate(data) {
  const {
    accountId,
    userId,
    name,
    description,
    agentType,
    niche,
    nicheDisplayName,
    tags = [],
    language = 'pt-BR',
    nicheParameters = [],
    workflowDefinition = {},
    promptTemplate = '',
    defaultConfig = {},
    isPublic = false
  } = data;

  const query = `
    INSERT INTO agent_templates (
      account_id, name, description, agent_type, niche, niche_display_name,
      tags, language, niche_parameters, workflow_definition, prompt_template,
      default_config, is_official, is_public, is_approved, approval_status,
      created_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false, $13, false, 'draft', $14
    )
    RETURNING *
  `;

  const result = await db.query(query, [
    accountId,
    name,
    description,
    agentType,
    niche,
    nicheDisplayName,
    tags,
    language,
    JSON.stringify(nicheParameters),
    JSON.stringify(workflowDefinition),
    promptTemplate,
    JSON.stringify(defaultConfig),
    isPublic,
    userId
  ]);

  return result.rows[0];
}

/**
 * Update an existing template
 * @param {string} templateId - Template UUID
 * @param {string} accountId - Account ID for permission check
 * @param {Object} data - Update data
 * @returns {Promise<Object|null>} Updated template or null
 */
async function updateTemplate(templateId, accountId, data) {
  // First check ownership
  const checkQuery = `
    SELECT id FROM agent_templates
    WHERE id = $1 AND account_id = $2 AND is_official = false
  `;
  const checkResult = await db.query(checkQuery, [templateId, accountId]);

  if (checkResult.rows.length === 0) {
    return null; // Not found or not authorized
  }

  const updateFields = [];
  const params = [templateId];
  let paramIndex = 2;

  const allowedFields = [
    'name', 'description', 'niche', 'niche_display_name', 'tags',
    'niche_parameters', 'workflow_definition', 'prompt_template',
    'default_config', 'is_public'
  ];

  for (const field of allowedFields) {
    const camelField = field.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    if (data[camelField] !== undefined) {
      updateFields.push(`${field} = $${paramIndex++}`);
      const value = typeof data[camelField] === 'object'
        ? JSON.stringify(data[camelField])
        : data[camelField];
      params.push(value);
    }
  }

  if (updateFields.length === 0) {
    return await getTemplateById(templateId, accountId);
  }

  updateFields.push(`updated_at = NOW()`);

  // If making public, set to pending approval
  if (data.isPublic === true) {
    updateFields.push(`approval_status = 'pending'`);
    updateFields.push(`is_approved = false`);
  }

  const query = `
    UPDATE agent_templates
    SET ${updateFields.join(', ')}
    WHERE id = $1
    RETURNING *
  `;

  const result = await db.query(query, params);
  return result.rows[0];
}

/**
 * Delete a template
 * @param {string} templateId - Template UUID
 * @param {string} accountId - Account ID for permission check
 * @returns {Promise<boolean>} Success
 */
async function deleteTemplate(templateId, accountId) {
  const query = `
    DELETE FROM agent_templates
    WHERE id = $1 AND account_id = $2 AND is_official = false
    RETURNING id
  `;

  const result = await db.query(query, [templateId, accountId]);
  return result.rows.length > 0;
}

/**
 * Record template usage
 * @param {string} templateId - Template UUID
 * @param {string} accountId - Account ID
 * @param {string} agentId - Created agent ID (optional)
 */
async function recordUsage(templateId, accountId, agentId = null) {
  const query = `
    INSERT INTO template_usage (template_id, account_id, agent_id)
    VALUES ($1, $2, $3)
  `;

  await db.query(query, [templateId, accountId, agentId]);
}

/**
 * Rate a template
 * @param {string} templateId - Template UUID
 * @param {string} accountId - Account ID
 * @param {number} rating - Rating 1-5
 * @param {string} review - Optional review text
 * @returns {Promise<Object>} Rating record
 */
async function rateTemplate(templateId, accountId, rating, review = null) {
  const query = `
    INSERT INTO template_ratings (template_id, account_id, rating, review)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (template_id, account_id)
    DO UPDATE SET rating = $3, review = $4, updated_at = NOW()
    RETURNING *
  `;

  const result = await db.query(query, [templateId, accountId, rating, review]);
  return result.rows[0];
}

/**
 * Get user's rating for a template
 * @param {string} templateId - Template UUID
 * @param {string} accountId - Account ID
 * @returns {Promise<Object|null>} Rating or null
 */
async function getUserRating(templateId, accountId) {
  const query = `
    SELECT * FROM template_ratings
    WHERE template_id = $1 AND account_id = $2
  `;

  const result = await db.query(query, [templateId, accountId]);
  return result.rows[0] || null;
}

/**
 * Get templates pending approval (admin only)
 * @returns {Promise<Array>} Pending templates
 */
async function getPendingTemplates() {
  const query = `
    SELECT
      t.*,
      u.name as created_by_name,
      a.name as account_name
    FROM agent_templates t
    LEFT JOIN users u ON t.created_by = u.id
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.approval_status = 'pending'
    ORDER BY t.created_at ASC
  `;

  const result = await db.query(query);
  return result.rows;
}

/**
 * Approve or reject a template (admin only)
 * @param {string} templateId - Template UUID
 * @param {string} adminUserId - Admin user ID
 * @param {boolean} approved - Approve or reject
 * @param {string} reason - Rejection reason (if rejected)
 * @returns {Promise<Object>} Updated template
 */
async function moderateTemplate(templateId, adminUserId, approved, reason = null) {
  const query = `
    UPDATE agent_templates
    SET
      is_approved = $2,
      approval_status = $3,
      approved_by = $4,
      approved_at = CASE WHEN $2 THEN NOW() ELSE NULL END,
      rejection_reason = $5,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;

  const status = approved ? 'approved' : 'rejected';
  const result = await db.query(query, [templateId, approved, status, adminUserId, reason]);
  return result.rows[0];
}

/**
 * Get available niches with counts
 * @param {string} agentType - Filter by agent type
 * @returns {Promise<Array>} List of niches with counts
 */
async function getNiches(agentType = null) {
  let query = `
    SELECT
      niche,
      niche_display_name,
      COUNT(*) as template_count
    FROM agent_templates
    WHERE (is_official = true OR (is_public = true AND is_approved = true))
  `;
  const params = [];

  if (agentType) {
    query += ` AND agent_type = $1`;
    params.push(agentType);
  }

  query += ` GROUP BY niche, niche_display_name ORDER BY template_count DESC`;

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Clone a template for editing
 * @param {string} templateId - Template to clone
 * @param {string} accountId - Account ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Cloned template
 */
async function cloneTemplate(templateId, accountId, userId) {
  const original = await getTemplateById(templateId, accountId);

  if (!original) {
    throw new Error('Template not found');
  }

  const cloneData = {
    accountId,
    userId,
    name: `${original.name} (Cópia)`,
    description: original.description,
    agentType: original.agent_type,
    niche: original.niche,
    nicheDisplayName: original.niche_display_name,
    tags: original.tags,
    language: original.language,
    nicheParameters: original.niche_parameters,
    workflowDefinition: original.workflow_definition,
    promptTemplate: original.prompt_template,
    defaultConfig: original.default_config,
    isPublic: false
  };

  return await createTemplate(cloneData);
}

module.exports = {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  recordUsage,
  rateTemplate,
  getUserRating,
  getPendingTemplates,
  moderateTemplate,
  getNiches,
  cloneTemplate
};
