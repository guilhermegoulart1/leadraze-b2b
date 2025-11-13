// backend/src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per IP per window
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 login attempts per IP per window
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const campaignLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // max 30 campaign requests per minute
  message: {
    success: false,
    message: 'Too many campaign requests, please slow down.'
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  campaignLimiter
};