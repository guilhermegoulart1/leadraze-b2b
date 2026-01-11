// backend/src/server.js
require('dotenv').config();
const http = require('http');
const app = require('./app');
const db = require('./config/database');
const { testRedisConnection } = require('./config/redis');
const { closeAllQueues } = require('./queues');
const bulkCollectionProcessor = require('./services/bulkCollectionProcessor');
const conversationSyncWorker = require('./workers/conversationSyncWorker');
const { initializeAbly, cleanup: cleanupAbly } = require('./services/ablyService');

// ✅ Import webhook worker to register job processors
require('./workers/webhookWorker');

// ✅ Import email worker to process email queue
require('./workers/emailWorker');

// ✅ Import Google Maps Agent processor
const { registerGoogleMapsAgentProcessor } = require('./queues/processors/googleMapsAgentProcessor');

// ✅ Import Invite Expiration Worker
const inviteExpirationWorker = require('./workers/inviteExpirationWorker');

// ✅ Import Invite Send Worker (processes scheduled invites)
const inviteSendWorker = require('./workers/inviteSendWorker');

// ✅ Import Invitation Polling Worker (polls for received invitations every 4h)
const invitationPollingWorker = require('./workers/invitationPollingWorker');

const PORT = process.env.PORT || 3001;

// Create HTTP server
const server = http.createServer(app);

// Test database connection before starting server
async function startServer() {
  try {
    console.log('🔄 Starting GetRaze API Server...\n');

    // Test database connection
    await db.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected');

    // ✅ Test Redis connection
    const redisOk = await testRedisConnection();
    if (!redisOk) {
      console.warn('⚠️  Redis connection failed - queues will not work');
      console.warn('    Make sure REDIS_URL is configured in .env');
    }

    // Start legacy workers (will be migrated to Bull in later phases)
    bulkCollectionProcessor.startProcessor();
    console.log('✅ Bulk collection processor started (legacy)');

    // ⚠️ Conversation sync disabled - webhooks handle real-time sync
    // conversationSyncWorker.start();
    // console.log('✅ Conversation sync worker started (legacy)');
    console.log('⚠️  Conversation sync disabled - using webhooks for real-time sync');

    console.log('✅ Webhook worker registered (Bull queue)');

    // Register Google Maps Agent processor
    registerGoogleMapsAgentProcessor();

    // ✅ Start Invite Expiration Worker
    inviteExpirationWorker.startProcessor();
    console.log('✅ Invite expiration worker started (cron job)');

    // ✅ Start Invite Send Worker
    inviteSendWorker.startProcessor();
    console.log('✅ Invite send worker started (processes scheduled invites every 2 min)');

    // ✅ Start Invitation Polling Worker
    invitationPollingWorker.startProcessor();
    console.log('✅ Invitation polling worker started (polls for received invitations every 4h)');

    // ✅ Initialize Ably for realtime
    initializeAbly();

    // Start server
    server.listen(PORT, () => {
      console.log('\n🚀 ========================================');
      console.log(`   GetRaze API Server`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Port: ${PORT}`);
      console.log(`   API: http://localhost:${PORT}/api`);
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log(`   Realtime: Ably`);
      console.log(`   Bull Board: http://localhost:${PORT}/admin/queues`);
      console.log('========================================');
      console.log('\n📊 Queue Status:');
      console.log('   - webhooks: ✅ Active (real-time processing)');
      console.log('   - google-maps-agents: ✅ Active (automated lead collection)');
      console.log('   - invite-send: ✅ Active (every 2 min)');
      console.log('   - invite-expiration: ✅ Active (hourly cron job)');
      console.log('   - campaigns: Ready (Phase 2)');
      console.log('   - bulk-collection: Ready (Phase 3)');
      console.log('   - conversation-sync: Disabled (webhooks handle sync)');
      console.log('========================================\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error('💡 Make sure:');
    console.error('   1. PostgreSQL is running');
    console.error('   2. Database exists');
    console.error('   3. .env file is configured (including REDIS_URL)');
    console.error('   4. Run: npm run migrate');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  await cleanupAbly();
  await closeAllQueues();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('👋 SIGINT received. Shutting down gracefully...');
  await cleanupAbly();
  await closeAllQueues();
  process.exit(0);
});

startServer();
