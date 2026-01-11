/**
 * Channel Permissions Routes
 *
 * Routes for managing user permissions per channel
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const channelPermissionsController = require('../controllers/channelPermissionsController');

// All routes require authentication
router.use(authenticateToken);

// Get permissions for a specific user (all channels)
router.get('/user/:userId', channelPermissionsController.getUserPermissions);

// Get permissions for a specific channel (all users)
router.get('/channel/:channelId', channelPermissionsController.getChannelPermissions);

// Set a single permission
router.put('/', channelPermissionsController.setPermission);

// Set multiple permissions for a user at once
router.put('/user/:userId/bulk', channelPermissionsController.setBulkPermissions);

// Delete a permission
router.delete('/:permissionId', channelPermissionsController.deletePermission);

module.exports = router;
