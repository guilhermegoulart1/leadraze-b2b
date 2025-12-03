/**
 * External Contacts Routes
 * Path: /external/v1/contacts
 */

const express = require('express');
const router = express.Router();
const contactsController = require('../../controllers/external/contactsExternalController');
const { requirePermission } = require('../../middleware/apiKeyAuth');

// List contacts
router.get('/',
  requirePermission('contacts:read'),
  contactsController.listContacts
);

// Get single contact
router.get('/:id',
  requirePermission('contacts:read'),
  contactsController.getContact
);

// Create contact
router.post('/',
  requirePermission('contacts:write'),
  contactsController.createContact
);

// Update contact
router.put('/:id',
  requirePermission('contacts:write'),
  contactsController.updateContact
);

// Delete contact
router.delete('/:id',
  requirePermission('contacts:delete'),
  contactsController.deleteContact
);

module.exports = router;
