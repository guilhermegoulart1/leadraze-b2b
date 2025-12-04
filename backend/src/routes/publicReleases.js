// backend/src/routes/publicReleases.js
// Public endpoint for releases (no auth required) - used by developer docs

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4321',
  'https://getraze.co',
  'https://www.getraze.co',
  'https://developer.getraze.co'
];

// Manual CORS middleware for this route
router.use((req, res, next) => {
  // Temporarily allow all origins to debug
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  console.log('📡 Public releases CORS - Origin:', req.headers.origin, 'Method:', req.method);

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

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
