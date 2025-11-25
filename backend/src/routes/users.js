/**
 * User Management Routes
 * All routes require admin access except where noted
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole, checkPermission } = require('../middleware/permissions');

// All user management routes require authentication
router.use(authenticateToken);

// Update user's language preference (any authenticated user)
router.put('/language',
  userController.updateLanguage
);

// List all users (admin only)
router.get('/',
  checkPermission('users:view'),
  userController.getUsers
);

// Get single user details (admin only)
router.get('/:id',
  checkPermission('users:view'),
  userController.getUser
);

// Create new user (admin only)
router.post('/',
  checkPermission('users:create'),
  userController.createUser
);

// Update user (admin only)
router.put('/:id',
  checkPermission('users:edit'),
  userController.updateUser
);

// Delete user (admin only)
router.delete('/:id',
  checkPermission('users:delete'),
  userController.deleteUser
);

// Team management routes
router.post('/:id/assign-team',
  requireRole('admin'), // Only admin can assign teams
  userController.assignToTeam
);

router.delete('/:supervisorId/team/:memberId',
  requireRole('admin'), // Only admin can remove from teams
  userController.removeFromTeam
);

router.get('/:id/team',
  requireRole(['admin', 'supervisor']), // Admin or the supervisor themselves
  userController.getTeamMembers
);

module.exports = router;
