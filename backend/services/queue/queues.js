import { Queue } from 'bullmq'
import { getRedisClient, checkRedisAvailable } from '../../config/redis.js'

let publishingQueue = null
let retryQueue = null
let automationQueue = null

export function getQueues() {
  if (!checkRedisAvailable()) {
    return {
      publishingQueue: null,
      retryQueue: null,
      automationQueue: null
    }
  }

  const connection = getRedisClient()

  // Default options for robust execution and retries
  const defaultPublishingOpts = {
    attempts: Number(process.env.QUEUE_MAX_RETRIES) || 3,
    backoff: {
      type: 'exponential',
      delay: Number(process.env.QUEUE_RETRY_BACKOFF_MS) || 30000,
    },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 }
  }

  if (!publishingQueue) {
    try {
      publishingQueue = new Queue('publishing', {
        connection,
        defaultJobOptions: defaultPublishingOpts
      })
    } catch (err) {
      console.warn(`[Queue] Failed to initialize publishing queue: ${err.message}`)
    }
  }

  if (!retryQueue) {
    try {
      retryQueue = new Queue('retry', {
        connection,
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: 'fixed',
            delay: 300000 // 5 minutes delay for dead-letter retry
          },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 200 }
        }
      })
    } catch (err) {
      console.warn(`[Queue] Failed to initialize retry queue: ${err.message}`)
    }
  }

  if (!automationQueue) {
    try {
      automationQueue = new Queue('automation', {
        connection,
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: 'fixed',
            delay: 10000 // 10s retry for automation rules
          },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 200 }
        }
      })
    } catch (err) {
      console.warn(`[Queue] Failed to initialize automation queue: ${err.message}`)
    }
  }

  return {
    publishingQueue,
    retryQueue,
    automationQueue
  }
}
