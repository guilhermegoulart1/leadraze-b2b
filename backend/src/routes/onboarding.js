const express = require('express');
const router = express.Router();
const onboardingController = require('../controllers/onboardingController');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

// All routes require authentication
router.use(authenticateToken);

// Client routes
router.get('/', onboardingController.getOnboarding);
router.post('/', onboardingController.createOnboarding);
router.put('/:id', onboardingController.updateOnboarding);

// Admin routes
router.get('/admin', checkPermission('admin'), onboardingController.getOnboardingsAdmin);
router.get('/admin/:id', checkPermission('admin'), onboardingController.getOnboardingById);
router.get('/admin/:id/export/csv', checkPermission('admin'), onboardingController.exportOnboardingCSV);
router.put('/admin/:id/review', checkPermission('admin'), onboardingController.markAsReviewed);

module.exports = router;
