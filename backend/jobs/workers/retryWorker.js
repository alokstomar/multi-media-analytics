import { Worker } from 'bullmq'
import { getRedisClient } from '../../config/redis.js'
import { getPublishingQueue } from '../queues/publishingQueue.js'
import { getRetryDelay } from '../queues/retryQueue.js'
import mongoose from 'mongoose'

let worker = null

/**
 * Start the retry worker.
 *
 * Processes dead-letter jobs from the 'retry' queue:
 *   - Re-enqueues failed jobs back into the publishing queue
 *   - Tracks retry count with escalating delays (1m → 5m → 15m)
 *   - Updates ScheduledJob model with failure details
 *   - Stops after max retries (configurable via SCHEDULER_MAX_RETRIES, default 3)
 */
export function startRetryWorker() {
  const connection = getRedisClient()
  const maxRetries = Number(process.env.SCHEDULER_MAX_RETRIES) || 3

  worker = new Worker('retry', async (job) => {
    const {
      postId, platform, scheduledPostId, publishingJobId, scheduledJobId,
      originalError, originalStack, failedAt,
    } = job.data

    console.log(`[RetryWorker] Processing dead-letter job ${job.id} (original error: ${originalError || 'unknown'})`)

    // Track retry attempt on ScheduledJob
    let scheduledJobRecord
    if (scheduledJobId) {
      const ScheduledJob = mongoose.model('ScheduledJob')
      scheduledJobRecord = await ScheduledJob.findById(scheduledJobId)
    }

    const currentRetries = scheduledJobRecord ? scheduledJobRecord.retries : job.attemptsMade

    if (currentRetries >= maxRetries) {
      console.warn(`[RetryWorker] Job ${job.id} has exhausted ${maxRetries} retries. Marking as permanently failed.`)

      if (scheduledJobRecord) {
        scheduledJobRecord.status = 'failed'
        scheduledJobRecord.error = `Permanently failed after ${maxRetries} retries. Last error: ${originalError || 'unknown'}`
        scheduledJobRecord.stackTrace = originalStack || ''
        await scheduledJobRecord.save()
      }

      return { status: 'permanently-failed', retries: currentRetries }
    }

    // Calculate delay for this retry attempt
    const delay = getRetryDelay(currentRetries)
    console.log(`[RetryWorker] Scheduling retry #${currentRetries + 1} with ${delay}ms delay`)

    // Update ScheduledJob
    if (scheduledJobRecord) {
      scheduledJobRecord.status = 'delayed'
      scheduledJobRecord.retries = currentRetries + 1
      scheduledJobRecord.error = `Retry #${currentRetries + 1} scheduled. Previous error: ${originalError || 'unknown'}`
      await scheduledJobRecord.save()
    }

    // Re-enqueue into publishing queue with calculated delay
    const publishingQueue = getPublishingQueue()
    if (publishingQueue) {
      await publishingQueue.add(
        `retry-${platform}-${postId}-${currentRetries + 1}`,
        { postId, platform, scheduledPostId, publishingJobId, scheduledJobId },
        { delay }
      )
      console.log(`[RetryWorker] Re-enqueued job for post ${postId} with ${delay}ms delay`)
    } else {
      console.error(`[RetryWorker] Publishing queue unavailable. Cannot re-enqueue job.`)

      if (scheduledJobRecord) {
        scheduledJobRecord.status = 'failed'
        scheduledJobRecord.error = 'Retry failed: publishing queue unavailable'
        await scheduledJobRecord.save()
      }
    }

    return { status: 'retried', attempt: currentRetries + 1, delay }
  }, { connection })

  worker.on('completed', (job) => {
    console.log(`[RetryWorker] Job ${job.id} processed.`)
  })

  worker.on('failed', (job, err) => {
    if (!job) return
    console.error(`[RetryWorker] Job ${job.id} failed: ${err.message}`)
  })

  console.log(`[RetryWorker] Started (max retries: ${maxRetries}).`)
  return worker
}

/**
 * Gracefully close the retry worker.
 */
export async function closeRetryWorker() {
  if (worker) {
    await worker.close()
    worker = null
  }
}
