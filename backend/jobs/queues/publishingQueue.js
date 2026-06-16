import { Queue } from 'bullmq'
import { getRedisClient, checkRedisAvailable } from '../../config/redis.js'

let publishingQueue = null

/**
 * Get or create the Publishing Queue.
 * Handles scheduled content publishing for all platforms:
 *   - twitter-post
 *   - linkedin-post
 *   - instagram-post (future)
 */
export function getPublishingQueue() {
  if (publishingQueue) return publishingQueue
  if (!checkRedisAvailable()) return null

  try {
    const connection = getRedisClient()

    publishingQueue = new Queue('publishing', {
      connection,
      defaultJobOptions: {
        attempts: Number(process.env.QUEUE_MAX_RETRIES) || 3,
        backoff: {
          type: 'exponential',
          delay: Number(process.env.QUEUE_RETRY_BACKOFF_MS) || 30000,
        },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 },
      },
    })

    console.log('[PublishingQueue] Initialized successfully.')
  } catch (err) {
    console.warn(`[PublishingQueue] Failed to initialize: ${err.message}`)
    publishingQueue = null
  }

  return publishingQueue
}
