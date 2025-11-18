// backend/src/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const passport = require('./config/passport');

const app = express();

// ================================
// MIDDLEWARES
// ================================

// Security
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Session for Google OAuth
app.use(session({
  secret: process.env.JWT_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// ================================
// HEALTH CHECK
// ================================

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'LeadRaze API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'LeadRaze API v1.0.0',
    endpoints: {
      auth: '/api/auth',
      profiles: '/api/profiles',
      campaigns: '/api/campaigns',
      leads: '/api/leads',
      conversations: '/api/conversations',
      analytics: '/api/analytics'
    }
  });
});

// ================================
// ROUTES
// ================================

try {
  app.use('/api/auth', require('./routes/auth'));
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.error('❌ Error loading auth routes:', error.message);
}

try {
  app.use('/api/profiles', require('./routes/profiles'));
  console.log('✅ Profile routes loaded');
} catch (error) {
  console.error('❌ Error loading profile routes:', error.message);
}

try {
  app.use('/api/campaigns', require('./routes/campaigns'));
  console.log('✅ Campaign routes loaded');
} catch (error) {
  console.error('❌ Error loading campaign routes:', error.message);
}

try {
  app.use('/api/leads', require('./routes/leads'));
  console.log('✅ Lead routes loaded');
} catch (error) {
  console.error('❌ Error loading lead routes:', error.message);
}

try {
  app.use('/api/conversations', require('./routes/conversations'));
  console.log('✅ Conversation routes loaded');
} catch (error) {
  console.error('❌ Error loading conversation routes:', error.message);
}

try {
  app.use('/api/ai-agents', require('./routes/aiAgents'));
  console.log('✅ AI Agent routes loaded');
} catch (error) {
  console.error('❌ Error loading AI Agent routes:', error.message);
}

try {
  app.use('/api', require('./routes/knowledge'));
  console.log('✅ Knowledge Base routes loaded');
} catch (error) {
  console.error('❌ Error loading Knowledge Base routes:', error.message);
}

try {
  app.use('/api/analytics', require('./routes/analytics'));
  console.log('✅ Analytics routes loaded');
} catch (error) {
  console.error('❌ Error loading analytics routes:', error.message);
}

try {
  app.use('/api/webhooks', require('./routes/webhooks'));
  console.log('✅ Webhook routes loaded');
} catch (error) {
  console.error('❌ Error loading webhook routes:', error.message);
}

try {
  app.use('/api/unipile', require('./routes/unipile'));
  console.log('✅ Unipile routes loaded');
} catch (error) {
  console.error('❌ Error loading Unipile routes:', error.message);
}

// ================================
// ERROR HANDLERS
// ================================

// 404 Not Found
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('💥 Global Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal server error'
    : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;