/**
 * Email Settings Controller
 *
 * Handles API endpoints for email signatures, templates, branding, and preferences
 */

const emailBrandingService = require('../services/emailBrandingService');
const storageService = require('../services/storageService');

// ============================================================================
// SIGNATURES
// ============================================================================

/**
 * Get all signatures for the account
 */
async function getSignatures(req, res) {
  try {
    const accountId = req.user.account_id;
    const userId = req.query.includePersonal === 'true' ? req.user.id : null;

    const signatures = await emailBrandingService.getSignatures(accountId, userId);
    res.json({ signatures });
  } catch (error) {
    console.error('Error getting signatures:', error);
    res.status(500).json({ error: 'Failed to get signatures' });
  }
}

/**
 * Get a specific signature
 */
async function getSignature(req, res) {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    const signature = await emailBrandingService.getSignatureById(id, accountId);

    if (!signature) {
      return res.status(404).json({ error: 'Signature not found' });
    }

    res.json({ signature });
  } catch (error) {
    console.error('Error getting signature:', error);
    res.status(500).json({ error: 'Failed to get signature' });
  }
}

/**
 * Create a new signature
 */
async function createSignature(req, res) {
  try {
    const accountId = req.user.account_id;
    const {
      name,
      user_id, // null for account-level, or user_id for personal
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
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Signature name is required' });
    }

    // Only allow creating personal signatures for own user
    const finalUserId = user_id === req.user.id ? user_id : null;

    const signature = await emailBrandingService.createSignature({
      account_id: accountId,
      user_id: finalUserId,
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
    });

    res.status(201).json({ signature });
  } catch (error) {
    console.error('Error creating signature:', error);
    res.status(500).json({ error: 'Failed to create signature' });
  }
}

/**
 * Update a signature
 */
async function updateSignature(req, res) {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    const signature = await emailBrandingService.updateSignature(id, accountId, req.body);

    if (!signature) {
      return res.status(404).json({ error: 'Signature not found' });
    }

    res.json({ signature });
  } catch (error) {
    console.error('Error updating signature:', error);
    res.status(500).json({ error: error.message || 'Failed to update signature' });
  }
}

/**
 * Delete a signature
 */
async function deleteSignature(req, res) {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    const deleted = await emailBrandingService.deleteSignature(id, accountId);

    if (!deleted) {
      return res.status(404).json({ error: 'Signature not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting signature:', error);
    res.status(500).json({ error: 'Failed to delete signature' });
  }
}

/**
 * Set a signature as default
 */
async function setDefaultSignature(req, res) {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    const signature = await emailBrandingService.setDefaultSignature(id, accountId);

    res.json({ signature });
  } catch (error) {
    console.error('Error setting default signature:', error);
    res.status(500).json({ error: error.message || 'Failed to set default signature' });
  }
}

// ============================================================================
// BRANDING
// ============================================================================

/**
 * Get account email branding settings
 */
async function getBranding(req, res) {
  try {
    const accountId = req.user.account_id;

    const branding = await emailBrandingService.getEffectiveBranding(accountId);
    res.json({ branding });
  } catch (error) {
    console.error('Error getting branding:', error);
    res.status(500).json({ error: 'Failed to get branding settings' });
  }
}

/**
 * Update account email branding settings
 */
async function updateBranding(req, res) {
  try {
    const accountId = req.user.account_id;
    const { format_preference, branding } = req.body;

    // Get current settings
    const currentSettings = await emailBrandingService.getAccountEmailSettings(accountId);

    // Merge updates
    const newSettings = {
      ...currentSettings,
      format_preference: format_preference || currentSettings.format_preference,
      branding: branding ? { ...currentSettings.branding, ...branding } : currentSettings.branding,
    };

    const updated = await emailBrandingService.updateAccountEmailSettings(accountId, newSettings);
    res.json({ branding: updated });
  } catch (error) {
    console.error('Error updating branding:', error);
    res.status(500).json({ error: 'Failed to update branding settings' });
  }
}

/**
 * Upload company logo
 */
async function uploadLogo(req, res) {
  try {
    const accountId = req.user.account_id;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { buffer, mimetype, originalname } = req.file;

    // Upload to R2
    const result = await storageService.uploadCompanyLogo(
      accountId,
      buffer,
      mimetype,
      originalname
    );

    // Update account settings with logo URL
    const currentSettings = await emailBrandingService.getAccountEmailSettings(accountId);
    await emailBrandingService.updateAccountEmailSettings(accountId, {
      ...currentSettings,
      company_logo_url: result.url,
    });

    res.json({
      logo_url: result.url,
      message: 'Logo uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({ error: error.message || 'Failed to upload logo' });
  }
}

/**
 * Delete company logo
 */
async function deleteLogo(req, res) {
  try {
    const accountId = req.user.account_id;

    // Delete from R2
    await storageService.deleteCompanyLogo(accountId);

    // Update account settings
    const currentSettings = await emailBrandingService.getAccountEmailSettings(accountId);
    await emailBrandingService.updateAccountEmailSettings(accountId, {
      ...currentSettings,
      company_logo_url: null,
    });

    res.json({ success: true, message: 'Logo deleted successfully' });
  } catch (error) {
    console.error('Error deleting logo:', error);
    res.status(500).json({ error: 'Failed to delete logo' });
  }
}

// ============================================================================
// PREFERENCES
// ============================================================================

/**
 * Get user email preferences
 */
async function getPreferences(req, res) {
  try {
    const userId = req.user.id;

    const preferences = await emailBrandingService.getUserEmailPreferences(userId);
    res.json({ preferences });
  } catch (error) {
    console.error('Error getting preferences:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
}

/**
 * Update user email preferences
 */
async function updatePreferences(req, res) {
  try {
    const userId = req.user.id;
    const { signature_id, email_format_preference, use_account_signature } = req.body;

    // Get current preferences
    const current = await emailBrandingService.getUserEmailPreferences(userId);

    // Merge updates
    const newPreferences = {
      ...current,
      signature_id: signature_id !== undefined ? signature_id : current.signature_id,
      email_format_preference: email_format_preference || current.email_format_preference,
      use_account_signature: use_account_signature !== undefined
        ? use_account_signature
        : current.use_account_signature,
    };

    const updated = await emailBrandingService.updateUserEmailPreferences(userId, newPreferences);
    res.json({ preferences: updated });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
}

// ============================================================================
// TEMPLATES
// ============================================================================

/**
 * Get all templates for the account
 */
async function getTemplates(req, res) {
  try {
    const accountId = req.user.account_id;
    const { category } = req.query;

    const templates = await emailBrandingService.getTemplates(accountId, category);
    res.json({ templates });
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({ error: 'Failed to get templates' });
  }
}

/**
 * Get a specific template
 */
async function getTemplate(req, res) {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    const template = await emailBrandingService.getTemplateById(id, accountId);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template });
  } catch (error) {
    console.error('Error getting template:', error);
    res.status(500).json({ error: 'Failed to get template' });
  }
}

/**
 * Create a new template
 */
async function createTemplate(req, res) {
  try {
    const accountId = req.user.account_id;
    const userId = req.user.id;
    const {
      name,
      slug,
      category,
      subject_template,
      html_template,
      text_template,
      available_variables,
      description,
    } = req.body;

    if (!name || !slug || !category || !html_template) {
      return res.status(400).json({
        error: 'Name, slug, category, and html_template are required',
      });
    }

    const template = await emailBrandingService.createTemplate({
      account_id: accountId,
      name,
      slug,
      category,
      subject_template,
      html_template,
      text_template,
      available_variables,
      description,
      created_by: userId,
    });

    res.status(201).json({ template });
  } catch (error) {
    console.error('Error creating template:', error);
    // Check for unique constraint violation
    if (error.code === '23505') {
      return res.status(400).json({ error: 'A template with this slug already exists' });
    }
    res.status(500).json({ error: 'Failed to create template' });
  }
}

/**
 * Update a template
 */
async function updateTemplate(req, res) {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    const template = await emailBrandingService.updateTemplate(id, accountId, req.body);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template });
  } catch (error) {
    console.error('Error updating template:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'A template with this slug already exists' });
    }
    res.status(500).json({ error: 'Failed to update template' });
  }
}

/**
 * Delete a template
 */
async function deleteTemplate(req, res) {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    const deleted = await emailBrandingService.deleteTemplate(id, accountId);

    if (!deleted) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
}

/**
 * Preview a template with sample data
 */
async function previewTemplate(req, res) {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;
    const { data = {} } = req.body;

    const template = await emailBrandingService.getTemplateById(id, accountId);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Replace variables with sample data or placeholders
    const sampleData = {
      nome: data.nome || 'João Silva',
      empresa: data.empresa || 'Empresa Exemplo',
      cargo: data.cargo || 'Diretor de Marketing',
      industria: data.industria || 'Tecnologia',
      ...data,
    };

    let preview = template.html_template;
    Object.entries(sampleData).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    res.json({
      preview,
      subject: template.subject_template
        ? template.subject_template.replace(/{{(\w+)}}/g, (_, key) => sampleData[key] || `{{${key}}}`)
        : null,
    });
  } catch (error) {
    console.error('Error previewing template:', error);
    res.status(500).json({ error: 'Failed to preview template' });
  }
}

// ============================================================================
// SIGNATURE LOGO UPLOAD
// ============================================================================

/**
 * Upload signature logo
 */
async function uploadSignatureLogo(req, res) {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    // Verify signature belongs to account
    const signature = await emailBrandingService.getSignatureById(id, accountId);
    if (!signature) {
      return res.status(404).json({ error: 'Signature not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { buffer, mimetype, originalname } = req.file;

    // Upload to R2
    const result = await storageService.uploadSignatureLogo(
      id,
      buffer,
      mimetype,
      originalname
    );

    // Update signature with logo URL
    await emailBrandingService.updateSignature(id, accountId, {
      logo_url: result.url,
    });

    res.json({
      logo_url: result.url,
      message: 'Signature logo uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading signature logo:', error);
    res.status(500).json({ error: error.message || 'Failed to upload signature logo' });
  }
}

/**
 * Generic upload for signature assets (photo or logo) before signature is created
 * This allows uploading images during signature creation wizard
 */
async function uploadSignatureAsset(req, res) {
  try {
    const accountId = req.user.account_id;
    const assetType = req.body.type || 'signature'; // 'signature' (photo) or 'logo'

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { buffer, mimetype, originalname } = req.file;

    let result;
    if (assetType === 'logo') {
      // For logo, use a unique identifier
      const identifier = Date.now().toString();
      result = await storageService.uploadSignatureLogo(
        `temp-${accountId}-${identifier}`,
        buffer,
        mimetype,
        originalname
      );
    } else {
      // For signature photo
      const identifier = Date.now().toString();
      result = await storageService.uploadSignaturePhoto(
        accountId,
        identifier,
        buffer,
        mimetype,
        originalname
      );
    }

    res.json({
      url: result.url,
      key: result.key,
      message: 'File uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading signature asset:', error);
    res.status(500).json({ error: error.message || 'Failed to upload file' });
  }
}

module.exports = {
  // Signatures
  getSignatures,
  getSignature,
  createSignature,
  updateSignature,
  deleteSignature,
  setDefaultSignature,
  uploadSignatureLogo,
  uploadSignatureAsset,

  // Branding
  getBranding,
  updateBranding,
  uploadLogo,
  deleteLogo,

  // Preferences
  getPreferences,
  updatePreferences,

  // Templates
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  previewTemplate,
};
