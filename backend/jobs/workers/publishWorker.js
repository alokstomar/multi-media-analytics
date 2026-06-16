import { Worker } from 'bullmq'
import { getRedisClient } from '../../config/redis.js'
import mongoose from 'mongoose'
import { getRetryQueue } from '../queues/retryQueue.js'
import ProviderFactory from '../../services/publishing/providerFactory.js'
import TwitterAccount from '../../models/TwitterAccount.js'
import LinkedInAccount from '../../models/LinkedInAccount.js'
import InstagramAccount from '../../models/InstagramAccount.js'
import PublishedPost from '../../models/PublishedPost.js'

let worker = null

/**
 * Start the publishing worker.
 */
export function startPublishWorker() {
  const connection = getRedisClient()
  const concurrency = Number(process.env.QUEUE_PUBLISH_CONCURRENCY) || 3

  worker = new Worker('publishing', async (job) => {
    const { postId, platform, scheduledPostId, publishingJobId, scheduledJobId } = job.data
    const startTime = Date.now()
    console.log(`[PublishWorker] Processing job ${job.id} for post ${postId} on ${platform}`)

    const Post = mongoose.model('Post')
    const ScheduledPost = mongoose.model('ScheduledPost')
    const PublishingJob = mongoose.model('PublishingJob')
    const ScheduledJob = mongoose.model('ScheduledJob')

    // 1. Update PublishingJob status → processing
    let pubJobRecord
    if (publishingJobId) {
      pubJobRecord = await PublishingJob.findById(publishingJobId)
      if (pubJobRecord) {
        pubJobRecord.status = 'processing'
        pubJobRecord.attempts = job.attemptsMade + 1
        pubJobRecord.lastAttempt = new Date()
        await pubJobRecord.save()
      }
    }

    // 2. Update ScheduledJob status → active
    let scheduledJobRecord
    if (scheduledJobId) {
      scheduledJobRecord = await ScheduledJob.findById(scheduledJobId)
      if (scheduledJobRecord) {
        scheduledJobRecord.status = 'active'
        scheduledJobRecord.executedAt = new Date()
        await scheduledJobRecord.save()
      }
    }

    // 3. Find the post
    const post = await Post.findById(postId)
    if (!post) {
      throw new Error(`Post not found in database: ${postId}`)
    }

    // 4. Update Post lifecycle status → queued
    post.status = 'queued'
    await post.save()

    // 5. Find the connected account
    let account = null
    let AccountModel = null
    const accountId = scheduledJobRecord?.accountId || post.channelId

    if (!accountId) {
      const err = new Error(`No connected account ID provided for post: ${postId}`)
      err.errorType = 'validation_error'
      throw err
    }

    if (platform === 'twitter') {
      AccountModel = TwitterAccount
    } else if (platform === 'linkedin') {
      AccountModel = LinkedInAccount
    } else if (platform === 'instagram') {
      AccountModel = InstagramAccount
    } else {
      const err = new Error(`Unsupported publishing platform: ${platform}`)
      err.errorType = 'validation_error'
      throw err
    }

    account = await AccountModel.findById(accountId).select('+accessToken +refreshToken')
    if (!account) {
      const err = new Error(`Connected account not found: ${accountId} on platform: ${platform}`)
      err.errorType = 'validation_error'
      throw err
    }

    // 6. Resolve provider from factory
    const provider = ProviderFactory.getProvider(platform)

    // 7. Validate token and refresh if invalid
    let isTokenValid = await provider.validateAccount(account)
    if (!isTokenValid) {
      console.log(`[PublishWorker] Access token for account ${account._id} is invalid/expired. Attempting auto-refresh...`)
      try {
        await provider.refreshToken(account)
        // Reload account credentials
        account = await AccountModel.findById(accountId).select('+accessToken +refreshToken')
        isTokenValid = await provider.validateAccount(account)
        if (!isTokenValid) {
          throw new Error('Auto-refresh completed but token remains invalid')
        }
        console.log(`[PublishWorker] Auto-refresh successful for account ${account._id}`)
      } catch (refreshErr) {
        const err = new Error(`Authentication token expired and auto-refresh failed: ${refreshErr.message}`)
        err.errorType = 'auth_error'
        throw err
      }
    }

    // 8. Update Post lifecycle status → publishing
    post.status = 'publishing'
    await post.save()

    // 9. Publish post
    const result = await provider.publishPost(post, account)
    const executionDurationMs = Date.now() - startTime

    if (result.success) {
      console.log(`[PublishWorker] Job ${job.id} completed successfully in ${executionDurationMs}ms!`)

      // 10. Create PublishedPost record (extended fields for Phase 4E)
      const fullTextContent = post.content.fullText || `${post.content.hook || ''}\n\n${post.content.body || ''}\n\n${post.content.cta || ''}`.trim()
      await PublishedPost.create({
        platform,
        accountId: account._id.toString(),
        content: fullTextContent,
        providerPostId: result.platformPostId,
        status: 'published',
        publishedAt: new Date(),
        responsePayload: result.platformResponse,
        scheduledJobId: scheduledJobRecord?._id,
        executionDurationMs,
        retryCount: job.attemptsMade,
        publishSource: 'bullmq',
        publishedBy: scheduledJobRecord?.createdBy || 'system',
      })

      // 11. Update Post lifecycle status → published
      post.status = 'published'
      post.publishedAt = new Date()
      post.platformPostId = result.platformPostId
      post.platformResponse = result.platformResponse
      await post.save()

      // 12. Update ScheduledPost
      if (scheduledPostId) {
        await ScheduledPost.findByIdAndUpdate(scheduledPostId, {
          status: 'completed',
          publishedAt: new Date(),
        })
      }

      // 13. Update PublishingJob
      if (pubJobRecord) {
        pubJobRecord.status = 'completed'
        pubJobRecord.completedAt = new Date()
        pubJobRecord.error = ''
        await pubJobRecord.save()
      }

      // 14. Update ScheduledJob
      if (scheduledJobRecord) {
        scheduledJobRecord.status = 'completed'
        scheduledJobRecord.completedAt = new Date()
        scheduledJobRecord.executionDurationMs = executionDurationMs
        scheduledJobRecord.error = ''
        scheduledJobRecord.stackTrace = ''
        scheduledJobRecord.errorCode = ''
        scheduledJobRecord.errorMessage = ''
        scheduledJobRecord.errorType = ''
        scheduledJobRecord.providerResponse = result.platformResponse
        await scheduledJobRecord.save()
      }

      return result
    } else {
      // Store API response failure directly onto the error details
      const errorObj = new Error(result.error || 'Provider failed to publish')
      errorObj.errorCode = result.response?.error_code || result.response?.error || 'PUBLISH_API_ERROR'
      errorObj.errorMessage = result.error || 'Provider returned success: false'
      errorObj.errorType = result.errorType || 'provider_error'
      errorObj.providerResponse = result.response || null
      throw errorObj
    }
  }, {
    connection,
    concurrency,
    limiter: {
      max: 10,
      duration: 60000,
    },
  })

  // ── Event Handlers ──────────────────────────────────────────────────

  worker.on('completed', (job) => {
    console.log(`[PublishWorker] Job ${job.id} completed.`)
  })

  worker.on('failed', async (job, err) => {
    if (!job) return
    console.error(`[PublishWorker] Job ${job.id} failed: ${err.message}`)

    const { postId, scheduledPostId, publishingJobId, scheduledJobId } = job.data
    const maxRetries = Number(process.env.QUEUE_MAX_RETRIES) || 3

    try {
      const Post = mongoose.model('Post')
      const ScheduledPost = mongoose.model('ScheduledPost')
      const PublishingJob = mongoose.model('PublishingJob')
      const ScheduledJob = mongoose.model('ScheduledJob')

      let pubJobRecord
      if (publishingJobId) {
        pubJobRecord = await PublishingJob.findById(publishingJobId)
      }

      // Update ScheduledJob on failure
      if (scheduledJobId) {
        const sjRecord = await ScheduledJob.findById(scheduledJobId)
        if (sjRecord) {
          sjRecord.retries = job.attemptsMade
          sjRecord.error = err.message
          sjRecord.stackTrace = err.stack || ''
          
          // Store provider errors if thrown from provider
          sjRecord.errorCode = err.errorCode || 'WORKER_INTERNAL_ERROR'
          sjRecord.errorMessage = err.errorMessage || err.message
          sjRecord.errorType = err.errorType || 'provider_error'
          sjRecord.providerResponse = err.providerResponse || null

          if (job.attemptsMade >= maxRetries) {
            sjRecord.status = 'failed'
          } else {
            sjRecord.status = 'delayed'
          }
          await sjRecord.save()
        }
      }

      if (job.attemptsMade >= maxRetries) {
        console.warn(`[PublishWorker] Job ${job.id} exhausted all ${maxRetries} retries. Moving to dead letter.`)

        // Mark PublishingJob as failed
        if (pubJobRecord) {
          pubJobRecord.status = 'failed'
          pubJobRecord.error = err.message
          await pubJobRecord.save()
        }

        // Mark Post as failed
        await Post.findByIdAndUpdate(postId, {
          status: 'failed',
          platformResponse: {
            error: err.message,
            errorCode: err.errorCode,
            errorMessage: err.errorMessage,
            errorType: err.errorType || 'provider_error',
            providerResponse: err.providerResponse
          },
        })

        // Mark ScheduledPost as failed
        if (scheduledPostId) {
          await ScheduledPost.findByIdAndUpdate(scheduledPostId, {
            status: 'failed',
            error: err.message,
          })
        }

        // Route to dead-letter retry queue
        const retryQueue = getRetryQueue()
        if (retryQueue) {
          await retryQueue.add(`dead-letter-${job.id}`, {
            ...job.data,
            originalError: err.message,
            originalStack: err.stack || '',
            errorCode: err.errorCode,
            errorMessage: err.errorMessage,
            errorType: err.errorType || 'provider_error',
            providerResponse: err.providerResponse,
            failedAt: new Date().toISOString(),
          }, {
            delay: 300000,
          })
        }
      } else {
        // Job will auto-retry via BullMQ backoff
        if (pubJobRecord) {
          pubJobRecord.status = 'pending'
          pubJobRecord.error = err.message
          const backoffMs = (Number(process.env.QUEUE_RETRY_BACKOFF_MS) || 30000) * Math.pow(2, job.attemptsMade)
          pubJobRecord.runAt = new Date(Date.now() + backoffMs)
          await pubJobRecord.save()
        }
      }
    } catch (updateErr) {
      console.error(`[PublishWorker] Error updating failure state: ${updateErr.message}`)
    }
  })

  console.log(`[PublishWorker] Started (concurrency: ${concurrency}, rate limit: 10/min).`)
  return worker
}

/**
 * Gracefully close the publishing worker.
 */
export async function closePublishWorker() {
  if (worker) {
    await worker.close()
    worker = null
  }
}
