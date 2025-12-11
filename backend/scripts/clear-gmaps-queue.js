// Script to clear Bull queue jobs from Redis
// Usage: node scripts/clear-gmaps-queue.js [queue-name]
// Examples:
//   node scripts/clear-gmaps-queue.js                    # Clear all queues
//   node scripts/clear-gmaps-queue.js google-maps-agents # Clear specific queue
//   node scripts/clear-gmaps-queue.js linkedin-invites   # Clear LinkedIn invites

require('dotenv').config();

const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
console.log('Connecting to Redis:', redisUrl.replace(/:[^:@]+@/, ':****@'));

const redis = new Redis(redisUrl);

// All queues that can be cleared
const ALL_QUEUES = [
  'google-maps-agents',
  'linkedin-invites',
  'connection-messages',
  'delayed-conversation',
  'campaigns',
  'bulk-collection'
];

async function clearQueue(queueName) {
  console.log(`\n🗑️  Limpando fila: ${queueName}...\n`);

  try {
    const keys = await redis.keys(`bull:${queueName}:*`);
    console.log(`📊 Found ${keys.length} keys`);

    if (keys.length > 0) {
      for (const key of keys) {
        await redis.del(key);
        console.log(`   Deleted: ${key}`);
      }
    }

    return keys.length;
  } catch (error) {
    console.error(`❌ Error clearing ${queueName}:`, error.message);
    return 0;
  }
}

async function main() {
  const specificQueue = process.argv[2];

  try {
    if (specificQueue) {
      // Clear specific queue
      if (!ALL_QUEUES.includes(specificQueue)) {
        console.log(`⚠️  Queue '${specificQueue}' not recognized.`);
        console.log(`   Available queues: ${ALL_QUEUES.join(', ')}`);
        process.exit(1);
      }

      const deleted = await clearQueue(specificQueue);
      console.log(`\n✅ Fila ${specificQueue} limpa! (${deleted} keys removidas)`);
    } else {
      // Clear all queues
      console.log('\n🧹 Limpando TODAS as filas...\n');

      let totalDeleted = 0;
      for (const queue of ALL_QUEUES) {
        const deleted = await clearQueue(queue);
        totalDeleted += deleted;
      }

      console.log(`\n✅ Todas as filas limpas! (${totalDeleted} keys removidas no total)`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    redis.disconnect();
    process.exit(0);
  }
}

main();
