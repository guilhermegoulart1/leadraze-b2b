// backend/src/server.js
require('dotenv').config();
const app = require('./app');
const db = require('./config/database');
const { testRedisConnection } = require('./config/redis');
const { closeAllQueues } = require('./queues');
const bulkCollectionProcessor = require('./services/bulkCollectionProcessor');
const conversationSyncWorker = require('./workers/conversationSyncWorker');

// ✅ Import webhook worker to register job processors
require('./workers/webhookWorker');

// ✅ Import email worker to process email queue
require('./workers/emailWorker');

// ✅ Import Google Maps Agent processor
const { registerGoogleMapsAgentProcessor } = require('./queues/processors/googleMapsAgentProcessor');

const PORT = process.env.PORT || 3001;

// Test database connection before starting server
async function startServer() {
  try {
    console.log('🔄 Starting LeadRaze API Server...\n');

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

    // Start server
    app.listen(PORT, () => {
      console.log('\n🚀 ========================================');
      console.log(`   LeadRaze API Server`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Port: ${PORT}`);
      console.log(`   API: http://localhost:${PORT}/api`);
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log(`   Bull Board: http://localhost:${PORT}/admin/queues`);
      console.log('========================================');
      console.log('\n📊 Queue Status:');
      console.log('   - webhooks: ✅ Active (real-time processing)');
      console.log('   - google-maps-agents: ✅ Active (automated lead collection)');
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
  // conversationSyncWorker.stop(); // Disabled - using webhooks
  await closeAllQueues();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('👋 SIGINT received. Shutting down gracefully...');
  // conversationSyncWorker.stop(); // Disabled - using webhooks
  await closeAllQueues();
  process.exit(0);
});

startServer();
