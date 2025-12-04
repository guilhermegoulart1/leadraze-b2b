// backend/src/routes/releases.js

const express = require('express');
const router = express.Router();
const releasesController = require('../controllers/releasesController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET /api/releases - List all releases
router.get('/', releasesController.getReleases);

// GET /api/releases/:id - Get single release
router.get('/:id', releasesController.getReleaseById);

// POST /api/releases - Create release (admin only)
router.post('/', releasesController.createRelease);

// PUT /api/releases/:id - Update release (admin only)
router.put('/:id', releasesController.updateRelease);

// DELETE /api/releases/:id - Delete release (admin only)
router.delete('/:id', releasesController.deleteRelease);

module.exports = router;
