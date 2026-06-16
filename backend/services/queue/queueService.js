import { getQueues } from './queues.js'
import { checkRedisAvailable } from '../../config/redis.js'
import mongoose from 'mongoose'

/**
 * Schedule a post for future publishing
 */
export async function schedulePublish({ postId, platform, scheduledAt, scheduledPostId, publishingJobId }) {
  const isRedis = checkRedisAvailable()
  const runAt = new Date(scheduledAt)
  const delay = Math.max(0, runAt.getTime() - Date.now())

  console.log(`[QueueService] Scheduling publish for post ${postId} on ${platform} at ${runAt.toISOString()} (delay: ${delay}ms, Redis: ${isRedis})`)

  if (isRedis) {
    const { publishingQueue } = getQueues()
    if (publishingQueue) {
      const job = await publishingQueue.add(
        `publish-${platform}-${postId}`,
        { postId, platform, scheduledPostId, publishingJobId },
        { 
          delay,
          jobId: publishingJobId ? publishingJobId.toString() : undefined
        }
      )
      console.log(`[QueueService] BullMQ Job enqueued successfully: ID=${job.id}`)
      return { type: 'bullmq', jobId: job.id }
    }
  }

  console.log(`[QueueService] Redis not available. Falling back to MongoDB scheduler.`)
  return { type: 'mongodb' }
}

/**
 * Publish a post immediately
 */
export async function publishNow({ postId, platform, scheduledPostId, publishingJobId }) {
  const isRedis = checkRedisAvailable()
  console.log(`[QueueService] Publishing immediately for post ${postId} on ${platform} (Redis: ${isRedis})`)

  if (isRedis) {
    const { publishingQueue } = getQueues()
    if (publishingQueue) {
      const job = await publishingQueue.add(
        `publish-now-${platform}-${postId}`,
        { postId, platform, scheduledPostId, publishingJobId },
        {
          jobId: publishingJobId ? publishingJobId.toString() : undefined
        }
      )
      console.log(`[QueueService] BullMQ Immediate Job enqueued successfully: ID=${job.id}`)
      return { type: 'bullmq', jobId: job.id }
    }
  }

  // Fallback: run publishing logic in background immediately
  setTimeout(async () => {
    try {
      const Post = mongoose.model('Post')
      const ScheduledPost = mongoose.model('ScheduledPost')
      const PublishingJob = mongoose.model('PublishingJob')

      let jobRecord
      if (publishingJobId) {
        jobRecord = await PublishingJob.findById(publishingJobId)
      }

      const post = await Post.findById(postId)
      if (!post) return

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
        await new Promise(r => setTimeout(r, 500))
        result = { success: true, platformPostId: `mock_${platform}_${Date.now()}` }
      }

      if (result.success) {
        post.status = 'published'
        post.publishedAt = new Date()
        post.platformPostId = result.platformPostId
        post.platformResponse = result.platformResponse || { simulated: true }
        await post.save()

        if (scheduledPostId) {
          await ScheduledPost.findByIdAndUpdate(scheduledPostId, { status: 'completed', publishedAt: new Date() })
        }
        if (jobRecord) {
          jobRecord.status = 'completed'
          jobRecord.completedAt = new Date()
          await jobRecord.save()
        }
      } else {
        post.status = 'failed'
        post.platformResponse = { error: result.error }
        await post.save()

        if (scheduledPostId) {
          await ScheduledPost.findByIdAndUpdate(scheduledPostId, { status: 'failed', error: result.error })
        }
        if (jobRecord) {
          jobRecord.status = 'failed'
          jobRecord.error = result.error
          await jobRecord.save()
        }
      }
    } catch (err) {
      console.error('[QueueService] Fallback immediate execution failed:', err)
    }
  }, 0)

  return { type: 'fallback' }
}

/**
 * Enqueue automation rule execution
 */
export async function enqueueAutomation({ ruleId, platform, action }) {
  const isRedis = checkRedisAvailable()
  console.log(`[QueueService] Enqueueing automation rule ${ruleId} for ${platform} (Redis: ${isRedis})`)

  if (isRedis) {
    const { automationQueue } = getQueues()
    if (automationQueue) {
      const job = await automationQueue.add(`automation-${ruleId}`, { ruleId, platform, action })
      return { type: 'bullmq', jobId: job.id }
    }
  }

  // Fallback: run simulated automation response
  setTimeout(async () => {
    console.log(`[QueueService] Fallback: Executing automation rule ${ruleId} in background`)
  }, 1000)

  return { type: 'fallback' }
}

/**
 * Retry a failed job (BullMQ retry or direct fallback trigger)
 */
export async function retryJob(jobId) {
  const isRedis = checkRedisAvailable()
  console.log(`[QueueService] Retrying job ${jobId} (Redis: ${isRedis})`)

  if (isRedis) {
    const { publishingQueue } = getQueues()
    if (publishingQueue) {
      const job = await publishingQueue.getJob(jobId)
      if (job) {
        await job.retry()
        return { success: true, type: 'bullmq' }
      }
    }
  }

  // Fallback to updating in MongoDB so the old poller or immediate fallback triggers it
  try {
    const PublishingJob = mongoose.model('PublishingJob')
    const job = await PublishingJob.findById(jobId)
    if (job) {
      job.status = 'pending'
      job.attempts = 0
      job.runAt = new Date()
      await job.save()
      return { success: true, type: 'mongodb-reset' }
    }
  } catch {}

  return { success: false, type: 'fallback' }
}
