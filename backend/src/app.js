// backend/src/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const passport = require('./config/passport');
const i18next = require('./config/i18n');
const middleware = require('i18next-http-middleware');

const app = express();

// ================================
// MIDDLEWARES
// ================================

// Security - configurado para permitir recursos cross-origin
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false
}));

// CORS - allow frontend app and www site
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    process.env.WWW_URL || 'http://localhost:4321',
    'https://getraze.co',
    'https://www.getraze.co',
    'https://app.getraze.co',
    'https://developer.getraze.co'
  ],
  credentials: true
}));

// ✅ Stripe webhook - DEVE vir ANTES do express.json()
// Stripe requires raw body for signature verification
app.post('/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  require('./controllers/stripeWebhookController').handleWebhook
);
console.log('✅ Stripe webhook route loaded (raw body - before json parser)');

// ✅ Middleware especial para capturar raw body do webhook Unipile
// DEVE vir ANTES do express.json/urlencoded
app.use('/api/webhooks/unipile', express.raw({ type: '*/*', limit: '10mb' }), (req, res, next) => {
  try {
    if (req.body && Buffer.isBuffer(req.body)) {
      const rawBody = req.body.toString('utf8');
      console.log('📦 Raw body capturado:', rawBody);

      // Tentar parsear como JSON
      try {
        req.body = JSON.parse(rawBody);
        console.log('✅ Parseado como JSON');
      } catch (e) {
        // Se não for JSON puro, pode ser form-urlencoded
        // Tentar decodificar URL e parsear
        try {
          const decoded = decodeURIComponent(rawBody);
          req.body = JSON.parse(decoded);
          console.log('✅ Parseado como form-urlencoded + JSON');
        } catch (e2) {
          console.log('⚠️ Não foi possível parsear, passando raw body');
          req.body = { raw: rawBody };
        }
      }
    }
  } catch (error) {
    console.error('❌ Erro ao processar raw body:', error);
  }
  next();
});

// Body parsing (para outras rotas)
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

// i18next - Internationalization
app.use(middleware.handle(i18next));

// ================================
// HEALTH CHECK
// ================================

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'GetRaze API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'GetRaze API v1.0.0',
    endpoints: {
      auth: '/api/auth',
      profiles: '/api/profiles',
      campaigns: '/api/campaigns',
      leads: '/api/leads',
      contacts: '/api/contacts',
      conversations: '/api/conversations',
      analytics: '/api/analytics',
      users: '/api/users',
      permissions: '/api/permissions',
      sectors: '/api/sectors',
      googleMaps: '/api/google-maps',
      googleMapsAgents: '/api/google-maps-agents',
      contactLists: '/api/contact-lists',
      activationAgents: '/api/activation-agents',
      activationCampaigns: '/api/activation-campaigns'
    }
  });
});

// ================================
// WEBHOOK ROUTES (BEFORE AUTH)
// ================================

// Middleware especial para webhooks do Unipile - permitir CORS de qualquer origem
app.options('/api/webhooks/unipile', cors()); // Preflight
app.use('/api/webhooks/unipile', cors({
  origin: '*', // Permitir qualquer origem para webhooks
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Unipile-Signature']
}));

// Webhook do Unipile deve estar ANTES de qualquer autenticação
// para garantir que não seja bloqueado
try {
  app.use('/api/webhooks', require('./routes/webhooks'));
  console.log('✅ Webhook routes loaded (public)');
} catch (error) {
  console.error('❌ Error loading webhook routes:', error.message);
}

// ================================
// PUBLIC WEBSITE CHAT (NO AUTH REQUIRED)
// ================================
// CORS for website chat - allow requests from www site
app.use('/api/public/website-chat', cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    process.env.WWW_URL || 'http://localhost:4321',
    'https://getraze.co',
    'https://www.getraze.co'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

try {
  app.use('/api/public/website-chat', require('./routes/publicWebsiteChat'));
  console.log('✅ Public website chat routes loaded (no auth)');
} catch (error) {
  console.error('❌ Error loading public website chat routes:', error.message);
}

// Public releases for developer docs (no auth required)
// CORS is handled directly in the route file
try {
  app.use('/api/public/releases', require('./routes/publicReleases'));
  console.log('✅ Public releases routes loaded (no auth)');
} catch (error) {
  console.error('❌ Error loading public releases routes:', error.message);
}

// Public website leads capture (no auth required)
app.use('/api/public/website-leads', cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    process.env.WWW_URL || 'http://localhost:4321',
    'https://getraze.co',
    'https://www.getraze.co'
  ],
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

try {
  app.use('/api/public/website-leads', require('./routes/publicWebsiteLeads'));
  console.log('✅ Public website leads routes loaded (no auth)');
} catch (error) {
  console.error('❌ Error loading public website leads routes:', error.message);
}

// ================================
// ROUTES
// ================================

try {
  app.use('/api/auth', require('./routes/auth'));
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.error('❌ Error loading auth routes:', error.message);
}


// ================================
// BILLING ROUTES (MUST BE BEFORE KNOWLEDGE ROUTES)
// Knowledge routes are mounted at /api with authenticateToken,
// which would catch /api/billing/* if we don't register billing first
// Stripe webhook is registered before express.json() middleware at the top
// ================================
try {
  app.use('/api/billing', require('./routes/billing'));
  console.log('✅ Billing routes loaded');
} catch (error) {
  console.error('❌ Error loading billing routes:', error.message);
}

try {
  app.use('/api/affiliate', require('./routes/affiliates'));
  console.log('✅ Affiliate routes loaded');
} catch (error) {
  console.error('❌ Error loading affiliate routes:', error.message);
}

try {
  app.use('/api/partners', require('./routes/partners'));
  console.log('✅ Partners routes loaded');
} catch (error) {
  console.error('❌ Error loading partners routes:', error.message);
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
  app.use('/api/tags', require('./routes/tags'));
  console.log('✅ Tags routes loaded');
} catch (error) {
  console.error('❌ Error loading tags routes:', error.message);
}

try {
  app.use('/api/products', require('./routes/products'));
  console.log('✅ Products routes loaded');
} catch (error) {
  console.error('❌ Error loading products routes:', error.message);
}

try {
  app.use('/api/discard-reasons', require('./routes/discardReasons'));
  console.log('✅ Discard reasons routes loaded');
} catch (error) {
  console.error('❌ Error loading discard reasons routes:', error.message);
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
  app.use('/api/unipile', require('./routes/unipile'));
  console.log('✅ Unipile routes loaded');
} catch (error) {
  console.error('❌ Error loading Unipile routes:', error.message);
}

try {
  app.use('/api/users', require('./routes/users'));
  console.log('✅ User management routes loaded');
} catch (error) {
  console.error('❌ Error loading user routes:', error.message);
}

try {
  app.use('/api/email-settings', require('./routes/emailSettings'));
  console.log('✅ Email settings routes loaded');
} catch (error) {
  console.error('❌ Error loading email settings routes:', error.message);
}

try {
  app.use('/api/permissions', require('./routes/permissions'));
  console.log('✅ Permissions management routes loaded');
} catch (error) {
  console.error('❌ Error loading permissions routes:', error.message);
}

try {
  app.use('/api/sectors', require('./routes/sectors'));
  console.log('✅ Sectors management routes loaded');
} catch (error) {
  console.error('❌ Error loading sectors routes:', error.message);
}

try {
  app.use('/api/contacts', require('./routes/contacts'));
  console.log('✅ Contacts management routes loaded');
} catch (error) {
  console.error('❌ Error loading contacts routes:', error.message);
}

try {
  app.use('/api/google-maps', require('./routes/googleMaps'));
  console.log('✅ Google Maps search routes loaded');
} catch (error) {
  console.error('❌ Error loading Google Maps routes:', error.message);
}

try {
  app.use('/api/google-maps-agents', require('./routes/googleMapsAgents'));
  console.log('✅ Google Maps agents routes loaded');
} catch (error) {
  console.error('❌ Error loading Google Maps agents routes:', error.message);
}

// ================================
// LIST ACTIVATION ROUTES
// ================================

try {
  app.use('/api/contact-lists', require('./routes/contactLists'));
  console.log('✅ Contact lists routes loaded');
} catch (error) {
  console.error('❌ Error loading contact lists routes:', error.message);
}

try {
  app.use('/api/activation-agents', require('./routes/activationAgents'));
  console.log('✅ Activation agents routes loaded');
} catch (error) {
  console.error('❌ Error loading activation agents routes:', error.message);
}

try {
  app.use('/api/activation-campaigns', require('./routes/activationCampaigns'));
  console.log('✅ Activation campaigns routes loaded');
} catch (error) {
  console.error('❌ Error loading activation campaigns routes:', error.message);
}

// Connections (1st degree LinkedIn connections)
try {
  app.use('/api/connections', require('./routes/connections'));
  console.log('✅ Connections routes loaded');
} catch (error) {
  console.error('❌ Error loading connections routes:', error.message);
}

// Unified Agents (LinkedIn, Google Maps, Email, WhatsApp)
try {
  app.use('/api/agents', require('./routes/agents'));
  console.log('✅ Unified agents routes loaded');
} catch (error) {
  console.error('❌ Error loading unified agents routes:', error.message);
}

// Website Agents Admin (for managing sales/support chatbots)
try {
  app.use('/api/website-agents', require('./routes/websiteAgentsAdmin'));
  console.log('✅ Website agents admin routes loaded');
} catch (error) {
  console.error('❌ Error loading website agents admin routes:', error.message);
}

// Notifications (in-app notifications for users)
try {
  app.use('/api/notifications', require('./routes/notifications'));
  console.log('✅ Notifications routes loaded');
} catch (error) {
  console.error('❌ Error loading notifications routes:', error.message);
}

// Feedback & Roadmap (GetRaze Next)
try {
  app.use('/api/feedback', require('./routes/feedback'));
  console.log('✅ Feedback & Roadmap routes loaded');
} catch (error) {
  console.error('❌ Error loading feedback routes:', error.message);
}

// Releases / Changelog
try {
  app.use('/api/releases', require('./routes/releases'));
  console.log('✅ Releases routes loaded');
} catch (error) {
  console.error('❌ Error loading releases routes:', error.message);
}

// ================================
// API KEYS MANAGEMENT
// ================================

try {
  app.use('/api/api-keys', require('./routes/apiKeys'));
  console.log('✅ API Keys management routes loaded');
} catch (error) {
  console.error('❌ Error loading API Keys routes:', error.message);
}

// ================================
// TASKS & CHECKLIST TEMPLATES
// ================================

try {
  app.use('/api/tasks', require('./routes/tasks'));
  console.log('✅ Tasks routes loaded');
} catch (error) {
  console.error('❌ Error loading tasks routes:', error.message);
}

try {
  app.use('/api/checklist-templates', require('./routes/checklistTemplates'));
  console.log('✅ Checklist templates routes loaded');
} catch (error) {
  console.error('❌ Error loading checklist templates routes:', error.message);
}

try {
  app.use('/api/checklists', require('./routes/checklists'));
  console.log('✅ Checklists routes loaded');
} catch (error) {
  console.error('❌ Error loading checklists routes:', error.message);
}

try {
  app.use('/api/checklist-items', require('./routes/checklistItems'));
  console.log('✅ Checklist items routes loaded');
} catch (error) {
  console.error('❌ Error loading checklist items routes:', error.message);
}

try {
  app.use('/api/secret-agent', require('./routes/secretAgent'));
  console.log('✅ Secret Agent routes loaded');
} catch (error) {
  console.error('❌ Error loading secret agent routes:', error.message);
}

// AI Employees V2 (templates, smart interview, workflow builder)
try {
  app.use('/api/ai-employees', require('./routes/aiEmployees'));
  console.log('✅ AI Employees V2 routes loaded');
} catch (error) {
  console.error('❌ Error loading AI Employees routes:', error.message);
}

// Follow-Up Flows (for AI Employees follow-up automation)
try {
  app.use('/api/follow-up-flows', require('./routes/followUpFlows'));
  console.log('✅ Follow-Up Flows routes loaded');
} catch (error) {
  console.error('❌ Error loading Follow-Up Flows routes:', error.message);
}

// Companies (LinkedIn company data via Unipile)
try {
  app.use('/api/companies', require('./routes/companies'));
  console.log('✅ Companies routes loaded');
} catch (error) {
  console.error('❌ Error loading companies routes:', error.message);
}

// Posts (LinkedIn posts search via Unipile)
try {
  app.use('/api/posts', require('./routes/posts'));
  console.log('✅ Posts routes loaded');
} catch (error) {
  console.error('❌ Error loading posts routes:', error.message);
}

// Folders (for organizing AI Employees and Follow-up Flows)
try {
  app.use('/api/folders', require('./routes/folders'));
  console.log('✅ Folders routes loaded');
} catch (error) {
  console.error('❌ Error loading Folders routes:', error.message);
}

// ================================
// CRM PIPELINES
// ================================

// CRM Projects (for organizing pipelines)
try {
  app.use('/api/crm-projects', require('./routes/crm-projects'));
  console.log('✅ CRM Projects routes loaded');
} catch (error) {
  console.error('❌ Error loading CRM Projects routes:', error.message);
}

// Pipelines (customizable sales pipelines)
try {
  app.use('/api/pipelines', require('./routes/pipelines'));
  console.log('✅ Pipelines routes loaded');
} catch (error) {
  console.error('❌ Error loading Pipelines routes:', error.message);
}

// Opportunities (deals in pipelines)
try {
  app.use('/api/opportunities', require('./routes/opportunities'));
  console.log('✅ Opportunities routes loaded');
} catch (error) {
  console.error('❌ Error loading Opportunities routes:', error.message);
}

// ================================
// EXTERNAL API ROUTES (API Key Authentication)
// ================================

try {
  app.use('/external/v1', require('./routes/external'));
  console.log('✅ External API routes loaded');
} catch (error) {
  console.error('❌ Error loading external API routes:', error.message);
}

// ================================
// BULL BOARD (Queue Monitoring Dashboard)
// ================================

try {
  const { createBullBoard } = require('@bull-board/api');
  const { BullAdapter } = require('@bull-board/api/bullAdapter');
  const { ExpressAdapter } = require('@bull-board/express');
  const { webhookQueue, campaignQueue, bulkCollectionQueue, conversationSyncQueue, googleMapsAgentQueue, emailQueue, billingQueue, linkedinInviteQueue, connectionMessageQueue, delayedConversationQueue, secretAgentQueue } = require('./queues');

  // Create Express adapter for Bull Board
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  // Create Bull Board with all queues
  createBullBoard({
    queues: [
      new BullAdapter(webhookQueue),
      new BullAdapter(campaignQueue),
      new BullAdapter(bulkCollectionQueue),
      new BullAdapter(conversationSyncQueue),
      new BullAdapter(googleMapsAgentQueue),
      new BullAdapter(emailQueue),
      new BullAdapter(billingQueue),
      new BullAdapter(linkedinInviteQueue),
      new BullAdapter(connectionMessageQueue),
      new BullAdapter(delayedConversationQueue),
      new BullAdapter(secretAgentQueue)
    ],
    serverAdapter
  });

  // Mount Bull Board (without auth for now - add authenticate middleware later)
  // TODO: Add authentication: app.use('/admin/queues', authenticate, serverAdapter.getRouter());
  app.use('/admin/queues', serverAdapter.getRouter());

  console.log('✅ Bull Board dashboard loaded at /admin/queues');
  console.log('   Monitoring queues: webhooks, campaigns, bulk-collection, conversation-sync, google-maps-agents, emails, billing, linkedin-invites, delayed-conversation');
  console.log('   ⚠️  Dashboard is currently public - add authentication in production');
} catch (error) {
  console.error('❌ Error loading Bull Board:', error.message);
  console.error('   Queue monitoring dashboard will not be available');
}

// ================================
// WORKERS INITIALIZATION
// ================================
console.log('🔧 Initializing workers...');

try {
  // Import workers to start processing jobs
  require('./workers/webhookWorker');
  require('./workers/linkedinInviteWorker');
  require('./workers/delayedConversationWorker');

  console.log('✅ Workers initialized successfully');
  console.log('   - Webhook Worker: processing incoming webhooks from Unipile');
  console.log('   - LinkedIn Invite Worker: processing invite sending');
  console.log('   - Delayed Conversation Worker: processing automated conversation starters');
} catch (workerError) {
  console.error('❌ Error initializing workers:', workerError.message);
  console.error('   Some background jobs may not process correctly');
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