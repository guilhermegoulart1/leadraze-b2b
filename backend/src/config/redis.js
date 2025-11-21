const Redis = require('ioredis');

/**
 * Redis Configuration for Bull Queues
 *
 * Connects to Redis instance on Railway
 */

// Redis configuration for ioredis
const redisUrl = process.env.REDIS_URL;

const redisConfig = redisUrl
  ? {
      // Parse Railway Redis URL (proxy handles TLS)
      ...parseRedisUrl(redisUrl),

      // Bull requires these settings
      maxRetriesPerRequest: null,
      enableReadyCheck: false,

      // Retry strategy for connection failures
      retryStrategy: (times) => {
        if (times > 10) {
          console.error(`Redis connection failed after ${times} attempts`);
          return null;
        }
        const delay = Math.min(times * 50, 2000);
        console.log(`Redis connection retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },

      // Connection timeouts
      connectTimeout: 10000,
      keepAlive: 30000
    }
  : {
      // Local Redis fallback
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,

      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    };

/**
 * Parse Redis URL to extract connection details
 */
function parseRedisUrl(urlString) {
  const url = new URL(urlString);
  return {
    host: url.hostname,
    port: parseInt(url.port) || 6379,
    username: url.username || undefined,
    password: url.password || undefined
  };
}

/**
 * Create Redis client for testing connection
 */
function createRedisClient() {
  return new Redis(redisConfig);
}

/**
 * Test Redis connection
 */
async function testRedisConnection() {
  const client = createRedisClient();

  try {
    await client.ping();
    console.log('✅ Redis connection successful');

    // Get Redis info
    const info = await client.info('server');
    const version = info.match(/redis_version:([^\r\n]+)/)?.[1];
    console.log(`📦 Redis version: ${version}`);

    await client.quit();
    return true;
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    await client.quit();
    return false;
  }
}

module.exports = {
  redisConfig,
  createRedisClient,
  testRedisConnection
};
