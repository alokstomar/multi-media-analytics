import { checkRedisAvailable } from '../config/redis.js'
import { getPublishingQueue } from './queues/publishingQueue.js'
import { getAutomationQueue } from './queues/automationQueue.js'
import { getRetryQueue } from './queues/retryQueue.js'
import { startPublishWorker, closePublishWorker } from './workers/publishWorker.js'
import { startAutomationWorker, closeAutomationWorker } from './workers/automationWorker.js'
import { startRetryWorker, closeRetryWorker } from './workers/retryWorker.js'
import { startTwitterAutomationWorker, closeTwitterAutomationWorker } from './workers/twitterAutomationWorker.js'
import { startPublishingWorker } from '../services/publishing/worker.js'

/**
 * Central Scheduler Orchestrator
 *
 * Initializes all BullMQ queues and starts all workers.
 * Falls back to MongoDB polling worker if Redis is unavailable.
 *
 * This is the primary startup path — called from server.js.
 */
export function initScheduler() {
  const isRedis = checkRedisAvailable()

  if (!isRedis) {
    console.log('[Scheduler] Redis is NOT available. Falling back to MongoDB polling worker.')
    startPublishingWorker()
    // Also start Twitter automation in on-demand mode
    startTwitterAutomationWorker()
    return
  }

  console.log('[Scheduler] ════════════════════════════════════════════════')
  console.log('[Scheduler] Initializing Production Scheduling Engine...')
  console.log('[Scheduler] ════════════════════════════════════════════════')

  // 1. Initialize Queues
  const pubQ = getPublishingQueue()
  const autoQ = getAutomationQueue()
  const retQ = getRetryQueue()

  const queueStatus = [
    pubQ ? '✓ Publishing Queue' : '✗ Publishing Queue (failed)',
    autoQ ? '✓ Automation Queue' : '✗ Automation Queue (failed)',
    retQ ? '✓ Retry Queue' : '✗ Retry Queue (failed)',
  ]
  queueStatus.forEach(s => console.log(`[Scheduler]   ${s}`))

  // 2. Start Workers
  console.log('[Scheduler] Starting workers...')
  startPublishWorker()
  startAutomationWorker()
  startRetryWorker()
  startTwitterAutomationWorker()

  console.log('[Scheduler] ════════════════════════════════════════════════')
  console.log('[Scheduler] Production Scheduling Engine is LIVE.')
  console.log('[Scheduler] ════════════════════════════════════════════════')

  // 3. Register graceful shutdown
  const shutdown = async () => {
    console.log('[Scheduler] Shutting down workers gracefully...')
    await Promise.all([
      closePublishWorker(),
      closeAutomationWorker(),
      closeRetryWorker(),
      closeTwitterAutomationWorker(),
    ])
    console.log('[Scheduler] All workers closed.')
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

