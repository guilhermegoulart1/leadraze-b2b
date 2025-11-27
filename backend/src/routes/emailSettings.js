/**
 * Email Settings Routes
 *
 * Routes for managing email signatures, templates, branding, and preferences
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const emailSettingsController = require('../controllers/emailSettingsController');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

// Configure multer for memory storage (files go to R2)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    // Allow only images for logos
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'), false);
    }
  },
});

// All routes require authentication
router.use(authenticateToken);

// ============================================================================
// SIGNATURES
// ============================================================================

// Get all signatures for the account
router.get('/signatures', emailSettingsController.getSignatures);

// Get a specific signature
router.get('/signatures/:id', emailSettingsController.getSignature);

// Create a new signature
router.post('/signatures', emailSettingsController.createSignature);

// Update a signature
router.put('/signatures/:id', emailSettingsController.updateSignature);

// Delete a signature
router.delete('/signatures/:id', emailSettingsController.deleteSignature);

// Set a signature as default
router.post('/signatures/:id/default', emailSettingsController.setDefaultSignature);

// Upload signature logo
router.post(
  '/signatures/:id/logo',
  upload.single('logo'),
  emailSettingsController.uploadSignatureLogo
);

// Generic file upload for signatures (photo or logo before signature exists)
router.post(
  '/signatures/upload',
  upload.single('file'),
  emailSettingsController.uploadSignatureAsset
);

// ============================================================================
// BRANDING
// ============================================================================

// Get account email branding settings
router.get('/branding', emailSettingsController.getBranding);

// Update account email branding settings (requires admin permission)
router.put(
  '/branding',
  checkPermission('settings:edit'),
  emailSettingsController.updateBranding
);

// Upload company logo (requires admin permission)
router.post(
  '/logo/upload',
  checkPermission('settings:edit'),
  upload.single('logo'),
  emailSettingsController.uploadLogo
);

// Delete company logo (requires admin permission)
router.delete(
  '/logo',
  checkPermission('settings:edit'),
  emailSettingsController.deleteLogo
);

// ============================================================================
// PREFERENCES
// ============================================================================

// Get user email preferences
router.get('/preferences', emailSettingsController.getPreferences);

// Update user email preferences
router.put('/preferences', emailSettingsController.updatePreferences);

// ============================================================================
// TEMPLATES
// ============================================================================

// Get all templates for the account
router.get('/templates', emailSettingsController.getTemplates);

// Get a specific template
router.get('/templates/:id', emailSettingsController.getTemplate);

// Create a new template (requires admin permission)
router.post(
  '/templates',
  checkPermission('settings:edit'),
  emailSettingsController.createTemplate
);

// Update a template (requires admin permission)
router.put(
  '/templates/:id',
  checkPermission('settings:edit'),
  emailSettingsController.updateTemplate
);

// Delete a template (requires admin permission)
router.delete(
  '/templates/:id',
  checkPermission('settings:edit'),
  emailSettingsController.deleteTemplate
);

// Preview a template with sample data
router.post('/templates/:id/preview', emailSettingsController.previewTemplate);

// Error handling for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: error.message });
  }
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  next();
});

module.exports = router;
