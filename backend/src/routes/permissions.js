/**
 * Permissions Management Routes
 * Admin can edit all permissions
 * Supervisor can view and edit user role permissions only
 */

const express = require('express');
const router = express.Router();
const permissionsController = require('../controllers/permissionsController');
const userPermissionsController = require('../controllers/userPermissionsController');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission, checkAnyPermission } = require('../middleware/permissions');

// All permission routes require authentication
router.use(authenticateToken);

// Get all available permissions
router.get('/',
  checkPermission('permissions:view'),
  permissionsController.getAllPermissions
);

// Get summary of all roles and their permission counts
router.get('/roles',
  checkPermission('permissions:view'),
  permissionsController.getRolesSummary
);

// Get permissions for a specific role
router.get('/roles/:role',
  checkPermission('permissions:view'),
  permissionsController.getRolePermissions
);

// Update permissions for a role (replace all)
router.put('/roles/:role',
  checkAnyPermission(['permissions:edit:all', 'permissions:edit:own']),
  permissionsController.updateRolePermissions
);

// Assign a single permission to a role
router.post('/roles/:role/assign',
  checkAnyPermission(['permissions:edit:all', 'permissions:edit:own']),
  permissionsController.assignPermissionToRole
);

// Remove a single permission from a role
router.delete('/roles/:role/remove/:permissionId',
  checkAnyPermission(['permissions:edit:all', 'permissions:edit:own']),
  permissionsController.removePermissionFromRole
);

// ========================================
// USER CUSTOM PERMISSIONS ROUTES
// ========================================

// Get all available permissions (for UI selection)
router.get('/available',
  checkPermission('permissions:view'),
  userPermissionsController.getAvailablePermissions
);

// Get custom permissions for a specific user
router.get('/users/:userId',
  checkPermission('permissions:view'),
  userPermissionsController.getUserPermissions
);

// Get effective permissions for a user (role + custom)
router.get('/users/:userId/effective',
  checkPermission('permissions:view'),
  userPermissionsController.getUserEffectivePermissions
);

// Set/update a custom permission for a user
router.post('/users/:userId',
  checkPermission('permissions:edit:all'),
  userPermissionsController.setUserPermission
);

// Bulk set permissions for a user
router.post('/users/:userId/bulk',
  checkPermission('permissions:edit:all'),
  userPermissionsController.bulkSetUserPermissions
);

// Remove a custom permission (revert to role permission)
router.delete('/users/:userId/:permissionId',
  checkPermission('permissions:edit:all'),
  userPermissionsController.removeUserPermission
);

module.exports = router;
