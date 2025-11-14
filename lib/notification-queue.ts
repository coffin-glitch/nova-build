import 'dotenv/config';
import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import Redis from 'ioredis';

// Redis connection configuration
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
if (!process.env.REDIS_URL) {
  console.warn('⚠️  REDIS_URL not set, defaulting to localhost. Set REDIS_URL in .env.local');
}

const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

// Log Redis connection status
redisConnection.on('connect', () => {
  console.log('✅ Redis connection established');
});

redisConnection.on('ready', () => {
  console.log('✅ Redis connection ready');
});

redisConnection.on('error', (error) => {
  console.error('❌ Redis connection error:', error);
});

redisConnection.on('close', () => {
  console.log('⚠️  Redis connection closed');
});

// Create queues for different notification priorities
export const notificationQueue = new Queue('notifications', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 24 * 3600, // Keep failed jobs for 24 hours
    },
  },
});

export const urgentNotificationQueue = new Queue('urgent-notifications', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    priority: 10, // Higher priority
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 24 * 3600,
    },
  },
});

// Queue events for monitoring
export const queueEvents = new QueueEvents('notifications', {
  connection: redisConnection,
});

// Worker configuration
export const createNotificationWorker = (processJob: (job: Job) => Promise<void>) => {
  return new Worker(
    'notifications',
    async (job: Job) => {
      console.log(`Processing notification job ${job.id} for user ${job.data.userId}`);
      await processJob(job);
    },
    {
      connection: redisConnection,
      concurrency: Number(process.env.NOTIFICATION_WORKER_CONCURRENCY || 10), // Process 10 jobs concurrently
      limiter: {
        max: Number(process.env.NOTIFICATION_RATE_LIMIT || 100), // Max 100 jobs per second
        duration: 1000,
      },
    }
  );
};

export const createUrgentNotificationWorker = (processJob: (job: Job) => Promise<void>) => {
  return new Worker(
    'urgent-notifications',
    async (job: Job) => {
      console.log(`Processing urgent notification job ${job.id} for user ${job.data.userId}`);
      await processJob(job);
    },
    {
      connection: redisConnection,
      concurrency: Number(process.env.URGENT_WORKER_CONCURRENCY || 5),
      limiter: {
        max: Number(process.env.URGENT_RATE_LIMIT || 50),
        duration: 1000,
      },
    }
  );
};

// Helper function to get queue stats
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    notificationQueue.getWaitingCount(),
    notificationQueue.getActiveCount(),
    notificationQueue.getCompletedCount(),
    notificationQueue.getFailedCount(),
    notificationQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}

// Helper function to clean up queues
export async function closeQueues() {
  await Promise.all([
    notificationQueue.close(),
    urgentNotificationQueue.close(),
    queueEvents.close(),
    redisConnection.quit(),
  ]);
}

// Export Redis connection for caching
export { redisConnection };

