// backend/src/services/folderService.js
// Service for managing Folders (for organizing AI Employees and Follow-up Flows)

const db = require('../config/database');

/**
 * Get all folders for an account by type
 * @param {Object} options - Query options
 * @returns {Promise<Array>} List of folders in hierarchical structure
 */
async function getFolders(options = {}) {
  const {
    accountId,
    folderType, // 'agents' or 'followup'
    parentFolderId = null
  } = options;

  let query = `
    SELECT
      f.*,
      u.name as created_by_name,
      (SELECT COUNT(*) FROM folders sub WHERE sub.parent_folder_id = f.id) as subfolder_count
    FROM folders f
    LEFT JOIN users u ON f.created_by = u.id
    WHERE f.account_id = $1 AND f.folder_type = $2
  `;
  const params = [accountId, folderType];
  let paramIndex = 3;

  // Filter by parent folder
  if (parentFolderId === null) {
    query += ` AND f.parent_folder_id IS NULL`;
  } else {
    query += ` AND f.parent_folder_id = $${paramIndex++}`;
    params.push(parentFolderId);
  }

  // Order by display_order, then by name
  query += ` ORDER BY f.display_order ASC, f.name ASC`;

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Get all folders with item counts (hierarchical tree)
 * @param {string} accountId - Account ID
 * @param {string} folderType - 'agents' or 'followup'
 * @returns {Promise<Array>} Hierarchical folder tree with counts
 */
async function getFoldersTree(accountId, folderType) {
  // Get all folders for this account and type
  const foldersQuery = `
    SELECT
      f.*,
      u.name as created_by_name
    FROM folders f
    LEFT JOIN users u ON f.created_by = u.id
    WHERE f.account_id = $1 AND f.folder_type = $2
    ORDER BY f.display_order ASC, f.name ASC
  `;
  const foldersResult = await db.query(foldersQuery, [accountId, folderType]);
  const folders = foldersResult.rows;

  // Get item counts per folder
  let itemCountQuery;
  if (folderType === 'agents') {
    itemCountQuery = `
      SELECT folder_id, COUNT(*) as count
      FROM ai_agents
      WHERE account_id = $1 AND folder_id IS NOT NULL
      GROUP BY folder_id
    `;
  } else {
    itemCountQuery = `
      SELECT folder_id, COUNT(*) as count
      FROM follow_up_flows
      WHERE account_id = $1 AND folder_id IS NOT NULL
      GROUP BY folder_id
    `;
  }
  const itemCountResult = await db.query(itemCountQuery, [accountId]);
  const itemCounts = {};
  itemCountResult.rows.forEach(row => {
    itemCounts[row.folder_id] = parseInt(row.count, 10);
  });

  // Get count of items without folder
  let noFolderCountQuery;
  if (folderType === 'agents') {
    noFolderCountQuery = `
      SELECT COUNT(*) as count
      FROM ai_agents
      WHERE account_id = $1 AND folder_id IS NULL
    `;
  } else {
    noFolderCountQuery = `
      SELECT COUNT(*) as count
      FROM follow_up_flows
      WHERE account_id = $1 AND folder_id IS NULL
    `;
  }
  const noFolderResult = await db.query(noFolderCountQuery, [accountId]);
  const noFolderCount = parseInt(noFolderResult.rows[0].count, 10);

  // Get total items count
  let totalCountQuery;
  if (folderType === 'agents') {
    totalCountQuery = `SELECT COUNT(*) as count FROM ai_agents WHERE account_id = $1`;
  } else {
    totalCountQuery = `SELECT COUNT(*) as count FROM follow_up_flows WHERE account_id = $1`;
  }
  const totalResult = await db.query(totalCountQuery, [accountId]);
  const totalCount = parseInt(totalResult.rows[0].count, 10);

  // Add item counts to folders
  folders.forEach(folder => {
    folder.item_count = itemCounts[folder.id] || 0;
  });

  // Build hierarchical tree
  const buildTree = (parentId = null) => {
    return folders
      .filter(f => f.parent_folder_id === parentId)
      .map(folder => ({
        ...folder,
        children: buildTree(folder.id)
      }));
  };

  return {
    tree: buildTree(null),
    flatList: folders,
    totalCount,
    noFolderCount
  };
}

/**
 * Get a single folder by ID
 * @param {string} folderId - Folder UUID
 * @param {string} accountId - Account ID for permission check
 * @returns {Promise<Object|null>} Folder or null
 */
async function getFolderById(folderId, accountId) {
  const query = `
    SELECT
      f.*,
      u.name as created_by_name
    FROM folders f
    LEFT JOIN users u ON f.created_by = u.id
    WHERE f.id = $1 AND f.account_id = $2
  `;

  const result = await db.query(query, [folderId, accountId]);
  return result.rows[0] || null;
}

/**
 * Create a new folder
 * @param {Object} data - Folder data
 * @returns {Promise<Object>} Created folder
 */
async function createFolder(data) {
  const {
    accountId,
    userId,
    name,
    color = 'gray',
    parentFolderId = null,
    folderType,
    displayOrder = 0
  } = data;

  // Validate folder type
  if (!['agents', 'followup'].includes(folderType)) {
    throw new Error('Invalid folder type. Must be "agents" or "followup"');
  }

  // If parent folder specified, verify it exists and belongs to same account/type
  if (parentFolderId) {
    const parentCheck = await db.query(
      `SELECT id FROM folders WHERE id = $1 AND account_id = $2 AND folder_type = $3`,
      [parentFolderId, accountId, folderType]
    );
    if (parentCheck.rows.length === 0) {
      throw new Error('Parent folder not found or invalid');
    }
  }

  const query = `
    INSERT INTO folders (
      account_id, name, color, parent_folder_id, folder_type, display_order, created_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7
    )
    RETURNING *
  `;

  const result = await db.query(query, [
    accountId,
    name,
    color,
    parentFolderId,
    folderType,
    displayOrder,
    userId
  ]);

  return result.rows[0];
}

/**
 * Update an existing folder
 * @param {string} folderId - Folder UUID
 * @param {string} accountId - Account ID for permission check
 * @param {Object} data - Update data
 * @returns {Promise<Object|null>} Updated folder or null
 */
async function updateFolder(folderId, accountId, data) {
  // First check ownership
  const checkQuery = `
    SELECT id, folder_type FROM folders
    WHERE id = $1 AND account_id = $2
  `;
  const checkResult = await db.query(checkQuery, [folderId, accountId]);

  if (checkResult.rows.length === 0) {
    return null; // Not found or not authorized
  }

  const folderType = checkResult.rows[0].folder_type;
  const updateFields = [];
  const params = [folderId];
  let paramIndex = 2;

  // Fields that can be updated
  if (data.name !== undefined) {
    updateFields.push(`name = $${paramIndex++}`);
    params.push(data.name);
  }

  if (data.color !== undefined) {
    updateFields.push(`color = $${paramIndex++}`);
    params.push(data.color);
  }

  if (data.displayOrder !== undefined) {
    updateFields.push(`display_order = $${paramIndex++}`);
    params.push(data.displayOrder);
  }

  if (data.parentFolderId !== undefined) {
    // Verify parent folder if not null
    if (data.parentFolderId !== null) {
      // Can't set self as parent
      if (data.parentFolderId === folderId) {
        throw new Error('Cannot set folder as its own parent');
      }
      const parentCheck = await db.query(
        `SELECT id FROM folders WHERE id = $1 AND account_id = $2 AND folder_type = $3`,
        [data.parentFolderId, accountId, folderType]
      );
      if (parentCheck.rows.length === 0) {
        throw new Error('Parent folder not found or invalid');
      }
      // Check for circular reference
      const isDescendant = await checkIsDescendant(data.parentFolderId, folderId, accountId);
      if (isDescendant) {
        throw new Error('Cannot move folder into its own descendant');
      }
    }
    updateFields.push(`parent_folder_id = $${paramIndex++}`);
    params.push(data.parentFolderId);
  }

  if (updateFields.length === 0) {
    return await getFolderById(folderId, accountId);
  }

  const query = `
    UPDATE folders
    SET ${updateFields.join(', ')}
    WHERE id = $1
    RETURNING *
  `;

  const result = await db.query(query, params);
  return result.rows[0];
}

/**
 * Check if a folder is a descendant of another folder
 * @param {string} potentialDescendantId - Potential descendant folder ID
 * @param {string} ancestorId - Potential ancestor folder ID
 * @param {string} accountId - Account ID
 * @returns {Promise<boolean>} True if descendant
 */
async function checkIsDescendant(potentialDescendantId, ancestorId, accountId) {
  // Recursively check parent chain
  const query = `
    WITH RECURSIVE folder_chain AS (
      SELECT id, parent_folder_id
      FROM folders
      WHERE id = $1 AND account_id = $3
      UNION ALL
      SELECT f.id, f.parent_folder_id
      FROM folders f
      INNER JOIN folder_chain fc ON f.id = fc.parent_folder_id
      WHERE f.account_id = $3
    )
    SELECT 1 FROM folder_chain WHERE id = $2 LIMIT 1
  `;

  const result = await db.query(query, [potentialDescendantId, ancestorId, accountId]);
  return result.rows.length > 0;
}

/**
 * Delete a folder
 * @param {string} folderId - Folder UUID
 * @param {string} accountId - Account ID for permission check
 * @returns {Promise<boolean>} Success
 */
async function deleteFolder(folderId, accountId) {
  // First, get folder info
  const folder = await getFolderById(folderId, accountId);
  if (!folder) {
    return false;
  }

  // Move items in this folder to no folder (null)
  if (folder.folder_type === 'agents') {
    await db.query(
      `UPDATE ai_agents SET folder_id = NULL WHERE folder_id = $1`,
      [folderId]
    );
  } else {
    await db.query(
      `UPDATE follow_up_flows SET folder_id = NULL WHERE folder_id = $1`,
      [folderId]
    );
  }

  // Move subfolders to parent folder (or root if no parent)
  await db.query(
    `UPDATE folders SET parent_folder_id = $1 WHERE parent_folder_id = $2`,
    [folder.parent_folder_id, folderId]
  );

  // Delete the folder
  const query = `
    DELETE FROM folders
    WHERE id = $1 AND account_id = $2
    RETURNING id
  `;

  const result = await db.query(query, [folderId, accountId]);
  return result.rows.length > 0;
}

/**
 * Move an agent to a folder
 * @param {number} agentId - Agent ID
 * @param {string|null} folderId - Target folder ID (null for no folder)
 * @param {string} accountId - Account ID
 * @returns {Promise<boolean>} Success
 */
async function moveAgentToFolder(agentId, folderId, accountId) {
  // Verify folder if specified
  if (folderId) {
    const folderCheck = await db.query(
      `SELECT id FROM folders WHERE id = $1 AND account_id = $2 AND folder_type = 'agents'`,
      [folderId, accountId]
    );
    if (folderCheck.rows.length === 0) {
      throw new Error('Folder not found or invalid');
    }
  }

  const result = await db.query(
    `UPDATE ai_agents SET folder_id = $1 WHERE id = $2 AND account_id = $3 RETURNING id`,
    [folderId, agentId, accountId]
  );

  return result.rows.length > 0;
}

/**
 * Move a follow-up flow to a folder
 * @param {string} flowId - Flow UUID
 * @param {string|null} folderId - Target folder ID (null for no folder)
 * @param {string} accountId - Account ID
 * @returns {Promise<boolean>} Success
 */
async function moveFlowToFolder(flowId, folderId, accountId) {
  // Verify folder if specified
  if (folderId) {
    const folderCheck = await db.query(
      `SELECT id FROM folders WHERE id = $1 AND account_id = $2 AND folder_type = 'followup'`,
      [folderId, accountId]
    );
    if (folderCheck.rows.length === 0) {
      throw new Error('Folder not found or invalid');
    }
  }

  const result = await db.query(
    `UPDATE follow_up_flows SET folder_id = $1 WHERE id = $2 AND account_id = $3 RETURNING id`,
    [folderId, flowId, accountId]
  );

  return result.rows.length > 0;
}

/**
 * Reorder folders
 * @param {string} accountId - Account ID
 * @param {Array} folderOrders - Array of { id, displayOrder }
 * @returns {Promise<void>}
 */
async function reorderFolders(accountId, folderOrders) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    for (const { id, displayOrder } of folderOrders) {
      await client.query(
        `UPDATE folders SET display_order = $1 WHERE id = $2 AND account_id = $3`,
        [displayOrder, id, accountId]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getFolders,
  getFoldersTree,
  getFolderById,
  createFolder,
  updateFolder,
  deleteFolder,
  moveAgentToFolder,
  moveFlowToFolder,
  reorderFolders
};
