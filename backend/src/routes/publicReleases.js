// backend/src/routes/publicReleases.js
// Public endpoint for releases (no auth required) - used by developer docs

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');

// GET /api/public/releases - List all releases (public)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        id,
        version,
        title,
        content,
        published_at,
        created_at
      FROM releases
      ORDER BY published_at DESC
    `);

    sendSuccess(res, result.rows);
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;
