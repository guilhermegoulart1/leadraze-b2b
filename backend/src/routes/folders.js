// backend/src/routes/folders.js
// Routes for Folders (organizing AI Employees and Follow-up Flows)

const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folderController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// ===========================================
// SPECIFIC ROUTES (must come before :id routes)
// ===========================================

// Move an agent to a folder
router.put('/move-agent', folderController.moveAgentToFolder);

// Move a follow-up flow to a folder
router.put('/move-flow', folderController.moveFlowToFolder);

// Reorder folders
router.put('/reorder', folderController.reorderFolders);

// ===========================================
// FOLDER CRUD ROUTES
// ===========================================

// Get all folders for a type (tree structure with counts)
// GET /api/folders?type=agents|followup
router.get('/', folderController.getFolders);

// Create a new folder
router.post('/', folderController.createFolder);

// Get a single folder
router.get('/:id', folderController.getFolder);

// Update a folder
router.put('/:id', folderController.updateFolder);

// Delete a folder
router.delete('/:id', folderController.deleteFolder);

module.exports = router;
