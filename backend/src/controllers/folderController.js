// backend/src/controllers/folderController.js
// Controller for Folders

const folderService = require('../services/folderService');

/**
 * Get all folders for a type (with tree structure and counts)
 * GET /api/folders?type=agents|followup
 */
async function getFolders(req, res) {
  try {
    const { accountId } = req.user;
    const { type } = req.query;

    if (!type || !['agents', 'followup'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Folder type is required. Must be "agents" or "followup"'
      });
    }

    const result = await folderService.getFoldersTree(accountId, type);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting folders:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get a single folder
 * GET /api/folders/:id
 */
async function getFolder(req, res) {
  try {
    const { id } = req.params;
    const { accountId } = req.user;

    const folder = await folderService.getFolderById(id, accountId);

    if (!folder) {
      return res.status(404).json({
        success: false,
        error: 'Folder not found'
      });
    }

    res.json({
      success: true,
      data: { folder }
    });
  } catch (error) {
    console.error('Error getting folder:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Create a new folder
 * POST /api/folders
 */
async function createFolder(req, res) {
  try {
    const { accountId, id: userId } = req.user;
    const {
      name,
      color,
      parent_folder_id,
      folder_type,
      display_order
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Folder name is required'
      });
    }

    if (!folder_type || !['agents', 'followup'].includes(folder_type)) {
      return res.status(400).json({
        success: false,
        error: 'Folder type is required. Must be "agents" or "followup"'
      });
    }

    const folder = await folderService.createFolder({
      accountId,
      userId,
      name,
      color,
      parentFolderId: parent_folder_id,
      folderType: folder_type,
      displayOrder: display_order
    });

    res.status(201).json({
      success: true,
      data: { folder }
    });
  } catch (error) {
    console.error('Error creating folder:', error);

    // Handle duplicate name error
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'A folder with this name already exists in this location'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Update a folder
 * PUT /api/folders/:id
 */
async function updateFolder(req, res) {
  try {
    const { id } = req.params;
    const { accountId } = req.user;
    const {
      name,
      color,
      parent_folder_id,
      display_order
    } = req.body;

    const folder = await folderService.updateFolder(id, accountId, {
      name,
      color,
      parentFolderId: parent_folder_id,
      displayOrder: display_order
    });

    if (!folder) {
      return res.status(404).json({
        success: false,
        error: 'Folder not found or not authorized'
      });
    }

    res.json({
      success: true,
      data: { folder }
    });
  } catch (error) {
    console.error('Error updating folder:', error);

    // Handle specific errors
    if (error.message.includes('Cannot set folder as its own parent') ||
        error.message.includes('Cannot move folder into its own descendant')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    // Handle duplicate name error
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'A folder with this name already exists in this location'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Delete a folder
 * DELETE /api/folders/:id
 */
async function deleteFolder(req, res) {
  try {
    const { id } = req.params;
    const { accountId } = req.user;

    const deleted = await folderService.deleteFolder(id, accountId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Folder not found or not authorized'
      });
    }

    res.json({
      success: true,
      message: 'Folder deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Move an agent to a folder
 * PUT /api/folders/move-agent
 */
async function moveAgentToFolder(req, res) {
  try {
    const { accountId } = req.user;
    const { agent_id, folder_id } = req.body;

    if (!agent_id) {
      return res.status(400).json({
        success: false,
        error: 'Agent ID is required'
      });
    }

    const success = await folderService.moveAgentToFolder(
      agent_id,
      folder_id || null,
      accountId
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found or not authorized'
      });
    }

    res.json({
      success: true,
      message: 'Agent moved successfully'
    });
  } catch (error) {
    console.error('Error moving agent to folder:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Move a follow-up flow to a folder
 * PUT /api/folders/move-flow
 */
async function moveFlowToFolder(req, res) {
  try {
    const { accountId } = req.user;
    const { flow_id, folder_id } = req.body;

    if (!flow_id) {
      return res.status(400).json({
        success: false,
        error: 'Flow ID is required'
      });
    }

    const success = await folderService.moveFlowToFolder(
      flow_id,
      folder_id || null,
      accountId
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Flow not found or not authorized'
      });
    }

    res.json({
      success: true,
      message: 'Flow moved successfully'
    });
  } catch (error) {
    console.error('Error moving flow to folder:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Reorder folders
 * PUT /api/folders/reorder
 */
async function reorderFolders(req, res) {
  try {
    const { accountId } = req.user;
    const { folder_orders } = req.body;

    if (!folder_orders || !Array.isArray(folder_orders)) {
      return res.status(400).json({
        success: false,
        error: 'folder_orders array is required'
      });
    }

    await folderService.reorderFolders(accountId, folder_orders);

    res.json({
      success: true,
      message: 'Folders reordered successfully'
    });
  } catch (error) {
    console.error('Error reordering folders:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  getFolders,
  getFolder,
  createFolder,
  updateFolder,
  deleteFolder,
  moveAgentToFolder,
  moveFlowToFolder,
  reorderFolders
};
