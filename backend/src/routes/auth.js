// backend/src/routes/auth.js
const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// ================================
// PUBLIC ROUTES
// ================================

// Register
router.post('/register', authLimiter, authController.register);

// Login
router.post('/login', authLimiter, authController.login);

// Password Reset
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.get('/validate-reset-token', authController.validateResetToken);
router.post('/reset-password', authController.resetPassword);

// Google OAuth
router.get('/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false 
  })
);

router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: `${process.env.FRONTEND_URL}/auth/error`,
    session: false 
  }),
  authController.googleCallback
);

// ================================
// PROTECTED ROUTES
// ================================

// Get profile
router.get('/profile', authenticateToken, authController.getProfile);

// Update profile
router.put('/profile', authenticateToken, authController.updateProfile);

module.exports = router;