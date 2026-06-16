import mongoose from 'mongoose'
import { checkRedisAvailable, getRedisClient } from '../config/redis.js'
import { getPublishingQueue } from '../jobs/queues/publishingQueue.js'
import { getAutomationQueue } from '../jobs/queues/automationQueue.js'
import { getRetryQueue } from '../jobs/queues/retryQueue.js'
import Post from '../models/Post.js'
import ScheduledPost from '../models/ScheduledPost.js'
import PublishingJob from '../models/PublishingJob.js'
import ScheduledJob from '../models/ScheduledJob.js'
import ProviderFactory from './publishing/providerFactory.js'

/**
 * Schedule a post for future publishing via BullMQ.
 *
 * @param {Object} params
 * @param {string} params.platform
 * @param {string} [params.accountId]
 * @param {Object} [params.content]
 * @param {Object} [params.media]
 * @param {string|Date} params.scheduledFor
 * @param {string} [params.createdBy]
 * @param {string} [params.postId]
 * @param {string} params.workspaceId - active workspace ID
 * @returns {Object} { scheduledJob, post, publishingJob, bullmqJobId }
 */
export async function schedulePost({ platform, accountId, content, media, scheduledFor, createdBy, postId, workspaceId }) {
  const scheduleDate = new Date(scheduledFor)
  const delay = Math.max(0, scheduleDate.getTime() - Date.now())

  // Validate Instagram media before queueing
  if (platform === 'instagram') {
    const provider = ProviderFactory.getProvider('instagram')
    const rawMedia = content?.mediaUrls || content?.media || media || []
    const contentType = content?.contentType || (media?.type) || (Array.isArray(rawMedia) && rawMedia.length > 1 ? 'carousel' : 'image')
    provider.validateMedia(rawMedia, contentType)
  }

  // 1. Create or find the Post
  let post
  if (postId) {
    post = await Post.findOne({ _id: postId, workspaceId })
    if (!post) throw new Error(`Post not found: ${postId}`)
  } else {
    const typeMap = {
      twitter: 'tweet',
      linkedin: 'thought-leadership',
      instagram: 'reel-caption',
    }
    post = await Post.create({
      platform,
      type: typeMap[platform] || 'post',
      status: 'scheduled',
      content: content || { fullText: '' },
      scheduledAt: scheduleDate,
      channelId: accountId || '',
      workspaceId,
    })
  }

  // Update post status
  post.status = 'scheduled'
  post.scheduledAt = scheduleDate
  await post.save()

  // 2. Create ScheduledPost record
  const scheduledRecord = await ScheduledPost.create({
    post: post._id,
    platform,
    scheduledAt: scheduleDate,
    status: 'pending',
    workspaceId,
  })

  // 3. Create PublishingJob record
  const jobRecord = await PublishingJob.create({
    post: post._id,
    platform,
    scheduledPost: scheduledRecord._id,
    status: 'pending',
    runAt: scheduleDate,
    workspaceId,
  })

  // Link back
  scheduledRecord.publishJob = jobRecord._id
  await scheduledRecord.save()

  // 4. Determine job type
  const jobTypeMap = {
    twitter: 'twitter-post',
    linkedin: 'linkedin-post',
    instagram: 'instagram-post',
  }

  // 5. Create ScheduledJob record
  const scheduledJob = await ScheduledJob.create({
    platform,
    accountId: accountId || '',
    jobType: jobTypeMap[platform] || 'twitter-post',
    status: delay > 0 ? 'delayed' : 'waiting',
    payload: { content, media, postId: post._id.toString() },
    scheduledFor: scheduleDate,
    post: post._id,
    publishingJob: jobRecord._id,
    createdBy: createdBy || 'system',
    workspaceId,
  })

  // 6. Enqueue to BullMQ
  let bullmqJobId = null
  const publishingQueue = getPublishingQueue()

  if (publishingQueue) {
    const bullJob = await publishingQueue.add(
      `publish-${platform}-${post._id}`,
      {
        postId: post._id.toString(),
        platform,
        scheduledPostId: scheduledRecord._id.toString(),
        publishingJobId: jobRecord._id.toString(),
        scheduledJobId: scheduledJob._id.toString(),
      },
      {
        delay,
        jobId: jobRecord._id.toString(),
      }
    )
    bullmqJobId = bullJob.id

    scheduledJob.bullmqJobId = bullmqJobId
    await scheduledJob.save()

    console.log(`[SchedulerService] Post ${post._id} scheduled for ${scheduleDate.toISOString()} (delay: ${delay}ms, BullMQ ID: ${bullmqJobId})`)
  } else {
    console.log(`[SchedulerService] Redis unavailable. Post ${post._id} scheduled via MongoDB fallback.`)
  }

  return {
    scheduledJob,
    post: post.toObject(),
    publishingJob: jobRecord.toObject(),
    bullmqJobId,
  }
}

/**
 * Cancel a scheduled post.
 *
 * @param {string} jobId - ScheduledJob ID
 * @param {string} workspaceId - active workspace ID
 */
export async function cancelScheduledPost(jobId, workspaceId) {
  const scheduledJob = await ScheduledJob.findOne({ _id: jobId, workspaceId })
  if (!scheduledJob) throw new Error(`ScheduledJob not found: ${jobId}`)

  // Remove from BullMQ
  if (scheduledJob.bullmqJobId) {
    const publishingQueue = getPublishingQueue()
    if (publishingQueue) {
      const bullJob = await publishingQueue.getJob(scheduledJob.bullmqJobId)
      if (bullJob) {
        await bullJob.remove()
        console.log(`[SchedulerService] Removed BullMQ job ${scheduledJob.bullmqJobId}`)
      }
    }
  }

  // Update ScheduledJob
  scheduledJob.status = 'cancelled'
  await scheduledJob.save()

  // Update related records
  if (scheduledJob.post) {
    await Post.findOneAndUpdate({ _id: scheduledJob.post, workspaceId }, { status: 'draft', scheduledAt: null })
  }
  if (scheduledJob.publishingJob) {
    await PublishingJob.findOneAndUpdate({ _id: scheduledJob.publishingJob, workspaceId }, { status: 'failed', error: 'Cancelled by user' })
  }

  console.log(`[SchedulerService] Cancelled scheduled job ${jobId}`)
  return scheduledJob
}

/**
 * Reschedule a post to a new time.
 *
 * @param {string} jobId
 * @param {string|Date} newScheduledFor
 * @param {string} workspaceId
 */
export async function reschedulePost(jobId, newScheduledFor, workspaceId) {
  const scheduledJob = await ScheduledJob.findOne({ _id: jobId, workspaceId })
  if (!scheduledJob) throw new Error(`ScheduledJob not found: ${jobId}`)

  const newDate = new Date(newScheduledFor)
  const delay = Math.max(0, newDate.getTime() - Date.now())

  // Remove old BullMQ job
  if (scheduledJob.bullmqJobId) {
    const publishingQueue = getPublishingQueue()
    if (publishingQueue) {
      const oldJob = await publishingQueue.getJob(scheduledJob.bullmqJobId)
      if (oldJob) {
        await oldJob.remove()
      }
    }
  }

  // Create new BullMQ job
  let newBullmqJobId = null
  const publishingQueue = getPublishingQueue()

  if (publishingQueue) {
    const newJob = await publishingQueue.add(
      `publish-${scheduledJob.platform}-${scheduledJob.post}-reschedule`,
      {
        postId: scheduledJob.post?.toString(),
        platform: scheduledJob.platform,
        scheduledPostId: null,
        publishingJobId: scheduledJob.publishingJob?.toString(),
        scheduledJobId: scheduledJob._id.toString(),
      },
      { delay }
    )
    newBullmqJobId = newJob.id
  }

  // Update ScheduledJob
  scheduledJob.scheduledFor = newDate
  scheduledJob.status = delay > 0 ? 'delayed' : 'waiting'
  scheduledJob.bullmqJobId = newBullmqJobId || scheduledJob.bullmqJobId
  scheduledJob.error = ''
  scheduledJob.retries = 0
  await scheduledJob.save()

  // Update Post
  if (scheduledJob.post) {
    await Post.findOneAndUpdate({ _id: scheduledJob.post, workspaceId }, { scheduledAt: newDate, status: 'scheduled' })
  }

  // Update PublishingJob
  if (scheduledJob.publishingJob) {
    await PublishingJob.findOneAndUpdate({ _id: scheduledJob.publishingJob, workspaceId }, { runAt: newDate, status: 'pending' })
  }

  console.log(`[SchedulerService] Rescheduled job ${jobId} to ${newDate.toISOString()} (delay: ${delay}ms)`)
  return scheduledJob
}

/**
 * Retry a failed job.
 *
 * @param {string} jobId
 * @param {string} workspaceId
 */
export async function retryFailedJob(jobId, workspaceId) {
  const scheduledJob = await ScheduledJob.findOne({ _id: jobId, workspaceId })
  if (!scheduledJob) throw new Error(`ScheduledJob not found: ${jobId}`)

  const publishingQueue = getPublishingQueue()
  if (!publishingQueue) {
    throw new Error('Publishing queue unavailable (Redis not connected)')
  }

  const newJob = await publishingQueue.add(
    `retry-manual-${scheduledJob.platform}-${scheduledJob.post}`,
    {
      postId: scheduledJob.post?.toString(),
      platform: scheduledJob.platform,
      publishingJobId: scheduledJob.publishingJob?.toString(),
      scheduledJobId: scheduledJob._id.toString(),
    }
  )

  scheduledJob.status = 'waiting'
  scheduledJob.bullmqJobId = newJob.id
  scheduledJob.retries = 0
  scheduledJob.error = ''
  scheduledJob.stackTrace = ''
  await scheduledJob.save()

  console.log(`[SchedulerService] Retrying failed job ${jobId} (new BullMQ ID: ${newJob.id})`)
  return scheduledJob
}

/**
 * Get comprehensive queue metrics.
 *
 * @param {string} workspaceId
 */
export async function getQueueMetrics(workspaceId) {
  const isRedis = checkRedisAvailable()
  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const queryMatch = workspaceId ? { workspaceId: new mongoose.Types.ObjectId(workspaceId) } : {}

  const [jobsLast24Hours, oldestPending, allJobs, avgDuration] = await Promise.all([
    ScheduledJob.countDocuments({ ...queryMatch, createdAt: { $gte: last24h } }),
    ScheduledJob.findOne({ ...queryMatch, status: { $in: ['waiting', 'delayed'] } }).sort({ scheduledFor: 1 }).lean(),
    ScheduledJob.aggregate([
      ...(workspaceId ? [{ $match: { workspaceId: new mongoose.Types.ObjectId(workspaceId) } }] : []),
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    ScheduledJob.aggregate([
      { $match: { ...queryMatch, executionDurationMs: { $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$executionDurationMs' } } },
    ]),
  ])

  // Build status counts
  const statusCounts = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, cancelled: 0 }
  allJobs.forEach(({ _id, count }) => {
    if (statusCounts.hasOwnProperty(_id)) {
      statusCounts[_id] = count
    }
  })

  const totalFinished = statusCounts.completed + statusCounts.failed
  const successRate = totalFinished > 0
    ? `${Math.round((statusCounts.completed / totalFinished) * 100)}%`
    : '100%'

  const avgExecMs = avgDuration[0]?.avg
  const avgExecutionTime = avgExecMs != null ? `${Math.round(avgExecMs)}ms` : 'N/A'

  // BullMQ-specific metrics (if Redis available)
  let redisInfo = { connected: false, mode: 'fallback-mongodb' }
  let bullmqMetrics = null

  if (isRedis) {
    redisInfo = { connected: true, mode: 'bullmq' }

    try {
      const connection = getRedisClient()
      const info = await connection.info()
      const memMatch = info.match(/used_memory_human:([^\r\n]+)/)
      const uptimeMatch = info.match(/uptime_in_seconds:([^\r\n]+)/)

      if (memMatch) redisInfo.memory = memMatch[1]
      if (uptimeMatch) {
        const seconds = parseInt(uptimeMatch[1], 10)
        const hours = Math.floor(seconds / 3600)
        redisInfo.uptime = hours > 0 ? `${hours}h` : `${seconds}s`
      }
    } catch (err) {
      console.warn(`[SchedulerService] Could not fetch Redis info: ${err.message}`)
    }

    // Get BullMQ queue counts
    const getQueueCounts = async (queueGetter, name) => {
      const queue = queueGetter()
      if (!queue) return null
      try {
        const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed')
        return { name, ...counts }
      } catch {
        return null
      }
    }

    const [pubCounts, autoCounts, retryCounts] = await Promise.all([
      getQueueCounts(getPublishingQueue, 'publishing'),
      getQueueCounts(getAutomationQueue, 'automation'),
      getQueueCounts(getRetryQueue, 'retry'),
    ])

    bullmqMetrics = { publishing: pubCounts, automation: autoCounts, retry: retryCounts }
  }

  return {
    redis: redisInfo,
    queued: statusCounts.waiting + statusCounts.delayed,
    processing: statusCounts.active,
    completed: statusCounts.completed,
    failed: statusCounts.failed,
    cancelled: statusCounts.cancelled,
    successRate,
    avgExecutionTime,
    oldestPendingJob: oldestPending
      ? {
          id: oldestPending._id,
          platform: oldestPending.platform,
          jobType: oldestPending.jobType,
          scheduledFor: oldestPending.scheduledFor,
          createdAt: oldestPending.createdAt,
        }
      : null,
    jobsLast24Hours,
    bullmq: bullmqMetrics,
  }
}

/**
 * List scheduled jobs with optional filters.
 */
export async function getJobs({ status, platform, limit = 50, workspaceId } = {}) {
  const query = { workspaceId }
  if (status) query.status = status
  if (platform) query.platform = platform

  return ScheduledJob.find(query)
    .sort({ scheduledFor: -1 })
    .limit(Number(limit))
    .populate('post', 'platform type status content scheduledAt')
    .lean()
}
