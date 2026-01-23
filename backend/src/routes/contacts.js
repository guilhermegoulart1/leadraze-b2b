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

// Get full contact data (for unified modal)
router.get('/:id/full',
  checkPermission('contacts:view:own'),
  contactController.getContactFull
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

// Notes management
router.post('/:id/notes',
  checkPermission('contacts:edit:own'),
  contactController.addContactNote
);

router.delete('/:id/notes/:noteId',
  checkPermission('contacts:edit:own'),
  contactController.deleteContactNote
);

// Refresh contact data from Unipile (picture, name, etc.)
router.post('/:id/refresh-data',
  checkPermission('contacts:edit:own'),
  contactController.refreshContactData
);

// Alias for backwards compatibility
router.post('/:id/refresh-picture',
  checkPermission('contacts:edit:own'),
  contactController.refreshContactPicture
);

// Enrich contact with full LinkedIn profile and company data
router.post('/:id/enrich',
  checkPermission('contacts:edit:own'),
  contactController.enrichContact
);

// Get contact's company data
router.get('/:id/company',
  checkPermission('contacts:view:own'),
  contactController.getContactCompany
);

// Enrich contact's company data from LinkedIn
router.post('/:id/enrich-company',
  checkPermission('contacts:edit:own'),
  contactController.enrichContactCompany
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

// Roadmap executions by contact
const roadmapController = require('../controllers/roadmapController');
router.get('/:contactId/roadmap-executions',
  checkPermission('contacts:view:own'),
  roadmapController.getExecutionsByContact
);

module.exports = router;
