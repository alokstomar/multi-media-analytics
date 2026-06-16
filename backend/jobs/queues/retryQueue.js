import { Queue } from 'bullmq'
import { getRedisClient, checkRedisAvailable } from '../../config/redis.js'

let retryQueue = null

// Escalating retry delays: 1 minute → 5 minutes → 15 minutes
const DEFAULT_RETRY_DELAYS = [60000, 300000, 900000]

/**
 * Parse retry delays from env or use defaults.
 * Format: "60000,300000,900000"
 */
function getRetryDelays() {
  const envDelays = process.env.SCHEDULER_RETRY_DELAYS
  if (envDelays) {
    return envDelays.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d))
  }
  return DEFAULT_RETRY_DELAYS
}

/**
 * Get the delay for a given retry attempt (0-indexed).
 * Returns the last delay value if attempt exceeds array length.
 */
export function getRetryDelay(attempt) {
  const delays = getRetryDelays()
  return delays[Math.min(attempt, delays.length - 1)]
}

/**
 * Get or create the Retry Queue.
 * Dead-letter queue for jobs that have exhausted retries.
 *
 * Retry schedule:
 *   Attempt 1: 1 minute
 *   Attempt 2: 5 minutes
 *   Attempt 3: 15 minutes
 *
 * Max retries: configurable via SCHEDULER_MAX_RETRIES (default 3)
 *
 * Stores per failure:
 *   - failure reason
 *   - stack trace
 *   - timestamp
 */
export function getRetryQueue() {
  if (retryQueue) return retryQueue
  if (!checkRedisAvailable()) return null

  try {
    const connection = getRedisClient()

    retryQueue = new Queue('retry', {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 300000, // 5 min default for dead-letter re-execution
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    })

    console.log('[RetryQueue] Initialized successfully.')
  } catch (err) {
    console.warn(`[RetryQueue] Failed to initialize: ${err.message}`)
    retryQueue = null
  }

  return retryQueue
}
