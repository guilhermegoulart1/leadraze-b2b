const Bull = require('bull');

/**
 * Bull Queue Definitions
 *
 * All application queues are defined here for centralized management
 */

// Redis connection configuration for Bull
// Bull accepts either a URL string or a connection object
const redisUrl = process.env.REDIS_URL;

// Connection options required by Bull
const redisOptions = {
  maxRetriesPerRequest: null, // Required for Bull
  enableReadyCheck: false,     // Required for Bull

  // Limit connection attempts
  retryStrategy: (times) => {
    if (times > 10) {
      console.error('❌ Redis: Maximum retry attempts reached');
      return null; // Stop retrying
    }
    const delay = Math.min(times * 100, 2000);
    return delay;
  },

  // Connection timeouts
  connectTimeout: 10000,
  lazyConnect: false
};

// Parse Redis URL to extract connection details
function parseRedisUrl(urlString) {
  const url = new URL(urlString);
  return {
    host: url.hostname,
    port: parseInt(url.port) || 6379,
    username: url.username || undefined,
    password: url.password || undefined
  };
}

// Create connection config - SIMPLIFIED for Bull compatibility
let bullRedisConfig;

if (redisUrl) {
  console.log('🔧 Redis connection: Using Railway URL');
  // Parse URL and create connection object
  const connectionInfo = parseRedisUrl(redisUrl);
  bullRedisConfig = {
    host: connectionInfo.host,
    port: connectionInfo.port,
    password: connectionInfo.password,
    // Only include essential Bull-compatible options
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  };
} else {
  console.log('🔧 Redis connection: Using localhost fallback');
  bullRedisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  };
}

/**
 * Webhook Queue - High Priority
 *
 * Processes incoming webhooks from Unipile (LinkedIn, WhatsApp)
 * - Fast processing required (< 100ms response to Unipile)
 * - Jobs added: when webhook received
 * - Jobs processed: immediately in background
 */
const webhookQueue = new Bull('webhooks', {
  redis: bullRedisConfig, // Simplified Redis config for Bull compatibility
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000 // 2s, 4s, 8s
    },
    removeOnComplete: {
      age: 24 * 3600, // 24 hours
      count: 1000 // keep max 1000 completed
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // 7 days
      count: 5000 // keep max 5000 failed for debugging
    }
  },
  settings: {
    stalledInterval: 30000, // Check for stalled jobs every 30s
    maxStalledCount: 2, // Retry stalled jobs max 2 times
    lockDuration: 30000 // Hold job lock for 30s
  }
});

/**
 * Campaign Queue - Medium Priority
 *
 * Processes campaign message sending
 * - Rate limited per LinkedIn account (50 msgs/day)
 * - Jobs added: when campaign started
 * - Jobs processed: with rate limiting
 */
const campaignQueue = new Bull('campaigns', {
  redis: bullRedisConfig, // Simplified Redis config for Bull compatibility
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 500
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
      count: 2000
    }
  },
  limiter: {
    max: 50, // Max 50 jobs
    duration: 24 * 60 * 60 * 1000, // per 24 hours
    groupKey: 'linkedinAccountId' // per LinkedIn account
  },
  settings: {
    stalledInterval: 60000,
    maxStalledCount: 2
  }
});

/**
 * Bulk Collection Queue - Low Priority
 *
 * Processes bulk lead collection from LinkedIn
 * - Long-running jobs (minutes to hours)
 * - Jobs added: when bulk collection started
 * - Jobs processed: with progress tracking
 */
const bulkCollectionQueue = new Bull('bulk-collection', {
  redis: bullRedisConfig, // Simplified Redis config for Bull compatibility
  defaultJobOptions: {
    attempts: 2,
    timeout: 3600000, // 1 hour max
    backoff: {
      type: 'exponential',
      delay: 10000
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 500
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
      count: 2000
    }
  },
  settings: {
    stalledInterval: 120000, // 2 minutes
    maxStalledCount: 1
  }
});

/**
 * Conversation Sync Queue - Low Priority
 *
 * Background sync of conversations from Unipile
 * - Backup/fallback for webhooks
 * - Jobs added: recurring (every 10-15 minutes)
 * - Jobs processed: in batches
 */
const conversationSyncQueue = new Bull('conversation-sync', {
  redis: bullRedisConfig, // Simplified Redis config for Bull compatibility
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 1000
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
      count: 5000
    }
  },
  settings: {
    stalledInterval: 60000,
    maxStalledCount: 2
  }
});

/**
 * Google Maps Agent Queue - Automated Lead Collection
 *
 * Processes Google Maps agents - fetches 20 leads/day automatically
 * - Jobs added: when agent created
 * - Jobs processed: immediately + repeat every 24h
 * - Auto-stops: when all results fetched
 */
const googleMapsAgentQueue = new Bull('google-maps-agents', {
  redis: bullRedisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: {
      age: 7 * 24 * 3600, // Keep for 7 days
      count: 500
    },
    removeOnFail: {
      age: 30 * 24 * 3600, // Keep failed for 30 days
      count: 1000
    }
  },
  settings: {
    stalledInterval: 60000,
    maxStalledCount: 2,
    lockDuration: 120000 // 2 minutes - API calls can take time
  }
});

/**
 * Global error handler for all queues
 */
const queues = [webhookQueue, campaignQueue, bulkCollectionQueue, conversationSyncQueue, googleMapsAgentQueue];

queues.forEach((queue) => {
  queue.on('error', (error) => {
    console.error(`[${queue.name}] Queue error:`, error.message);
  });

  queue.on('waiting', (jobId) => {
    console.log(`[${queue.name}] Job ${jobId} is waiting`);
  });

  queue.on('active', (job) => {
    console.log(`[${queue.name}] Job ${job.id} started processing`);
  });

  queue.on('stalled', (job) => {
    console.warn(`[${queue.name}] Job ${job.id} has stalled`);
  });
});

/**
 * Graceful shutdown for all queues
 */
async function closeAllQueues() {
  console.log('Closing all queues...');

  await Promise.all(queues.map(async (queue) => {
    await queue.close();
    console.log(`✅ ${queue.name} queue closed`);
  }));

  console.log('✅ All queues closed successfully');
}

module.exports = {
  webhookQueue,
  campaignQueue,
  bulkCollectionQueue,
  conversationSyncQueue,
  googleMapsAgentQueue,
  closeAllQueues
};
