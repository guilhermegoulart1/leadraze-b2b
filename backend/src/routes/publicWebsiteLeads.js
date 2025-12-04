// backend/src/routes/publicWebsiteLeads.js
const express = require('express');
const router = express.Router();
const { captureLead } = require('../controllers/websiteLeadsController');

/**
 * @route POST /api/public/website-leads/capture
 * @desc Capture a lead from website (email capture form)
 * @access Public
 */
router.post('/capture', captureLead);

module.exports = router;
