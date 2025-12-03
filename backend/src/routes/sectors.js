/**
 * Sector Management Routes
 * Handles department/sector organization and assignments
 */

const express = require('express');
const router = express.Router();
const sectorController = require('../controllers/sectorController');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission, requireRole } = require('../middleware/permissions');

// All sector routes require authentication
router.use(authenticateToken);

// Get all sectors for the account
router.get('/',
  checkPermission('sectors:view'),
  sectorController.getSectors
);

// Get users belonging to a sector (for agent rotation selection)
router.get('/:id/users',
  checkPermission('sectors:view'),
  sectorController.getSectorUsers
);

// Get single sector with details
router.get('/:id',
  checkPermission('sectors:view'),
  sectorController.getSector
);

// Create new sector (admin only)
router.post('/',
  checkPermission('sectors:create'),
  sectorController.createSector
);

// Update sector (admin only)
router.put('/:id',
  checkPermission('sectors:edit'),
  sectorController.updateSector
);

// Delete sector (admin only)
router.delete('/:id',
  checkPermission('sectors:delete'),
  sectorController.deleteSector
);

// Assign user to sector
router.post('/assign-user',
  checkPermission('sectors:edit'),
  sectorController.assignUserToSector
);

// Remove user from sector
router.delete('/:sectorId/users/:userId',
  checkPermission('sectors:edit'),
  sectorController.removeUserFromSector
);

// Assign supervisor to sector
router.post('/assign-supervisor',
  checkPermission('sectors:edit'),
  sectorController.assignSupervisorToSector
);

// Remove supervisor from sector
router.delete('/:sectorId/supervisors/:supervisorId',
  checkPermission('sectors:edit'),
  sectorController.removeSupervisorFromSector
);

// Get user's accessible sectors
router.get('/users/:userId/sectors',
  checkPermission('sectors:view'),
  sectorController.getUserSectors
);

// Get supervisor's sectors
router.get('/supervisors/:supervisorId/sectors',
  checkPermission('sectors:view'),
  sectorController.getSupervisorSectors
);

// ================================
// ROUND-ROBIN MANAGEMENT
// ================================

// Toggle round-robin for a sector
router.patch('/:id/round-robin',
  checkPermission('sectors:edit'),
  sectorController.toggleSectorRoundRobin
);

// Get users configured for round-robin
router.get('/:id/round-robin-users',
  checkPermission('sectors:view'),
  sectorController.getSectorRoundRobinUsers
);

// Add user to round-robin rotation
router.post('/:id/round-robin-users',
  checkPermission('sectors:edit'),
  sectorController.addUserToRoundRobin
);

// Remove user from round-robin rotation
router.delete('/:id/round-robin-users/:userId',
  checkPermission('sectors:edit'),
  sectorController.removeUserFromRoundRobin
);

// Get assignment statistics for a sector
router.get('/:id/assignment-stats',
  checkPermission('sectors:view'),
  sectorController.getSectorAssignmentStats
);

module.exports = router;
