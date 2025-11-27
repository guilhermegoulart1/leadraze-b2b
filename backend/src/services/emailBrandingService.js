/**
 * Email Branding Service
 *
 * Handles email signatures, branding, and template customization
 */

const db = require('../config/database');
const storageService = require('./storageService');

class EmailBrandingService {
  /**
   * Get account email settings from accounts.settings JSONB
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Account email settings
   */
  async getAccountEmailSettings(accountId) {
    const query = `
      SELECT settings->'email' as email_settings
      FROM accounts
      WHERE id = $1
    `;
    const result = await db.query(query, [accountId]);

    if (result.rows.length === 0) {
      return {};
    }

    return result.rows[0].email_settings || {};
  }

  /**
   * Update account email settings
   * @param {string} accountId - Account ID
   * @param {Object} emailSettings - Email settings to update
   */
  async updateAccountEmailSettings(accountId, emailSettings) {
    const query = `
      UPDATE accounts
      SET settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{email}',
        $2::jsonb
      ),
      updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING settings->'email' as email_settings
    `;
    const result = await db.query(query, [accountId, JSON.stringify(emailSettings)]);
    return result.rows[0]?.email_settings || {};
  }

  // ============================================================================
  // SIGNATURES
  // ============================================================================

  /**
   * Get all signatures for an account
   * @param {string} accountId - Account ID
   * @param {string} userId - Optional user ID to filter
   */
  async getSignatures(accountId, userId = null) {
    let query = `
      SELECT *
      FROM email_signatures
      WHERE account_id = $1
      AND is_active = true
    `;
    const params = [accountId];

    if (userId) {
      query += ` AND (user_id = $2 OR user_id IS NULL)`;
      params.push(userId);
    }

    query += ` ORDER BY is_default DESC, created_at DESC`;

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get a specific signature by ID
   * @param {string} signatureId - Signature ID
   * @param {string} accountId - Account ID (for security)
   */
  async getSignatureById(signatureId, accountId) {
    const query = `
      SELECT *
      FROM email_signatures
      WHERE id = $1 AND account_id = $2
    `;
    const result = await db.query(query, [signatureId, accountId]);
    return result.rows[0] || null;
  }

  /**
   * Get the effective signature for a user/account
   * Priority: User specific > User's account default > Account default
   * @param {string} accountId - Account ID
   * @param {string} userId - User ID
   */
  async getEffectiveSignature(accountId, userId = null) {
    // First, check if user has email_settings with signature preference
    if (userId) {
      const userQuery = `
        SELECT email_settings
        FROM users
        WHERE id = $1
      `;
      const userResult = await db.query(userQuery, [userId]);
      const userSettings = userResult.rows[0]?.email_settings || {};

      // If user wants to use account signature
      if (userSettings.use_account_signature === true || !userSettings.signature_id) {
        // Fall through to account default
      } else if (userSettings.signature_id) {
        // User has specific signature
        const signature = await this.getSignatureById(userSettings.signature_id, accountId);
        if (signature) return signature;
      }
    }

    // Get account default signature
    const defaultQuery = `
      SELECT *
      FROM email_signatures
      WHERE account_id = $1
      AND is_default = true
      AND user_id IS NULL
      AND is_active = true
      LIMIT 1
    `;
    const defaultResult = await db.query(defaultQuery, [accountId]);

    if (defaultResult.rows.length > 0) {
      return defaultResult.rows[0];
    }

    // Get any active signature for account
    const anyQuery = `
      SELECT *
      FROM email_signatures
      WHERE account_id = $1
      AND user_id IS NULL
      AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const anyResult = await db.query(anyQuery, [accountId]);
    return anyResult.rows[0] || null;
  }

  /**
   * Create a new signature
   * @param {Object} signatureData - Signature data
   */
  async createSignature(signatureData) {
    const {
      account_id,
      user_id = null,
      name,
      is_default = false,
      html_content,
      text_content,
      full_name,
      title,
      company,
      phone,
      email,
      website,
      logo_url,
      // New fields
      template_id,
      accent_color,
      photo_url,
      department,
      pronouns,
      mobile,
      address,
    } = signatureData;

    // If setting as default, unset other defaults first
    if (is_default) {
      await db.query(`
        UPDATE email_signatures
        SET is_default = false
        WHERE account_id = $1 AND user_id IS NOT DISTINCT FROM $2
      `, [account_id, user_id]);
    }

    const query = `
      INSERT INTO email_signatures (
        account_id, user_id, name, is_default,
        html_content, text_content,
        full_name, title, company, phone, email, website,
        logo_url, template_id, accent_color, photo_url,
        department, pronouns, mobile, address
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `;

    const result = await db.query(query, [
      account_id, user_id, name, is_default,
      html_content, text_content,
      full_name, title, company, phone, email, website,
      logo_url, template_id, accent_color, photo_url,
      department, pronouns, mobile, address,
    ]);

    return result.rows[0];
  }

  /**
   * Update a signature
   * @param {string} signatureId - Signature ID
   * @param {string} accountId - Account ID
   * @param {Object} updates - Fields to update
   */
  async updateSignature(signatureId, accountId, updates) {
    const {
      name,
      is_default,
      html_content,
      text_content,
      full_name,
      title,
      company,
      phone,
      email,
      website,
      logo_url,
      // New fields
      template_id,
      accent_color,
      photo_url,
      department,
      pronouns,
      mobile,
      address,
    } = updates;

    // Get current signature to check user_id
    const current = await this.getSignatureById(signatureId, accountId);
    if (!current) {
      throw new Error('Signature not found');
    }

    // If setting as default, unset other defaults first
    if (is_default) {
      await db.query(`
        UPDATE email_signatures
        SET is_default = false
        WHERE account_id = $1 AND user_id IS NOT DISTINCT FROM $2 AND id != $3
      `, [accountId, current.user_id, signatureId]);
    }

    const query = `
      UPDATE email_signatures
      SET
        name = COALESCE($3, name),
        is_default = COALESCE($4, is_default),
        html_content = COALESCE($5, html_content),
        text_content = COALESCE($6, text_content),
        full_name = COALESCE($7, full_name),
        title = COALESCE($8, title),
        company = COALESCE($9, company),
        phone = COALESCE($10, phone),
        email = COALESCE($11, email),
        website = COALESCE($12, website),
        logo_url = COALESCE($13, logo_url),
        template_id = COALESCE($14, template_id),
        accent_color = COALESCE($15, accent_color),
        photo_url = COALESCE($16, photo_url),
        department = COALESCE($17, department),
        pronouns = COALESCE($18, pronouns),
        mobile = COALESCE($19, mobile),
        address = COALESCE($20, address),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND account_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [
      signatureId, accountId,
      name, is_default,
      html_content, text_content,
      full_name, title, company, phone, email, website,
      logo_url, template_id, accent_color, photo_url,
      department, pronouns, mobile, address,
    ]);

    return result.rows[0];
  }

  /**
   * Delete a signature
   * @param {string} signatureId - Signature ID
   * @param {string} accountId - Account ID
   */
  async deleteSignature(signatureId, accountId) {
    // First get the signature to delete logo if exists
    const signature = await this.getSignatureById(signatureId, accountId);
    if (signature?.logo_url) {
      try {
        await storageService.deleteSignatureLogo(signatureId);
      } catch (error) {
        console.error('Error deleting signature logo:', error);
      }
    }

    const query = `
      DELETE FROM email_signatures
      WHERE id = $1 AND account_id = $2
      RETURNING id
    `;
    const result = await db.query(query, [signatureId, accountId]);
    return result.rows.length > 0;
  }

  /**
   * Set a signature as default
   * @param {string} signatureId - Signature ID
   * @param {string} accountId - Account ID
   */
  async setDefaultSignature(signatureId, accountId) {
    const signature = await this.getSignatureById(signatureId, accountId);
    if (!signature) {
      throw new Error('Signature not found');
    }

    // Unset other defaults for the same scope (account or user)
    await db.query(`
      UPDATE email_signatures
      SET is_default = false
      WHERE account_id = $1 AND user_id IS NOT DISTINCT FROM $2
    `, [accountId, signature.user_id]);

    // Set this one as default
    const query = `
      UPDATE email_signatures
      SET is_default = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND account_id = $2
      RETURNING *
    `;
    const result = await db.query(query, [signatureId, accountId]);
    return result.rows[0];
  }

  // ============================================================================
  // TEMPLATES
  // ============================================================================

  /**
   * Get all custom templates for an account
   * @param {string} accountId - Account ID
   * @param {string} category - Optional category filter
   */
  async getTemplates(accountId, category = null) {
    let query = `
      SELECT *
      FROM email_templates_custom
      WHERE account_id = $1
      AND is_active = true
    `;
    const params = [accountId];

    if (category) {
      query += ` AND category = $2`;
      params.push(category);
    }

    query += ` ORDER BY category, name`;

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get a specific template by ID
   * @param {string} templateId - Template ID
   * @param {string} accountId - Account ID
   */
  async getTemplateById(templateId, accountId) {
    const query = `
      SELECT *
      FROM email_templates_custom
      WHERE id = $1 AND account_id = $2
    `;
    const result = await db.query(query, [templateId, accountId]);
    return result.rows[0] || null;
  }

  /**
   * Create a new template
   * @param {Object} templateData - Template data
   */
  async createTemplate(templateData) {
    const {
      account_id,
      name,
      slug,
      category,
      subject_template,
      html_template,
      text_template,
      available_variables,
      description,
      created_by,
    } = templateData;

    const query = `
      INSERT INTO email_templates_custom (
        account_id, name, slug, category,
        subject_template, html_template, text_template,
        available_variables, description, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const result = await db.query(query, [
      account_id, name, slug, category,
      subject_template, html_template, text_template,
      JSON.stringify(available_variables || ['{{nome}}', '{{empresa}}', '{{cargo}}']),
      description, created_by,
    ]);

    return result.rows[0];
  }

  /**
   * Update a template
   * @param {string} templateId - Template ID
   * @param {string} accountId - Account ID
   * @param {Object} updates - Fields to update
   */
  async updateTemplate(templateId, accountId, updates) {
    const {
      name,
      slug,
      category,
      subject_template,
      html_template,
      text_template,
      available_variables,
      description,
      is_active,
    } = updates;

    const query = `
      UPDATE email_templates_custom
      SET
        name = COALESCE($3, name),
        slug = COALESCE($4, slug),
        category = COALESCE($5, category),
        subject_template = COALESCE($6, subject_template),
        html_template = COALESCE($7, html_template),
        text_template = COALESCE($8, text_template),
        available_variables = COALESCE($9, available_variables),
        description = COALESCE($10, description),
        is_active = COALESCE($11, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND account_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [
      templateId, accountId,
      name, slug, category,
      subject_template, html_template, text_template,
      available_variables ? JSON.stringify(available_variables) : null,
      description, is_active,
    ]);

    return result.rows[0];
  }

  /**
   * Delete a template
   * @param {string} templateId - Template ID
   * @param {string} accountId - Account ID
   */
  async deleteTemplate(templateId, accountId) {
    const query = `
      DELETE FROM email_templates_custom
      WHERE id = $1 AND account_id = $2
      RETURNING id
    `;
    const result = await db.query(query, [templateId, accountId]);
    return result.rows.length > 0;
  }

  // ============================================================================
  // BRANDING
  // ============================================================================

  /**
   * Get effective branding (colors, logo) for an account
   * @param {string} accountId - Account ID
   */
  async getEffectiveBranding(accountId) {
    const emailSettings = await this.getAccountEmailSettings(accountId);

    return {
      company_logo_url: emailSettings.company_logo_url || null,
      format_preference: emailSettings.format_preference || 'html',
      branding: emailSettings.branding || {
        primary_color: '#6366F1',
        header_color: '#3B82F6',
      },
    };
  }

  /**
   * Render a signature to HTML
   * @param {Object} signature - Signature object
   * @returns {string} HTML content
   */
  renderSignatureHtml(signature) {
    if (signature.html_content) {
      return signature.html_content;
    }

    // Build HTML from structured components
    let html = '<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">';

    if (signature.full_name) {
      html += `<p style="margin: 0; font-weight: bold;">${signature.full_name}</p>`;
    }
    if (signature.title) {
      html += `<p style="margin: 0; color: #666;">${signature.title}</p>`;
    }
    if (signature.company) {
      html += `<p style="margin: 0; color: #666;">${signature.company}</p>`;
    }

    const contacts = [];
    if (signature.phone) contacts.push(`Tel: ${signature.phone}`);
    if (signature.email) contacts.push(`Email: ${signature.email}`);
    if (contacts.length > 0) {
      html += `<p style="margin: 8px 0 0 0; font-size: 12px; color: #888;">${contacts.join(' | ')}</p>`;
    }

    if (signature.website) {
      html += `<p style="margin: 4px 0 0 0; font-size: 12px;"><a href="${signature.website}" style="color: #6366F1;">${signature.website}</a></p>`;
    }

    if (signature.logo_url) {
      html += `<img src="${signature.logo_url}" alt="Logo" style="margin-top: 12px; max-height: 50px; max-width: 150px;" />`;
    }

    html += '</div>';
    return html;
  }

  /**
   * Render a signature to plain text
   * @param {Object} signature - Signature object
   * @returns {string} Plain text content
   */
  renderSignatureText(signature) {
    if (signature.text_content) {
      return signature.text_content;
    }

    // Build text from structured components
    const lines = [];

    if (signature.full_name) lines.push(signature.full_name);
    if (signature.title) lines.push(signature.title);
    if (signature.company) lines.push(signature.company);
    if (signature.phone) lines.push(`Tel: ${signature.phone}`);
    if (signature.email) lines.push(`Email: ${signature.email}`);
    if (signature.website) lines.push(signature.website);

    return lines.join('\n');
  }

  // ============================================================================
  // USER PREFERENCES
  // ============================================================================

  /**
   * Get user email preferences
   * @param {string} userId - User ID
   */
  async getUserEmailPreferences(userId) {
    const query = `
      SELECT email_settings
      FROM users
      WHERE id = $1
    `;
    const result = await db.query(query, [userId]);
    return result.rows[0]?.email_settings || {};
  }

  /**
   * Update user email preferences
   * @param {string} userId - User ID
   * @param {Object} preferences - Email preferences
   */
  async updateUserEmailPreferences(userId, preferences) {
    const query = `
      UPDATE users
      SET email_settings = $2::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING email_settings
    `;
    const result = await db.query(query, [userId, JSON.stringify(preferences)]);
    return result.rows[0]?.email_settings || {};
  }

  // ============================================================================
  // AI AGENT EMAIL CONFIG
  // ============================================================================

  /**
   * Get AI agent email configuration
   * @param {string} agentId - Agent ID
   */
  async getAgentEmailConfig(agentId) {
    const query = `
      SELECT email_config
      FROM ai_agents
      WHERE id = $1
    `;
    const result = await db.query(query, [agentId]);
    return result.rows[0]?.email_config || {};
  }

  /**
   * Update AI agent email configuration
   * @param {string} agentId - Agent ID
   * @param {string} accountId - Account ID (for security)
   * @param {Object} emailConfig - Email configuration
   */
  async updateAgentEmailConfig(agentId, accountId, emailConfig) {
    const query = `
      UPDATE ai_agents
      SET email_config = $3::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND account_id = $2
      RETURNING email_config
    `;
    const result = await db.query(query, [agentId, accountId, JSON.stringify(emailConfig)]);
    return result.rows[0]?.email_config || {};
  }
}

module.exports = new EmailBrandingService();
