import { Queue } from 'bullmq'
import { getRedisClient, checkRedisAvailable } from '../../config/redis.js'

let automationQueue = null

/**
 * Get or create the Automation Queue.
 * Handles automation rule execution and AI job types:
 *   - Weekly LinkedIn post
 *   - Daily Twitter thread
 *   - Repurpose YouTube video
 *   - AI-generated content campaigns
 *
 * Supported AI job types:
 *   - generate-linkedin-post
 *   - generate-thread
 *   - generate-content-ideas
 *   - repurpose-content
 */
export function getAutomationQueue() {
  if (automationQueue) return automationQueue
  if (!checkRedisAvailable()) return null

  try {
    const connection = getRedisClient()

    automationQueue = new Queue('automation', {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 10000, // 10s retry for automation rules
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    })

    console.log('[AutomationQueue] Initialized successfully.')
  } catch (err) {
    console.warn(`[AutomationQueue] Failed to initialize: ${err.message}`)
    automationQueue = null
  }

  return automationQueue
}
