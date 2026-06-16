import { Worker } from 'bullmq'
import { getRedisClient, checkRedisAvailable } from '../../config/redis.js'
import mongoose from 'mongoose'
import { startPublishingWorker } from '../publishing/worker.js'

let publishingWorker = null
let retryWorker = null
let automationWorker = null

export function startQueueWorkers() {
  const isRedis = checkRedisAvailable()
  
  if (!isRedis) {
    console.log('[QueueWorker] Redis is NOT available. Falling back to simple MongoDB polling worker.')
    startPublishingWorker()
    return
  }

  const connection = getRedisClient()
  const concurrency = Number(process.env.QUEUE_PUBLISH_CONCURRENCY) || 3

  console.log(`[QueueWorker] Initializing BullMQ workers (concurrency: ${concurrency})...`)

  // 1. Publishing Worker
  publishingWorker = new Worker('publishing', async (job) => {
    const { postId, platform, scheduledPostId, publishingJobId } = job.data
    console.log(`[QueueWorker:publishing] Processing job ${job.id} for post ${postId} on ${platform}`)

    const Post = mongoose.model('Post')
    const ScheduledPost = mongoose.model('ScheduledPost')
    const PublishingJob = mongoose.model('PublishingJob')

    let jobRecord
    if (publishingJobId) {
      jobRecord = await PublishingJob.findById(publishingJobId)
    }

    if (jobRecord) {
      jobRecord.status = 'processing'
      jobRecord.attempts = job.attemptsMade + 1
      jobRecord.lastAttempt = new Date()
      await jobRecord.save()
    }

    const post = await Post.findById(postId)
    if (!post) {
      throw new Error(`Post not found in database: ${postId}`)
    }

    // Call mock providers
    const { LinkedinProvider } = await import('../../providers/linkedinProvider.js')
    const { TwitterProvider } = await import('../../providers/twitterProvider.js')
    const providers = {
      linkedin: new LinkedinProvider(),
      twitter: new TwitterProvider()
    }

    const provider = providers[platform]
    let result

    if (provider) {
      result = await provider.publish(post)
    } else {
      console.log(`[QueueWorker:publishing] Platform ${platform} has no provider. Using mock delay.`)
      await new Promise((resolve) => setTimeout(resolve, 500))
      result = {
        success: true,
        platformPostId: `mock_${platform}_${Date.now()}`,
        platformResponse: { simulated: true, publishedAt: new Date().toISOString() }
      }
    }

    if (result.success) {
      console.log(`[QueueWorker:publishing] Job ${job.id} completed successfully!`)
      post.status = 'published'
      post.publishedAt = new Date()
      post.platformPostId = result.platformPostId
      post.platformResponse = result.platformResponse || { simulated: true }
      await post.save()

      if (scheduledPostId) {
        await ScheduledPost.findByIdAndUpdate(scheduledPostId, {
          status: 'completed',
          publishedAt: new Date()
        })
      }

      if (jobRecord) {
        jobRecord.status = 'completed'
        jobRecord.completedAt = new Date()
        await jobRecord.save()
      }

      return result
    } else {
      throw new Error(result.error || 'Provider failed to publish')
    }
  }, {
    connection,
    concurrency,
    limiter: {
      max: 10,
      duration: 60000 // rate limiting to respect API limits (10 jobs/min)
    }
  })

  publishingWorker.on('completed', (job) => {
    console.log(`[QueueWorker:publishing] Job ${job.id} completed successfully.`)
  })

  publishingWorker.on('failed', async (job, err) => {
    if (!job) return
    console.error(`[QueueWorker:publishing] Job ${job.id} failed: ${err.message}`)
    
    const PublishingJob = mongoose.model('PublishingJob')
    const ScheduledPost = mongoose.model('ScheduledPost')
    const Post = mongoose.model('Post')

    const { postId, scheduledPostId, publishingJobId } = job.data

    let jobRecord
    if (publishingJobId) {
      jobRecord = await PublishingJob.findById(publishingJobId)
    }

    const maxRetries = Number(process.env.QUEUE_MAX_RETRIES) || 3
    if (job.attemptsMade >= maxRetries) {
      console.warn(`[QueueWorker:publishing] Job ${job.id} exhausted all ${maxRetries} retries. Moving to failed state.`)
      
      if (jobRecord) {
        jobRecord.status = 'failed'
        jobRecord.error = err.message
        await jobRecord.save()
      }

      await Post.findByIdAndUpdate(postId, {
        status: 'failed',
        platformResponse: { error: err.message }
      })

      if (scheduledPostId) {
        await ScheduledPost.findByIdAndUpdate(scheduledPostId, {
          status: 'failed',
          error: err.message
        })
      }

      // Add to dead letter queue
      const { retryQueue } = await import('./queues.js').then(m => m.getQueues())
      if (retryQueue) {
        await retryQueue.add(`dead-letter-${job.id}`, job.data, {
          delay: 300000 // 5 minutes backoff
        })
      }
    } else {
      if (jobRecord) {
        jobRecord.status = 'pending'
        jobRecord.error = err.message
        // estimate backoff time
        const backoffMs = (Number(process.env.QUEUE_RETRY_BACKOFF_MS) || 30000) * Math.pow(2, job.attemptsMade)
        jobRecord.runAt = new Date(Date.now() + backoffMs)
        await jobRecord.save()
      }
    }
  })

  // 2. Retry Worker
  retryWorker = new Worker('retry', async (job) => {
    console.log(`[QueueWorker:retry] Attempting to recover failed job ${job.id}`)
    const { postId, platform, scheduledPostId, publishingJobId } = job.data
    const { publishNow } = await import('./queueService.js')
    await publishNow({ postId, platform, scheduledPostId, publishingJobId })
  }, { connection })

  // 3. Automation Worker
  automationWorker = new Worker('automation', async (job) => {
    const { ruleId, platform, action } = job.data
    console.log(`[QueueWorker:automation] Running automation rule ${ruleId} for ${platform}`)
    await new Promise(r => setTimeout(r, 1000))
    console.log(`[QueueWorker:automation] Automation rule ${ruleId} executed successfully`)
  }, { connection })

  // Register shutdown handlers
  process.on('SIGTERM', async () => {
    await shutdown()
  })
  process.on('SIGINT', async () => {
    await shutdown()
  })
}

async function shutdown() {
  console.log('[QueueWorker] Shutting down workers gracefully...')
  if (publishingWorker) await publishingWorker.close()
  if (retryWorker) await retryWorker.close()
  if (automationWorker) await automationWorker.close()
}
