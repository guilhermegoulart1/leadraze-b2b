// backend/src/server.js
require('dotenv').config();
const app = require('./app');
const db = require('./config/database');
const bulkCollectionProcessor = require('./services/bulkCollectionProcessor');
const conversationSyncWorker = require('./workers/conversationSyncWorker');

const PORT = process.env.PORT || 3001;

// Test database connection before starting server
async function startServer() {
  try {
    // Test database connection
    await db.query('SELECT NOW()');
    console.log('✅ Database connected successfully');

    // Start bulk collection processor
    bulkCollectionProcessor.startProcessor();
    console.log('✅ Bulk collection processor started');

    // Start conversation sync worker
    conversationSyncWorker.start();
    console.log('✅ Conversation sync worker started');

    // Start server
    app.listen(PORT, () => {
      console.log('\n🚀 ========================================');
      console.log(`   LeadRaze API Server`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Port: ${PORT}`);
      console.log(`   API: http://localhost:${PORT}/api`);
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log('========================================\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error('💡 Make sure:');
    console.error('   1. PostgreSQL is running');
    console.error('   2. Database exists');
    console.error('   3. .env file is configured');
    console.error('   4. Run: npm run migrate');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  conversationSyncWorker.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received. Shutting down gracefully...');
  conversationSyncWorker.stop();
  process.exit(0);
});

startServer();
 
