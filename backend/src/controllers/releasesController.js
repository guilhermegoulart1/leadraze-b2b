// backend/src/controllers/releasesController.js
// Changelog / Releases system (like GitHub releases)

const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { NotFoundError, ValidationError, ForbiddenError } = require('../utils/errors');

/**
 * GET /api/releases
 * List all releases (public, ordered by published_at DESC)
 */
const getReleases = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        r.*,
        u.name as author_name
      FROM releases r
      LEFT JOIN users u ON u.id = r.created_by
      ORDER BY r.published_at DESC
    `);

    sendSuccess(res, result.rows);
  } catch (error) {
    sendError(res, error);
  }
};

/**
 * GET /api/releases/:id
 * Get a single release
 */
const getReleaseById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT
        r.*,
        u.name as author_name
      FROM releases r
      LEFT JOIN users u ON u.id = r.created_by
      WHERE r.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Release not found');
    }

    sendSuccess(res, result.rows[0]);
  } catch (error) {
    sendError(res, error);
  }
};

/**
 * POST /api/releases
 * Create a new release (admin only)
 */
const createRelease = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { version, title, content, published_at } = req.body;

    if (userRole !== 'admin') {
      throw new ForbiddenError('Only admins can create releases');
    }

    if (!version || version.trim().length === 0) {
      throw new ValidationError('Version is required');
    }

    if (!content || content.trim().length === 0) {
      throw new ValidationError('Content is required');
    }

    const release = await db.insert('releases', {
      version: version.trim(),
      title: title?.trim() || null,
      content: content.trim(),
      published_at: published_at || new Date(),
      created_by: userId
    });

    sendSuccess(res, release, 'Release created successfully', 201);
  } catch (error) {
    sendError(res, error);
  }
};

/**
 * PUT /api/releases/:id
 * Update a release (admin only)
 */
const updateRelease = async (req, res) => {
  try {
    const userRole = req.user.role;
    const { id } = req.params;
    const { version, title, content, published_at } = req.body;

    if (userRole !== 'admin') {
      throw new ForbiddenError('Only admins can update releases');
    }

    // Check if release exists
    const releaseCheck = await db.query(
      'SELECT * FROM releases WHERE id = $1',
      [id]
    );

    if (releaseCheck.rows.length === 0) {
      throw new NotFoundError('Release not found');
    }

    const updateData = {};

    if (version !== undefined) {
      if (version.trim().length === 0) {
        throw new ValidationError('Version is required');
      }
      updateData.version = version.trim();
    }

    if (title !== undefined) {
      updateData.title = title?.trim() || null;
    }

    if (content !== undefined) {
      if (content.trim().length === 0) {
        throw new ValidationError('Content is required');
      }
      updateData.content = content.trim();
    }

    if (published_at !== undefined) {
      updateData.published_at = published_at;
    }

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No changes provided');
    }

    updateData.updated_at = new Date();

    const updated = await db.update('releases', updateData, { id });

    sendSuccess(res, updated, 'Release updated successfully');
  } catch (error) {
    sendError(res, error);
  }
};

/**
 * DELETE /api/releases/:id
 * Delete a release (admin only)
 */
const deleteRelease = async (req, res) => {
  try {
    const userRole = req.user.role;
    const { id } = req.params;

    if (userRole !== 'admin') {
      throw new ForbiddenError('Only admins can delete releases');
    }

    const releaseCheck = await db.query(
      'SELECT * FROM releases WHERE id = $1',
      [id]
    );

    if (releaseCheck.rows.length === 0) {
      throw new NotFoundError('Release not found');
    }

    await db.delete('releases', { id });

    sendSuccess(res, null, 'Release deleted successfully');
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  getReleases,
  getReleaseById,
  createRelease,
  updateRelease,
  deleteRelease
};
