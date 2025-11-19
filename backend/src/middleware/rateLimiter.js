// backend/src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 200 : 1000, // Dev: 1000, Prod: 200 requests per window
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
  max: 60, // ✅ Aumentado para 60 requests/minuto (suporta polling de múltiplas campanhas)
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