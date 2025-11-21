/**
 * Contacts Routes
 * Unified contact management across all channels
 */

const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

// All contact routes require authentication
router.use(authenticateToken);

// Get all tags (needed for filters/UI)
router.get('/tags',
  checkPermission('tags:view'),
  contactController.getTags
);

// List contacts
router.get('/',
  checkPermission('contacts:view:own'),
  contactController.getContacts
);

// Get single contact
router.get('/:id',
  checkPermission('contacts:view:own'),
  contactController.getContact
);

// Create new contact
router.post('/',
  checkPermission('contacts:create'),
  contactController.createContact
);

// Update contact
router.put('/:id',
  checkPermission('contacts:edit:own'),
  contactController.updateContact
);

// Delete contact
router.delete('/:id',
  checkPermission('contacts:delete:own'),
  contactController.deleteContact
);

// Tag management
router.post('/:id/tags',
  checkPermission('contacts:edit:own'),
  contactController.addTag
);

router.delete('/:id/tags/:tagId',
  checkPermission('contacts:edit:own'),
  contactController.removeTag
);

// Export/Import
router.post('/export',
  checkPermission('contacts:export'),
  contactController.exportContacts
);

router.post('/import',
  checkPermission('contacts:import'),
  contactController.importContacts
);

module.exports = router;
